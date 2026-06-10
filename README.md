# LUCY Realtime Service

Node.js realtime audio service for LUCY rooms. It manages room state, Agora RTC token issuance, Socket.io presence, mic/hand state, and PostgreSQL persistence.

## Stack

- Express REST API under `/api`
- Socket.io realtime events
- Prisma + PostgreSQL
- Agora RTC token generation
- Local JWT verification compatible with `Lucy.Identity.Api`

## Run Locally

Install dependencies:

```powershell
npm install
```

Create `.env` from `.env.sample`, then set Agora values when audio token issuance is needed:

```powershell
Copy-Item .env.sample .env
```

Start PostgreSQL for realtime:

```powershell
docker compose up -d postgres
```

The included compose file maps PostgreSQL to host port `5433`, so use:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/lucy_realtime
```

Run Prisma migration and start dev server:

```powershell
npm run prisma:migrate
npm run dev
```

Default URL: `http://localhost:3000`.

## Environment

- `PORT`, default `3000`
- `DATABASE_URL`
- `LUCY_JWT_ISSUER`, default `lucy.identity`
- `LUCY_JWT_AUDIENCE`, default `lucy.clients`
- `LUCY_JWT_SIGNING_KEY`, must match Identity/Gateway
- `AUTH_CACHE_TTL_SECONDS`, default `60`
- `IDENTITY_SERVICE_URL`, default `http://localhost:5095`
- `AGORA_APP_ID`
- `AGORA_APP_CERTIFICATE`
- `AGORA_TOKEN_TTL_SECONDS`, default `3600`
- `DISCONNECT_GRACE_SECONDS`, default `180`
- `PRESENCE_SWEEP_INTERVAL_SECONDS`, default `60`
- `CORS_ORIGINS`, default `http://localhost:5173,http://localhost:3000`

## REST API

All room endpoints require:

```text
Authorization: Bearer <accessToken>
```

Gateway route:

```text
/api/realtime/** -> http://localhost:3000/api/**
```

Direct local endpoints:

- `GET /api/health`
- `POST /api/rooms`
- `GET /api/rooms`
- `GET /api/rooms/{roomId}`
- `POST /api/rooms/{roomId}/join`
- `POST /api/rooms/{roomId}/leave`
- `POST /api/rooms/{roomId}/mic`
- `POST /api/rooms/{roomId}/hand`
- `POST /api/rooms/{roomId}/end`

Create room:

```json
{
  "title": "Survival Speaking Level 1",
  "language": "ENGLISH",
  "level": 1,
  "maxParticipants": 50
}
```

Join response:

```json
{
  "appId": "<agora-app-id>",
  "channelName": "lucy-...",
  "uid": 123,
  "rtcToken": "<agora-rtc-token>",
  "expiresAt": "2026-06-07T15:00:00.000Z",
  "member": {}
}
```

Errors follow:

```json
{
  "code": "validation_error",
  "message": "Request validation failed.",
  "details": {}
}
```

## Socket.io Contract

Connect with:

```js
io("http://localhost:3000", {
  auth: { token: accessToken }
});
```

Client events:

- `room:join` `{ "roomId": "<uuid>" }`
- `room:leave` `{ "roomId": "<uuid>" }`
- `member:mic_changed` `{ "roomId": "<uuid>", "muted": true }`
- `member:hand_changed` `{ "roomId": "<uuid>", "raised": true }`

Server events:

- `room:snapshot`
- `member:joined`
- `member:left`
- `member:disconnected`
- `member:reconnected`
- `member:auto_left`
- `member:mic_changed`
- `member:hand_changed`
- `room:ended`
- `room:error`

## Presence Rules

- Explicit `room:leave` marks the member `LEFT` immediately.
- Socket disconnect marks the member `DISCONNECTED` only if the DB still points to that socket id.
- Reconnect before the grace period marks the member `ONLINE`.
- The sweep job converts stale disconnected members to `LEFT`.
- A startup cleanup marks stale `ONLINE`/`DISCONNECTED` members as `LEFT` after service restart.
