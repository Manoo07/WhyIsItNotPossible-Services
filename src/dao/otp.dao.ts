import type { Prisma, OtpPurpose } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export function create(data: Prisma.OtpUncheckedCreateInput) {
  return prisma.otp.create({ data });
}

// The one OTP a verify attempt is checked against — most recent first, so
// a re-sent code always supersedes an older still-unexpired one.
export function findLatestActive(userId: number, purpose: OtpPurpose) {
  return prisma.otp.findFirst({
    where: { userId, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
}

export function incrementAttempts(id: number) {
  return prisma.otp.update({ where: { id }, data: { attempts: { increment: 1 } } });
}

export function markConsumed(id: number) {
  return prisma.otp.update({ where: { id }, data: { consumedAt: new Date() } });
}

// Called right before issuing a new code so only the newest one is ever
// valid — otherwise two requested-in-a-row codes would both work until
// whichever expires first.
export function invalidateActive(userId: number, purpose: OtpPurpose) {
  return prisma.otp.updateMany({
    where: { userId, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });
}
