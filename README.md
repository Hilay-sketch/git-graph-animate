# @gamzo/git-graph

Draw pretty git graphs with React. A React-only fork of the archived [GitGraph.js](https://github.com/nicoespeon/gitgraph.js).

## Install

```sh
pnpm add @gamzo/git-graph
```

Requires `react >= 16.8`. Ships ESM + TypeScript types; use it through a bundler (Vite, Next.js, webpack…).

## Usage

```jsx
import { Gitgraph } from "@gamzo/git-graph";

function MyComponent() {
  return (
    <Gitgraph>
      {(gitgraph) => {
        const master = gitgraph.branch("master");
        master.commit("Initial commit");

        const develop = master.branch("develop");
        develop.commit("Add TypeScript");

        const aFeature = develop.branch("a-feature");
        aFeature
          .commit("Make it work")
          .commit("Make it right")
          .commit("Make it fast");

        develop.merge(aFeature);
        develop.commit("Prepare v1");

        master.merge(develop).tag("v1.0.0");
      }}
    </Gitgraph>
  );
}
```

`<Gitgraph>` also accepts `options` (`template`, `orientation`, `mode`, …) and, for imperative control, a `graph` prop created with `new GitgraphCore()`.

## Animation

Lines draw one after another, parent to child, and each commit fades in when its line arrives. The first draw of a long history is capped at `maxTotal`, so it stays short. Users with `prefers-reduced-motion` get a static graph.

With `impact: true`, a commit added later lands with an impact:
1. The parent commit charges up: it squeezes, trembles and glows, and the line into it swells.
2. The parent lets go: the new line shoots out, speeding up.
3. The new commit slams in: shockwave rings burst from it and the graph jolts.

Its timings scale with `duration`.

```jsx
<Gitgraph>{...}</Gitgraph>                                  // draw + fade (default)
<Gitgraph animation={false}>{...}</Gitgraph>                // off
<Gitgraph animation={{ duration: 300, maxTotal: 1500 }}>   // ms per line, cap for one batch
<Gitgraph animation={{ impact: true }}>{...}</Gitgraph>     // added commits land with an impact
```

The animation CSS is injected in a `<style>` tag. Under a strict Content-Security-Policy, pass its nonce: `<Gitgraph nonce={nonce}>`.

Every line is a `path.gg-edge` with `data-from` / `data-to` (commit hashes). Every commit is a `g.gg-commit` with `data-hash`. Both carry a `--gg-delay` CSS variable. The built-in CSS has zero specificity, so plain CSS overrides it:

```css
.my-graph .gg-edge { animation-timing-function: ease-in-out; }
```

Don't animate `transform` on `.gg-commit`: it would override the commit's position. With `impact`, added commits also carry `gg-added`, and their shockwaves are `circle.gg-ripple`. To tone it down, for example: `.gg-ripple { display: none; }`. The charge and the jolt use the Web Animations API and also respect reduced motion.

To draw lines with a library, use `renderEdge`. It receives `{ d, from, to, stroke, strokeWidth, delay, duration, animated, added }`:

```jsx
import { motion } from "motion/react";

<Gitgraph
  renderEdge={(e) => (
    <motion.path
      d={e.d}
      fill="none"
      stroke={e.stroke}
      strokeWidth={e.strokeWidth}
      initial={e.animated ? { pathLength: 0 } : false}
      animate={{ pathLength: 1 }}
      transition={{ delay: e.delay / 1000, duration: e.duration / 1000 }}
    />
  )}
>
  {...}
</Gitgraph>
```

## Development

```sh
pnpm install
pnpm example     # showcase app (Vite) on localhost
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
pnpm knip        # unused files/exports/deps
pnpm build       # tsc -> lib/
```

## License

MIT
