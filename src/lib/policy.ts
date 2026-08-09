// Single source of truth for the "is this user an owner/author" and
// "does this user own this resource" checks that were previously copied
// inline at each call site (post.service.ts, follow.service.ts,
// auth.middleware.ts). See docs/codebase-architecture-review.md #1.

export function isAuthorRole(user: { role: string } | null | undefined): boolean {
  return user?.role === "author" || user?.role === "owner";
}

export function isOwnerOrAuthorOf(
  user: { id: number; role: string },
  resource: { authorId: number },
): boolean {
  return user.role === "owner" || resource.authorId === user.id;
}
