# Gitalyze — Agent Notes

## Summary

Gitalyze is a Next.js 15 + React 19 + TypeScript app (Bun preferred) that visualizes GitHub user/repository analytics, provides a score breakdown, and can optionally generate AI recommendations via Groq.

## Dev Workflow

- Install: `bun install`
- Dev server: `bun run dev`
- Typecheck: `bun run lint` (runs `tsc --noEmit`)
- Production build: `bun run build`
- Start (after build): `bun run start`

## Environment Variables

Source of truth: `.env.example` (keep it in sync with docs).

### Required (SEO/canonical URLs)

- `SITE_URL` — server-side canonical host used for sitemap/robots/metadata.
- `NEXT_PUBLIC_SITE_URL` — client-exposed canonical host.

### Optional

- `GITHUB_API_TOKEN` — increases GitHub API rate limits.
- `GROQ_API_KEY` — enables AI recommendations.
- `GROQ_MODEL`, `GROQ_TIMEOUT_MS`, `GROQ_MAX_RETRIES` — Groq request tuning.
- `RECOMMENDATION_CACHE_TTL_MS` — server cache TTL for AI results.
- `NEXT_PUBLIC_RECOMMENDATION_CACHE_TTL_MS` — client cache TTL.
- `GROQ_COOLDOWN_MS` — cooldown after rate limiting.
- `FORCE_AI_RECS` — set to `true` to always use deterministic fallback recommendations.

## Repo Layout

- `app/` — Next App Router routes, metadata, `sitemap.ts`, `robots.ts`.
- `src/` — views/components and library helpers.
- `metadata.json` — site name/description/theme color used by metadata and SEO.

## Conventions

- TypeScript + functional React components.
- Prefer server-side `generateMetadata()` for per-route metadata.
- Page titles should be “page-only” (do not append site name); the global template adds `| Gitalyze`.
- Avoid adding unused env vars; when env usage changes, update `.env.example` and `README.md` together.

## Verification

Before finishing a change, run:

- `bun run lint`
- `bun run build`
