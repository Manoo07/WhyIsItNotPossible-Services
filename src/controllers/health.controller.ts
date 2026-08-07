import type { Request, Response } from "express";
import { HealthCheckResponse } from "../lib/validation.js";

export function getHealth(_req: Request, res: Response) {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
}
