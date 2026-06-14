import { sweepRoomProgression } from "./progressionService.js";

let progressionInterval: NodeJS.Timeout | null = null;

export function startProgressionJob() {
  if (progressionInterval) {
    return;
  }

  progressionInterval = setInterval(() => {
    sweepRoomProgression().catch((error) => {
      console.error("Failed to sweep room progression", error);
    });
  }, 30_000);
}

export function stopProgressionJob() {
  if (!progressionInterval) {
    return;
  }
  clearInterval(progressionInterval);
  progressionInterval = null;
}
