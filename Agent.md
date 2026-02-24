# Agent.md — Sales Territory Performance & Revenue Hotspot Mapping Platform

## Project Identity

| Field              | Value                                                         |
|--------------------|---------------------------------------------------------------|
| **Platform Name**  | Sales Territory Performance & Revenue Hotspot Mapping Platform |
| **Organization**   | Pfizer Medical Industries                                     |
| **Geography**      | United States — District-Wise                                 |
| **PRD Version**    | 1.0                                                           |
| **Project Type**   | Demo-Level Strategic Intelligence Platform                    |

---

## Purpose

This platform is a **map-first sales intelligence system** that provides district-level revenue visibility across the United States for Pfizer Medical Industries. It is **not** a CRM, payment processor, or AI forecasting engine. It is a visualization and performance platform designed for demo-level implementation with simplified territory boundaries.

---

## Technology Stack

| Layer            | Technology                              |
|------------------|-----------------------------------------|
| **Frontend**     | React (Vite + TypeScript), Mapbox / Leaflet, Chart.js, Tailwind CSS |
| **Backend**      | Node.js (Express + TypeScript), Prisma ORM           |
| **Database**     | Supabase (PostgreSQL)                   |
| **Auth**         | JWT, Enum-based Role Validation         |
| **Email**        | Resend SDK                              |
| **Deployment**   | GitHub Pages (Frontend), Render (Backend), Supabase (DB) |

---

## Monorepo Structure

```
/
├── frontend/                  # React Vite app → GitHub Pages
│   └── src/
│       ├── api/client.ts      # Axios + JWT interceptors
│       ├── context/AuthContext.tsx
│       ├── components/        # Layout, Sidebar, TopBar, ProtectedRoute
│       └── pages/             # login, set-password, admin, management, sales, map
├── backend/                   # Express API → Render
│   ├── prisma/
│   │   ├── schema.prisma      # All 7 data models
│   │   └── seed.ts            # Extensible upsert-based seeder
│   └── src/
│       ├── config/env.ts
│       ├── middleware/auth.ts  # verifyToken + requireRole
│       ├── utils/userCode.ts  # SL_001, AD_001, MP_001 auto-gen
│       ├── services/email.ts  # Resend onboarding email
│       └── routes/            # auth, admin, sales, map, dashboard
├── docs/DEPLOYMENT.md
├── render.yaml
└── Agent.md
```

---

## User Roles & Access Control

Authentication is JWT-based with enum-driven role control. Three roles:

### ADMIN
- Create / Edit Sales Reps → auto-generate `SL_XXX`, send onboarding email
- Create / Edit Products and Territories
- View all sales records (paginated)
- Activate / Deactivate users
- View system-wide dashboards
- **Cannot** modify financial rules (future scope)

### SALES
- Add Sales Records (territory enforced from JWT, not body)
- View personally assigned territories and district map
- View personal performance dashboard
- **Cannot** view other reps' data or create products

### MANAGEMENT
- View full USA map with all districts
- Toggle heatmap and markers
- Drill into territories and view regional dashboards
- Identify underperforming regions and revenue distribution
- **Cannot** create sales or products

---

## Functional Modules

### Map Module *(Core Entry Point — `/map`)*
- Full-screen Leaflet USA map post-login
- Revenue color coding: 🟢 HIGH · 🟡 MEDIUM · 🔴 LOW
- Heatmap toggle; click marker → Territory detail panel
- Filters: date range, product, sales rep, search
- SALES role restricted to assigned territories only

### Territory Performance Panel
- Revenue, Deals, Avg Deal Size per territory
- Opens as side panel on marker click

### Sales Data Module (`/sales/dashboard`)
- Sales creation form with product/territory dropdown
- `salesRepId` injected from JWT — never from request body
- Territory assignment validated at API level

### Management Dashboard (`/management/dashboard`)
- Revenue by Region (Doughnut chart)
- Monthly Revenue Trend (Line chart)
- Top 5 / Bottom 5 territories table
- Expansion / Pricing opportunity indicators

### Admin Module (`/admin/dashboard`)
- User management table (create, activate/deactivate)
- Product catalogue (create)
- Onboarding email sent on Sales Rep creation

---

## Data Model (PostgreSQL via Prisma)

> Prisma schema lives at `backend/prisma/schema.prisma`

| Model | Key Fields | Indexes |
|-------|-----------|--------|
| Role | id, name | unique(name) |
| User | id(UUID), userCode, email, roleId, isActive, isFirstLogin, onboardingToken | unique(email), unique(userCode), unique(onboardingToken) |
| Territory | id(UUID), name, state, region, lat, lng | — |
| Product | id(UUID), name, category, price | — |
| Customer | id(UUID), name, industry, location, contact | — |
| **Sale** | id, revenue, deals, qty, saleDate, territoryId, salesRepId, productId, customerId | territoryId, salesRepId, saleDate, productId |
| SalesRepTerritory | salesRepId, territoryId, assignedAt | unique(salesRepId, territoryId) |
| Invoice | saleId(unique FK) | — |

---

## API Routes

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | Public | Login by email OR userCode |
| POST | `/api/auth/set-password` | Public | Set password via onboarding token |
| GET | `/api/auth/me` | Any | Current user info |
| GET/POST | `/api/admin/users` | ADMIN | List / Create sales reps |
| PUT | `/api/admin/users/:id/activate` | ADMIN | Activate user |
| PUT | `/api/admin/users/:id/deactivate` | ADMIN | Deactivate user |
| GET/POST | `/api/admin/products` | ADMIN | List / Create products |
| GET/POST | `/api/admin/territories` | ADMIN | List / Create territories |
| POST | `/api/admin/territories/assign` | ADMIN | Assign territory to rep |
| DELETE | `/api/admin/territories/assign` | ADMIN | Unassign territory |
| GET | `/api/admin/sales` | ADMIN | All sales (paginated) |
| GET/POST | `/api/sales` | SALES+ADMIN | Own sales / Create sale |
| GET | `/api/map/territories` | All Auth | Aggregated revenue map data |
| GET | `/api/dashboard/sales` | SALES | Personal KPIs |
| GET | `/api/dashboard/management` | MGMT+ADMIN | Regional KPIs |

---

## Security Requirements

- JWT (`8h` expiry) on all protected routes
- `verifyToken` + `requireRole(...roles)` middleware chain
- Passwords hashed with `bcrypt` (rounds: 12)
- Active user validation on every authenticated request
- `salesRepId` ALWAYS from JWT — never from request body
- Onboarding token: 32-byte hex, 24h expiry, single-use

---

## Seeding System

`backend/prisma/seed.ts` uses **UPSERT** — safe to re-run after any schema change.

**To add new seeded users:** add an entry to `SEED_USERS[]` array and run:
```bash
npm run prisma:seed
```

**After schema changes:**
```bash
npm run prisma:migrate:dev  # creates migration
npm run prisma:seed          # re-seeds (upsert-safe)
# Or full reset:
npm run prisma:reset         # migrate reset + seed
```

**Default seeded accounts:**
| Code | Email | Password | Role |
|------|-------|----------|------|
| AD_001 | admin@pfizer.com | Admin@1234 | ADMIN |
| MP_001 | management@pfizer.com | Mgmt@1234 | MANAGEMENT |

---

## UserCode Generation

`backend/src/utils/userCode.ts` auto-increments per role:

| Role | Format | Example |
|------|--------|---------|
| ADMIN | `AD_NNN` | AD_001 |
| SALES | `SL_NNN` | SL_001, SL_002 |
| MANAGEMENT | `MP_NNN` | MP_001 |

---

## Agent Directives

When building, extending, or debugging this platform:

1. **Map-First Philosophy** — The Leaflet map is the primary entry point. All features must preserve the map-first UX.
2. **Role Enforcement** — Every API endpoint validates JWT role against allowed roles via `requireRole()` middleware.
3. **Query-Based Aggregations** — All KPIs are computed at query time (`GROUP BY` + `SUM`). No cached/precomputed values in MVP.
4. **Prisma + Supabase** — All DB interactions via Prisma ORM. Raw SQL only for complex aggregations.
5. **Indexed Queries** — Always filter/JOIN on indexed columns (`territoryId`, `salesRepId`, `saleDate`, `productId`).
6. **No Scope Creep** — Do not implement CRM, payment gateway, AI forecasting, or streaming unless explicitly instructed.
7. **One Sale → One Territory** — Enforced at schema + API level. Never allow multi-territory sales.
8. **Sales Rep Isolation** — SALES users see only their own records. `salesRepId` is always from JWT.
9. **Password Security** — Always bcrypt (rounds 12). Never log or return `passwordHash`.
10. **Onboarding Flow** — `isFirstLogin=true` users must set password before accessing any protected route. Redirect to `/set-password?token=XYZ`.
11. **Extensible Seeding** — Any new role or seeded user must be added to `SEED_USERS[]` in `seed.ts`. Re-run seed after schema changes.
12. **Dark Theme** — UI uses deep navy `#08090f` base with yellow-gold `#eab308` accent. Never introduce light-mode overrides without explicit instruction.
