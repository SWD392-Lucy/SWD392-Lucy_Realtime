import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { errorHandler, notFoundHandler } from "./errors.js";
import { healthRoutes } from "./routes/healthRoutes.js";
import { roomRoutes } from "./routes/roomRoutes.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(express.json());
  app.use(morgan("dev"));

  app.use("/api/health", healthRoutes);
  app.use("/api/rooms", roomRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
