import { beforeEach, describe, expect, it, vi } from "vitest";

describe("agoraService", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/lucy_realtime";
    process.env.LUCY_JWT_SIGNING_KEY = "TEST_SIGNING_KEY_FOR_UNIT_TESTS_32B";
    process.env.AGORA_APP_ID = "";
    process.env.AGORA_APP_CERTIFICATE = "";
  });

  it("creates a stable positive numeric uid for a user in a room", async () => {
    const { createAgoraUid } = await import("./agoraService.js");

    const uid = createAgoraUid("user-1", "room-1");

    expect(uid).toBe(createAgoraUid("user-1", "room-1"));
    expect(uid).toBeGreaterThan(0);
  });

  it("fails clearly when Agora config is missing", async () => {
    const { createRtcToken } = await import("./agoraService.js");

    expect(() => createRtcToken("lucy-room", 1)).toThrow("Agora app id/certificate are not configured.");
  });
});
