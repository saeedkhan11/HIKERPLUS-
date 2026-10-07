# HIKER+ Shoes Factory ERP

## Architecture
- **Frontend**: React 18 + Vite 6 + TailwindCSS 3 + lucide-react + recharts
- **Backend**: Supabase (PostgreSQL 15 + GoTrue auth + PostgREST REST API)
- **Security**: RLS (Row Level Security) for workspace isolation, server-side PIN hashing (pgcrypto), admin-only operations enforced in PostgreSQL functions

## Running the app
```bash
docker compose -f docker-compose.base44.yml up -d --build
```
- Frontend (Vite dev server): port 3000
- Supabase API proxy (nginx → GoTrue + PostgREST): port 8000
- PostgreSQL: internal only

The compose file sets up a complete local Supabase instance. The SQL migration runs automatically on first boot.

## Using a hosted Supabase project instead
1. Create a project at supabase.com
2. Run `supabase/migrations/0001_initial_schema.sql` in the Supabase SQL Editor
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Base44 Secrets dashboard

## Database
- Migration: `supabase/migrations/0001_initial_schema.sql`
- All tables use UUID primary keys, `workspace_id` for isolation, soft-delete (`is_deleted`), timestamps
- RLS policies on every table enforce workspace isolation
- Business logic in PostgreSQL functions (SECURITY DEFINER): `create_invoice`, `record_production`, `record_purchase`, `record_payment`, `record_kharcha`, `get_dashboard`, `get_customer_ledger`, `get_supplier_ledger`, `get_recycle_bin`, `restore_record`, `permanent_delete`, PIN management

## Key files
- `frontend/src/lib/services.js` — all data service functions + supabase re-export
- `frontend/src/lib/supabase.js` — Supabase client init from env vars
- `frontend/src/auth/AuthContext.jsx` — auth state, PIN verification, audit logging
- `frontend/src/components/AppShell.jsx` — navigation + layout
- `frontend/src/components/InvoiceSheet.jsx` — printable invoice template

## Security
- No hardcoded credentials, passwords, or PINs in source
- Supabase Auth (GoTrue) for password authentication
- PIN verified server-side via `crypt()` comparison (pgcrypto bcrypt)
- Direct `/dashboard` access requires authentication AND successful PIN verification
- Logout terminates the Supabase session
- RLS prevents cross-workspace access at the database level
- Admin-only operations (permanent delete, user management) checked server-side
- Audit logs track all actions (never store passwords or PINs)

## ERP workflow
Articles → Raw Stock → Production (consumes uppers, produces ready shoes) → Ready Shoes → Invoice (deducts stock, updates customer ledger) → Payment → Roznamcha (cashbook) → Reports
Suppliers → Purchase (adds raw stock, updates supplier ledger) → Supplier Payment → Roznamcha → Reports
