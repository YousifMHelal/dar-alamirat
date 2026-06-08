# Dar Al-Amirat — Operations Portal

Enterprise operations dashboard for **Dar Al-Amirat**, a premium Saudi beauty retailer.

> **Phase 0 — Foundation & Shell.** This phase delivers the project scaffold, the bilingual (Arabic + English) RTL-aware responsive shell, the design-token layer, the database connection, and placeholder routes for all 8 modules. Domain features, data models, and auth arrive in later phases.

---

## Tech stack

| Area       | Choice                                                                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework  | [Next.js 16](https://nextjs.org) (App Router) + TypeScript (strict)                                                                                                   |
| Styling    | [Tailwind CSS 4](https://tailwindcss.com) (CSS-first theme) + shadcn-style primitives                                                                                 |
| i18n / RTL | [next-intl 4](https://next-intl.dev) with `[locale]` routing                                                                                                          |
| Database   | [Prisma 7](https://prisma.io) + Postgres (local Docker for dev; any hosted Postgres, e.g. [Neon](https://neon.tech), via `DATABASE_URL`) — connection only this phase |
| Icons      | [lucide-react](https://lucide.dev)                                                                                                                                    |
| Fonts      | IBM Plex Sans Arabic (AR) · Inter (EN) · Playfair Display (Latin display) via `next/font`                                                                             |

---

## Prerequisites

- **Node.js ≥ 20.19** (Prisma 7 requirement)
- **Docker** + Docker Compose — runs the local Postgres (see [Database (local)](#database-local)). Any other Postgres (e.g. hosted Neon) works too; just point `DATABASE_URL` at it.

---

## Setup

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Configure environment
cp .env.example .env
#    .env already points at the local Docker Postgres; edit DATABASE_URL
#    only if you're using a hosted DB instead.

# 3. Start the local database (Docker) — see "Database (local)" below
docker compose up -d

# 4. (Re)generate the Prisma client if needed
npx prisma generate

# 5. Run the dev server
npm run dev
```

Open **http://localhost:3000** — `/` redirects to **`/ar/overview`** (Arabic is the default locale).

### Environment variables

| Variable       | Required | Description                                                                                                                                             |
| -------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | Yes      | Postgres connection string. Defaults to the local Docker DB; swap for a hosted string (e.g. Neon) elsewhere. Used by the Prisma CLI and runtime client. |

---

## Database (local)

Local development uses a Dockerized **Postgres 16** ([docker-compose.yml](docker-compose.yml)),
container `daralamirat-db`, on host port **5432**. Data persists in the named volume
`daralamirat_pgdata`.

```bash
docker compose up -d        # start the DB (waits until healthy)
docker compose ps           # check status — should report "healthy"
docker compose down         # stop the DB (data persists in the volume)
docker compose down -v      # stop AND wipe all data (removes the volume)
```

Run migrations against it (creates the `prisma/migrations` history):

```bash
npx prisma migrate dev      # apply/author migrations on the local DB
# or, for a schema with no models yet:
npx prisma db pull          # introspect — confirms the connection works
```

The connection string lives entirely in `.env` (`DATABASE_URL`). Moving to a **hosted DB**
(Neon or otherwise) is just swapping that one value — no app or Prisma code changes.

---

## Scripts

| Command          | Description                                         |
| ---------------- | --------------------------------------------------- |
| `npm run dev`    | Start the dev server                                |
| `npm run build`  | Generate the Prisma client and build for production |
| `npm run start`  | Serve the production build                          |
| `npm run lint`   | Run ESLint                                          |
| `npm run format` | Format the codebase with Prettier                   |

---

## Verifying the foundation

- **Routing & locale**

  ```bash
  curl -i http://localhost:3000/            # 307 → /ar
  curl -i http://localhost:3000/ar          # 307 → /ar/overview
  ```

  All 8 modules load under both locales, e.g. `/ar/catalog`, `/en/financials`.

- **Database health** — runs a trivial `SELECT 1` against the configured Postgres:

  ```bash
  curl http://localhost:3000/api/health
  # connected:    { "status": "ok",    "database": "connected",    ... }   → HTTP 200
  # not connected:{ "status": "error", "database": "disconnected", ... }   → HTTP 503
  ```

- **Language + RTL** — the AR/EN toggle in the topbar switches the locale and mirrors
  the entire layout live (sidebar side, padding, text alignment) with no reload, because
  the layout uses Tailwind **logical properties** throughout (`ps/pe`, `ms/me`, `start/end`).

---

## Project structure

```
prisma/
  schema.prisma            # empty domain (Phase 0) — connection only
prisma.config.ts           # Prisma 7 config (DATABASE_URL lives here)
messages/
  ar.json  en.json         # message catalogs — every UI string is here
src/
  app/
    globals.css            # ← design tokens (single source of truth)
    api/health/route.ts    # GET /api/health — DB connectivity probe
    [locale]/
      layout.tsx           # sets <html lang/dir>, fonts, i18n provider
      page.tsx             # /[locale] → redirect to /overview
      (dashboard)/         # shared shell layout segment
        layout.tsx         # sidebar + drawer + topbar frame
        overview/ … settings/   # the 8 module routes
  components/
    shell/                 # sidebar, mobile drawer, topbar, language toggle, …
    ui/                    # shadcn-style primitives (button, …)
    module-page.tsx        # shared placeholder page for every module
  i18n/                    # routing, request config, locale-aware navigation
  lib/
    fonts.ts  modules.ts  prisma.ts  utils.ts
  middleware.ts            # next-intl locale negotiation
```

---

## Design system

The entire portal themes from **one place**: the CSS variables in
[`src/app/globals.css`](src/app/globals.css). Colours are authored in OKLCH — a refined
**editorial light palette**: warm paper-white surfaces, a muted **mauve/rose** primary
accent, a warm **bronze** secondary, soft layered shadows, and restrained radii. Every later
phase pulls from these tokens (`bg-background`, `text-foreground`, `border-border`,
`bg-primary`, `shadow-soft`, …) rather than hard-coded values.

---

## Internationalization & RTL notes

- **Arabic (`ar`) is the default locale**; English (`en`) is the toggle. Locale lives in the
  URL via the `[locale]` segment.
- `<html lang dir>` is derived from the active locale in
  [`src/app/[locale]/layout.tsx`](src/app/%5Blocale%5D/layout.tsx) — `dir="rtl"` for Arabic,
  `dir="ltr"` for English. The correct font face leads the stack per locale.
- Layout mirroring is achieved entirely with **logical properties** — no physical
  `pl/pr/ml/mr/left/right`, so switching locale flips the whole UI with zero per-component
  overrides.
- All user-facing strings come from `messages/ar.json` and `messages/en.json`. Add a key to
  **both** files when introducing new copy.
