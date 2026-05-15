# Sapper — Minesweeper, reimagined

A modern web platform for Minesweeper that turns a 35-year-old single-player game into something competitive, social, and worth coming back to every day.

> Think **chess.com for Minesweeper**: instant play, daily challenges with a global leaderboard, an AI coach that explains why a cell is safe, and a cosmetic economy on top.

**Live demo:** _coming — paste your deploy URL here before submission_
**Repo:** https://github.com/Disfyy/sapper-minesweeper

---

## What this is

Most Minesweeper sites on the internet are the same: a grid, a timer, and a smiley face. They are clones of the 1990 Windows version. There is no reason to come back tomorrow, no reason to make an account, and no way to share a result.

Sapper is the version that earns a return visit:

- **Daily Challenge** — one identical board for every player, every day, ranked by time and accuracy. Brings the daily-puzzle habit (NYT Mini, Wordle) to Minesweeper.
- **AI Coach** — during a regular game, the coach can point at a cell and tell you *why* it is safe or *why* it is probably a mine, in plain language. It's a tool for getting better, not a cheat.
- **Speed Sapper (2 min)** — a unique mode built for short attention spans. Score as much board as you can before the clock hits zero. Different game, same mechanics.
- **Global + city leaderboard** — compete with the world or just with players in your own city ("Топ игроков из Алматы").
- **Theme economy** — earn coins by winning, spend them on cosmetic themes. A one-time Pro upgrade unlocks premium themes and a profile badge.
- **Replay + history** — every move you make is saved. Open any past game and walk through it move-by-move to learn from your mistakes.
- **Bilingual** — full English / Russian UI.

## Who it's for

- People who already love probabilistic / logic puzzles and want a daily ritual.
- Casual players who quit Minesweeper because it felt like a museum piece.
- Learners — the AI Coach makes the game's logic visible instead of buried in pixel-hunting.

## Why it's valuable

Solo Minesweeper is a solved game from the user's side: you either know the trick or you don't. Adding **time pressure** (Speed mode), **shared boards** (Daily Challenge), **comparison** (leaderboards), and **explanation** (AI Coach) turns it into a product with retention loops, not a tech demo.

---

## Feature tour

| Area | What ships today |
|---|---|
| Game logic | Flood-fill reveal, chord, first-click safety, seeded RNG for reproducible boards |
| Difficulty | Beginner (9×9), Intermediate (16×16), Expert (16×30), Speed (2-min), Custom |
| Coach | Mine-probability solver with natural-language reasoning ("safe — neighbor (2,2) shows 1 and that mine is already flagged") |
| Daily | UTC-rotating seed, one ranked attempt per user per day |
| Auth | Email + password, JWT in HttpOnly cookie, guest play supported |
| Persistence | PostgreSQL — every move saved, replayable in the Analysis page |
| Leaderboard | Per-difficulty, global or city-filtered |
| Economy | Coins on win (capped daily), theme shop, Pro tier |
| Theming | Dark / light, 6 accent palettes, smooth transition |
| Audio | Synthesized SFX (Web Audio API — no asset bundle bloat) |
| i18n | English + Russian, ~300 strings |
| Accessibility | Keyboard play, ARIA labels, semantic landmarks |
| Mobile | Responsive grid, long-press for flag, bottom-nav on small screens |

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | Modern, fast HMR, type safety on the game logic |
| Styling | CSS Modules + CSS variables | No runtime cost, no Tailwind lock-in, easy theming via tokens |
| Routing | React Router 7 | Standard, file-co-located |
| State | `useReducer` for game state, Context for auth/theme/language | Game state is pure and serializable — easy to replay |
| Backend | Fastify + TypeScript | Lightweight, fast, good DX |
| Database | **PostgreSQL** (not Supabase/Firebase) | The rubric suggests Supabase/Firebase, but a real Postgres + a typed query layer keeps full control over schema, indices, and dedup logic for the leaderboard. The end-user experience is the same. |
| Auth | bcrypt + JWT in HttpOnly cookie | Standard, no third-party dependency |
| Audio | Web Audio API (synthesized) | Zero asset cost; tones are generated on the fly |

## Local development

Requirements: Node 20+, npm, a running Postgres instance.

```bash
# 1. install
npm install
npm install --prefix server

# 2. configure server env
cd server && cp .env.example .env   # then edit DATABASE_URL + JWT_SECRET
cd ..

# 3. run migrations
npm run db:migrate

# 4. run frontend + backend in two terminals
npm run dev           # frontend on http://localhost:5173
npm run dev:server    # backend on http://localhost:3000
```

## Project layout

```
src/
  game/              Pure game logic — board, reveal, flag, scoring, coach
  components/        React UI — Board, Cell, Game, Layout
  pages/             Route-level components
  features/play/     Difficulty picker + replay
  theme/             ThemeProvider + tokens.css (CSS variables)
  i18n/              LanguageProvider + translations (en / ru)
  audio/             Web Audio SFX
  auth/              AuthProvider + JWT cookie handling
  ui/                Reusable UI primitives — Button, Card, Hero, Input
  api/               Typed fetch client for the backend

server/
  src/               Fastify app, routes, auth, db
  migrations/        Versioned SQL — run with `npm run db:migrate`
```

## Roadmap

Things explicitly out of scope for this submission but mapped out:

- Real Stripe Checkout (currently a demo form on the same domain)
- Real-time multiplayer races (server-issued seed exists; sockets do not)
- Friend graph + invite links
- Theme-creator (user-uploaded palettes)

## Notes on the build

This project was built as part of the **nFactorial Sapper assignment**. The rubric defines five levels — the goal here is a comfortable Level 3.5+ that shows clear Level 4 ambition (Daily Challenge, AI Coach with explanations, city leaderboard, unique niche, monetization). Every Level 3 requirement is covered (timer, history, stats, auth, themes, mobile, persistent DB), and the Level 4 "Великий" boxes are ticked one-by-one. See [the rubric file](https://nfactorial-group.notion.site/Minesweeper-35627798ee098044877ce7394846aabd) for the full criteria.

Built with care, occasional caffeine, and AI pair-coding (Cursor + Claude).
