# Deploying Sapper

Stack: **Neon** (Postgres) + **Render** (Fastify API) + **Vercel** (Vite frontend). Each has a free tier sufficient for a demo.

## 1. Database — Neon (~10 min)

1. Go to [neon.tech](https://neon.tech) → **New Project** → name it `minesweeper`.
2. Copy the **pooled** connection string. It looks like:
   `postgresql://USER:PASSWORD@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`
3. Run migrations from your local machine **once**:
   ```bash
   DATABASE_URL='paste-string-here' npm --prefix server run migrate
   ```
   You should see each `00x_*.sql` file applied. Re-running is safe — already-applied files are skipped.

## 2. Backend — Render (~20 min)

The repo already ships `server/render.yaml`. Render reads it as a Blueprint.

1. Push the repo to GitHub (private is fine).
2. Go to [render.com](https://render.com) → **New** → **Blueprint** → connect the repo.
3. Render detects the `render.yaml` and creates the `minesweeper-api` web service.
4. On the new service, set the environment variables:
   - `DATABASE_URL` → paste the Neon pooled string from step 1.
   - `CLIENT_ORIGIN` → leave blank for now; fill after step 3.
   - `JWT_SECRET` → Render auto-generates this from the YAML.
   - `NODE_ENV` → already `production` from the YAML.
5. Click **Manual deploy**. First build takes ~3 minutes (free dyno).
6. Note the public URL (e.g. `https://minesweeper-api.onrender.com`).

> Render's free plan **sleeps the service after ~15 min idle**. The first request after sleep takes 20–30 s to wake. Mention this in your README or warm the API with a cron call.

## 3. Frontend — Vercel (~10 min)

The repo ships `vercel.json` for the Vite preset + SPA rewrites.

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project** → import the repo.
2. Framework auto-detected as **Vite**. Output directory `dist`. No changes needed.
3. Set environment variable:
   - `VITE_API_URL` → the Render URL from step 2 (e.g. `https://minesweeper-api.onrender.com`).
4. **Deploy**. You'll get a URL like `https://minesweeper-abc123.vercel.app`.

## 4. Wire up CORS / cookies (~5 min)

1. Back on Render → service → Environment → set `CLIENT_ORIGIN` to the Vercel URL exactly (no trailing slash).
2. **Manual deploy** to pick up the new env.
3. Hit `https://your-vercel-url.vercel.app`. Register a new account, log in, play a game.
4. Open DevTools → Application → Cookies. The session cookie should show `SameSite=None; Secure`. Reload to confirm you stay logged in.

If login looks like it "succeeds" but you bounce back to logged-out: the cookie is being dropped. Double-check:
- `CLIENT_ORIGIN` on Render exactly matches your Vercel origin.
- The API URL on Vercel is `https://` (not `http://`).
- `NODE_ENV=production` on Render (this is what flips `sameSite='none'` and `secure=true`).

## 5. Optional polish

- **Custom domain**: Vercel → Settings → Domains. Update `CLIENT_ORIGIN` on Render afterwards.
- **Keep the API warm**: an uptime monitor (Uptimerobot, etc.) hitting `/api/health` every 5 min prevents the cold-start delay.
- **Migrations on every deploy**: add a `postdeploy` script and call `npm run migrate`, or run from Render Shell after schema changes.

## Quick reference: env vars

| Where     | Name              | Value                                                  |
|-----------|-------------------|--------------------------------------------------------|
| Render    | `DATABASE_URL`    | Neon pooled connection string                          |
| Render    | `JWT_SECRET`      | Auto-generated (or any long random string)             |
| Render    | `CLIENT_ORIGIN`   | Vercel deployment URL (e.g. `https://x.vercel.app`)    |
| Render    | `NODE_ENV`        | `production`                                           |
| Vercel    | `VITE_API_URL`    | Render API URL (e.g. `https://x.onrender.com`)         |
