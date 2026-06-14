import { AccountRole, Prisma, Room, RoomEventType, RoomStatus } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../http/errors.js";
import { emitToRoom } from "../../realtime/publisher.js";
import type { AuthUser } from "../../types/auth.js";

const SUBLEVEL_MINUTES = 10;
const SUBLEVEL_MS = SUBLEVEL_MINUTES * 60 * 1000;

type ProgressPatch = {
  autoStageEnabled: boolean;
  currentSubLevelIndex: number;
  totalSubLevels: number;
  stageStartedAt: Date | null;
  nextTransitionAt: Date | null;
};

type StageState = {
  name: "WAITING" | "ACTIVE" | "TRANSITIONING" | "COMPLETED";
  canTransition(room: Room, now: Date): boolean;
  next(room: Room, now: Date): ProgressPatch;
};

class WaitingState implements StageState {
  name = "WAITING" as const;

  canTransition() {
    return false;
  }

  next(room: Room): ProgressPatch {
    return toProgressPatch(room);
  }
}

class ActiveSubLevelState implements StageState {
  name: StageState["name"] = "ACTIVE";

  canTransition(room: Room, now: Date) {
    return Boolean(room.nextTransitionAt && room.nextTransitionAt <= now);
  }

  next(room: Room, now: Date): ProgressPatch {
    const nextIndex = room.currentSubLevelIndex + 1;
    if (nextIndex >= room.totalSubLevels) {
      return completedPatch(room);
    }

    return {
      autoStageEnabled: true,
      currentSubLevelIndex: nextIndex,
      totalSubLevels: room.totalSubLevels,
      stageStartedAt: now,
      nextTransitionAt: new Date(now.getTime() + SUBLEVEL_MS)
    };
  }
}

class TransitioningState extends ActiveSubLevelState {
  name: StageState["name"] = "TRANSITIONING";
}

class CompletedState implements StageState {
  name = "COMPLETED" as const;

  canTransition() {
    return false;
  }

  next(room: Room): ProgressPatch {
    return completedPatch(room);
  }
}

export function stateFor(room: Room, now = new Date()): StageState {
  if (room.status === RoomStatus.ENDED || room.currentSubLevelIndex >= room.totalSubLevels) {
    return new CompletedState();
  }
  if (!room.autoStageEnabled || !room.stageStartedAt || !room.nextTransitionAt) {
    return new WaitingState();
  }
  if (room.nextTransitionAt <= now) {
    return new TransitioningState();
  }
  return new ActiveSubLevelState();
}

export async function getProgress(roomId: string) {
  const room = await requireRoom(roomId);
  return progressSnapshot(room);
}

export async function startProgress(user: AuthUser, roomId: string, totalSubLevels: number) {
  const room = await requireRoom(roomId);
  requireHostOrSuper(user, room);

  if (room.status === RoomStatus.ENDED) {
    throw new AppError(409, "room_ended", "Cannot start progression for an ended room.");
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const nextRoom = await tx.room.update({
      where: { id: roomId },
      data: {
        status: room.status === RoomStatus.OPEN ? RoomStatus.LIVE : room.status,
        startedAt: room.startedAt ?? now,
        autoStageEnabled: true,
        currentSubLevelIndex: 0,
        totalSubLevels,
        stageStartedAt: now,
        nextTransitionAt: new Date(now.getTime() + SUBLEVEL_MS)
      }
    });
    await tx.roomEvent.create({
      data: {
        roomId,
        userId: user.userId,
        type: RoomEventType.PROGRESS_STARTED,
        payload: progressPayload(nextRoom)
      }
    });
    return nextRoom;
  });

  emitProgress(updated, "room:progress_snapshot");
  return progressSnapshot(updated);
}

export async function manualNextProgress(user: AuthUser, roomId: string) {
  const room = await requireRoom(roomId);
  requireHostOrSuper(user, room);
  if (!room.autoStageEnabled) {
    throw new AppError(409, "progress_not_started", "Room progression has not started.");
  }
  if (room.currentSubLevelIndex + 1 >= room.totalSubLevels) {
    return completeProgress(room, user.userId, true);
  }
  return transitionRoom(room, new Date(), user.userId, true);
}

export async function manualPreviousProgress(user: AuthUser, roomId: string) {
  const room = await requireRoom(roomId);
  requireHostOrSuper(user, room);
  if (!room.autoStageEnabled) {
    throw new AppError(409, "progress_not_started", "Room progression has not started.");
  }

  const now = new Date();
  const previousIndex = Math.max(0, room.currentSubLevelIndex - 1);
  const updated = await prisma.$transaction(async (tx) => {
    const nextRoom = await tx.room.update({
      where: { id: room.id },
      data: {
        autoStageEnabled: true,
        currentSubLevelIndex: previousIndex,
        totalSubLevels: room.totalSubLevels,
        stageStartedAt: now,
        nextTransitionAt: new Date(now.getTime() + SUBLEVEL_MS)
      }
    });
    await tx.roomEvent.create({
      data: {
        roomId: room.id,
        userId: user.userId,
        type: RoomEventType.SUBLEVEL_CHANGED,
        payload: {
          ...progressPayload(nextRoom),
          manual: true,
          direction: "previous"
        } as Prisma.InputJsonValue
      }
    });
    return nextRoom;
  });

  emitProgress(updated, "room:sublevel_changed");
  return progressSnapshot(updated);
}

export async function sweepRoomProgression() {
  const now = new Date();
  const rooms = await prisma.room.findMany({
    where: {
      status: RoomStatus.LIVE,
      autoStageEnabled: true,
      nextTransitionAt: {
        lte: now
      }
    }
  });

  for (const room of rooms) {
    await transitionRoom(room, now, null, false);
  }
}

async function transitionRoom(room: Room, now: Date, userId: string | null, manual: boolean) {
  const state = stateFor(room, now);
  if (!state.canTransition(room, now) && !manual) {
    return progressSnapshot(room);
  }

  if (room.status === RoomStatus.ENDED) {
    return progressSnapshot(room);
  }

  const patch = state.next(room, now);
  const completed = patch.currentSubLevelIndex >= patch.totalSubLevels || !patch.autoStageEnabled;
  const updated = await prisma.$transaction(async (tx) => {
    const nextRoom = await tx.room.update({
      where: { id: room.id },
      data: patch
    });
    await tx.roomEvent.create({
      data: {
        roomId: room.id,
        userId,
        type: completed ? RoomEventType.PROGRESS_COMPLETED : RoomEventType.SUBLEVEL_CHANGED,
        payload: {
          ...progressPayload(nextRoom),
          manual
        } as Prisma.InputJsonValue
      }
    });
    return nextRoom;
  });

  emitProgress(updated, completed ? "room:progress_completed" : "room:sublevel_changed");
  return progressSnapshot(updated);
}

async function completeProgress(room: Room, userId: string | null, manual: boolean) {
  const patch = completedPatch(room);
  const updated = await prisma.$transaction(async (tx) => {
    const nextRoom = await tx.room.update({
      where: { id: room.id },
      data: patch
    });
    await tx.roomEvent.create({
      data: {
        roomId: room.id,
        userId,
        type: RoomEventType.PROGRESS_COMPLETED,
        payload: {
          ...progressPayload(nextRoom),
          manual
        } as Prisma.InputJsonValue
      }
    });
    return nextRoom;
  });

  emitProgress(updated, "room:progress_completed");
  return progressSnapshot(updated);
}

function emitProgress(room: Room, eventName: "room:progress_snapshot" | "room:sublevel_changed" | "room:progress_completed") {
  emitToRoom(room.id, eventName, progressSnapshot(room));
}

function progressSnapshot(room: Room) {
  const state = stateFor(room);
  const displayIndex = Math.min(room.currentSubLevelIndex, Math.max(0, room.totalSubLevels - 1));
  return {
    roomId: room.id,
    state: state.name,
    autoStageEnabled: room.autoStageEnabled,
    currentSubLevelIndex: displayIndex,
    currentSubLevelNumber: displayIndex + 1,
    totalSubLevels: room.totalSubLevels,
    stageStartedAt: room.stageStartedAt,
    nextTransitionAt: room.nextTransitionAt,
    subLevelMinutes: SUBLEVEL_MINUTES
  };
}

function progressPayload(room: Room) {
  return {
    currentSubLevelIndex: room.currentSubLevelIndex,
    totalSubLevels: room.totalSubLevels,
    stageStartedAt: room.stageStartedAt?.toISOString() ?? null,
    nextTransitionAt: room.nextTransitionAt?.toISOString() ?? null
  };
}

function toProgressPatch(room: Room): ProgressPatch {
  return {
    autoStageEnabled: room.autoStageEnabled,
    currentSubLevelIndex: room.currentSubLevelIndex,
    totalSubLevels: room.totalSubLevels,
    stageStartedAt: room.stageStartedAt,
    nextTransitionAt: room.nextTransitionAt
  };
}

function completedPatch(room: Room): ProgressPatch {
  return {
    autoStageEnabled: false,
    currentSubLevelIndex: room.totalSubLevels,
    totalSubLevels: room.totalSubLevels,
    stageStartedAt: null,
    nextTransitionAt: null
  };
}

async function requireRoom(roomId: string) {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) {
    throw new AppError(404, "room_not_found", "Room does not exist.");
  }
  return room;
}

function requireHostOrSuper(user: AuthUser, room: Room) {
  if (room.hostUserId !== user.userId && user.role !== AccountRole.Super) {
    throw new AppError(403, "forbidden", "Only the room host or Super can control room progression.");
  }
}
