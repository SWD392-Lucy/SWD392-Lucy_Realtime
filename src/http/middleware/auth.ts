import type { NextFunction, Request, Response } from "express";
import { extractBearerToken, verifyAccessToken } from "../../modules/auth/authService.js";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req.header("authorization"));
    req.user = verifyAccessToken(token);
    next();
  } catch (error) {
    next(error);
  }
}
