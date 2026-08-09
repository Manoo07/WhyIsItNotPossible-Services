# Architecture Review: Author Follow & Notification System

**Reviewer stance:** senior engineer / architect, extensibility-focused. This is not a
bug review — the implementation fully satisfies the FRS it was built against (follow,
per-author email opt-out, global opt-out, publish-only trigger, idempotent
duplicate-prevention, batched async fanout). Every finding below is about what breaks
or gets awkward the moment the product grows past "one notification type, one
delivery channel." Nothing here should block shipping the current scope.

**Files in scope:**
`prisma/schema.prisma` (`AuthorFollow`, `Notification`, `NotificationType`,
`NotificationStatus`), `src/queues/notification.queue.ts`,
`src/services/notification.service.ts`, `src/services/follow.service.ts`,
`src/dao/follow.dao.ts`, `src/dao/notification.dao.ts`,
`src/workers/notification-fanout.worker.ts`, `src/workers/notification-email.worker.ts`,
`src/worker.ts`.

---

## Summary of findings

| # | Finding | Priority | Effort |
|---|---|---|---|
| 1 | Notification "type" and "delivery channel" are conflated and hardcoded | P0 | M |
| 2 | Per-follow toggle can't express per-type preferences | P0 | S |
| 3 | Email templates are inline strings in the service function | P1 | S |
| 4 | Queue/worker pair is bespoke to "new post published" | P0 | M |
| 5 | Follower-eligibility rule is duplicated logic, not a reusable predicate | P1 | S |
| 6 | Fanout is coupled directly to `Post`, not a generic "publish event" | P1 | M |
| 7 | Worker registration is manual/imperative in `worker.ts` | P2 | S |
| 8 | Tuning constants are scattered across files with no central config | P2 | S |
| 9 | Zero automated test coverage on idempotency/batching logic | P0 | M |
| 10 | Observability is log-only — no metrics/event hooks | P2 | S |
| 11 | No in-app notification surface, only email delivery status | P2 | L |

---

## 1. Notification type and delivery channel are conflated (P0)

**Current state.** `NotificationType` (`prisma/schema.prisma:21-23`) has exactly one
member, `new_post`, and nothing in the schema represents *how* the notification was
delivered — `processSendEmail` in `notification.service.ts:71-123` just assumes email.
The `Notification` row, the fanout worker, and the email worker are all written as if
"notification" and "email" are the same concept.

**Why it limits extensibility.** The moment a second notification type shows up
(comment replies, mentions, a weekly digest) or a second channel shows up (in-app bell,
push, SMS), there's no slot to put it in. Someone will either bolt on `if (type ===
...)` branches inside `processSendEmail`, or copy-paste the whole
queue → worker → service triplet per type. Both paths compound linearly with every new
notification the product adds.

**Recommended change.**
- Add a `channel` enum to `Notification`: `email | in_app` (start with just these two;
  `push`/`sms` can be added later without a migration shape change).
- Expand `NotificationType` as new types are added (e.g. `new_post`, `comment_reply`,
  `mention`) — additive, no migration risk to existing rows since it's already an enum
  column with a default.
- Replace the single `notification-email` queue with one queue per **channel**
  (`notification-email`, later `notification-in-app`), each with a worker that is
  generic across *types*. The type-specific part (what the message says) moves into a
  small per-type registry (see §3), not into the worker.

```prisma
enum NotificationChannel {
  email
  in_app
}

model Notification {
  // ...existing fields
  channel NotificationChannel @default(email)
}
```

This keeps `processSendEmail` as "render + send whatever this notification's type
registry says," instead of a function that has to know about every type by name.

---

## 2. Per-follow notification toggle doesn't generalize (P0)

**Current state.** `AuthorFollow.notificationEnabled` (`schema.prisma:64`) is a single
boolean covering "does this follower get emailed." `findEligibleFollowersBatch`
(`follow.dao.ts:46-58`) filters directly on that one column plus
`user.emailNotificationsGlobal`.

**Why it limits extensibility.** This is fine as long as "follow an author" means
exactly one kind of notification. Once there's a second notification type tied to the
same follow relationship (e.g. "notify me of new posts" vs. "notify me when they go
live" vs. a future "weekly digest instead of per-post"), one boolean can't represent
independent choices. Rebuilding this later means a schema migration *and* an API
migration (`PATCH .../notification-preference` currently takes a single `enabled`
boolean — `validation.ts` `UpdateNotificationPreferenceBody`).

**Recommended change.** Keep `AuthorFollow.notificationEnabled` exactly as-is — it's
the correct coarse default and matches the FRS precisely, don't touch it. Add an
**additive, optional override table** for when finer granularity is actually needed:

```prisma
model NotificationTypePreference {
  id       Int              @id @default(autoincrement())
  userId   Int              @map("user_id")
  authorId Int              @map("author_id")
  type     NotificationType
  enabled  Boolean

  @@unique([userId, authorId, type])
  @@map("notification_type_preferences")
}
```

Eligibility becomes: "does a row exist here for this (user, author, type)? use it.
Otherwise fall back to `AuthorFollow.notificationEnabled`." No existing behavior
changes until a second `NotificationType` actually exists and something starts writing
to this table — it's dead weight until needed, which is why this is scoped as "add the
table when the second type ships," not now.

---

## 3. Email templates are inline strings (P1)

**Current state.** Subject/text/html are built inline inside `processSendEmail`
(`notification.service.ts:85-109`) with template literals, specific to the "new post"
copy from FRS §6.

**Why it limits extensibility.** Every new `NotificationType` means another branch of
inline string-building crammed into the same function, and there's no single place to
apply cross-cutting concerns (a shared header/footer, i18n, unsubscribe-link
consistency, preview-text, plain-text/HTML parity) once there's more than one template.

**Recommended change.** One small module per type, all implementing the same shape:

```ts
// src/notifications/templates/types.ts
export interface NotificationEmailContext {
  recipientEmail: string;
  authorName: string;
  preferencesUrl: string;
}
export interface EmailContent { subject: string; text: string; html: string; }
export type EmailTemplate<T> = (ctx: NotificationEmailContext & T) => EmailContent;

// src/notifications/templates/new-post.template.ts
export const newPostEmail: EmailTemplate<{ postTitle: string; postUrl: string }> = (ctx) => ({ ... });

// src/notifications/templates/index.ts
export const emailTemplates: Record<NotificationType, EmailTemplate<any>> = {
  new_post: newPostEmail,
};
```

`processSendEmail` shrinks to: look up `notification.type` in `emailTemplates`, build
the context, call it, send. It stops needing to change when a new type is added.

---

## 4. Queue/worker pair is bespoke to "new post published" (P0)

**Current state.** `FanoutJobData` is `{ postId: number }` and `EmailJobData` is
`{ notificationId: number }` (`notification.queue.ts:7-13`). `processFanout` hardcodes
a `postDao.findById` lookup and a "must be published" check
(`notification.service.ts:17-26`) as the only way into the fanout path.

**Why it limits extensibility.** Any future "author does X, notify followers" flow
(a new post *type*, or a completely different trigger like "author started a live
session") needs its own fanout entry point today, because `processFanout` only knows
how to resolve a `postId` into an author and eligible followers. The follower-batching
and `addBulk` logic — which is the actually reusable, hard-won part (see §22 of the
FRS on performance) — is entangled with the Post-specific lookup.

**Recommended change.** Split `processFanout` into a generic half and a type-specific
half:

```ts
// generic — batches followers, creates Notification rows, bulk-queues email jobs.
// Doesn't know what a "post" is.
async function fanOutToFollowers(params: {
  authorId: number;
  type: NotificationType;
  buildNotificationRow: (userId: number) => PendingNotificationInput;
}): Promise<{ eligible: number; queued: number }> { ... }

// type-specific — the only thing that changes when a new trigger is added.
export async function processNewPostFanout(postId: number) {
  const post = await requirePublishedPost(postId); // existing guard, unchanged
  return fanOutToFollowers({
    authorId: post.authorId,
    type: "new_post",
    buildNotificationRow: (userId) => ({ userId, authorId: post.authorId, postId }),
  });
}
```

A future second trigger writes one function like `processNewPostFanout`, reusing
`fanOutToFollowers` — not a second copy of the batching loop.

---

## 5. Follower-eligibility rule is duplicated logic (P1)

**Current state.** The eligibility rule — "following, per-author notifications on,
global notifications on" — exists exactly once, as a Prisma `where` clause inline in
`findEligibleFollowersBatch` (`follow.dao.ts:46-58`). That's good today. The risk is
structural: nothing marks this as *the* eligibility rule, so it's one edit-in-place away
from silently diverging the next time someone needs "who's eligible for X" from a
different entry point (an admin preview tool, a "how many people will see this"
count shown to the author before they hit Publish, a digest job).

**Recommended change.** No schema change needed — just name the concept so it can't be
quietly reimplemented:

```ts
// follow.dao.ts
export function eligibilityWhere(authorId: number, type: NotificationType = "new_post"): Prisma.AuthorFollowWhereInput {
  return { authorId, notificationEnabled: true, user: { emailNotificationsGlobal: true } };
}
```

`findEligibleFollowersBatch` and any future caller both build off
`eligibilityWhere(...)`, so when §2's per-type override table lands, there's exactly
one function to update.

---

## 6. Fanout is coupled to `Post` (P1)

Related to §4, but worth calling out separately: `processFanout` imports
`postDao` directly and treats "publishable content" as synonymous with "blog post."
If the product ever notifies followers about something that isn't a `Post` row, the
generic/type-specific split in §4 is what makes that tractable — this entry is just
flagging that the split shouldn't stop at "one more `if`" the second time, or the same
coupling reappears one level down.

**Recommended change.** Covered by §4's `fanOutToFollowers` extraction — no separate
action beyond making sure the next trigger is added as a new thin function, not a new
branch inside the existing one.

---

## 7. Worker registration is manual (P2)

**Current state.** `src/worker.ts:9-10` directly imports and calls
`startFanoutWorker()` / `startEmailWorker()`. Fine at two workers.

**Recommended change.** Once a third queue exists (e.g. an in-app-notification
worker from §1), switch to a registry so `worker.ts` doesn't grow a new import + call
+ shutdown-array entry per queue:

```ts
// src/workers/index.ts
export const workerFactories = [startFanoutWorker, startEmailWorker];

// worker.ts
const workers = workerFactories.map((start) => start());
...
await Promise.all(workers.map((w) => w.close()));
```

---

## 8. Tuning constants are scattered (P2)

`FANOUT_BATCH_SIZE = 500` (`notification.service.ts:8`), retry `attempts: 3` /
`backoff.delay: 5000` (`notification.service.ts:50-51`), and the email worker's
concurrency/rate-limit env vars (`notification-email.worker.ts:10-12`) all live in
different files with different conventions (const vs. env-with-default).

**Recommended change.** One `src/config/notifications.config.ts` exporting all of it as
a single typed object, read from env once, defaults documented in one place instead of
three. Not urgent — do this when the second consumer of these numbers shows up (e.g.
an admin dashboard that wants to display current batch/retry settings), not before.

---

## 9. Zero automated test coverage (P0)

**Current state.** The correctness properties this system depends on — idempotent
follow/unfollow (`follow.dao.ts:9-22`), the `skipDuplicates` duplicate-prevention
(`notification.dao.ts:14-20`), the "only the draft→published transition fires a
notification" guard in `post.service.ts`, and the cursor pagination in
`findEligibleFollowersBatch` — were all verified once, manually, via curl during
development. None of it is pinned down by a test.

**Why it matters for extensibility.** Every recommendation above (splitting
`processFanout`, adding a channel/type dimension, adding the override-preference table)
touches this exact code. Without tests, each of those refactors is a manual
re-verification pass against a live Postgres+Redis, same as the one that happened
during initial development — that doesn't scale as the surface area grows.

**Recommended change.** Minimum viable coverage before any of §1–§6 are attempted:
- Unit tests (mocked Prisma) for `follow.service.ts`: follow-twice is idempotent,
  unfollow-twice is idempotent, self-follow rejected, preference update on a
  non-followed author is rejected.
- Unit test for `notification.dao.createPendingBatch`: given two calls with an
  overlapping `(userId, postId, type)`, the second returns zero rows for the overlap.
- Unit test for `post.service.ts`: publishing (`create` with `status: published`,
  and `update` draft→published) calls the fanout enqueue exactly once; editing an
  already-published post does not.
- One integration test (real local Postgres + Redis, same as this session's manual
  verification) that runs `processFanout` end-to-end and asserts the queued job count
  matches the eligible-follower count for a batch spanning more than one page (i.e.
  `FANOUT_BATCH_SIZE + 1` followers), to pin down the cursor-pagination boundary.

---

## 10. Observability is log-only (P2)

`notification.service.ts` logs eligible-follower and emails-queued counts
(`:64-67`) and the email worker logs failures (`notification-email.worker.ts:27-32`),
which satisfies FRS §24's observability list today. There's no metrics/counter hook,
so wiring up Prometheus/Datadog/OTel later means editing business logic to insert
calls, rather than attaching an exporter.

**Recommended change.** A single no-op-by-default hook:

```ts
// src/lib/metrics.ts
export function recordMetric(name: string, value = 1, tags?: Record<string, string>) {
  // no-op until a real exporter is wired in
}
```

Call it alongside the existing `logger.info` calls in `processFanout` /
`processSendEmail`. Zero behavior change today; a future metrics backend becomes a
one-file change instead of a business-logic change.

---

## 11. No in-app notification surface (P2, larger effort)

The `Notification` table already has everything needed to drive an in-app "bell" UI
(recipient, type, created-at) except a `readAt`/`channel` marker. This is explicitly
out of scope for the FRS that was implemented (email-only), but is the natural next
step once §1's `channel` field exists — an `in_app` notification is a row with
`channel: in_app` and no email ever gets sent for it. Flagging so the §1 schema change
is designed with this in mind rather than needing a second migration when it's built.

---

## What this review is *not* recommending

- Don't change the public API shape (`/authors/:id/follow`, `/me/followed-authors`,
  etc.) — it matches the FRS exactly and none of the above requires touching it.
- Don't introduce a generic pub/sub or event-bus framework. `fanOutToFollowers` as a
  plain function (§4) is sufficient for the number of notification types this product
  is likely to have; a message-bus abstraction would be solving a problem that doesn't
  exist yet.
- Don't rework the BullMQ batching/cursor-pagination design (`follow.dao.ts:46-58`,
  `notification.service.ts:33-62`) — it already does the thing the FRS explicitly
  asked for (batched, not looped, scales to large follower counts) and none of the
  findings above require changing it, only reusing it.

## Suggested sequencing

1. **Now, before touching anything else:** §9 (tests) — pins down current behavior so
   the refactors below can be verified automatically instead of manually.
2. **When the second `NotificationType` is actually being built:** §1 (channel enum),
   §4 (generic fanout split), §3 (template registry) — these three are naturally done
   together, since the second notification type is what forces the generic/specific
   split to exist in the first place.
3. **When the second type needs independent per-author preferences:** §2 (override
   table), §5 (named eligibility predicate).
4. **Opportunistic / low-urgency:** §7, §8, §10, §11 — small, isolated, no reason to
   block on them.
