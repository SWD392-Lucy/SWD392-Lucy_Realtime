import crypto from "node:crypto";
import type { AuthUser } from "../../types/auth.js";
import { env } from "../../config/env.js";

type CacheEntry = {
  user: AuthUser;
  expiresAtMs: number;
};

const cache = new Map<string, CacheEntry>();

export function getCachedAuth(token: string): AuthUser | null {
  const key = tokenHash(token);
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAtMs <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.user;
}

export function setCachedAuth(token: string, user: AuthUser) {
  const tokenExpiresAtMs = user.expiresAt.getTime();
  const cacheExpiresAtMs = Date.now() + env.AUTH_CACHE_TTL_SECONDS * 1000;
  cache.set(tokenHash(token), {
    user,
    expiresAtMs: Math.min(tokenExpiresAtMs, cacheExpiresAtMs)
  });
}

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
