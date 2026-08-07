import bcrypt from "bcryptjs";
import * as userDao from "../dao/user.dao.js";
import { ConflictError, UnauthorizedError } from "../lib/errors.js";
import type { RegisterBody, LoginBody } from "../lib/validation.js";
import type { z } from "zod";

type RegisterInput = z.infer<typeof RegisterBody>;
type LoginInput = z.infer<typeof LoginBody>;

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
  return userDao.create({ username, email, passwordHash, displayName, role });
}

export async function login(input: LoginInput) {
  const { email, password } = input;
  const user = await userDao.findByEmail(email);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new UnauthorizedError("Invalid credentials");
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
