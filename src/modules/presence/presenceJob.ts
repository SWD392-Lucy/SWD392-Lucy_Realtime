import { env } from "../../config/env.js";
import { cleanupStartupPresence, sweepStalePresence } from "../rooms/roomService.js";

let interval: NodeJS.Timeout | null = null;

export async function startPresenceJobs() {
  await cleanupStartupPresence();

  interval = setInterval(() => {
    sweepStalePresence().catch((error) => {
      console.error("Presence sweep failed", error);
    });
  }, env.PRESENCE_SWEEP_INTERVAL_SECONDS * 1000);
}

export function stopPresenceJobs() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
