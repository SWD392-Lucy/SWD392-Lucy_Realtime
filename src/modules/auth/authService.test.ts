import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signingKey = "TEST_SIGNING_KEY_FOR_UNIT_TESTS_32B";

describe("authService", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/lucy_realtime";
    process.env.LUCY_JWT_ISSUER = "lucy.identity";
    process.env.LUCY_JWT_AUDIENCE = "lucy.clients";
    process.env.LUCY_JWT_SIGNING_KEY = signingKey;
  });

  it("verifies a Lucy Identity compatible token", async () => {
    const { verifyAccessToken } = await import("./authService.js");
    const token = jwt.sign(
      {
        sub: "11111111-1111-1111-1111-111111111111",
        role: "Pro",
        isAnonymous: false
      },
      signingKey,
      {
        algorithm: "HS256",
        issuer: "lucy.identity",
        audience: "lucy.clients",
        expiresIn: "1h"
      }
    );

    const user = verifyAccessToken(token);

    expect(user.userId).toBe("11111111-1111-1111-1111-111111111111");
    expect(user.role).toBe("Pro");
    expect(user.isAnonymous).toBe(false);
  });

  it("rejects an invalid token", async () => {
    const { verifyAccessToken } = await import("./authService.js");

    expect(() => verifyAccessToken("not-a-token")).toThrow("Invalid or expired access token.");
  });
});
