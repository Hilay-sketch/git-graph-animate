# @gamzo/git-graph

Animated git graphs for React. Zero dependencies, TypeScript types, SSR-ready.

**[Live demo](https://gitgraph-showcase.vercel.app/)** · [Try your own graph](https://gitgraph-showcase.vercel.app/#make-it-yours)

```sh
npm install @gamzo/git-graph
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

        const feature = main.branch("feature");
        feature.commit("Make it work").commit("Make it fast");

        main.merge(feature).tag("v1.0.0");
      }}
    </Gitgraph>
  );
}
```

## API

| Call | Does |
|---|---|
| `gitgraph.branch(name)` | New branch from HEAD |
| `branch.commit(subject \| options)` | Add a commit |
| `branch.merge(other, subject?)` | Merge commit (`{ branch, fastForward: true }` to fast-forward) |
| `branch.tag(name)` | Tag the branch tip |
| `branch.checkout()` / `branch.delete()` | Move HEAD / delete the branch |
| `gitgraph.import(json)` | Draw a real repo from [`git2json`](https://github.com/fabien0102/git2json) output |

Commit options: `subject`, `body`, `author`, `hash`, `tag`, `dotText`, `style`, `onClick`, `renderDot`, `renderMessage`, `renderTooltip`.

## Options

```jsx
<Gitgraph
  options={{
    orientation: "horizontal", // or "vertical-reverse", "horizontal-reverse"
    mode: "compact",           // fewer rows
    template: "blackarrow",    // "metro" (default), "blackarrow", or a custom one
    author: "Ada <ada@example.com>",
  }}
>
  {(gitgraph) => { /* … */ }}
</Gitgraph>
```

## Custom template

```jsx
import { templateExtend } from "@gamzo/git-graph";

const template = templateExtend("metro", {
  colors: ["#7c3aed", "#0ea5e9", "#f59e0b"],
  branch: { lineWidth: 4, spacing: 40, mergeStyle: "straight" },
  commit: {
    spacing: 48,
    dot: { size: 8 },
    message: { displayAuthor: false, displayHash: false },
  },
});

<Gitgraph options={{ template }}>{/* … */}</Gitgraph>;
```

## Custom rendering

Replace any piece with your own SVG. Clicks and hovers keep working.

```jsx
main.commit({
  subject: "Ship it",
  renderDot: (commit) => (
    <rect width={commit.style.dot.size * 2} height={commit.style.dot.size * 2} rx={3} fill={commit.style.dot.color} />
  ),
  onClick: (commit) => console.log(commit.hash),
});
```

Also: `renderMessage`, `renderTooltip` (commits), `renderLabel` (branches), `render` (tags), `renderEdge` (lines, on `<Gitgraph>`).

## Live graphs

To add commits after the first render, keep the graph with `useGitgraph`:

```jsx
import { Gitgraph, useGitgraph } from "@gamzo/git-graph";

export function Live() {
  const graph = useGitgraph({}, (gitgraph) => gitgraph.branch("main").commit("Init"));

  return (
    <>
      <button onClick={() => graph.getUserApi().commit("One more")}>Commit</button>
      <Gitgraph graph={graph} animation={{ impact: true }} />
    </>
  );
}
```

## Animation

| Prop | Effect |
|---|---|
| *(default)* | Lines draw in order, commits fade in |
| `animation={false}` | No animation |
| `animation={{ duration, maxTotal }}` | ms per line, cap for the first draw |
| `animation={{ impact: true }}` | Commits added later land with a charge, a slam and a jolt |

Reduced motion is respected. Lines are `path.gg-edge` and commits `g.gg-commit`; the built-in CSS has zero specificity, so your CSS wins.

## Good to know

- **Dark mode:** set `--gg-tooltip-bg` and `--gg-tooltip-color`; everything else comes from the template.
- **Keyboard:** commits with `onClick` are focusable buttons (Enter / Space).
- **Strict CSP:** pass `<Gitgraph nonce={nonce}>`.
- **TypeScript:** `Commit`, `TemplateOptions`, `TagStyle`, `EdgeProps` and more are exported.

## License

MIT. Based on [GitGraph.js](https://github.com/nicoespeon/gitgraph.js) by Nicolas Carlo and Fabien Bernard.
