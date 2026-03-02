# Gitalyze — Agent Guide

This file is for coding agents working in this repository.
Follow it as the project-specific source of truth.

## Project Snapshot

- Stack: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS.
- Runtime/tooling: Bun is preferred (`bun.lock` is committed).
- Purpose: GitHub user/repo analytics + scoring + optional Groq AI summaries/recommendations.
- Path alias: `@/*` -> `src/*` (see `tsconfig.json`).

## Cursor / Copilot Rules

- `.cursor/rules/`: not present.
- `.cursorrules`: not present.
- `.github/copilot-instructions.md`: not present.
- Therefore, this `AGENTS.md` is the primary agent instruction file in-repo.

## Install / Build / Lint / Run

- Install deps: `bun install`
- Start dev server: `bun run dev`
- Typecheck (project "lint"): `bun run lint` (runs `tsc --noEmit`)
- Production build: `bun run build`
- Start production server: `bun run start`

## Test Commands (Current State)

There is no dedicated test runner configured in `package.json` today.
No `*.test.*` / `*.spec.*` files are present currently.

Use these targeted checks instead:

- Type-only check: `bun run lint`
- Build/runtime integration check: `bun run build`
- Evaluation script (requires dev server or `EVAL_BASE_URL`):
  - `bun scripts/eval-profiles.ts <github-username>`
  - Example single target: `bun scripts/eval-profiles.ts octocat`

If a test runner is added later, prefer Bun-native invocation:

- All tests: `bun test`
- Single file: `bun test path/to/file.test.ts`
- Single test name: `bun test path/to/file.test.ts -t "test name"`

## Pre-PR Verification

Before finishing any non-trivial change, run:

1. `bun run lint`
2. `bun run build`

If you touched recommendation/scoring logic, also run:

3. `bun scripts/eval-profiles.ts <one-or-more-usernames>`

## Repository Layout

- `app/`: App Router pages + API routes (`app/api/**`) + SEO (`sitemap.ts`, `robots.ts`).
- `src/views/`: top-level page view components (Home, Dashboard, RepoDetail, etc.).
- `src/components/`: reusable UI and app components.
- `src/hooks/`: client hooks (notably `useGithubAnalytics`).
- `src/lib/`: domain logic (github, scoring, recommendations, groq, snapshot).
- `src/lib/server/`: server helpers and cache utilities.
- `scripts/`: one-off/evaluation scripts.
- `metadata.json`: site metadata used by SEO-related code.

## Environment Variables

Source of truth is `.env.example`.
When env usage changes, update `.env.example` and `README.md` together.

Required for canonical SEO URLs:

- `SITE_URL`
- `NEXT_PUBLIC_SITE_URL`

Optional operational flags:

- `GITHUB_API_TOKEN`
- `GROQ_API_KEY`
- `GROQ_MODEL`, `GROQ_TIMEOUT_MS`, `GROQ_MAX_RETRIES`
- `RECOMMENDATION_CACHE_TTL_MS`, `NEXT_PUBLIC_RECOMMENDATION_CACHE_TTL_MS`
- `GROQ_COOLDOWN_MS`
- `FORCE_AI_RECS`

## Code Style and Conventions

## TypeScript

- Prefer explicit, narrow types at module boundaries (API responses, function params, return types).
- Use `type`/`interface` for data shapes; keep shared shapes in `src/lib/*` when reused.
- Avoid `any`; if unavoidable, isolate and normalize immediately.
- `tsconfig` has `noUnusedLocals` and `noUnusedParameters` enabled: remove dead code.
- `strict` is currently `false`; still write code as if strict-mode hygiene is expected.

## Imports

- Order imports in this pattern unless file already follows another stable pattern:
  1) framework/external packages
  2) internal alias imports (`@/...`)
  3) relative imports
- Prefer `import type` for type-only imports.
- Use alias imports (`@/...`) across directories; use relative imports for same-folder modules.

## Naming

- Components: PascalCase (`RepoDetail`, `SearchInput`).
- Hooks: camelCase prefixed with `use` (`useGithubAnalytics`).
- Variables/functions: camelCase.
- Constants: UPPER_SNAKE_CASE for true constants; otherwise descriptive camelCase.
- API route files follow Next convention: `route.ts` under path segments.

## Formatting

- Match surrounding file style; do not reformat unrelated code.
- Existing code uses double quotes in many files and semicolons in several server/lib files.
- Keep JSX readable: break long prop lists and complex objects across lines.
- Keep utility class strings grouped logically; avoid churn-only class reordering.

## React / Next.js Practices

- Prefer functional components.
- Use `"use client"` only where client hooks/state/browser APIs are required.
- Prefer server metadata via `generateMetadata()` for route-level SEO.
- Page titles should be page-only; global template appends `| Gitalyze`.
- In effects, guard against loops and duplicate network requests (request keys/refs are used in repo).

## API Routes and Error Handling

- Validate request payloads early and return `NextResponse.json(..., { status })` with clear `message`.
- Wrap external calls in `try/catch`; provide deterministic fallbacks where implemented.
- Keep fallback payload contracts stable (e.g., `fallback`, `message`, optional retry metadata).
- Log errors for diagnostics, but avoid leaking sensitive values.
- Preserve non-destructive behavior for transient upstream failures (avoid sticky degraded cache states).

## Caching and Data Fetching

- Reuse existing cache helpers/patterns (`TtlCache`, in-memory maps, client localStorage keys).
- Version cache keys when payload semantics/parsing changes.
- Normalize cached AI text before rendering.
- For GitHub API calls, follow existing auth header pattern and URL construction via `URL` when query params are involved.

## AI/Groq-Specific Guidelines

- Keep deterministic fallback behavior intact; do not make AI a hard dependency.
- If adding validation gates, ensure invalid AI output falls back cleanly.
- Retry only for retryable conditions; cap retries to avoid request spam.
- Avoid prompt text that is likely to be echoed verbatim by the model.

## Change Discipline for Agents

- Keep edits focused; avoid unrelated refactors.
- Do not add new dependencies unless necessary.
- Do not commit generated artifacts like `tsconfig.tsbuildinfo`.
- If you change env usage, docs must be updated in the same patch.
- Prefer small, reviewable patches and include verification commands in your final handoff.
