# Testing Checklist

## API smoke (manual)

1) Start API
```
cd api
cp .env.example .env
npm install
npm run dev
```

2) Register a user
```
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","gameName":"TestXI","email":"user@myxi.local","password":"pass1234"}'
```

3) Login as master admin
```
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@myxi.local","password":"change-me"}'
```
Copy `token` from response.

4) Approve the user
```
curl -X POST http://localhost:4000/auth/approve-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <MASTER_TOKEN>" \
  -d '{"userId":2,"status":"active"}'
```

5) Login as the user
```
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@myxi.local","password":"pass1234"}'
```
Copy `token`.

6) Create tournament (admin/master)
```
curl -X POST http://localhost:4000/admin/tournaments/select \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <MASTER_TOKEN>" \
  -d '{"name":"T20 World Cup","season":"2026","sourceKey":"t20wc2026"}'
```

7) Import fixtures
```
curl -X POST http://localhost:4000/admin/matches/import-fixtures \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <MASTER_TOKEN>" \
  -d '{"tournamentId":1,"fixtures":[{"name":"Match 1","teamA":"Team A","teamB":"Team B","startTime":"2026-02-07T18:30:00+05:30"}]}'
```

8) Set match status
```
curl -X PATCH http://localhost:4000/admin/matches/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <MASTER_TOKEN>" \
  -d '{"status":"live"}'
```

9) Submit team (user)
```
curl -X POST http://localhost:4000/matches/1/team \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -d '{"playingXi":["p1","p2","p3","p4","p5","p6","p7","p8","p9","p10","p11"],"backups":["b1","b2"]}'
```

10) Delete user (master admin)
```
curl -X DELETE http://localhost:4000/users/2 \
  -H "Authorization: Bearer <MASTER_TOKEN>"
```

## API unit tests

```
cd api
npm test
```

## UI smoke
1) Start web
```
cd web
npm install
npm run dev
```

2) Open pages
- `/`
- `/login`
- `/register`
- `/pending`
- `/team`
