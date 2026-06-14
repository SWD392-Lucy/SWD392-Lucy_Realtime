import http from "node:http";
import { Server } from "socket.io";
import { createApp } from "./http/app.js";
import { corsOrigins, env } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./database/prisma.js";
import { configureSocket } from "./realtime/socket.js";
import { startPresenceJobs, stopPresenceJobs } from "./modules/presence/presenceJob.js";
import { startProgressionJob, stopProgressionJob } from "./modules/rooms/progressionJob.js";

async function main() {
  await connectDatabase();
  await startPresenceJobs();
  startProgressionJob();

  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: corsOrigins,
      credentials: true
    }
  });

  configureSocket(io);

  server.listen(env.PORT, () => {
    console.log(`LUCY realtime service listening on http://localhost:${env.PORT}`);
  });

  const shutdown = async () => {
    console.log("Shutting down realtime service...");
    stopPresenceJobs();
    stopProgressionJob();
    io.close();
    server.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(async (error) => {
  console.error("Failed to start realtime service", error);
  await disconnectDatabase();
  process.exit(1);
});
