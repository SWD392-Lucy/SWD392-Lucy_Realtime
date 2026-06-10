import jwt from "jsonwebtoken";
import { AccountRole } from "@prisma/client";
import { env } from "../../config/env.js";
import { AppError } from "../../http/errors.js";
import type { AuthUser } from "../../types/auth.js";
import { getCachedAuth, setCachedAuth } from "./tokenCache.js";

type LucyJwtPayload = jwt.JwtPayload & {
  sub?: string;
  role?: string;
  isAnonymous?: boolean;
};

export function extractBearerToken(header: string | undefined): string {
  if (!header) {
    throw new AppError(401, "missing_token", "Authorization header is required.");
  }

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new AppError(401, "invalid_auth_scheme", "Authorization header must use Bearer scheme.");
  }

  return token.trim();
}

export function verifyAccessToken(token: string): AuthUser {
  const cached = getCachedAuth(token);
  if (cached) {
    return cached;
  }

  let payload: LucyJwtPayload;
  try {
    payload = jwt.verify(token, env.LUCY_JWT_SIGNING_KEY, {
      algorithms: ["HS256"],
      issuer: env.LUCY_JWT_ISSUER,
      audience: env.LUCY_JWT_AUDIENCE
    }) as LucyJwtPayload;
  } catch {
    throw new AppError(401, "invalid_token", "Invalid or expired access token.");
  }

  const role = parseRole(payload.role);
  if (!payload.sub || !role || typeof payload.exp !== "number") {
    throw new AppError(401, "invalid_token_claims", "Access token is missing required claims.");
  }

  const user: AuthUser = {
    userId: payload.sub,
    role,
    isAnonymous: Boolean(payload.isAnonymous),
    expiresAt: new Date(payload.exp * 1000),
    token
  };

  setCachedAuth(token, user);
  return user;
}

function parseRole(value: string | undefined): AccountRole | null {
  if (value === AccountRole.Lucy || value === AccountRole.Pro || value === AccountRole.Super) {
    return value;
  }

  return null;
}
