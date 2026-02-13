# Kora Web Dashboard

Next.js app for the Kora manager dashboard and API routes.

## Local setup

Install dependencies:

```bash
npm install
```

Set your database URL:

```bash
export DATABASE_URL='postgres://avnadmin:<PASSWORD>@kora-bl0007-ed7d.c.aivencloud.com:13881/defaultdb?sslmode=require'
```

Set a JWT secret (required in production):

```bash
export JWT_SECRET='replace-with-a-long-random-secret'
```

Run the app:

```bash
npm run dev
```

## Database health check endpoint

This project includes a read-only DB health route:

- `GET /api/health/db`

Core auth/manager APIs added:

- `POST /api/auth/signup-company`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET/POST /api/manager/staff`
- `PATCH /api/manager/staff/:companyUserId`
- `GET/POST /api/manager/shops`
- `PATCH /api/manager/shops/:shopId`
- `POST /api/manager/shop-assignments`

Expected response on success:

```json
{
  "ok": true,
  "database": "connected",
  "result": 1
}
```
