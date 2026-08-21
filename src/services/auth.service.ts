import bcrypt from "bcryptjs";
import * as userDao from "../dao/user.dao.js";
import * as otpService from "./otp.service.js";
import { ConflictError, UnauthorizedError, ForbiddenError, NotFoundError, BadRequestError } from "../lib/errors.js";
import type {
  RegisterBody,
  LoginBody,
  VerifyEmailBody,
  ResendOtpBody,
  ForgotPasswordBody,
  ResetPasswordBody,
} from "../lib/validation.js";
import type { z } from "zod";

type RegisterInput = z.infer<typeof RegisterBody>;
type LoginInput = z.infer<typeof LoginBody>;
type VerifyEmailInput = z.infer<typeof VerifyEmailBody>;
type ResendOtpInput = z.infer<typeof ResendOtpBody>;
type ForgotPasswordInput = z.infer<typeof ForgotPasswordBody>;
type ResetPasswordInput = z.infer<typeof ResetPasswordBody>;

export async function register(input: RegisterInput) {
  const { username, email, password, displayName } = input;

  const existingEmail = await userDao.findByEmail(email);
  if (existingEmail) {
    throw new ConflictError("Email already taken");
  }

  const existingUsername = await userDao.findByUsername(username);
  if (existingUsername) {
    throw new ConflictError("Username already taken");
  }

  // First user gets owner role
  const userCount = await userDao.count();
  const role = userCount === 0 ? "owner" : "reader";

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await userDao.create({ username, email, passwordHash, displayName, role });

  await otpService.generateAndSend(user, "email_verification");
  return user;
}

export async function login(input: LoginInput) {
  const { email, password } = input;
  const user = await userDao.findByEmail(email);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new UnauthorizedError("Invalid credentials");
  }

  if (!user.emailVerifiedAt) {
    throw new ForbiddenError("Please verify your email before logging in.");
  }

  return user;
}

export async function getMe(userId: number) {
  const user = await userDao.findById(userId);
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

export async function verifyEmail(input: VerifyEmailInput) {
  const user = await userDao.findByEmail(input.email);
  // Same "invalid or expired code" message userDao lookup failure as a
  // wrong code — don't let this endpoint reveal whether an email is
  // registered.
  if (!user) {
    throw new BadRequestError("Invalid or expired code. Request a new one and try again.");
  }
  if (user.emailVerifiedAt) {
    return user;
  }

  await otpService.verify(user.id, "email_verification", input.code);
  return userDao.update(user.id, { emailVerifiedAt: new Date() });
}

export async function resendVerification(input: ResendOtpInput) {
  const user = await userDao.findByEmail(input.email);
  if (!user) {
    throw new NotFoundError("No account found for that email");
  }
  if (user.emailVerifiedAt) {
    throw new BadRequestError("This email is already verified");
  }

  await otpService.generateAndSend(user, "email_verification");
}

export async function forgotPassword(input: ForgotPasswordInput) {
  const user = await userDao.findByEmail(input.email);
  // Always succeeds from the caller's point of view — whether or not the
  // email is registered isn't revealed. Only send anything if it is.
  if (user) {
    await otpService.generateAndSend(user, "password_reset");
  }
}

export async function resetPassword(input: ResetPasswordInput) {
  const invalid = () => new BadRequestError("Invalid or expired code. Request a new one and try again.");

  const user = await userDao.findByEmail(input.email);
  if (!user) {
    throw invalid();
  }

  await otpService.verify(user.id, "password_reset", input.code);

  const passwordHash = await bcrypt.hash(input.newPassword, 10);
  // Bumping sessionVersion signs out every existing session for this
  // account — the same mechanism admin "force logout" uses — since a
  // password reset is exactly the moment a stale/compromised session
  // elsewhere should stop working.
  await userDao.update(user.id, { passwordHash, sessionVersion: { increment: 1 } });
}
