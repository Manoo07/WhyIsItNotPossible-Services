import * as userDao from "../dao/user.dao.js";
import * as postDao from "../dao/post.dao.js";
import * as reportDao from "../dao/report.dao.js";
import * as auditLogDao from "../dao/audit-log.dao.js";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Media KPIs/health from the FRS dashboard are intentionally omitted — this
// app has no Media entity or processing pipeline (single cover-image URL
// per post, uploaded synchronously, no derivatives). See
// docs/admin-console-architecture-notes.md.
export async function getDashboard() {
  const today = startOfToday();

  const [
    totalUsers,
    activeUsers,
    newUsersToday,
    postsToday,
    pendingReports,
    activeModerationItems,
    suspendedUsers,
    recentReports,
    recentActions,
  ] = await Promise.all([
    userDao.count(),
    userDao.count({ status: "active" }),
    userDao.count({ createdAt: { gte: today } }),
    postDao.count({ createdAt: { gte: today } }),
    reportDao.count({ status: "open" }),
    reportDao.count({ status: { in: ["under_review", "action_required"] } }),
    userDao.count({ status: "suspended" }),
    reportDao.findMany({}, { createdAt: "desc" }, { skip: 0, take: 8 }),
    auditLogDao.findMany({}, { skip: 0, take: 8 }),
  ]);

  return {
    kpis: {
      totalUsers,
      activeUsers,
      newUsersToday,
      postsToday,
      pendingReports,
      activeModerationItems,
      suspendedUsers,
    },
    recentReports,
    recentActions,
  };
}
