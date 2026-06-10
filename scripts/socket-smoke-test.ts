import { io } from "socket.io-client";

const baseUrl = process.env.REALTIME_URL ?? "http://localhost:3000";
const token = process.env.ACCESS_TOKEN;
const roomId = process.env.ROOM_ID;

if (!token || !roomId) {
  console.error("ACCESS_TOKEN and ROOM_ID are required.");
  console.error("Example:");
  console.error("$env:ACCESS_TOKEN='<identity-token>'; $env:ROOM_ID='<room-id>'; npm run test:manual:socket");
  process.exit(1);
}

const socket = io(baseUrl, {
  auth: { token },
  transports: ["websocket"]
});

const timeout = setTimeout(() => {
  console.error("Socket smoke test timed out.");
  socket.disconnect();
  process.exit(1);
}, 15000);

socket.on("connect", () => {
  console.log("connected", socket.id);
  socket.emit("room:join", { roomId });
});

socket.on("room:snapshot", (snapshot) => {
  console.log("room:snapshot", JSON.stringify({
    id: snapshot.id,
    status: snapshot.status,
    members: snapshot.members?.length ?? 0
  }));

  socket.emit("member:mic_changed", { roomId, muted: false });
  socket.emit("member:hand_changed", { roomId, raised: true });

  setTimeout(() => {
    socket.emit("room:leave", { roomId });
  }, 1000);
});

socket.on("member:mic_changed", (member) => {
  console.log("member:mic_changed", member.userId, member.micMuted);
});

socket.on("member:hand_changed", (member) => {
  console.log("member:hand_changed", member.userId, member.handRaised);
});

socket.on("member:left", (member) => {
  console.log("member:left", member.userId);
  clearTimeout(timeout);
  socket.disconnect();
  process.exit(0);
});

socket.on("room:error", (error) => {
  console.error("room:error", error);
  clearTimeout(timeout);
  socket.disconnect();
  process.exit(1);
});

socket.on("connect_error", (error) => {
  console.error("connect_error", error.message);
  clearTimeout(timeout);
  process.exit(1);
});
