# @gamzo/git-graph

Draw pretty, animated git graphs with React. A React-only fork of the archived [GitGraph.js](https://github.com/nicoespeon/gitgraph.js).

- Zero dependencies (React is a peer), ~36 kB packed, ESM + TypeScript types.
- Works with SSR and the Next.js App Router.
- Lines draw in order and commits fade in; opt into an "impact" when commits are added live.
- Fast on big histories: 2,000 commits lay out in ~50 ms.

## Install

```sh
npm install @gamzo/git-graph
# or: pnpm add @gamzo/git-graph / yarn add @gamzo/git-graph
```

Requires `react >= 18`.

## Quick start

```jsx
import { Gitgraph } from "@gamzo/git-graph";

export function History() {
  return (
    <Gitgraph>
      {(gitgraph) => {
        const main = gitgraph.branch("main");
        main.commit("Initial commit");

        const develop = main.branch("develop");
        develop.commit("Add TypeScript");

        const feature = develop.branch("feature/login");
        feature.commit("Make it work").commit("Make it right").commit("Make it fast");

        develop.merge(feature);
        develop.commit("Prepare v1");

        main.merge(develop).tag("v1.0.0");
      }}
    </Gitgraph>
  );
}
```

The `children` function runs **once**, to build the history. To change the graph afterwards, see [Live graphs](#live-graphs).

## Building a history

`gitgraph` (the argument of `children`) and every branch mirror git:

```jsx
<Gitgraph>
  {(gitgraph) => {
    const main = gitgraph.branch("main");
    main.commit("Init");

    // Commit with options instead of a string.
    main.commit({
      subject: "Add login page",
      body: "Email + password, with a reset link.",
      author: "Ada Lovelace <ada@example.com>",
      dotText: "★",           // text inside the dot
      tag: "v0.1.0",          // tag this commit
    });

    const fix = main.branch("hotfix");
    fix.commit("Fix typo");

    main.merge(fix, "Merge hotfix");                         // merge commit with a subject
    main.merge({ branch: fix, fastForward: true });          // fast-forward when possible

    main.tag("v0.1.1");                                      // tag the branch tip
    gitgraph.tag({ name: "stable", ref: "main" });           // tag any branch or commit hash

    fix.delete();                                            // like `git branch -d`
    main.checkout();                                         // move HEAD
  }}
</Gitgraph>
```

| Call | What it does |
|---|---|
| `gitgraph.branch(name \| options)` | New branch from HEAD. Options: `name`, `from` (branch or commit hash), `style`, `commitDefaultOptions`, `renderLabel`. |
| `gitgraph.commit(subject \| options)` | Commit on the current branch. |
| `gitgraph.tag(name, ref?)` / `gitgraph.tag({ name, ref, style, render })` | Tag a commit hash or branch (default: HEAD). |
| `gitgraph.clear()` | Start over (`rm -rf .git && git init`). |
| `gitgraph.import(json)` | Replace the history with [`git2json`](https://github.com/fabien0102/git2json) output: draw a real repository. |
| `branch.commit(subject \| options)` | Commit on this branch. |
| `branch.branch(name \| options)` | New branch from this one. |
| `branch.merge(branch, subject?)` / `branch.merge({ branch, fastForward, commitOptions })` | Merge another branch (or its name) into this one. |
| `branch.tag(name \| { name, style, render })` | Tag this branch's tip. |
| `branch.checkout()` / `branch.delete()` | Move HEAD here / delete the branch (its commits stay). |

Commit options: `subject`, `body`, `author` (`"Name <email>"`), `hash`, `dotText`, `tag`, `style`, `onClick`, `onMessageClick`, `onMouseOver`, `onMouseOut`, `renderDot`, `renderMessage`, `renderTooltip`.

## Graph options

Pass `options` to `<Gitgraph>` (or to `useGitgraph` / `new GitgraphCore`):

```jsx
<Gitgraph
  options={{
    orientation: "vertical-reverse", // "vertical-reverse" | "horizontal" | "horizontal-reverse"; default: vertical, newest on top
    mode: "compact",                 // pack commits into fewer rows
    template: "blackarrow",          // "metro" (default) | "blackarrow" | a custom template
    author: "Ada Lovelace <ada@example.com>", // default author for every commit
    reverseArrow: false,             // arrows point from parent to child
    branchLabelOnEveryCommit: false, // label every commit, not just the tip
    initCommitOffsetX: 0,            // shift the whole graph
    initCommitOffsetY: 0,
    generateCommitHash: () => crypto.randomUUID().replace(/-/g, ""),
    compareBranchesOrder: (a, b) => a.localeCompare(b), // column order of branches
  }}
>
  {(gitgraph) => { /* … */ }}
</Gitgraph>
```

Every string value also has a constant, if you prefer: `Orientation.Horizontal`, `Mode.Compact`, `TemplateName.BlackArrow`, `MergeStyle.Straight`.

## Custom templates

Start from a built-in template and override what you need with `templateExtend`:

```jsx
import { Gitgraph, templateExtend } from "@gamzo/git-graph";

const template = templateExtend("metro", {
  colors: ["#7c3aed", "#0ea5e9", "#f59e0b", "#10b981"], // one per branch column
  branch: {
    lineWidth: 4,
    spacing: 40,                  // px between branch columns
    mergeStyle: "straight",       // "bezier" (default) | "straight"
    label: { display: true, bgColor: "#f5f3ff", borderRadius: 6, font: "600 11px system-ui" },
  },
  commit: {
    spacing: 48,                  // px between commits
    dot: { size: 8, strokeWidth: 2, strokeColor: "#ffffff" },
    message: {
      displayAuthor: false,
      displayHash: false,
      font: "14px system-ui",
    },
  },
  arrow: { size: 8, color: "#94a3b8" },               // arrows are off unless you give a size
  tag: { bgColor: "#111827", color: "#fff", borderRadius: 4 },
});

<Gitgraph options={{ template }}>{/* … */}</Gitgraph>;
```

Per-branch and per-commit styles override the template:

```jsx
const docs = gitgraph.branch({
  name: "docs",
  style: { color: "#ec4899", lineWidth: 2 },
  commitDefaultOptions: { style: { dot: { size: 5 } } }, // every commit on this branch
});
docs.commit({ subject: "Write the README", style: { message: { color: "#ec4899" } } });
```

## Custom rendering

Every piece can be replaced with your own SVG. Custom renders keep clicks, hovers and tooltips working.

```jsx
import { Gitgraph } from "@gamzo/git-graph";

<Gitgraph>
  {(gitgraph) => {
    const main = gitgraph.branch({
      name: "main",
      // Branch label
      renderLabel: (branch) => (
        <text fill={branch.computedColor} fontWeight="bold">⎇ {branch.name}</text>
      ),
    });

    main.commit({
      subject: "Ship it",
      // The dot: draw inside a (2 × dot.size) square
      renderDot: (commit) => (
        <rect width={commit.style.dot.size * 2} height={commit.style.dot.size * 2} rx={3} fill={commit.style.dot.color} />
      ),
      // The message, next to the dot
      renderMessage: (commit) => (
        <text y={commit.style.dot.size} alignmentBaseline="central" fill={commit.style.message.color}>
          🚀 {commit.subject}
        </text>
      ),
      // The hover tooltip (horizontal and compact modes)
      renderTooltip: (commit) => <text x={20}>{commit.subject}</text>,
      onClick: (commit) => alert(commit.hash),
    });

    // Tags
    main.tag({
      name: "v1",
      render: (name, style) => (
        <text fill={style.bgColor} fontWeight="bold">#{name}</text>
      ),
    });
  }}
</Gitgraph>;
```

In TypeScript, type your helpers with the exported `Commit`, `TagStyle`, `TemplateOptions`, `CommitOptions`, `BranchOptions`, `Branch` and `EdgeProps` types.

## Live graphs

To add commits after the first render (from your data, a button, a websocket…), keep a graph with `useGitgraph` and pass it as `graph`. The second argument builds the first history **once**: use it instead of an effect, since StrictMode runs effects twice and would commit everything twice.

```jsx
import { Gitgraph, useGitgraph } from "@gamzo/git-graph";

export function Live() {
  const graph = useGitgraph({ orientation: "vertical-reverse" }, (gitgraph) =>
    gitgraph.branch("main").commit("Initial commit"),
  );

  return (
    <>
      <button onClick={() => graph.getUserApi().commit("One more")}>Commit</button>
      <Gitgraph graph={graph} animation={{ impact: true }} />
    </>
  );
}
```

Outside React state (a store, a module), create it yourself: `const graph = new GitgraphCore(options)`.

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

## Theming, accessibility, CSP

- **Dark mode:** the default tooltip follows `--gg-tooltip-bg` and `--gg-tooltip-color`: `.my-graph { --gg-tooltip-bg: #222; --gg-tooltip-color: #eee; }`. Everything else comes from the template (see [Custom templates](#custom-templates)).
- **Keyboard:** commits with an `onClick` are buttons: focusable, labelled by their subject, clicked with Enter or Space.
- **Content-Security-Policy:** the animation CSS is injected in a `<style>` tag. Under a strict CSP, pass its nonce: `<Gitgraph nonce={nonce}>`.

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

MIT. Based on GitGraph.js by Nicolas Carlo and Fabien Bernard.
