# AGENTS.md

Guidance for AI coding agents (and new human contributors) working in this repo.
For product context (who it's for / why) see [项目介绍.md](项目介绍.md); for setup and
APIs see [README.md](README.md).

## What this is

A Next.js 15 (App Router) + React 19 + TypeScript app that turns papers/research
into figures via **three independent pipelines**. The whole repo (`app/components/`,
`app/api/`, `lib/`) is grouped by these three names — follow the name to the code:

1. **Mindmap** — paper PDF/text → structured outline + SVG (`lib/mindmap/mindmapGenerator.ts`)
2. **Architecture diagram** — method description → `FigureSpec` → SVG via Dagre layout
   (`lib/figure/figureSpec.ts` → `lib/figure/spec/*` → `lib/figure/renderers/architectureRenderer.ts` → `lib/figure/figureRenderer.ts`)
3. **Chart code** — data → seaborn/ggplot2 code (`lib/chart/chartGenerator.ts`)

Architecture diagrams and mindmaps are **vector SVG, not image-model output** — labels
must be 100% correct. Charts are **code, not images** — values must be real. An AI
image-gen backend exists but its UI is disabled by default.

## Where things live

- `app/api/*/route.ts` — backend, named by pipeline. Heavy routes (`analyze`, `mindmap`,
  `chart`) are rate-limited (`lib/infra/rateLimit.ts`) and read/write local JSON via
  `lib/infra/storage.ts`.
- `app/components/` — client UI. `StudioClient.tsx` is the shell; shared primitives in
  `ui.tsx`; each pipeline has its own subfolder (`mindmap/`, `figure/`, `chart/`).
- `lib/` — framework-agnostic logic, grouped the same way: `mindmap/`, `figure/`,
  `chart/`, plus `parsers/`, `providers/`, and `infra/` (storage/rateLimit/sanitizeSvg/
  exportUtils). Global shared bits stay at the root: `types.ts`, `utils.ts`, `palettes.ts`.
- `scripts/` — dependency-free test/quality harnesses (compile TS on the fly, then run).

## Conventions

- **Single source of truth**: chart types in `lib/chart/chartTypes.ts`, palettes in
  `lib/palettes.ts`, shared types in `lib/types.ts`. Add one entry, don't fork.
- **Pluggable providers**: add a text provider via env; add an image backend by adding
  one entry to the `IMAGE_PROVIDERS` registry in `lib/providers/imageProviders.ts`.
- **All generated SVG escapes text** (`escapeHtml`) and is sanitized before injection
  (`lib/infra/sanitizeSvg.ts`). Keep both layers when touching renderers.
- **LLM may fail** → every path degrades to a local template and surfaces a `status:
  "fallback"` the UI shows as an amber warning. Preserve this; don't make failures silent.
- **Storage writes** go through `withFileLock` + atomic temp-then-rename. Don't bypass it.

## Commands

```bash
npm run dev          # local dev → http://localhost:3000
npm run typecheck    # tsc --noEmit (strict)
npm test             # renderer / escaping / sanitize unit checks
npm run quality:golden  # 3 end-to-end scenario checks
npm run build        # production build (also runs ESLint)
```

Before committing changes to renderers or storage, run `npm run typecheck && npm test &&
npm run quality:golden`.

## Do not touch

- `test/` — user's test paper and demo screenshots. Never delete or overwrite.
- `.env.local` — real API keys; gitignored. Never commit or print its contents.
- `data/` — local runtime data; gitignored.
