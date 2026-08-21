import * as authorApplicationDao from "../dao/author-application.dao.js";
import { BadRequestError } from "../lib/errors.js";
import type { SubmitAuthorApplicationBody } from "../lib/validation.js";
import type { z } from "zod";

type CurrentUser = { id: number; role: string };
type SubmitInput = z.infer<typeof SubmitAuthorApplicationBody>;

export async function submit(user: CurrentUser, input: SubmitInput) {
  if (user.role !== "reader") {
    throw new BadRequestError("You can already publish — no application needed.");
  }

  const pending = await authorApplicationDao.findPendingByApplicant(user.id);
  if (pending) {
    throw new BadRequestError("You already have an application under review.");
  }

  return authorApplicationDao.create({
    applicantId: user.id,
    pitch: input.pitch,
    portfolioUrl: input.portfolioUrl || null,
  });
}

// Null means "never applied" — the frontend gate treats that the same as
// a fresh reader who hasn't started the flow yet.
export function getMine(userId: number) {
  return authorApplicationDao.findLatestByApplicant(userId);
}
