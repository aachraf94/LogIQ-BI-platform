# LOGIQ Frontend

Next.js 14 (App Router) dashboard for the LOGIQ BI platform. TypeScript + Tailwind CSS + ECharts + Tremor.

**Local port:** 3001 (`http://localhost:3001`)

## Setup

```powershell
cd frontend

npm install

cp .env.local.example .env.local
# .env.local contains:
#   NEXT_PUBLIC_API_URL=http://localhost:8000/api

npm run dev   # http://localhost:3001
```

## Commands

```powershell
npm run dev     # development server with hot reload
npm run build   # production build (also used to catch type/lint errors)
npm run start   # start production server after build
npm run lint    # ESLint check via next lint
```

## Pages

| Route | Description |
|---|---|
| `/login` | JWT login |
| `/overview` | KPI cards, summary charts, notification feed |
| `/transport` | Dedicated transport analytics |
| `/parcel-costs` | PCC (parcel cost comparison) |
| `/routes` | Route performance + logistics map |
| `/alerts` | Alert rule management and acknowledgement |
| `/settings` | User preferences |
| `/admin/users` | User activation and role assignment |
| `/admin/roles` | Role CRUD |
| `/admin/etl` | ETL run history and data freshness |

## Key Libraries

| Library | Version | Role |
|---|---|---|
| Next.js | 14.2 | App Router framework |
| React | 18 | Rendering |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 3.4 | Utility CSS |
| @tremor/react | 3.17 | Dashboard component kit |
| ECharts | 5.5 | Charts (via echarts-for-react) |
| D3 | 7.9 | Custom SVG visualizations |
| React Leaflet | 4.2 | Map rendering |
| Zustand | 4.5 | Client state (auth, filters, notifications) |
| Framer Motion | 11.2 | Animations |

## Environment Variables

```env
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

In Docker, this is injected by `docker-compose.yml` as `http://backend:8000/api`.

## Full documentation

See [docs/frontend-doc.md](../../docs/frontend-doc.md).
