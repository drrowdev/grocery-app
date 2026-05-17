# Ostoslista — Smart Grocery App

A bilingual (Finnish / Swedish) smart shopping list PWA that:

- **Categorizes items automatically** in FI/SV via Claude.
- **Dedupes** via canonical names + aliases (no "maito" vs "maitoa" duplicates).
- **Learns your recurring needs** — quantity and cycle days — and surfaces "Running low soon" suggestions (never auto-adds).
- **Shares lists in real time** with your household via Supabase Realtime.
- **Sorts by store aisle order** (drag-to-reorder per store).
- **Tracks pantry stock** for accurate refill predictions.
- **Works offline as a PWA** — installable on iPhone home screen and desktop.

## Stack

- **Next.js 16** (App Router) + Tailwind 4 + TypeScript
- **Supabase** — Postgres + magic-link auth + Realtime + RLS
- **Anthropic Claude Haiku 4.5** — categorization, NL parsing, seasonality
- **Vercel** — hosting (Hobby tier, auto-deploys from `main`)
- **[FSOB](https://kotus.fi/sanakirjat/muita-sanakirjoja/finlandssvensk-ordbok)** — Finlandssvensk ordbok by Institutet för de inhemska språken (Kotus), CC BY 4.0. Bundled at build time to keep our Finland-Swedish output correct.

## Local development

```bash
pnpm install
cp .env.example .env.local        # then fill in keys
pnpm dev
```

Open <http://localhost:3000>.

## Environment variables

See [`.env.example`](.env.example). You need:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` from your Supabase project.
- `ANTHROPIC_API_KEY` for the Claude integration (server-side only).

## Project status

Phase 1 scaffold — landing screen with bilingual toggle and PWA manifest. Supabase schema, auth, and Claude integration are next.

See the build plan in the session workspace.
