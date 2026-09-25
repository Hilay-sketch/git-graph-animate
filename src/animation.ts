export { type AnimationOptions, assignDelays, edgeKey, ANIMATION_CSS };

interface AnimationOptions {
  /** Time to draw one line, in ms. */
  duration: number;
  /** Cap on how long the lines of one batch keep starting, in ms. */
  maxTotal: number;
}

function edgeKey(edge: { from: string; to: string }): string {
  return `${edge.from}->${edge.to}`;
}

/**
 * Give each new commit and line an animation delay (ms), once.
 * Lines draw in commit order; a commit fades in when its line arrives.
 * Known keys keep their delay, so re-renders never replay an animation.
 */
function assignDelays(
  commits: Array<{ hash: string }>,
  edges: Array<{ from: string; to: string }>,
  delays: Map<string, number>,
  { duration, maxTotal }: AnimationOptions,
): void {
  const fresh = commits.filter(({ hash }) => !delays.has(hash));
  const step = Math.min(duration, maxTotal / fresh.length);
  const starts = new Map(fresh.map(({ hash }, i) => [hash, i * step]));

  edges.forEach((edge) => {
    if (delays.has(edgeKey(edge))) return;
    const start = starts.get(edge.to);
    // Line into an already shown commit: negative delay = already drawn.
    delays.set(edgeKey(edge), start === undefined ? -duration : start);
  });

  fresh.forEach(({ hash }) => {
    const hasLine = edges.some(({ to }) => to === hash);
    delays.set(hash, starts.get(hash)! + (hasLine ? duration : 0));
  });
}

// Fixed string: per-graph values come from `--gg-*` variables, so several
// graphs on one page don't clash. `:where()` keeps specificity at 0 so any
// user CSS wins. Reduced motion gets a static, fully drawn graph.
const ANIMATION_CSS = `
@media (prefers-reduced-motion: no-preference) {
  :where(.gg-edge) {
    /* Gap (2) longer than the path (1): nothing leaks while hidden. */
    stroke-dasharray: 1 2;
    animation: gg-draw var(--gg-duration) linear var(--gg-delay) backwards;
  }
  :where(.gg-commit) {
    animation: gg-fade var(--gg-duration) ease-out var(--gg-delay) backwards;
  }
}
@keyframes gg-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes gg-fade { from { opacity: 0; } }
`;
