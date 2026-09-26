# Animatable @gitgraph/react

## Context
Goal: on first render, lines between commits draw start→end **in order**, not all at once.
When a commit is added, only the line(s) into the new commit animate. Consumers can animate
anything their own way (CSS, Motion, GSAP) and can turn animation off.

Decided with the user: **A** (CSS default + `renderEdge` hook, no new deps), **on by default**,
**total time capped**, **lines draw and commits fade in**.

Why the rendering has to change: today `BranchPath.tsx` draws ONE `<path>` per branch (several
"M…" sub-paths across all of the branch's commits). A dash animation runs on every sub-path at
once, and a new commit changes the whole path's `d`. So the lines can't play one at a time, and
a new commit can't animate only its own line. Fix: one `<path>` per edge (parent→child), keyed
by commit hashes. Hashes are stable; coordinates are not, because default vertical puts the
newest commit on top, which shifts every y.

## Public API
```tsx
<Gitgraph>{...}</Gitgraph>                                  // animated (default)
<Gitgraph animation={false}>{...}</Gitgraph>                // off
<Gitgraph animation={{ duration: 250, maxTotal: 2000 }}>   // ms per line / cap for a batch
<Gitgraph renderEdge={(e) => <motion.path d={e.d} … />} />  // full control
```
- `animation?: boolean | { duration?: number; maxTotal?: number }`. Defaults: 300 / 1500.
- `renderEdge?: (e: EdgeProps) => ReactElement` with
  `EdgeProps = { d, from, to, stroke, strokeWidth, delay, duration, animated }`
  (`from`/`to` are commit hashes, `delay`/`duration` in ms). Same pattern as `renderDot`.
- Hooks for CSS and other libraries: classes `gg-edge`, `gg-commit`. Attributes `data-from`,
  `data-to` on edges and `data-hash` on commits. Inline CSS variables `--gg-delay` and `--gg-duration`.
- Both props go on a shared base interface used by both `GitgraphProps` variants
  (`Gitgraph.tsx:46-55`). Export the `EdgeProps` type.

## Changes

### 1. Core: split branch paths into edges — `src/core/branches-paths.ts`
- New `toSvgEdges(coordinates, commits, isBezier, isVertical, isReverse, mapPoint)` returns
  `Array<{ from: hash; to: hash; d: string }>`.
  - Walk each sub-path and cut it at points that equal a commit's **raw** x/y. Each chunk
    between two commit points is one edge. Branches never share a column
    (`branches-order.ts`), so this is sound in compact mode too.
  - Keep `toSvgPath`'s rule: a segment is a `C` if its index in the ORIGINAL sub-path is 1 or
    the last one, otherwise an `L`. The geometry stays pixel-identical.
  - In reverse orientations, sub-paths run child→parent (`branches-paths.ts:181/210`,
    `gitgraph.ts:431-448`). Reverse the chunk's points and swap its first/last curve flags. The
    midpoint control points are symmetric, so the shape is the same.
  - Skip sub-paths with one point or fewer. If a chunk's end matches no commit (the
    merged-deleted-branch edge case, `:81`), keep the rest as one edge keyed by its endpoints.
  - Apply `mapPoint` (the renderer's `getWithCommitOffset`) only when building `d`, after matching.
- Delete `toSvgPath` if nothing uses it any more (knip), and move its tests over to `toSvgEdges`.

### 2. Timing — new `src/animation.ts` (pure, tested)
- `assignDelays(commits, edges, known: Map<key, number>, { duration, maxTotal })`:
  - Each commit or edge gets its delay once and keeps it; existing keys are never touched.
  - New commits in this batch, in creation order: `step = min(duration, maxTotal / n)`.
  - The edge into new commit i gets `delay = i * step`. The commit gets `delay = i * step + duration`
    (it fades in when its line arrives). A commit with no incoming new edge (the root) gets `i * step`.
  - Two merge edges into one commit share a delay, which is intended.
- Exports the fixed `ANIMATION_CSS` string:
  - Everything sits inside `@media (prefers-reduced-motion: no-preference)` and `:where(...)`
    selectors, so any user CSS wins.
  - `.gg-edge`: `stroke-dasharray: 1 1; animation: gg-draw var(--gg-duration) linear var(--gg-delay) backwards`.
  - `.gg-commit`: `animation: gg-fade …`. **Opacity only**, because a CSS `transform` would
    override the positional `transform` attribute (`Commit.tsx:139`).
  - `@keyframes gg-draw { from { stroke-dashoffset: 1.001 } to { stroke-dashoffset: 0 } }`.
    Using 1.001 avoids a dot showing from the round cap.

### 3. Renderer
- `BranchPath.tsx` becomes the edge renderer: one `<path pathLength={1} className="gg-edge" …>`,
  or `renderEdge(...)` when provided.
- `Gitgraph.tsx`:
  - `renderBranchesPaths` → `renderEdges`: every edge rendered **flat under one `<g>`**, keyed
    `from->to`. Nothing remounts when a branch is deleted or fast-forwarded, so nothing replays.
  - Keep a `delays` map as an instance field. Update it in the data handler, not in `render`.
    Store the edges in state.
  - Emit `<style>{ANIMATION_CSS}</style>` inside the `<svg>` only when animation is on. Pass
    `--gg-duration` on the `<svg>`.
  - Seed state from `this.gitgraph.getRenderedData()` in the constructor. Otherwise, with the
    `graph` prop, a remount stays empty and then the whole history animates on the next commit.
  - Store the `subscribe()` unsubscribe function and call it in `componentWillUnmount`.
- `Commit.tsx`: on the outer `<g>`, add `className="gg-commit"`, `data-hash`, and
  `style={{'--gg-delay': …}}` (passed in as a prop). The dot, arrows, message, label and tags
  all fade with it.
- `index.tsx`: export the `EdgeProps` type (use `type` re-exports, because `isolatedModules` is on).

### 4. Example + docs
- `example/main.tsx`:
  - The existing sections animate by default.
  - LiveGraph's "Add commit" shows the single-line animation.
  - Add an "Animation" section with an on/off toggle, a slow `duration`, and a `renderEdge`
    demo (a custom stroke, no new dependency).
- README: an animation section with the CSS-override, disable and Motion `renderEdge` snippets.

## Order of work
0. Write the spec to `docs/superpowers/specs/2026-09-25-animation-design.md` and commit it.
1. TDD `toSvgEdges`: 4 orientations × bezier/straight, merge, branch-off, compact, single
   commit, and a check that the concatenated edges draw the same geometry as the old `toSvgPath`.
2. TDD `assignDelays`: initial batch order, cap, one added commit gets delay 0, existing keys unchanged.
3. Renderer wiring, then the example.

## Verification
- `pnpm test`, `pnpm typecheck`, `pnpm knip`, `pnpm build`.
- Check in a browser with `pnpm example` (claude-in-chrome, recorded as a GIF):
  - The initial draw plays in order and finishes within about 1.5s.
  - "Add commit" animates only the new line.
  - All 4 orientations and compact mode draw in the right direction.
  - Blackarrow arrows appear with their commit.
  - `animation={false}` shows a static graph.
  - Emulated reduced motion (DevTools rendering) shows a fully drawn static graph.
- Compare screenshots against `master` with animation off: the graph must look the same.

## Out of scope (add when asked)
- Moving existing commits smoothly when history shifts (CSS `d` transitions aren't supported in Safari).
- Exit animations and `clear()` transitions.
- A CSP `nonce` prop for the `<style>` tag.
