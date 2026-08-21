import * as authorApplicationDao from "../dao/author-application.dao.js";
import * as adminUserService from "./admin-user.service.js";
import * as auditService from "./audit.service.js";
import { NotFoundError, BadRequestError } from "../lib/errors.js";

export interface ListAuthorApplicationsInput {
  page: number;
  limit: number;
  status: string;
}

export async function list(params: ListAuthorApplicationsInput) {
  const { page, limit, status } = params;
  const where = status ? { status: status as "pending" | "approved" | "rejected" } : {};

  const [applications, total] = await Promise.all([
    authorApplicationDao.findMany(where, { skip: (page - 1) * limit, take: limit }),
    authorApplicationDao.count(where),
  ]);

  return { applications, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function detail(id: number) {
  const application = await authorApplicationDao.findById(id);
  if (!application) {
    throw new NotFoundError("Application not found");
  }
  return application;
}

export interface DecideInput {
  decision: "approved" | "rejected";
  reason: string;
}

// Approval is deliberately routed through adminUserService.updateRole
// instead of a direct `user.update({ role: "author" })` here — that's the
// one place role promotion happens and gets audited (SET_ROLE_AUTHOR),
// whether an admin clicked "Verify as Author" on the user page or approved
// an application. Rejection has no role side effect, so it logs its own
// audit entry directly.
export async function decide(adminId: number, id: number, input: DecideInput) {
  const application = await authorApplicationDao.findById(id);
  if (!application) {
    throw new NotFoundError("Application not found");
  }
  if (application.status !== "pending") {
    throw new BadRequestError("This application has already been decided");
  }
  if (!input.reason || !input.reason.trim()) {
    throw new BadRequestError("A reason is required for this action");
  }

  if (input.decision === "approved") {
    await adminUserService.updateRole(adminId, application.applicantId, { role: "author", reason: input.reason });
  } else {
    await auditService.recordAction({
      adminId,
      action: "REJECT_AUTHOR_APPLICATION",
      targetType: "author_application",
      targetId: id,
      reason: input.reason,
    });
  }

  return authorApplicationDao.update(id, {
    status: input.decision,
    decisionReason: input.reason,
    reviewedById: adminId,
    reviewedAt: new Date(),
  });
}
