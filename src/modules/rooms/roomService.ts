import {
  AccountRole,
  ConnectionStatus,
  Prisma,
  RoomEventType,
  RoomStatus
} from "@prisma/client";
import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../http/errors.js";
import { createAgoraUid, createRtcToken } from "../agora/agoraService.js";
import { getRoomIdentity } from "../identity/identityClient.js";
import type { AuthUser } from "../../types/auth.js";
import { emitToRoom } from "../../realtime/publisher.js";

type CreateRoomInput = {
  title: string;
  language: string;
  level: number;
  maxParticipants: number;
};

export async function createRoom(user: AuthUser, input: CreateRoomInput) {
  requireMentor(user);
  const roomId = crypto.randomUUID();

  const room = await prisma.room.create({
    data: {
      id: roomId,
      title: input.title,
      language: input.language,
      level: input.level,
      hostUserId: user.userId,
      agoraChannelName: `lucy-${roomId}`,
      maxParticipants: input.maxParticipants,
      events: {
        create: {
          userId: user.userId,
          type: RoomEventType.ROOM_CREATED,
          payload: input
        }
      }
    }
  });

  return room;
}

export async function listRooms() {
  const rooms = await prisma.room.findMany({
    where: {
      status: {
        in: [RoomStatus.OPEN, RoomStatus.LIVE]
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    include: {
      members: {
        where: {
          connectionStatus: {
            in: [ConnectionStatus.ONLINE, ConnectionStatus.DISCONNECTED]
          }
        }
      }
    }
  });

  return rooms.map(({ members, ...room }) => ({
    ...room,
    activeMemberCount: members.filter((member) => member.connectionStatus === ConnectionStatus.ONLINE).length
  }));
}

export async function getRoom(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      members: {
        where: {
          connectionStatus: {
            in: [ConnectionStatus.ONLINE, ConnectionStatus.DISCONNECTED]
          }
        },
        orderBy: [
          { handRaised: "desc" },
          { joinedAt: "asc" }
        ]
      }
    }
  });

  if (!room) {
    throw new AppError(404, "room_not_found", "Room does not exist.");
  }

  return room;
}

export async function joinRoom(user: AuthUser, roomId: string, socketId?: string) {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room || room.status === RoomStatus.ENDED) {
    throw new AppError(404, "room_not_found", "Room does not exist or has ended.");
  }

  const activeMemberCount = await prisma.roomMember.count({
    where: {
      roomId,
      connectionStatus: ConnectionStatus.ONLINE,
      userId: {
        not: user.userId
      }
    }
  });
  if (activeMemberCount >= room.maxParticipants) {
    throw new AppError(409, "room_full", "Room has reached its participant limit.");
  }

  const roomIdentity = await getRoomIdentity(user);
  const agoraUid = createAgoraUid(user.userId, roomId);
  const existing = await prisma.roomMember.findUnique({
    where: {
      roomId_userId: {
        roomId,
        userId: user.userId
      }
    }
  });
  const wasDisconnected = existing?.connectionStatus === ConnectionStatus.DISCONNECTED;
  const wasOnline = existing?.connectionStatus === ConnectionStatus.ONLINE;
  const wasLeft = existing?.connectionStatus === ConnectionStatus.LEFT;

  const result = await prisma.$transaction(async (tx) => {
    if (room.status === RoomStatus.OPEN) {
      await tx.room.update({
        where: { id: roomId },
        data: {
          status: RoomStatus.LIVE,
          startedAt: new Date()
        }
      });
    }

    const member = await tx.roomMember.upsert({
      where: {
        roomId_userId: {
          roomId,
          userId: user.userId
        }
      },
      create: {
        roomId,
        userId: user.userId,
        role: roomIdentity.role,
        avatarPersona: roomIdentity.avatarPersona,
        anonymousDisplayName: roomIdentity.anonymousDisplayName,
        isAnonymous: roomIdentity.isAnonymous,
        agoraUid,
        socketId,
        lastSeenAt: new Date(),
        connectionStatus: ConnectionStatus.ONLINE
      },
      update: {
        role: roomIdentity.role,
        avatarPersona: roomIdentity.avatarPersona,
        anonymousDisplayName: roomIdentity.anonymousDisplayName,
        isAnonymous: roomIdentity.isAnonymous,
        agoraUid,
        socketId,
        connectionStatus: ConnectionStatus.ONLINE,
        disconnectedAt: null,
        leftAt: null,
        lastSeenAt: new Date()
      }
    });

    if (!wasOnline) {
      await tx.roomEvent.create({
        data: {
          roomId,
          userId: user.userId,
          type: wasDisconnected ? RoomEventType.RECONNECTED : RoomEventType.JOINED,
          payload: { socketId, wasLeft }
        }
      });
    }

    return member;
  });

  const token = createRtcToken(room.agoraChannelName, agoraUid);
  if (!wasOnline) {
    emitToRoom(roomId, wasDisconnected ? "member:reconnected" : "member:joined", result);
  }
  emitToRoom(roomId, "room:snapshot", await getRoom(roomId));

  return {
    ...token,
    member: result
  };
}

export async function leaveRoom(user: AuthUser, roomId: string) {
  const member = await requireMember(roomId, user.userId);
  const updated = await prisma.roomMember.update({
    where: { id: member.id },
    data: {
      connectionStatus: ConnectionStatus.LEFT,
      socketId: null,
      leftAt: new Date(),
      lastSeenAt: new Date()
    }
  });

  await recordEvent(roomId, user.userId, RoomEventType.LEFT, {});
  emitToRoom(roomId, "member:left", updated);
  return updated;
}

export async function updateMic(user: AuthUser, roomId: string, muted: boolean) {
  const member = await requireMember(roomId, user.userId);
  const updated = await prisma.roomMember.update({
    where: { id: member.id },
    data: {
      micMuted: muted,
      lastSeenAt: new Date()
    }
  });

  await recordEvent(roomId, user.userId, RoomEventType.MIC_CHANGED, { muted });
  emitToRoom(roomId, "member:mic_changed", updated);
  return updated;
}

export async function manageMemberMic(user: AuthUser, roomId: string, memberId: string, muted: boolean) {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) {
    throw new AppError(404, "room_not_found", "Room does not exist.");
  }
  requireRoomManager(user, room);

  const member = await prisma.roomMember.findFirst({
    where: {
      id: memberId,
      roomId,
      connectionStatus: {
        in: [ConnectionStatus.ONLINE, ConnectionStatus.DISCONNECTED]
      }
    }
  });
  if (!member) {
    throw new AppError(404, "member_not_found", "Member is not active in this room.");
  }

  const updated = await prisma.roomMember.update({
    where: { id: member.id },
    data: {
      micMuted: muted,
      lastSeenAt: new Date()
    }
  });

  await recordEvent(roomId, user.userId, RoomEventType.MIC_CHANGED, {
    muted,
    targetUserId: member.userId,
    managed: true
  });
  emitToRoom(roomId, "member:mic_changed", updated);
  return updated;
}

export async function kickMember(user: AuthUser, roomId: string, memberId: string) {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) {
    throw new AppError(404, "room_not_found", "Room does not exist.");
  }
  requireRoomManager(user, room);

  const member = await prisma.roomMember.findFirst({
    where: {
      id: memberId,
      roomId,
      connectionStatus: {
        in: [ConnectionStatus.ONLINE, ConnectionStatus.DISCONNECTED]
      }
    }
  });
  if (!member) {
    throw new AppError(404, "member_not_found", "Member is not active in this room.");
  }
  if (member.userId === user.userId) {
    throw new AppError(400, "cannot_kick_self", "Managers cannot kick themselves.");
  }

  const updated = await prisma.roomMember.update({
    where: { id: member.id },
    data: {
      connectionStatus: ConnectionStatus.LEFT,
      socketId: null,
      leftAt: new Date(),
      lastSeenAt: new Date()
    }
  });

  await recordEvent(roomId, user.userId, RoomEventType.LEFT, {
    targetUserId: member.userId,
    kicked: true
  });
  emitToRoom(roomId, "member:kicked", updated);
  emitToRoom(roomId, "member:left", updated);
  return updated;
}

export async function updateHand(user: AuthUser, roomId: string, raised: boolean) {
  const member = await requireMember(roomId, user.userId);
  const updated = await prisma.roomMember.update({
    where: { id: member.id },
    data: {
      handRaised: raised,
      lastSeenAt: new Date()
    }
  });

  await recordEvent(roomId, user.userId, RoomEventType.HAND_CHANGED, { raised });
  emitToRoom(roomId, "member:hand_changed", updated);
  return updated;
}

export async function endRoom(user: AuthUser, roomId: string) {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) {
    throw new AppError(404, "room_not_found", "Room does not exist.");
  }

  if (room.hostUserId !== user.userId && user.role !== AccountRole.Super) {
    throw new AppError(403, "forbidden", "Only the room host or Super can end this room.");
  }

  const endedRoom = await prisma.$transaction(async (tx) => {
    const updatedRoom = await tx.room.update({
      where: { id: roomId },
      data: {
        status: RoomStatus.ENDED,
        endedAt: new Date()
      }
    });

    await tx.roomMember.updateMany({
      where: {
        roomId,
        connectionStatus: {
          in: [ConnectionStatus.ONLINE, ConnectionStatus.DISCONNECTED]
        }
      },
      data: {
        connectionStatus: ConnectionStatus.LEFT,
        socketId: null,
        leftAt: new Date(),
        lastSeenAt: new Date()
      }
    });

    await tx.roomEvent.create({
      data: {
        roomId,
        userId: user.userId,
        type: RoomEventType.ROOM_ENDED,
        payload: {}
      }
    });

    return updatedRoom;
  });

  emitToRoom(roomId, "room:ended", endedRoom);
  return endedRoom;
}

export async function markSocketDisconnected(socketId: string, roomIds: Iterable<string>) {
  for (const roomId of roomIds) {
    const member = await prisma.roomMember.findFirst({
      where: {
        roomId,
        socketId,
        connectionStatus: ConnectionStatus.ONLINE
      }
    });

    if (!member) {
      continue;
    }

    const updated = await prisma.roomMember.update({
      where: { id: member.id },
      data: {
        connectionStatus: ConnectionStatus.DISCONNECTED,
        disconnectedAt: new Date(),
        lastSeenAt: new Date()
      }
    });

    await recordEvent(roomId, member.userId, RoomEventType.DISCONNECTED, { socketId });
    emitToRoom(roomId, "member:disconnected", updated);
  }
}

export async function sweepStalePresence() {
  const cutoff = new Date(Date.now() - env.DISCONNECT_GRACE_SECONDS * 1000);
  const staleMembers = await prisma.roomMember.findMany({
    where: {
      connectionStatus: ConnectionStatus.DISCONNECTED,
      disconnectedAt: {
        lte: cutoff
      }
    }
  });

  for (const member of staleMembers) {
    const updated = await prisma.roomMember.update({
      where: { id: member.id },
      data: {
        connectionStatus: ConnectionStatus.LEFT,
        socketId: null,
        leftAt: new Date(),
        lastSeenAt: new Date()
      }
    });

    await recordEvent(member.roomId, member.userId, RoomEventType.AUTO_LEFT, {});
    emitToRoom(member.roomId, "member:auto_left", updated);
  }
}

export async function cleanupStartupPresence() {
  const cutoff = new Date(Date.now() - env.DISCONNECT_GRACE_SECONDS * 1000);
  await prisma.roomMember.updateMany({
    where: {
      connectionStatus: {
        in: [ConnectionStatus.ONLINE, ConnectionStatus.DISCONNECTED]
      },
      lastSeenAt: {
        lte: cutoff
      }
    },
    data: {
      connectionStatus: ConnectionStatus.LEFT,
      socketId: null,
      leftAt: new Date(),
      lastSeenAt: new Date()
    }
  });
}

async function requireMember(roomId: string, userId: string) {
  const member = await prisma.roomMember.findUnique({
    where: {
      roomId_userId: {
        roomId,
        userId
      }
    }
  });

  if (!member || member.connectionStatus === ConnectionStatus.LEFT) {
    throw new AppError(404, "member_not_found", "User is not an active member of this room.");
  }

  return member;
}

async function recordEvent(roomId: string, userId: string | null, type: RoomEventType, payload: Prisma.InputJsonValue) {
  await prisma.roomEvent.create({
    data: {
      roomId,
      userId,
      type,
      payload
    }
  });
}

function requireMentor(user: AuthUser) {
  if (user.role !== AccountRole.Pro && user.role !== AccountRole.Super) {
    throw new AppError(403, "forbidden", "Only Pro or Super users can create realtime rooms.");
  }
}

function requireRoomManager(user: AuthUser, room: { hostUserId: string }) {
  if (room.hostUserId !== user.userId && user.role !== AccountRole.Pro && user.role !== AccountRole.Super) {
    throw new AppError(403, "forbidden", "Only Pro or Super users can manage room learners.");
  }
}
