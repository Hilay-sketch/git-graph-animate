# CLAUDE.md

Single-package React library (`@gitgraph/react`), forked from the archived gitgraph.js monorepo and trimmed to the React renderer. pnpm, TypeScript 5, Vitest, knip, Prettier.

## Commands

- `pnpm test` — Vitest (`--globals`, node env; no config file). Single file: `pnpm test src/core/__tests__/gitgraph.commit.test.ts`.
- `pnpm typecheck` / `pnpm build` — `tsc` (build emits ESM + `.d.ts` to `lib/`; tests are excluded).
- `pnpm knip` — unused files/exports/deps; keep it clean.
- `pnpm format` — Prettier over `src`.

## Architecture

- `src/core/` — renderer-agnostic graph logic. `GitgraphCore<TNode>` (`gitgraph.ts`) holds commits, branches, refs/tags and template. Users get `GitgraphUserApi` / `BranchUserApi` (`user-api/`) via `getUserApi()`; every mutation schedules a debounced `next()` that notifies `subscribe()` listeners with `getRenderedData()`.
  - `getRenderedData()` computes layout: rows (`graph-rows/`, regular vs compact), branch order/colors (`branches-order.ts`), orientation-aware x/y, branch SVG paths (`branches-paths.ts`). `template.ts` has `metro`/`blackarrow` and `templateExtend`.
- `src/*.tsx` — the React renderer. `Gitgraph.tsx` is the public component (and re-exports the public core API); it subscribes to core and draws the rendered data as SVG. `index.tsx` is the package entry.
- `jsx: "react"` (classic transform) is deliberate, to keep the `react >= 16.8` peer range.
