# Admin Console — Scope Decisions

The Admin Content Operations Console FRS was written for a media platform
(multi-media/video posts, per-media processing pipeline, an existing
report/moderation system, account verification). This app is a text blog
with a single cover image per post and none of that infrastructure. Rather
than build fictional plumbing to match the FRS literally, scope was
narrowed with the user up front. This doc records what was decided and why,
so the reasoning doesn't have to be reverse-engineered from the diff later.

## Media (§8–10, §28)

**Skipped as a separate entity.** There is no Media table, no processing
pipeline, no thumbnails/derivatives, no video. A post's cover image is
managed through Post Detail, per the FRS's own §33 guidance: promote to a
dedicated Media screen "when operational volume requires it." Nothing here
blocks adding one later — `Post.coverImageUrl` is unaffected by this build.

## Reports & Moderation Queue (§11–14)

**Built for real, but merged into one system.** The FRS treats "Reports"
and "Moderation Queue" as related-but-separate concepts (queue items can
also come from automated moderation, spam detection, account-risk systems).
None of those other sources exist in this app, so the moderation queue
*is* the reports list, filtered to open/under-review items — matching the
FRS's own §33 MVP screen list, which already combines them into one
screen ("Reports / Moderation Queue"). A `Report` model was added, plus a
real consumer-facing "Report" action (post/comment/user), so the queue
isn't backed by a screen with no way to populate it.

Skipped: SLA timers, automated priority scoring, bulk operations. Priority
is admin-set (`critical | high | medium | low`), not computed.

## Account Suspension (§16, §23)

**Built with real enforcement**, not just a UI-visible flag:
`User.status` (`active | restricted | suspended | deleted`) is checked
against the database on every authenticated request
(`middleware/auth.middleware.ts`), not just read from the session cookie —
this app's sessions are process-local with no shared store, so re-checking
per request is what makes a suspension take effect immediately instead of
only at the session's natural expiry. A `sessionVersion` counter, bumped on
suspend/restrict/delete/force-logout, invalidates already-issued sessions
the same way.

Simplification: `restricted` currently blocks authenticated access the same
way `suspended` does. The FRS doesn't specify exactly what a "restricted"
account can still do (read-only? no posting? no commenting?), and building
a granular per-route restriction system wasn't asked for — this can be
narrowed later once that's defined, without a schema change.

Timed suspensions (`suspendedUntil`) auto-expire back to `active` the next
time the account is checked — no cron job required for the MVP.

## Admin Role (§22)

**Reused the existing `owner` role** as the FRS's `SUPER_ADMIN` rather than
adding a parallel role. `owner` already functions as this app's top
privilege level everywhere else (category management, moderating any
comment, etc.). `requireAdmin` in `auth.middleware.ts` is just a named
alias for `requireRole("owner")`.

## Content Removal (§15)

**Soft-delete for Post and Comment** (`removedAt`/`removalReason`),
deliberately kept as a separate state from `PostStatus`
(draft/published) — the FRS is explicit about this (§30): a post can be
published *and* removed at the same time. Physical deletion is out of
scope, matching §15's own recommendation ("physical deletion should be
handled by a separate retention/deletion process").

User "Delete account" (§5) is also soft — `status: "deleted"` — not an
actual `DELETE FROM users`, for the same reversibility reasoning applied
consistently.

## Not built

MFA, CSRF tokens, rate limiting, idempotency keys for mutation APIs, bulk
operations, cursor-based pagination (used offset/skip — dataset sizes here
don't yet warrant the added complexity). These are real §23/§24/§20
requirements for a production system at scale; flagging them as explicitly
deferred rather than silently absent.
