import { env } from "../../config/env.js";
import { AppError } from "../../http/errors.js";
import type { AuthUser, RoomIdentity } from "../../types/auth.js";

export async function getRoomIdentity(user: AuthUser): Promise<RoomIdentity> {
  const response = await fetch(`${env.IDENTITY_SERVICE_URL}/api/internal/users/${user.userId}/room-identity`, {
    headers: {
      Authorization: `Bearer ${user.token}`
    }
  });

  if (response.status === 404) {
    throw new AppError(404, "user_not_found", "User does not exist.");
  }

  if (!response.ok) {
    throw new AppError(502, "identity_unavailable", "Could not load room identity from Identity service.");
  }

  const data = await response.json() as {
    userId: string;
    role: RoomIdentity["role"];
    avatarPersona: string;
    anonymousDisplayName: string;
    isAnonymous: boolean;
  };

  return {
    userId: data.userId,
    role: data.role,
    avatarPersona: data.avatarPersona,
    anonymousDisplayName: data.anonymousDisplayName,
    isAnonymous: data.isAnonymous
  };
}
