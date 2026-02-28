<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/0c2cf118-6213-4baa-965f-8a1bc69470ce

## Run Locally

**Prerequisites:** Bun (recommended) or Node.js

1. Install dependencies:
   `bun install` (or `npm install` / `yarn install` if you prefer)
2. Set the required environment variables in `.env.local` (see the AI & SEO sections below).
3. Run the dev server (Express + Vite middleware) with:
   `bun run dev`

After running `bun run build`, preview the production bundle via the same server:
`bun run preview`
`bun run preview` executes `NODE_ENV=production bun ./server.ts`, so the static assets and API routes live on a single process - no need to run `vite preview` or maintain two terminals.

## SEO & Sitemap

- Set the `SITE_URL` (and optionally `VITE_SITE_URL` if you need the browser to know it) in `.env.local` (or `.env.example`) so canonical URLs and the sitemap reflect your production domain. The client bundle now reads `VITE_SITE_URL` while Node still falls back to `SITE_URL`/`metadata.json` when missing.
- `npm run build` (or `bun run build`) automatically runs `bun run generate:sitemap`, which outputs `dist/sitemap.xml` and `dist/robots.txt` using the canonical route list.
- In production, `/sitemap.xml` and `/robots.txt` are served by the Express backend. During development you can rerun `bun run generate:sitemap` before previewing.

## AI recommendations

- Groq responses are cached for `RECOMMENDATION_CACHE_TTL_MS` milliseconds on the server (default 900000ms = 15 minutes) and the dashboard respects the same TTL on the client via `VITE_RECOMMENDATION_CACHE_TTL_MS`. Shorten the window for fresher tips or lengthen it to chew through fewer tokens.
- Once a rate limit hits, the backend enforces `GROQ_COOLDOWN_MS` before making more requests; during the cooldown the dashboard hides the retry button, shows the remaining wait time, and still renders deterministic remediation guidance generated through `generateRecommendations`.
- Flip `FORCE_AI_RECS=true` to skip Groq entirely and always receive the heuristic remediation plan, which is handy when you’re trying to conserve quota or debug without hitting the AI provider.
- Set `GROQ_API_KEY` in your `.env.local` (matching the free tier key) and optionally override `GROQ_ENDPOINT`, `GROQ_MODEL`, `GROQ_TIMEOUT_MS`, or `GROQ_MAX_RETRIES` if you need to target a different Groq deployment.
