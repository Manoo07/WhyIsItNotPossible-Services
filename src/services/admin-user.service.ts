import type { Prisma, UserAccountStatus, UserRole } from "@prisma/client";
import * as userDao from "../dao/user.dao.js";
import * as postDao from "../dao/post.dao.js";
import * as followDao from "../dao/follow.dao.js";
import * as reportDao from "../dao/report.dao.js";
import * as auditService from "./audit.service.js";
import { toPublicUser } from "./user.service.js";
import { NotFoundError, BadRequestError } from "../lib/errors.js";

export interface ListAdminUsersInput {
  page: number;
  limit: number;
  search: string;
  status: string;
  role: string;
}

export async function listUsers(params: ListAdminUsersInput) {
  const { page, limit, search, status, role } = params;
  const conditions: Prisma.UserWhereInput[] = [];

  if (search) {
    conditions.push({
      OR: [
        { username: { contains: search, mode: "insensitive" } },
        { displayName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  if (status) {
    conditions.push({ status: status as UserAccountStatus });
  }
  if (role) {
    conditions.push({ role: role as UserRole });
  }

  const where: Prisma.UserWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const [users, total] = await Promise.all([
    userDao.findMany(where, { createdAt: "desc" }, { skip: (page - 1) * limit, take: limit }),
    userDao.count(where),
  ]);

  const enriched = await Promise.all(
    users.map(async (u) => {
      const [postCount, reportsReceived] = await Promise.all([
        postDao.count({ authorId: u.id }),
        reportDao.count({ targetType: "user", targetId: u.id }),
      ]);
      return { ...toPublicUser(u), postCount, reportsReceived };
    }),
  );

  return { users: enriched, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

// Moderation history is NOT bundled inline (previously an unbounded
// findMany()) — see listUserModerationHistory below, its own paginated
// sub-resource.
export async function getUserDetail(id: number) {
  const user = await userDao.findById(id);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const [postCount, followerCount, followingCount, reportsReceived, reportsSubmitted] = await Promise.all([
    postDao.count({ authorId: id }),
    followDao.countFollowers(id),
    followDao.countFollowing(id),
    reportDao.count({ targetType: "user", targetId: id }),
    reportDao.count({ reporterId: id }),
  ]);

  return {
    ...toPublicUser(user),
    stats: {
      totalPosts: postCount,
      followers: followerCount,
      following: followingCount,
      reportsReceived,
      reportsSubmitted,
    },
  };
}

export function listUserModerationHistory(userId: number, page: number, limit: number) {
  return auditService.listForTarget("user", userId, page, limit);
}

export interface UpdateUserStatusInput {
  status: "active" | "restricted" | "suspended" | "deleted";
  reason: string;
  durationHours?: number | null;
  note?: string | null;
}

const STATUS_ACTION_NAME: Record<UpdateUserStatusInput["status"], string> = {
  active: "RESTORE_USER",
  restricted: "RESTRICT_USER",
  suspended: "SUSPEND_USER",
  deleted: "DELETE_USER",
};

export async function updateStatus(adminId: number, userId: number, input: UpdateUserStatusInput) {
  const user = await userDao.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }
  if (!input.reason || !input.reason.trim()) {
    throw new BadRequestError("A reason is required for this action");
  }

  const suspendedUntil =
    input.status === "suspended" && input.durationHours ? new Date(Date.now() + input.durationHours * 60 * 60 * 1000) : null;

  const updated = await userDao.update(userId, {
    status: input.status,
    statusReason: input.reason,
    suspendedUntil,
    // Immediately invalidates any session the user already holds — required
    // for suspension/restriction/deletion to actually take effect right
    // away rather than at next natural session expiry (FRS §16, §23).
    ...(input.status !== "active" ? { sessionVersion: { increment: 1 } } : {}),
  });

  await auditService.recordAction({
    adminId,
    action: STATUS_ACTION_NAME[input.status],
    targetType: "user",
    targetId: userId,
    reason: input.reason,
    note: input.note,
  });

  return toPublicUser(updated);
}

export interface UpdateUserRoleInput {
  role: UserRole;
  reason: string;
}

const ROLE_ACTION_NAME: Record<UserRole, string> = {
  owner: "SET_ROLE_OWNER",
  author: "SET_ROLE_AUTHOR",
  reader: "SET_ROLE_READER",
};

// This is the "verified by admin" gate the FRS asks for: a reader can't
// hit POST /api/posts at all (requireRole("owner", "author") already
// blocks it) until an admin promotes them here. No separate
// "isVerified" flag — role already is the verification state, and adding
// a second overlapping flag would just create a case where the two
// disagree.
export async function updateRole(adminId: number, userId: number, input: UpdateUserRoleInput) {
  const user = await userDao.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }
  if (!input.reason || !input.reason.trim()) {
    throw new BadRequestError("A reason is required for this action");
  }
  if (user.role === input.role) {
    return toPublicUser(user);
  }

  const updated = await userDao.update(userId, { role: input.role });

  await auditService.recordAction({
    adminId,
    action: ROLE_ACTION_NAME[input.role],
    targetType: "user",
    targetId: userId,
    reason: input.reason,
  });

  return toPublicUser(updated);
}

export async function forceLogout(adminId: number, userId: number, reason?: string) {
  const user = await userDao.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  await userDao.update(userId, { sessionVersion: { increment: 1 } });

  await auditService.recordAction({
    adminId,
    action: "FORCE_LOGOUT",
    targetType: "user",
    targetId: userId,
    reason: reason ?? "Manual force logout",
  });

  return { success: true };
}
