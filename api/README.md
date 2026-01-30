# API Readme

## Run
```
cd api
cp .env.example .env
npm install
npm run dev
```

## Env
```
PORT=4000
MASTER_ADMIN_NAME=Admin
MASTER_ADMIN_EMAIL=admin@myxi.local
MASTER_ADMIN_PASSWORD=change-me
JWT_SECRET=change-me-too
JWT_EXPIRES_IN=7d
```

## Auth
- `POST /auth/register`
  - body: `{ name, gameName, email, password }`
- `POST /auth/login`
  - body: `{ email, password }`
- `POST /auth/approve-user` (master admin)
  - header: `Authorization: Bearer <token>`
  - body: `{ userId, status: "active" | "rejected" }`

## Users
- `GET /users?q=...` (admin/master)
  - header: `Authorization: Bearer <token>`
- `PATCH /users/:id` (self/admin/master)
  - header: `Authorization: Bearer <token>`
  - body: `{ name?, gameName?, email?, password?, status?, role? }`

## Tournaments + Matches
- `GET /tournaments`
- `GET /tournaments/:id/matches`
- `GET /admin/tournaments` (admin/master)
  - header: `Authorization: Bearer <token>`
- `POST /admin/tournaments/select` (admin/master)
  - header: `Authorization: Bearer <token>`
  - body: `{ name, season, sourceKey }`
- `POST /admin/matches/import-fixtures` (admin/master)
  - header: `Authorization: Bearer <token>`
  - body: `{ tournamentId, fixtures: [{ name, teamA, teamB, startTime }] }`
- `PATCH /admin/matches/:id/status` (admin/master)
  - header: `Authorization: Bearer <token>`
  - body: `{ status: "scheduled" | "live" | "completed" }`

## Team Selection
- `POST /matches/:id/team`
  - header: `Authorization: Bearer <token>`
  - body: `{ playingXi: [11], backups: [0..6] }`
- `POST /admin/matches/:id/auto-swap` (admin/master)
  - header: `Authorization: Bearer <token>`
  - body: `{ playingXiConfirmed: [playerIds] }`
