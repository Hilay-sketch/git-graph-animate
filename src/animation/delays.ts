export { type AnimationOptions, assignDelays, edgeKey, CHARGE_MS };

/** Wind-up before an added commit's line shoots out, in ms. */
const CHARGE_MS = 450;

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
 *
 * Commits added after the first batch wait CHARGE_MS for their parent to charge.
 *
 * @returns Hashes of commits added after the first batch (they get the impact).
 */
function assignDelays(
  commits: Array<{ hash: string }>,
  edges: Array<{ from: string; to: string }>,
  delays: Map<string, number>,
  { duration, maxTotal }: AnimationOptions,
): string[] {
  const isFirstBatch = delays.size === 0;
  const fresh = commits.filter(({ hash }) => !delays.has(hash));
  const step = Math.min(duration, maxTotal / fresh.length);
  const offset = isFirstBatch ? 0 : CHARGE_MS;
  const starts = new Map(fresh.map(({ hash }, i) => [hash, i * step + offset]));

  edges.forEach((edge) => {
    if (delays.has(edgeKey(edge))) return;
    const start = starts.get(edge.to);
    // Line into an already shown commit: negative delay = already drawn.
    delays.set(edgeKey(edge), start === undefined ? -duration : start);
  });

  const hasLine = new Set(edges.map(({ to }) => to));
  fresh.forEach(({ hash }) => {
    delays.set(hash, starts.get(hash)! + (hasLine.has(hash) ? duration : 0));
  });

  return isFirstBatch ? [] : fresh.map(({ hash }) => hash);
}
