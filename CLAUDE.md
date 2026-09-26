# CLAUDE.md

Single-package React library (`@gamzo/git-graph`), forked from the archived gitgraph.js monorepo and trimmed to the React renderer. pnpm, TypeScript 5, Vitest, knip, Prettier.

## Commands

- `pnpm test` — Vitest (`--globals`, node env; no config file). Single file: `pnpm test src/core/__tests__/gitgraph.commit.test.ts`.
- `pnpm typecheck` / `pnpm build` — `tsc` (build emits ESM + `.d.ts` to `lib/`; tests are excluded).
- `pnpm knip` — unused files/exports/deps; keep it clean.
- `pnpm format` — Prettier over `src`.
- `pnpm example` — Vite showcase in `example/` (imports `src/` via alias; not published). Check changes there in a browser.

## Architecture

- `src/index.ts` — the package entry and the only public export list (`"use client"`).
- `src/core/` — DOM-free graph logic, tested in node. `GitgraphCore` (`gitgraph.ts`) holds commits, branches, refs/tags and template. Users get `GitgraphUserApi` / `BranchUserApi` (`user-api/`, git2json in `user-api/import.ts`) via `getUserApi()`; every mutation schedules a debounced `next()` that notifies `subscribe()` listeners with `getRenderedData()`.
  - `layout.ts` computes rendered data: rows (`rows.ts`, regular vs compact), branch order/colors (`branches-order.ts`), orientation-aware x/y, branch SVG paths (`branches-paths.ts`). `template.ts` has `metro`/`blackarrow` and `templateExtend`.
- `src/Gitgraph.tsx` — the public component: subscribes to core and draws the rendered data as SVG. Pieces live in `components/`, DOM measuring in `measure.ts`, animation in `animation/` (`delays.ts` scheduling, `css.ts` keyframes, `impact.ts` WAAPI for added commits).
- `module: nodenext`: relative imports need `.js` extensions (`./core/index.js`), so `lib/` loads in plain Node ESM / SSR. `tsc` enforces it.
- `isolatedModules` is on: re-export types with `type` (e.g. `export { type Foo }`) or per-file compilers (Vite) break.
- `jsx: "react"` (classic transform) is deliberate, to keep the `react >= 16.8` peer range.
