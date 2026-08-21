import crypto from "node:crypto";
import type { OtpPurpose, User } from "@prisma/client";
import * as otpDao from "../dao/otp.dao.js";
import { sendMail } from "../lib/mailer.js";
import { logger } from "../lib/logger.js";
import { BadRequestError } from "../lib/errors.js";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

const SUBJECTS: Record<OtpPurpose, string> = {
  email_verification: "Verify your email — Why Is It NOT Possible?",
  password_reset: "Reset your password — Why Is It NOT Possible?",
};

function buildEmail(purpose: OtpPurpose, code: string) {
  const intro =
    purpose === "email_verification"
      ? "Use this code to verify your email and finish creating your account."
      : "Use this code to reset your password.";

  const text = `${intro}\n\nYour code: ${code}\n\nThis code expires in 10 minutes. If you didn't request this, you can safely ignore this email.`;
  const html = `
    <p>${intro}</p>
    <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${code}</p>
    <p>This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
  `;
  return { text, html };
}

function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

// Invalidates any still-active code for this user+purpose, issues a fresh
// one, emails it, and stores only the hash — never the plaintext code.
export async function generateAndSend(user: User, purpose: OtpPurpose): Promise<void> {
  const code = generateCode();

  await otpDao.invalidateActive(user.id, purpose);
  await otpDao.create({
    userId: user.id,
    purpose,
    codeHash: hashCode(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  const { text, html } = buildEmail(purpose, code);
  try {
    await sendMail({ to: user.email, subject: SUBJECTS[purpose], html, text });
  } catch (err) {
    // Don't fail the request over a transient SMTP issue — the user can hit
    // "resend code," which invalidates this one and tries again.
    logger.error({ err, userId: user.id, purpose }, "Failed to send OTP email");
  }
}

// Throws BadRequestError with the same message for "no code," "wrong
// code," "expired," and "too many attempts" — a caller shouldn't be able
// to distinguish those from the response alone.
export async function verify(userId: number, purpose: OtpPurpose, code: string): Promise<void> {
  const invalid = () => new BadRequestError("Invalid or expired code. Request a new one and try again.");

  const otp = await otpDao.findLatestActive(userId, purpose);
  if (!otp) {
    throw invalid();
  }

  if (otp.attempts >= MAX_ATTEMPTS) {
    throw invalid();
  }

  if (otp.codeHash !== hashCode(code)) {
    await otpDao.incrementAttempts(otp.id);
    throw invalid();
  }

  await otpDao.markConsumed(otp.id);
}
