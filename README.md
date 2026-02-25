# Sales Territory Performance & Revenue Hotspot Mapping Platform

**Organization:** Pfizer Medical Industries  
**Geography:** United States — District-Wise  
**Type:** Demo-Level Strategic Intelligence Platform

---

## Overview

A map-first sales intelligence platform providing district-level revenue visibility across the India. Features role-based dashboards, interactive Leaflet maps with revenue color coding, and drill-down territory performance analytics.

## Monorepo Structure

```
/
├── frontend/        # React + Vite + TypeScript (GitHub Pages)
├── backend/         # Node.js + Express + TypeScript (Render)
│   └── prisma/      # Prisma ORM schema + migrations + seed
├── docs/            # Deployment & architecture docs
└── render.yaml      # Render deployment config
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React (Vite + TypeScript), Tailwind CSS, Leaflet, Chart.js, Axios |
| Backend | Node.js (Express + TypeScript), Prisma ORM |
| Database | Supabase (PostgreSQL) |
| Auth | JWT + bcrypt + Enum role control |
| Email | Resend SDK |
| Deploy | GitHub Pages (FE) · Render (BE) · Supabase (DB) |

## Roles

| Role | Code Prefix | Default Login |
|------|-------------|---------------|
| Admin | AD_001 | admin@pfizer.com |
| Management | MP_001 | management@pfizer.com |
| Sales Rep | SL_001... | Onboarding email |

## Getting Started

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full setup instructions.

### Quick Start (Development)

```bash
# Backend
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

## Environment Variables

Copy `.env.development` templates in both `/frontend` and `/backend` and fill in your values.
