# HIKER+ Shoes Factory ERP

Vite + React (react-router-dom, tailwindcss, recharts, lucide-react) single-page frontend.
No backend in this repo — data/auth goes through Supabase via `@supabase/supabase-js`.

## Run in the Base44 sandbox

```
docker compose -f docker-compose.base44.yml up -d
```

- Web entry point is on host port **3000** (mapped to Vite's 5173 inside the container).
- The container bind-mounts the repo at `/app` and runs `npm install` + `vite` on startup, so source edits hot-reload without a rebuild.
- Vite binds `0.0.0.0`; host allowlisting is handled via `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` (set by the platform).

## Environment / secrets

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are **optional for booting** — `src/lib/supabase.js`
falls back to placeholders and `src/auth/AuthContext.jsx` skips auth when unconfigured, so the app
renders the login screen without them. Provide real values (via the dashboard Secrets page) only
when you need live auth and data.

## Known build history / gotchas

- The project arrived with `frontend/index.html` missing (it had been deleted by a "Revert reviewed
  branch file changes" commit). Vite cannot start without its HTML entry point — it is required.
- `src/pages/NewInvoice.jsx` had an unbalanced paren in an `onClick` arrow (`setForm(` never closed),
  which broke esbuild's dependency scan. Fixed.
- `src/App.jsx` imports 9 pages (`Sales`, `Payments`, `Roznamcha`, `Kharcha`, `Reports`, `Settings`,
  `RecycleBin`, `AuditLogs`, `UserManagement`) that were referenced by the router and sidebar nav but
  never committed. They now exist as lightweight placeholder pages (`src/components/Placeholder.jsx`)
  so the build resolves; replace them with real implementations as needed.

## Verify it works

```
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/   # expect 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/src/App.jsx  # expect 200
```
A 200 on `/src/App.jsx` confirms the full module graph transforms without errors.
