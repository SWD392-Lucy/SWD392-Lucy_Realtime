import { Router } from "express";
import { hasAgoraConfig } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { asyncHandler } from "../asyncHandler.js";

export const healthRoutes = Router();

healthRoutes.get("/", asyncHandler(async (_req, res) => {
  let database = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "unavailable";
  }

  res.json({
    service: "lucy-realtime",
    status: database === "ok" ? "ok" : "degraded",
    database,
    agoraConfigured: hasAgoraConfig
  });
}));
