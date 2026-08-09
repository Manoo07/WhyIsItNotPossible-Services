# Architecture Review: Backend Codebase (whyisitnotpossible-services)

**Reviewer stance:** senior engineer / architect, extensibility-focused — same
methodology as [`notification-system-architecture-review.md`](./notification-system-architecture-review.md),
now extended to the whole backend. Not a bug review: the app works, typechecks clean,
and was manually verified end-to-end. Every finding is about what gets awkward or
requires touching many files at once as the app grows past its current feature set
(single-author-ish blog → many authors, more content types, more roles, more
integrations).

**Scope:** everything under `src/` — auth, posts, categories, tags, comments,
likes/bookmarks, uploads, and the follow/notification system covered in depth in the
companion doc. Read in full for this review: every file in `src/dao`, `src/services`,
`src/controllers`, `src/routes`, `src/middleware`, `src/lib`, plus `prisma/schema.prisma`
and `build.mjs`.

---

## What's already right (don't undo these)

A review that only lists problems is misleading about how much rework is actually
needed, so this up front: the codebase has a genuinely consistent, extensible
foundation already in place.

- **DAO → Service → Controller → Routes is applied uniformly**, without exception,
  across all nine resources (post, user, auth, category, tag, comment, like, bookmark,
  follow). A new resource added by copying `category.*` (the smallest complete
  example) as a template will fit right in.
- **The `AppError` hierarchy + single `errorHandler` middleware**
  (`lib/errors.ts`, `middleware/error.middleware.ts`) means every controller can
  `throw new NotFoundError(...)` and trust it becomes the right HTTP status — no
  route handler does its own try/catch/status-code plumbing. This is the correct shape
  and should be the template for anything new (e.g. a future `RateLimitError`).
- **Lazy external-client initialization** (`lib/s3.ts`, `lib/redis.ts`, `lib/mailer.ts`)
  is applied consistently: the app boots and most features work even if S3/Redis/SMTP
  aren't configured, only failing the specific operation that needs them. New external
  integrations should follow this exact pattern.
- **`sanitizeHtml`'s allowlist is centralized** in one function with a comment
  explaining *why* iframes/scripts aren't there yet ("added incrementally, scoped to
  exact allowlisted hostnames") — that's the right way to leave a door open without
  building it early.

---

## Findings

| # | Finding | Priority | Effort |
|---|---|---|---|
| 1 | Authorization checks are ad hoc `role === "x"` string comparisons, duplicated per call site | P0 | M |
| 2 | Three different pagination strategies coexist with no shared convention | P1 | M |
| 3 | Two parallel upload storage paths (S3 + legacy local-disk) with no common interface | P1 | S |
| 4 | `validation.ts` is a single 1055-line file for every resource's schemas | P2 | M |
| 5 | `post.service.ts` (522 lines) is the only resource service handling multiple unrelated concerns | P1 | M |
| 6 | No environment/config validation at boot — required env vars fail lazily, per-feature, at request time | P2 | S |
| 7 | Sanitizer allowlist is duplicated in `prisma/scrape/sanitize.mjs` | P2 | S |
| 8 | Session-only auth with a flat 3-value role enum | P2 | L (only if/when needed) |

---

## 1. Authorization is ad hoc, duplicated `role === "x"` checks (P0)

**Current state.** The "owner or the resource's own author" check appears
independently, hand-written, in at least four places:

```ts
// post.service.ts:289, :337, :365 (create/update/remove)
const isOwnerOrAuthor = currentUser.role === "owner" || existing.authorId === currentUser.id;

// follow.service.ts:7 (requireAuthor)
if (!author || (author.role !== "author" && author.role !== "owner")) { ... }

// middleware/auth.middleware.ts:12 (requireRole)
if (!roles.includes(req.session.user.role)) { ... }
```

Plus the frontend independently re-derives the identical rule in at least three
places (`user.role === "author" || user.role === "owner"` in `Navbar.tsx`,
`SidebarNav.tsx`, `CreatePost.tsx`/`EditPost.tsx`, `BlogDetail.tsx`'s `canEdit`).

**Why it limits extensibility.** Every one of these is a manually-copied boolean
expression, not a call to a shared function. There's no single place that answers
"can this user edit this post" or "does this user have author-level privileges" — so
adding a fourth role (e.g. `editor`, `moderator`), or changing the rule (e.g. "owners
can edit but not delete other authors' posts"), means grepping for every
hand-rolled copy of the check across two codebases and hoping none were missed. This
is exactly the kind of thing that silently drifts: two of the three backend copies
already use a slightly different shape (`isOwnerOrAuthor` computed inline vs.
`requireAuthor` as a guard that throws).

**Recommended change.** A small policy module, not a framework:

```ts
// src/lib/policy.ts
export function isOwnerOrAuthorOf(user: { id: number; role: string }, resource: { authorId: number }) {
  return user.role === "owner" || resource.authorId === user.id;
}
export function isAuthorRole(user: { role: string }) {
  return user.role === "author" || user.role === "owner";
}
```

Every current call site becomes `isOwnerOrAuthorOf(currentUser, existing)` /
`isAuthorRole(user)`. On the frontend, export the same two predicates from
`@workspace/api-client-react` or a shared `lib/policy.ts` so the rule exists in
exactly one place per repo, not one place per call site. This is a pure refactor —
zero behavior change — which makes it a good candidate to do opportunistically
whenever one of the existing call sites is touched next, rather than as a standalone
project.

---

## 2. Three pagination strategies coexist (P1)

**Current state.**
- `post.service.ts` `list()` (the main post-list endpoint, used by Home/Search/
  CategoryPage/AuthorProfile): fetches **every** matching row with `postDao.findMany`,
  then slices in JS — `posts.slice(offset, offset + limit)`.
- `post.service.ts` `getRelated()`: fetches all published posts, scores/sorts them in
  JS, then slices — same in-memory-pagination shape, justified there by a comment
  ("a personal blog, not a platform-scale catalog").
- `follow.dao.ts` `findEligibleFollowersBatch()` (built for the notification system):
  real DB-level cursor pagination (`cursor`/`skip`/`take`), the only one of the three
  that doesn't load unbounded rows into memory.

**Why it limits extensibility.** The main post list — the highest-traffic read path
in the app — is the one still doing `findMany()` with no `take` and slicing in
application code. That's fine at dozens or hundrends of posts; it stops being fine
well before "platform-scale," and unlike `getRelated()` there's no comment
acknowledging the tradeoff. More importantly for *extensibility* specifically: the
next engineer adding pagination to a new list endpoint has three different examples
in the codebase to copy from and no signal for which one is the sanctioned pattern.

**Recommended change.** Move `list()` to DB-level pagination — Prisma already supports
this identically to what `findEligibleFollowersBatch` proved out:

```ts
// post.dao.ts
export function findMany(where, orderBy, opts?: { skip?: number; take?: number }) {
  return prisma.post.findMany({ where, orderBy, ...opts });
}
export function countWhere(where: Prisma.PostWhereInput) {
  return prisma.post.count({ where });
}
```

`list()` calls `countWhere` for `total` and `findMany` with `skip`/`take` for the page,
instead of loading everything. Leave `getRelated()` as-is (its comment's reasoning —
small catalog, needs full-catalog ranking — is legitimate and documented); the goal is
one *documented* exception, not zero exceptions.

---

## 3. Two parallel upload storage paths (P1)

**Current state.** `upload.service.ts` has `uploadToS3()` (current, used by every new
upload) and `resolveUploadPath()`/`uploadExists()` (legacy local-disk, marked
"kept only so files uploaded before the S3 migration keep working"), wired together
via `upload.controller.ts`'s `serveUpload()` which checks the legacy path only as a
fallback. There's no interface — the controller directly imports and calls
S3-specific functions.

**Why it limits extensibility.** This isn't "should have migrated better" — the
migration comment shows it was a deliberate, reasonable choice. The extensibility gap
is that there's no `StorageProvider` seam, so if a second storage need shows up (e.g.
an already-discussed video/audio upload beyond "images only," or a CDN swap), it's
another bespoke set of functions rather than a second implementation of an existing
interface.

**Recommended change.** Not urgent — do this the next time upload requirements
actually change (video support, a CDN, or S3 credentials rotating to a different
provider), not preemptively:

```ts
export interface StorageProvider {
  upload(file: Express.Multer.File): Promise<string>; // returns public URL
}
export const s3Provider: StorageProvider = { upload: uploadToS3 };
```

`upload.controller.ts` depends on `StorageProvider`, not on `uploadToS3` by name. The
legacy local-disk fallback (`serveUpload`) stays exactly as it is — it's a read path
for old data, not something that needs to fit the same interface.

---

## 4. `validation.ts` is one 1055-line file (P2)

**Current state.** Every resource's Zod schemas — post, user, auth, category, tag,
comment, follow, notification — live in a single `src/lib/validation.ts`, hand-
maintained (see the file's own comments about being partially orval-generated,
partially hand-written like the follow/notification additions and the autosave
schema).

**Why it limits extensibility.** Not a functional problem today — Zod schemas are
cheap and this file typechecks fine. The risk is purely organizational: it's already
over 1000 lines covering 9 resources, and it's the one file every resource's
controller imports from, so it's a permanent commit-conflict hotspot as more
resources are added, and there's no way to tell from the file structure which
schemas are "real" orval output vs. hand-added without reading the inline comments.

**Recommended change.** Split into `src/lib/validation/<resource>.ts` (one file per
resource, matching the DAO/service/controller split that already exists), re-exported
from `src/lib/validation/index.ts` so `import { CreatePostBody } from "../lib/
validation.js"` call sites don't need to change. Do this opportunistically — it's a
mechanical split, not urgent, and shouldn't be done as a big-bang refactor competing
with feature work.

---

## 5. `post.service.ts` handles multiple unrelated concerns (P1)

**Current state.** At 522 lines it's more than 4x the size of the next-largest
service (`follow.service.ts`, 73 lines) and covers: CRUD + publish-gating
(`assertPublishable`), tag syncing, list/search/filter, featured/trending queries,
blog-wide stats (`getStats`), the tag/category-scored recommendation engine
(`getRelated`), comments (`listComments`/`addComment`/`removeComment`), and the
follow-notification publish hook.

**Why it limits extensibility.** Comments live under "post" only because a comment
always belongs to a post — but they're a distinct enough concern (their own future
moderation rules, reply-notification hooks, rate-limiting) that they'll eventually
want their own service the way `follow`/`notification` got their own. Same for
`getStats` (blog-wide, not post-specific — it also reaches into `likeDao`/`userDao`/
`categoryDao`) and `getRelated` (a recommendation algorithm, not CRUD). Keeping them
bundled means every future post-related change touches a 500+ line file with several
unrelated blast radii.

**Recommended change.** Split along the seams that already exist as distinct exported
function groups:
- `comment.service.ts` — `listComments`/`addComment`/`removeComment` (already has
  `comment.dao.ts` as its DAO; only the service layer needs to move).
- `stats.service.ts` — `getStats` (already only reads from other DAOs, doesn't touch
  `post.dao` for anything post-specific).
- `recommendation.service.ts` — `getRelated` (self-contained, already has its own
  well-commented scoring logic).

`post.service.ts` shrinks to what's actually post CRUD + publish-gating + the
follow-notification hook — closer in size to the other resource services, and each
extracted piece can grow its own tests/logic independently. Mechanical, low-risk
refactor (function bodies don't change, only which file they live in and their
imports) — good candidate for a dedicated pass rather than doing it inline with a
feature change.

---

## 6. No boot-time environment validation (P2)

**Current state.** Required env vars are checked lazily and independently:
`SESSION_SECRET` and `PORT` are validated eagerly (`app.ts:9`, `index.ts:6`), but
`DATABASE_URL` throws from inside `lib/prisma.ts` on import, and `AWS_*`/`REDIS_URL`/
`SMTP_*` only throw when a request actually exercises that code path (by design, per
the "lazy" pattern praised above).

**Why it limits extensibility.** The *lazy* part is correct and shouldn't change
(§ "what's already right"). The gap is narrower: there's no single place listing
*all* env vars the app understands, so `.env.example` is the only source of truth for
what's configurable, and it's manually kept in sync by hand (already visibly true —
it was hand-edited three separate times this session, once per feature). A new
contributor has no way to ask "what env vars does this app support" other than
grepping `process.env`.

**Recommended change.** Low-effort, not urgent: a single `src/config/env.ts` that
re-exports every `process.env.X` the app reads as a typed, documented constant (still
lazily throwing exactly where it does today — this isn't about changing the lazy
behavior, just giving it one inventory point instead of scattering `process.env.FOO`
across `lib/s3.ts`, `lib/redis.ts`, `lib/mailer.ts`, `app.ts`, `index.ts`).

---

## 7. Sanitizer allowlist duplicated in the scraper tooling (P2)

**Current state.** `src/lib/sanitize.ts`'s allowlist has a standalone copy in
`prisma/scrape/sanitize.mjs` (built during the content-migration work, per that
directory's own scope — offline, one-off tooling, not part of the running app).

**Why it limits extensibility.** If the app's allowlist changes (e.g. adding an embed
tag per the existing "added incrementally" comment), the scraper's copy silently
goes stale — it only matters the next time the scraper is actually re-run, which
could be a long time from now, at which point the drift is easy to miss.

**Recommended change.** Low priority specifically because `prisma/scrape/` is offline
tooling, not runtime code — but if it's ever re-run, either re-point it at
`src/lib/sanitize.ts` directly (same repo, so it's an import away) or add a one-line
comment in both files cross-referencing the other so a future edit at least gets
flagged for a human to sync manually.

---

## 8. Session-only auth, flat 3-role enum (P2, only if the product needs it)

**Current state.** `UserRole` is `owner | author | reader` (`schema.prisma:10-14`),
auth is cookie/session-based (`express-session`, `req.session.user`), and every
privilege check is a direct comparison against one of those three strings (see § 1).

**Why this is listed at all.** Not a defect — this is a correctly-sized solution for
a single blog with a small number of authors. Flagging only because §1's policy-module
recommendation is the *prerequisite* for ever outgrowing this cheaply: once
`isOwnerOrAuthorOf`/`isAuthorRole` exist as the single source of truth, evolving to a
4th role or to resource-level permissions is a change in two functions instead of an
audit of every call site. Don't build permissions infrastructure ahead of an actual
need for it — this entry exists only to record that § 1 is what keeps that future
option cheap.

---

## What this review is *not* recommending

- Don't switch off session-based auth to JWT/OAuth — nothing here requires it, and the
  session middleware is already correctly configured (`httpOnly`, `secure` in
  production).
- Don't add a permissions/RBAC library — § 1's two-function policy module is
  sufficient for the actual complexity that exists.
- Don't touch the lazy-client pattern (`lib/s3.ts`, `lib/redis.ts`, `lib/mailer.ts`) —
  it's correct and should be the template, not something to "fix."
- Don't migrate away from the hand-maintained `validation.ts`/api-client generation
  approach — splitting the file (§4) is organizational, not a change to how it's
  maintained.

## Suggested sequencing

1. **Opportunistic, do alongside other work, not as a project:** §1 (policy module) —
   small, mechanical, and everything else benefits from it existing first.
2. **Next time the post-list endpoint's performance is looked at:** §2 (DB-level
   pagination for `list()`).
3. **Next time upload requirements change:** §3 (storage interface) — don't build it
   speculatively before there's a second provider to support.
4. **Opportunistic:** §4, §5, §6, §7 — mechanical, low-risk, no reason to block on them
   or bundle them into a single refactor sprint.

See [`notification-system-architecture-review.md`](./notification-system-architecture-review.md)
for the follow/notification subsystem specifically, which has its own deeper set of
findings (notification type/channel modeling, template registry, generic fanout).
