import type { Server } from "socket.io";

let io: Server | null = null;

export function setRealtimeServer(server: Server) {
  io = server;
}

export function emitToRoom(roomId: string, event: string, payload: unknown) {
  io?.to(roomChannel(roomId)).emit(event, payload);
}

export function roomChannel(roomId: string) {
  return `room:${roomId}`;
}
