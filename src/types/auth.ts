import type { AccountRole } from "@prisma/client";

export type AuthUser = {
  userId: string;
  role: AccountRole;
  isAnonymous: boolean;
  expiresAt: Date;
  token: string;
};

export type RoomIdentity = {
  userId: string;
  role: AccountRole;
  avatarPersona: string;
  anonymousDisplayName: string;
  isAnonymous: boolean;
};
