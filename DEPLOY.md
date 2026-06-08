# Deploy Checklist — Dar Al-Amirat Portal

## 1. Neon Database

1. Create a Neon project at [neon.tech](https://neon.tech).
2. Copy the **connection string** (pooled, `postgresql://...`).
3. Set it as `DATABASE_URL` — that is the **only** env var that changes from local.

## 2. Vercel Project

```bash
# First deploy
vercel --prod
```

### Required Environment Variables (Vercel Dashboard → Settings → Environment Variables)

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Neon pooled connection string | The only change from local |
| `NEXTAUTH_URL` | `https://<your-deployment>.vercel.app` | Must match exactly |
| `NEXTAUTH_SECRET` | Random 32-char secret | `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | Same as `NEXTAUTH_URL` | |

All other variables (`ZATCA_*`, `SMTP_*`, etc.) carry over from `.env.local` if used.

## 3. Run Migrations + Seed

After the first successful Vercel deploy (env vars set):

```bash
# Point your local CLI at the hosted DB
DATABASE_URL="<neon-connection-string>" npx prisma migrate deploy

# Seed demo data
DATABASE_URL="<neon-connection-string>" npx prisma db seed
```

## 4. Verify

```bash
curl https://<your-deployment>.vercel.app/api/health
# → { "status": "ok", "db": "connected" }
```

## 5. Ongoing Deploys

Push to `main` → Vercel auto-deploys. Migrations run via the seed script above whenever the schema changes; Vercel does **not** auto-run migrations.
