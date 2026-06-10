import { Router } from "express";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import {
  createRoomHandler,
  endRoomHandler,
  getRoomHandler,
  joinRoomHandler,
  leaveRoomHandler,
  listRoomsHandler,
  updateHandHandler,
  updateMicHandler
} from "../../modules/rooms/roomController.js";

export const roomRoutes = Router();

roomRoutes.use(requireAuth);
roomRoutes.post("/", asyncHandler(createRoomHandler));
roomRoutes.get("/", asyncHandler(listRoomsHandler));
roomRoutes.get("/:roomId", asyncHandler(getRoomHandler));
roomRoutes.post("/:roomId/join", asyncHandler(joinRoomHandler));
roomRoutes.post("/:roomId/leave", asyncHandler(leaveRoomHandler));
roomRoutes.post("/:roomId/mic", asyncHandler(updateMicHandler));
roomRoutes.post("/:roomId/hand", asyncHandler(updateHandHandler));
roomRoutes.post("/:roomId/end", asyncHandler(endRoomHandler));
