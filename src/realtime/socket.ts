import type { Server, Socket } from "socket.io";
import { extractBearerToken, verifyAccessToken } from "../modules/auth/authService.js";
import {
  getRoom,
  joinRoom,
  leaveRoom,
  markSocketDisconnected,
  updateHand,
  updateMic
} from "../modules/rooms/roomService.js";
import { getProgress } from "../modules/rooms/progressionService.js";
import {
  socketHandSchema,
  socketMicSchema,
  socketRoomJoinSchema
} from "../modules/rooms/roomSchemas.js";
import { roomChannel, setRealtimeServer } from "./publisher.js";
import type { SocketData } from "../types/socket.js";

type LucySocket = Socket<any, any, any, SocketData>;

export function configureSocket(io: Server) {
  setRealtimeServer(io);

  io.use((socket, next) => {
    try {
      const token = typeof socket.handshake.auth.token === "string"
        ? socket.handshake.auth.token
        : extractBearerToken(socket.handshake.headers.authorization);
      socket.data.user = verifyAccessToken(token);
      socket.data.activeRoomIds = new Set<string>();
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("Socket authentication failed."));
    }
  });

  io.on("connection", (socket: LucySocket) => {
    socket.on("room:join", async (payload: unknown) => {
      await safeSocketHandler(socket, async () => {
        const { roomId } = socketRoomJoinSchema.parse(payload);
        await joinRoom(socket.data.user, roomId, socket.id);
        socket.join(roomChannel(roomId));
        socket.data.activeRoomIds.add(roomId);
        socket.emit("room:snapshot", await getRoom(roomId));
        socket.emit("room:progress_snapshot", await getProgress(roomId));
      });
    });

    socket.on("room:leave", async (payload: unknown) => {
      await safeSocketHandler(socket, async () => {
        const { roomId } = socketRoomJoinSchema.parse(payload);
        const member = await leaveRoom(socket.data.user, roomId);
        socket.leave(roomChannel(roomId));
        socket.data.activeRoomIds.delete(roomId);
        socket.emit("member:left", member);
      });
    });

    socket.on("member:mic_changed", async (payload: unknown) => {
      await safeSocketHandler(socket, async () => {
        const { roomId, muted } = socketMicSchema.parse(payload);
        await updateMic(socket.data.user, roomId, muted);
      });
    });

    socket.on("member:hand_changed", async (payload: unknown) => {
      await safeSocketHandler(socket, async () => {
        const { roomId, raised } = socketHandSchema.parse(payload);
        await updateHand(socket.data.user, roomId, raised);
      });
    });

    socket.on("disconnect", async () => {
      await markSocketDisconnected(socket.id, socket.data.activeRoomIds);
    });
  });
}

async function safeSocketHandler(socket: LucySocket, handler: () => Promise<void>) {
  try {
    await handler();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected socket error.";
    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "socket_error";
    socket.emit("room:error", { code, message });
  }
}
