import type { AuthUser } from "./auth.js";

export type SocketData = {
  user: AuthUser;
  activeRoomIds: Set<string>;
};
