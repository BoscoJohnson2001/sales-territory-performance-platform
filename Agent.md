# Agent.md — Sales Territory Performance & Revenue Hotspot Mapping Platform

## Project Identity

| Field              | Value                                                          |
|--------------------|----------------------------------------------------------------|
| **Platform Name**  | Sales Territory Performance & Revenue Hotspot Mapping Platform |
| **Organization**   | Pfizer Medical Industries                                      |
| **Geography**      | India — District-Wise (753 districts, all states + UTs)        |
| **PRD Version**    | 1.0                                                            |
| **Project Type**   | Demo-Level Strategic Intelligence Platform                     |

---

## Purpose

A **map-first sales intelligence system** providing district-level revenue visibility across India for Pfizer Medical Industries.  
It is **not** a CRM, payment processor, or AI forecasting engine — it is a visualization and performance platform targeting demo-level implementation with real India district boundaries.

---

## Technology Stack

| Layer          | Technology                                                                        |
|----------------|-----------------------------------------------------------------------------------|
| **Frontend**   | React 18 (Vite + TypeScript), Leaflet (GeoJSON choropleth), Tailwind CSS          |
| **Backend**    | Node.js (Express + TypeScript), Supabase JS client (no Prisma in production flow) |
| **Database**   | Supabase (PostgreSQL) — direct client, schema managed via Supabase migrations      |
| **Auth**       | JWT (8 h expiry), Enum-based Role Validation                                       |
| **Email**      | Resend SDK                                                                         |
| **Deployment** | GitHub Pages (Frontend), Render (Backend), Supabase (DB)                          |

> **Note:** `backend/prisma/` and `schema.prisma` are present in the repo but the active DB workflow uses **Supabase MCP migrations** (`apply_migration`) and the `@supabase/supabase-js` client directly. Prisma is not used at runtime.

---

## Monorepo Structure

```
/
├── frontend/                        # React Vite app → GitHub Pages
│   ├── .env                         # VITE_ENABLE_GEOLOCATION=true
│   └── src/
│       ├── api/client.ts            # Axios + JWT interceptors
│       ├── context/AuthContext.tsx
│       ├── components/              # Layout, Sidebar, TopBar, ProtectedRoute
│       ├── services/
│       │   └── geolocation.service.ts  # getCurrentLocation() + reverseGeocode()
│       └── pages/
│           ├── LoginPage.tsx
│           ├── SetPasswordPage.tsx
│           ├── admin/AdminDashboard.tsx
│           ├── management/ManagementDashboard.tsx
│           ├── sales/SalesDashboard.tsx
│           └── map/MapPage.tsx      # Choropleth map — India GeoJSON + revenue overlay
├── backend/
│   ├── prisma/                      # Legacy schema + seed (kept for reference)
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── config/
│       │   ├── env.ts
│       │   └── supabase.ts          # Supabase client singleton
│       ├── middleware/auth.ts       # verifyToken + requireRole
│       ├── utils/userCode.ts        # SL_001, AD_001, MP_001 auto-gen
│       ├── services/email.ts        # Resend onboarding email
│       ├── routes/
│       │   ├── auth.ts
│       │   ├── admin.ts
│       │   ├── sales.ts
│       │   ├── map.ts
│       │   └── dashboard.ts
│       └── scripts/
│           ├── seedIndiaDistricts.ts       # Seed all 753 Indian districts
│           └── importDistrictPolygons.ts   # Populate Territory.polygon from GeoJSON CDN
├── docs/DEPLOYMENT.md
├── render.yaml
└── Agent.md
```

---

## User Roles & Access Control

JWT-based with enum-driven role control. Three roles:

### ADMIN
- Create / Edit Sales Reps → auto-generate `SL_XXX`, send onboarding email
- Create / Edit Products
- Assign / Unassign territories to Sales Reps (Territory tab in Admin Dashboard)
- View all sales records (paginated)
- Activate / Deactivate users
- View system-wide dashboards
- Full India map access
- **Extended Profile Fields**: display name, phone (E.164 `+` validated), joining date (no future date), work start/end time in local timezone

### SALES
- Add Sales Records (territory must be assigned to them — enforced at API level)
- View personally assigned territories on district map
- View personal performance dashboard
- **Cannot** view other reps' data or add products
- Map renders only their assigned district polygons in colour

### MANAGEMENT
- View full India map with all districts coloured
- Toggle heatmap / outline modes
- Drill into territories, view regional dashboards
- **Cannot** create sales or products

---

## Functional Modules

### Map Module *(Core Entry Point — `/map`)*

**GeoJSON Choropleth (not circle/marker heatmap)**

- Fetches ~594-district India GeoJSON from CDN on first load (browser-cached after)
- Fetches revenue data from `GET /api/map/districts` — merged client-side by district name
- **Heatmap ON**: filled district polygons — 🟢 HIGH · 🟡 MEDIUM · 🔴 LOW
- **Heatmap OFF**: neutral gray polygon outlines + SVG teardrop centroid markers (coloured by revenue level, only for districts with actual sales data)
- Hover tooltip: District name, state, revenue, deals — single tooltip at a time (explicit open/close via `activeTooltipLayerRef`)
- Click polygon → Territory Performance side panel
- SALES role: only assigned territories displayed in colour; others faint

---

### Heatmap Colour Logic (Percentile-Based)

#### Overview
The heatmap assigns one of three revenue levels — `HIGH`, `MEDIUM`, or `LOW` — to each district polygon. This classification is computed **backend-side** in `GET /api/map/districts` using only districts that have revenue > $0.

#### Step-by-Step Calculation (`map.ts`)

1. **Fetch all territories + aggregate their sales revenue:**
   ```
   Territory → join → Sale → SUM(revenue) per territory
   ```

2. **Separate non-zero territories:**
   ```typescript
   const nonZero = enriched.filter(t => t.revenue > 0);
   nonZero.sort((a, b) => a.revenue - b.revenue); // ascending
   ```

3. **Compute percentile thresholds from non-zero set only:**
   ```typescript
   const p30 = nonZero[Math.floor(nonZero.length * 0.30)]?.revenue ?? 0;
   const p70 = nonZero[Math.floor(nonZero.length * 0.70)]?.revenue ?? 0;
   ```

4. **Assign revenue level to every territory:**

   | Condition | Level | Polygon Fill | Marker Color |
   |-----------|-------|-------------|--------------|
   | `revenue === 0` | `LOW` | Dark (`#1e293b`) at low opacity | No marker shown |
   | `revenue > 0 && revenue <= p30` | `LOW` | `#ef4444` (red) | 🔴 Red teardrop |
   | `revenue > p30 && revenue <= p70` | `MEDIUM` | `#f59e0b` (amber) | 🟡 Amber teardrop |
   | `revenue > p70` | `HIGH` | `#22c55e` (green) | 🟢 Green teardrop + pulse ring |

5. **Why exclude $0 territories from threshold calc:**  
   If $0 territories were included in the sorted array, the 30th/70th percentiles would collapse toward $0, making all active territories appear `HIGH`. Only **territories with actual revenue** define what HIGH/MEDIUM/LOW means.

#### Frontend Rendering (`MapPage.tsx`)

- `styleFeature(feature, isHeatmap)` maps each GeoJSON feature to a Leaflet style object:
  ```typescript
  fillColor: allowed ? (hasRev ? FILL[lvl] : '#1e293b') : '#0f172a'
  fillOpacity: allowed ? (hasRev ? 0.70 : 0.18) : 0.08
  ```
  - `allowed` = SALES role check (is this district assigned to the rep?)
  - `hasRev` = `revenue > 0`
  - `lvl` = `HIGH | MEDIUM | LOW` from backend response

- Heatmap toggle does **not** re-fetch data — it calls `layer.setStyle()` on every existing GeoJSON layer with the toggled `isHeatmap` boolean. GeoJSON data is cached in `geoDataRef`.

#### Centroid Markers (Heatmap OFF)

```
Only rendered if: t.revenue > 0 OR t.deals > 0
```
- SVG teardrop divIcon, color = `FILL[revenueLevel]`
- Drop-shadow filter: `drop-shadow(0 2px 6px ${color}88)`
- HIGH revenue: animated `mapPulse` ring radiates outward at 1.6s loop
- All others: static teardrop pin with white inner dot

#### Tooltip Behaviour Fix
Previously `sticky: true` caused multiple tooltips to stack on rapid mouse movement.  
Fixed via explicit lifecycle management:
```typescript
// mouseover
activeTooltipLayerRef.current?.closeTooltip();   // close previous
activeTooltipLayerRef.current = e.target;
e.target.openTooltip();                          // open new

// mouseout
e.target.closeTooltip();
activeTooltipLayerRef.current = null;
```

---

### Territory Assignment (Admin Dashboard — Territories tab)

- Sales rep dropdown → loads their currently assigned territories
- Checkbox multi-select across all 753 Indian districts
- `POST /api/admin/sales-users/:id/territories` — bulk assign
- `DELETE /api/admin/sales-users/:id/territories/:tid` — remove single mapping
- Assignment propagates immediately to map and sales form dropdown

### Admin — Extended Sales Rep Profile Fields

When creating a sales rep (`POST /api/admin/users`), the form and API now accept:

| Field | Validation | Storage |
|-------|-----------|---------|
| `displayName` | Optional string | `User.displayName` |
| `phone` | Must start with `+` | `User.phone` |
| `joiningDate` | No future dates | `User.joiningDate` (DATE) |
| `workStartTime` | HH:MM local time | `User.workStartTimeUtc` (DateTime, UTC) |
| `workEndTime` | HH:MM local time, must be after start | `User.workEndTimeUtc` (DateTime, UTC) |
| `timezone` | Auto-detected via `Intl.DateTimeFormat().resolvedOptions().timeZone` | Used only for conversion |

**Timezone Conversion (backend `admin.ts`):**
- Uses `date-fns-tz` → `fromZonedTime(localDateTimeString, timezone)` for reliable UTC conversion
- Anchor date = `joiningDate` (or today), ensuring DST-boundary accuracy
- Database stores **only UTC** — never local time
- Frontend displays using `toLocaleTimeString()` → auto-converts UTC → browser local TZ

### Sales Data Module (`/sales/dashboard`)

- Sales creation form with product + territory dropdown
- Territory dropdown shows **only assigned** territories for SALES role (from `GET /api/sales/territories`)
- `salesRepId` injected from JWT — never from request body
- Territory assignment validated at API level (403 if unassigned)

### Management Dashboard (`/management/dashboard`)

- Revenue by Region (Doughnut chart)
- Monthly Revenue Trend (Line chart)
- Top 5 / Bottom 5 territories table with **Signal column**

#### Signal Column Logic

| Signal | Condition | Badge |
|--------|-----------|-------|
| `EXPANSION_CANDIDATE` | `revenue >= $50,000` | 🚀 Expand (green) |
| `PRICING_OPPORTUNITY` | `revenue > $0 AND revenue < $50,000` | 💡 Pricing (amber) |
| `NO_ACTIVITY` | `revenue = $0` | ❄️ Cold (red) |

Each badge has a `title` HTML tooltip explaining the signal in plain English.  
Signal column appears in **both** Top 5 and Bottom 5 tables.

### Admin Dashboard (`/admin/dashboard`)
- **Users tab**: create, activate/deactivate sales reps (with extended profile fields)
- **Products tab**: create products
- **Territories tab**: assign/unassign territories to sales reps

---

## Data Model (PostgreSQL via Supabase)

| Model | Key Fields | Notes |
|-------|-----------|-------|
| Role | id, name | Enum: ADMIN, SALES, MANAGEMENT |
| User | id(UUID), userCode, email, roleId, isActive, isFirstLogin, onboardingToken, displayName, phone, joiningDate, workStartTimeUtc, workEndTimeUtc | unique(email, userCode, onboardingToken) |
| Territory | id(UUID), name, state, region, latitude, longitude, **radius**(INT), **polygon**(JSONB) | 753 Indian districts seeded |
| Product | id(UUID), name, category, price | — |
| Customer | id(UUID), name, industry, location, contact | — |
| Sale | id, revenue, deals, qty, saleDate, territoryId, salesRepId, productId, customerId | indexed on territoryId, salesRepId, saleDate |
| SalesRepTerritory | salesRepId, territoryId, assignedAt | unique(salesRepId, territoryId) |

> `Territory.radius` — approximate district coverage radius in metres (used as fallback)  
> `Territory.polygon` — GeoJSON geometry; populated by running `importDistrictPolygons.ts`  
> `User.workStartTimeUtc / workEndTimeUtc` — always stored in UTC; converted from local time using `date-fns-tz`

---

## API Routes

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | Public | Login by email OR userCode |
| POST | `/api/auth/set-password` | Public | Set password via onboarding token |
| GET  | `/api/auth/me` | Any Auth | Current user info |
| GET  | `/api/admin/users` | ADMIN | List all users |
| POST | `/api/admin/users` | ADMIN | Create sales rep + send onboarding email |
| PUT  | `/api/admin/users/:id/activate` | ADMIN | Activate user |
| PUT  | `/api/admin/users/:id/deactivate` | ADMIN | Deactivate user |
| GET  | `/api/admin/products` | ADMIN | List products |
| POST | `/api/admin/products` | ADMIN | Create product |
| GET  | `/api/admin/territories` | ADMIN | List all territories |
| POST | `/api/admin/territories` | ADMIN | Create territory |
| POST | `/api/admin/territories/assign` | ADMIN | Assign territory to rep |
| DELETE | `/api/admin/territories/assign` | ADMIN | Unassign territory |
| GET  | `/api/admin/sales` | ADMIN | All sales (paginated) |
| GET  | `/api/admin/sales-users` | ADMIN | List SALES role users |
| GET  | `/api/admin/sales-users/:id/territories` | ADMIN | Get assigned territories for a user |
| POST | `/api/admin/sales-users/:id/territories` | ADMIN | Bulk assign territories to a user |
| DELETE | `/api/admin/sales-users/:id/territories/:tid` | ADMIN | Remove territory assignment |
| GET  | `/api/sales` | SALES | Own sales records |
| POST | `/api/sales` | SALES | Create sale (territory must be assigned) |
| GET  | `/api/sales/territories` | SALES | Territories assigned to logged-in rep |
| GET  | `/api/map/territories` | All Auth | City/circle-based revenue map data (legacy) |
| GET  | `/api/map/districts` | All Auth | **District-level revenue data for choropleth** |
| GET  | `/api/dashboard/sales` | SALES | Personal KPIs |
| GET  | `/api/dashboard/management` | MGMT+ADMIN | Regional KPIs + Signal column data |

---

## Security Requirements

- JWT (`8h` expiry) on all protected routes via `verifyToken` middleware
- `requireRole(...roles)` middleware enforced on all role-restricted endpoints
- Passwords hashed with `bcrypt` (rounds: 12)
- Active user validation on every authenticated request (`isActive` check)
- `salesRepId` **always** from JWT — never from request body
- Territory assignment validated at sale-creation time (403 if not assigned)
- Onboarding token: 32-byte hex, 24h expiry, single-use

---

## Territory & Seed System

### India Districts Seed
753 Indian districts across all 28 states + 8 union territories, seeded via Supabase `execute_sql`.

**To re-seed districts (from backend dir):**
```bash
npx ts-node --transpile-only src/scripts/seedIndiaDistricts.ts
```

### Import District Polygons (one-time)
Fetches India district GeoJSON from GitHub CDN, matches by district name, stores polygon in DB:
```bash
npx ts-node --transpile-only src/scripts/importDistrictPolygons.ts
```

### Default Seeded Accounts

| Code   | Email                      | Password   | Role       |
|--------|----------------------------|------------|------------|
| AD_001 | admin@pfizer.com           | Admin@1234 | ADMIN      |
| MP_001 | management@pfizer.com      | Mgmt@1234  | MANAGEMENT |

---

## UserCode Generation

`backend/src/utils/userCode.ts` auto-increments per role:

| Role       | Format   | Example           |
|------------|----------|-------------------|
| ADMIN      | `AD_NNN` | AD_001            |
| SALES      | `SL_NNN` | SL_001, SL_002    |
| MANAGEMENT | `MP_NNN` | MP_001            |

---

## Agent Directives

When building, extending, or debugging this platform:

1. **Map-First Philosophy** — Leaflet GeoJSON choropleth is the primary entry point. All features must preserve the polygon-based map-first UX. Do **not** reintroduce circle/marker heatmap rendering.
2. **India Geography** — All territory references are Indian districts. Do not revert to USA terminology or geography.
3. **Role Enforcement** — Every API endpoint validates JWT role via `requireRole()`. SALES users see only their assigned territories everywhere (map, form dropdowns, side panel).
4. **Revenue Percentiles from Non-Zero Only** — `HIGH/MEDIUM/LOW` thresholds always computed from territories with `revenue > 0`. Including $0 territories in the sort would collapse all thresholds to $0.
5. **Supabase Client (not Prisma)** — All DB interactions use `@supabase/supabase-js`. Prisma schema files are reference-only. DDL changes go via `apply_migration`.
6. **Indexed Queries** — Always filter on indexed columns (`territoryId`, `salesRepId`, `saleDate`, `productId`).
7. **No Scope Creep** — Do not implement CRM, payment gateway, AI forecasting, or streaming unless explicitly instructed.
8. **One Sale → One Territory** — Enforced at schema + API level. Multi-territory sales are not supported.
9. **Sales Rep Isolation** — SALES users see only their own records. `salesRepId` is always from JWT.
10. **Password Security** — Always bcrypt (rounds 12). Never log or return `passwordHash`.
11. **Onboarding Flow** — `isFirstLogin=true` users must set password before any protected route. Redirect to `/set-password?token=XYZ`.
12. **Dark Theme** — UI base `#08090f` deep navy with yellow-gold `#eab308` accent. Never introduce light-mode overrides.
13. **Geolocation Safety** — `VITE_ENABLE_GEOLOCATION=false` in `.env` disables auto-detect without code changes. Always handle denied/timeout gracefully (fallback to full India view).
14. **GeoJSON Caching** — The India district GeoJSON (~15 MB) is fetched once per session and stored in a component ref. Never re-fetch on state change or heatmap toggle.
15. **UTC-Only Storage** — Working hours are stored in UTC (`workStartTimeUtc`, `workEndTimeUtc`). Always convert via `date-fns-tz → fromZonedTime()`. Use `joiningDate` as anchor. Never store local time in DB.
16. **Tooltip Exclusivity** — Map tooltips must use the `activeTooltipLayerRef` pattern: explicitly `openTooltip()` / `closeTooltip()` on enter/leave. Never use `sticky: true` as it allows multiple tooltips to stack.
17. **Signal Thresholds** — Dashboard signals are: `EXPANSION_CANDIDATE` (≥$50K), `PRICING_OPPORTUNITY` (>$0 <$50K), `NO_ACTIVITY` ($0). Adjust these if data ranges change significantly.
18. **Centroid Markers — Sales Only** — When Heatmap is OFF, centroid markers are only rendered for districts where `revenue > 0 OR deals > 0`. Zero-activity districts get no marker.
