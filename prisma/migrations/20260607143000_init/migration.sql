-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('OPEN', 'LIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('Lucy', 'Pro', 'Super');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('ONLINE', 'DISCONNECTED', 'LEFT');

-- CreateEnum
CREATE TYPE "RoomEventType" AS ENUM ('ROOM_CREATED', 'JOINED', 'LEFT', 'DISCONNECTED', 'RECONNECTED', 'AUTO_LEFT', 'MIC_CHANGED', 'HAND_CHANGED', 'ROOM_ENDED');

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'OPEN',
    "hostUserId" UUID NOT NULL,
    "agoraChannelName" TEXT NOT NULL,
    "maxParticipants" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_members" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "AccountRole" NOT NULL,
    "avatarPersona" TEXT NOT NULL,
    "anonymousDisplayName" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL,
    "agoraUid" INTEGER NOT NULL,
    "micMuted" BOOLEAN NOT NULL DEFAULT true,
    "handRaised" BOOLEAN NOT NULL DEFAULT false,
    "connectionStatus" "ConnectionStatus" NOT NULL DEFAULT 'ONLINE',
    "socketId" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "room_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_events" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "userId" UUID,
    "type" "RoomEventType" NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rooms_agoraChannelName_key" ON "rooms"("agoraChannelName");

-- CreateIndex
CREATE INDEX "room_members_roomId_connectionStatus_idx" ON "room_members"("roomId", "connectionStatus");

-- CreateIndex
CREATE INDEX "room_members_socketId_idx" ON "room_members"("socketId");

-- CreateIndex
CREATE UNIQUE INDEX "room_members_roomId_userId_key" ON "room_members"("roomId", "userId");

-- CreateIndex
CREATE INDEX "room_events_roomId_createdAt_idx" ON "room_events"("roomId", "createdAt");

-- AddForeignKey
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_events" ADD CONSTRAINT "room_events_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
