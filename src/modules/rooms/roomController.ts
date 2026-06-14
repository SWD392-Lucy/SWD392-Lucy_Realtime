import type { Request, Response } from "express";
import {
  createRoom,
  endRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  listRooms,
  updateHand,
  updateMic
} from "./roomService.js";
import { getProgress, manualNextProgress, manualPreviousProgress, startProgress } from "./progressionService.js";
import { createRoomSchema, handSchema, micSchema, roomIdParamsSchema, startProgressSchema } from "./roomSchemas.js";

export async function createRoomHandler(req: Request, res: Response) {
  const input = createRoomSchema.parse(req.body);
  const room = await createRoom(req.user!, input);
  res.status(201).json(room);
}

export async function listRoomsHandler(_req: Request, res: Response) {
  res.json(await listRooms());
}

export async function getRoomHandler(req: Request, res: Response) {
  const { roomId } = roomIdParamsSchema.parse(req.params);
  res.json(await getRoom(roomId));
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
