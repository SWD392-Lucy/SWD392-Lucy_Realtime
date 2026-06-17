import type { Request, Response } from "express";
import {
  createRoom,
  endRoom,
  getRoom,
  joinRoom,
  kickMember,
  leaveRoom,
  listRooms,
  manageMemberMic,
  updateHand,
  updateMic
} from "./roomService.js";
import { getProgress, manualNextProgress, manualPreviousProgress, startProgress } from "./progressionService.js";
import { createRoomSchema, handSchema, micSchema, roomIdParamsSchema, roomMemberParamsSchema, startProgressSchema } from "./roomSchemas.js";

export async function createRoomHandler(req: Request, res: Response) {
  const input = createRoomSchema.parse(req.body);
  const room = await createRoom(req.user!, input);
  res.status(201).json(room);
}

export async function listRoomsHandler(req: Request, res: Response) {
  res.json(await listRooms(req.user!.token));
}

export async function getRoomHandler(req: Request, res: Response) {
  const { roomId } = roomIdParamsSchema.parse(req.params);
  res.json(await getRoom(roomId, req.user!.token));
}

export async function joinRoomHandler(req: Request, res: Response) {
  const { roomId } = roomIdParamsSchema.parse(req.params);
  res.json(await joinRoom(req.user!, roomId));
}

export async function leaveRoomHandler(req: Request, res: Response) {
  const { roomId } = roomIdParamsSchema.parse(req.params);
  res.json(await leaveRoom(req.user!, roomId));
}

export async function updateMicHandler(req: Request, res: Response) {
  const { roomId } = roomIdParamsSchema.parse(req.params);
  const { muted } = micSchema.parse(req.body);
  res.json(await updateMic(req.user!, roomId, muted));
}

export async function manageMemberMicHandler(req: Request, res: Response) {
  const { roomId, memberId } = roomMemberParamsSchema.parse(req.params);
  const { muted } = micSchema.parse(req.body);
  res.json(await manageMemberMic(req.user!, roomId, memberId, muted));
}

export async function kickMemberHandler(req: Request, res: Response) {
  const { roomId, memberId } = roomMemberParamsSchema.parse(req.params);
  res.json(await kickMember(req.user!, roomId, memberId));
}

export async function updateHandHandler(req: Request, res: Response) {
  const { roomId } = roomIdParamsSchema.parse(req.params);
  const { raised } = handSchema.parse(req.body);
  res.json(await updateHand(req.user!, roomId, raised));
}

export async function endRoomHandler(req: Request, res: Response) {
  const { roomId } = roomIdParamsSchema.parse(req.params);
  res.json(await endRoom(req.user!, roomId));
}

export async function getProgressHandler(req: Request, res: Response) {
  const { roomId } = roomIdParamsSchema.parse(req.params);
  res.json(await getProgress(roomId));
}

export async function startProgressHandler(req: Request, res: Response) {
  const { roomId } = roomIdParamsSchema.parse(req.params);
  const { totalSubLevels } = startProgressSchema.parse(req.body ?? {});
  res.json(await startProgress(req.user!, roomId, totalSubLevels));
}

export async function nextProgressHandler(req: Request, res: Response) {
  const { roomId } = roomIdParamsSchema.parse(req.params);
  res.json(await manualNextProgress(req.user!, roomId));
}

export async function previousProgressHandler(req: Request, res: Response) {
  const { roomId } = roomIdParamsSchema.parse(req.params);
  res.json(await manualPreviousProgress(req.user!, roomId));
}
