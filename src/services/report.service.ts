import type { Prisma, ReportPriority, ReportStatus, ReportTargetType } from "@prisma/client";
import * as reportDao from "../dao/report.dao.js";
import * as userDao from "../dao/user.dao.js";
import * as postDao from "../dao/post.dao.js";
import * as commentDao from "../dao/comment.dao.js";
import * as auditService from "./audit.service.js";
import * as adminUserService from "./admin-user.service.js";
import * as adminPostService from "./admin-post.service.js";
import * as commentService from "./comment.service.js";
import { toPublicUser } from "./user.service.js";
import { NotFoundError, BadRequestError } from "../lib/errors.js";

export interface SubmitReportInput {
  targetType: "user" | "post" | "comment";
  targetId: number;
  reason: string;
  description?: string;
}

// Resolves the actual reported content so the moderation UI can show it
// inline (FRS §12: "inspect the reported content without leaving the
// moderation workflow") without ever exposing more than each entity's
// public-safe fields (no passwordHash, no raw storage URLs beyond what's
// already public on a post's cover image).
export async function resolveTarget(targetType: "user" | "post" | "comment", targetId: number) {
  if (targetType === "user") {
    const user = await userDao.findById(targetId);
    if (!user) return null;
    return { type: "user" as const, ...toPublicUser(user) };
  }
  if (targetType === "post") {
    const post = await postDao.findById(targetId);
    if (!post) return null;
    return {
      type: "post" as const,
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      coverImageUrl: post.coverImageUrl,
      status: post.status,
      authorId: post.authorId,
      removedAt: post.removedAt?.toISOString() ?? null,
    };
  }
  const comment = await commentDao.findById(targetId);
  if (!comment) return null;
  return {
    type: "comment" as const,
    id: comment.id,
    content: comment.content,
    postId: comment.postId,
    userId: comment.userId,
    removedAt: comment.removedAt?.toISOString() ?? null,
  };
}

export async function submitReport(reporterId: number, input: SubmitReportInput) {
  const target = await resolveTarget(input.targetType, input.targetId);
  if (!target) {
    throw new NotFoundError("The content you're trying to report could not be found");
  }

  return reportDao.create({
    reporterId,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    description: input.description ?? null,
  });
}

export interface ListReportsInput {
  page: number;
  limit: number;
  status: string;
  priority: string;
  targetType: string;
  assignedToId: number | null;
}

export async function listReports(params: ListReportsInput) {
  const { page, limit, status, priority, targetType, assignedToId } = params;
  const conditions: Prisma.ReportWhereInput[] = [];

  if (status) conditions.push({ status: status as ReportStatus });
  if (priority) conditions.push({ priority: priority as ReportPriority });
  if (targetType) conditions.push({ targetType: targetType as ReportTargetType });
  if (assignedToId) conditions.push({ assignedToId });

  const where: Prisma.ReportWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const [reports, total] = await Promise.all([
    reportDao.findMany(where, [{ priority: "asc" }, { createdAt: "asc" }], { skip: (page - 1) * limit, take: limit }),
    reportDao.count(where),
  ]);

  return { reports, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

// Deliberately does NOT bundle related reports or moderation history inline
// — both were previously unbounded findMany() calls with no limit. They're
// their own paginated sub-resources (listRelatedReports /
// listModerationHistory below), fetched by the frontend the same way the
// top-level list screens are: page + limit, never "everything at once."
export async function getReportDetail(id: number) {
  const report = await reportDao.findById(id);
  if (!report) {
    throw new NotFoundError("Report not found");
  }

  const reportedContent = await resolveTarget(report.targetType, report.targetId);

  return { ...report, reportedContent };
}

export async function listRelatedReports(reportId: number, page: number, limit: number) {
  const report = await reportDao.findById(reportId);
  if (!report) {
    throw new NotFoundError("Report not found");
  }

  const [reports, total] = await Promise.all([
    reportDao.findByTarget(report.targetType, report.targetId, { skip: (page - 1) * limit, take: limit, excludeId: reportId }),
    reportDao.countByTarget(report.targetType, report.targetId, reportId),
  ]);

  return { reports, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export function listModerationHistory(reportId: number, page: number, limit: number) {
  return auditService.listForTarget("report", reportId, page, limit);
}

export type ReportDecisionAction =
  | "assign"
  | "dismiss"
  | "escalate"
  | "remove_content"
  | "restore_content"
  | "restrict_user"
  | "suspend_user";

export interface DecideReportInput {
  action: ReportDecisionAction;
  reason?: string;
  note?: string | null;
  assignToId?: number;
  durationHours?: number | null;
}

// Resolves "the user this decision should act on" — either the reported
// user directly, or the author/commenter behind reported content, so
// "suspend the user" works from a post/comment report without the admin
// having to separately look up who posted it.
async function resolveActingUserId(report: NonNullable<Awaited<ReturnType<typeof reportDao.findById>>>): Promise<number | null> {
  if (report.targetType === "user") return report.targetId;
  if (report.targetType === "post") {
    const post = await postDao.findById(report.targetId);
    return post?.authorId ?? null;
  }
  const comment = await commentDao.findById(report.targetId);
  return comment?.userId ?? null;
}

function requireReason(input: DecideReportInput): string {
  if (!input.reason || !input.reason.trim()) {
    throw new BadRequestError("A reason is required for this decision");
  }
  return input.reason;
}

async function resolveReport(adminId: number, reportId: number) {
  return reportDao.update(reportId, { status: "resolved", resolvedAt: new Date(), resolvedById: adminId });
}

export async function decide(adminId: number, reportId: number, input: DecideReportInput) {
  const report = await reportDao.findById(reportId);
  if (!report) {
    throw new NotFoundError("Report not found");
  }

  switch (input.action) {
    case "assign": {
      if (!input.assignToId) {
        throw new BadRequestError("assignToId is required to assign a report");
      }
      const updated = await reportDao.update(reportId, { assignedToId: input.assignToId, status: "under_review" });
      await auditService.recordAction({ adminId, action: "ASSIGN_REPORT", targetType: "report", targetId: reportId, note: input.note });
      return updated;
    }

    case "dismiss": {
      const reason = requireReason(input);
      const updated = await reportDao.update(reportId, { status: "dismissed", resolvedAt: new Date(), resolvedById: adminId });
      await auditService.recordAction({ adminId, action: "DISMISS_REPORT", targetType: "report", targetId: reportId, reason, note: input.note });
      return updated;
    }

    case "escalate": {
      const reason = requireReason(input);
      const updated = await reportDao.update(reportId, { status: "under_review", priority: "critical" });
      await auditService.recordAction({ adminId, action: "ESCALATE_REPORT", targetType: "report", targetId: reportId, reason, note: input.note });
      return updated;
    }

    case "remove_content": {
      const reason = requireReason(input);
      if (report.targetType === "post") {
        await adminPostService.removePost(adminId, report.targetId, { reason, note: input.note });
      } else if (report.targetType === "comment") {
        await commentService.moderationRemove(adminId, report.targetId, reason, input.note);
      } else {
        throw new BadRequestError("remove_content only applies to post or comment reports");
      }
      return resolveReport(adminId, reportId);
    }

    case "restore_content": {
      const reason = requireReason(input);
      if (report.targetType === "post") {
        await adminPostService.restorePost(adminId, report.targetId, { reason, note: input.note });
      } else if (report.targetType === "comment") {
        await commentService.moderationRestore(adminId, report.targetId, reason, input.note);
      } else {
        throw new BadRequestError("restore_content only applies to post or comment reports");
      }
      return resolveReport(adminId, reportId);
    }

    case "restrict_user":
    case "suspend_user": {
      const reason = requireReason(input);
      const actingUserId = await resolveActingUserId(report);
      if (!actingUserId) {
        throw new BadRequestError("Could not resolve which user this decision should act on");
      }
      await adminUserService.updateStatus(adminId, actingUserId, {
        status: input.action === "suspend_user" ? "suspended" : "restricted",
        reason,
        durationHours: input.durationHours,
        note: input.note,
      });
      return resolveReport(adminId, reportId);
    }
  }
}
