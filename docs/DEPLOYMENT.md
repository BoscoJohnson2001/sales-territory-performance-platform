# Deployment Guide

## Prerequisites

- Node.js 20+
- Supabase account + project
- Render account
- GitHub account
- Resend account + API key

---

## 1. Supabase Setup

1. Create a new Supabase project
2. Go to **Settings → Database → Connection String**
3. Copy the **URI** format connection string
4. Enable extensions in SQL Editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "pgcrypto";
   ```
5. Save connection string as `DATABASE_URL` in `backend/.env.production`

---

## 2. Backend — Render

1. Connect your GitHub repo to Render
2. Create a **Web Service**
3. Set **Root Directory** to `backend` (or use `render.yaml` at root)
4. Set environment variables:
   - `DATABASE_URL` — Supabase connection string
   - `JWT_SECRET` — random 64-char string
   - `RESEND_API_KEY` — from Resend dashboard
   - `FRONTEND_URL` — your GitHub Pages URL
   - `NODE_ENV=production`
5. Deploy — Render runs `prisma migrate deploy` automatically on start
6. After first deploy, run seed (one-time via Render Shell):
   ```bash
   npx ts-node prisma/seed.ts
   ```

---

## 3. Frontend — GitHub Pages

1. Fill in `frontend/.env.production`:
   ```
   VITE_API_BASE_URL=https://your-render-backend.onrender.com
   ```
2. Deploy:
   ```bash
   cd frontend
   npm run deploy
   ```
3. Enable GitHub Pages in repo settings → branch: `gh-pages`

---

## 4. Default Credentials (Seeded)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@pfizer.com | Admin@1234 |
| Management | management@pfizer.com | Mgmt@1234 |

> ⚠️ Change these passwords immediately after first login.

---

## 5. Prisma Migrations

```bash
# Development — creates migration files
npx prisma migrate dev --name <description>

# Production — applies pending migrations
npx prisma migrate deploy

# Re-seed after schema changes
npm run prisma:seed
```
