import { z } from "zod";

export const roomIdParamsSchema = z.object({
  roomId: z.string().uuid()
});

export const roomMemberParamsSchema = z.object({
  roomId: z.string().uuid(),
  memberId: z.string().uuid()
});

export const createRoomSchema = z.object({
  title: z.string().trim().min(1).max(120),
  language: z.string().trim().min(1).max(40),
  level: z.coerce.number().int().min(1).max(500),
  maxParticipants: z.coerce.number().int().min(2).max(1000).default(50)
});

export const micSchema = z.object({
  muted: z.boolean()
});

export const handSchema = z.object({
  raised: z.boolean()
});

export const socketRoomJoinSchema = z.object({
  roomId: z.string().uuid()
});

export const socketMicSchema = z.object({
  roomId: z.string().uuid(),
  muted: z.boolean()
});

export const socketHandSchema = z.object({
  roomId: z.string().uuid(),
  raised: z.boolean()
});

export const socketMaterialSchema = z.object({
  roomId: z.string().uuid(),
  action: z.enum(["uploaded", "pinned", "unpinned", "deleted"]).default("pinned")
});

export const startProgressSchema = z.object({
  totalSubLevels: z.coerce.number().int().min(1).max(24).default(6)
});
