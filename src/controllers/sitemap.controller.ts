import type { Request, Response } from "express";
import * as sitemapService from "../services/sitemap.service.js";

export async function getSitemap(_req: Request, res: Response) {
  const xml = await sitemapService.buildSitemapXml();
  res.type("application/xml").send(xml);
}
