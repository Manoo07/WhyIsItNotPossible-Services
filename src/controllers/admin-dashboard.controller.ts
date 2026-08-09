import type { Request, Response } from "express";
import * as adminDashboardService from "../services/admin-dashboard.service.js";

export async function get(_req: Request, res: Response) {
  res.json(await adminDashboardService.getDashboard());
}
