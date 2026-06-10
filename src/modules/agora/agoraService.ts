import crypto from "node:crypto";
import agoraAccessToken from "agora-access-token";
import { env, hasAgoraConfig } from "../../config/env.js";
import { AppError } from "../../http/errors.js";

const { RtcRole, RtcTokenBuilder } = agoraAccessToken;

export type AgoraJoinToken = {
  appId: string;
  channelName: string;
  uid: number;
  rtcToken: string;
  expiresAt: Date;
};

export function createAgoraUid(userId: string, roomId: string): number {
  const hash = crypto.createHash("sha256").update(`${userId}:${roomId}`).digest();
  // Agora numeric uid must be a positive 32-bit integer.
  return (hash.readUInt32BE(0) % 2_147_483_647) + 1;
}

export function createRtcToken(channelName: string, uid: number): AgoraJoinToken {
  if (!hasAgoraConfig) {
    throw new AppError(503, "agora_not_configured", "Agora app id/certificate are not configured.");
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = now + env.AGORA_TOKEN_TTL_SECONDS;
  const rtcToken = RtcTokenBuilder.buildTokenWithUid(
    env.AGORA_APP_ID,
    env.AGORA_APP_CERTIFICATE,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    expiresAtSeconds
  );

  return {
    appId: env.AGORA_APP_ID,
    channelName,
    uid,
    rtcToken,
    expiresAt: new Date(expiresAtSeconds * 1000)
  };
}
