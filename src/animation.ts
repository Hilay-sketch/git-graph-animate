export {
  type AnimationOptions,
  assignDelays,
  edgeKey,
  charge,
  chargeLine,
  recoil,
  CHARGE_MS,
  ANIMATION_CSS,
};

/** Wind-up before an added commit's line shoots out, in ms. */
const CHARGE_MS = 450;
/** Snap-back of the parent after the charge, in ms. */
const RELEASE_MS = 250;

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

  fresh.forEach(({ hash }) => {
    const hasLine = edges.some(({ to }) => to === hash);
    delays.set(hash, starts.get(hash)! + (hasLine ? duration : 0));
  });

  return isFirstBatch ? [] : fresh.map(({ hash }) => hash);
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

  /* Added commit: the line speeds up into it, then the commit slams in. */
  :where(.gg-edge.gg-added) {
    animation-timing-function: cubic-bezier(0.55, 0, 1, 0.45);
  }
  :where(.gg-commit.gg-added) {
    animation-duration: 60ms;
  }
  :where(.gg-dot, .gg-ripple) {
    transform-box: fill-box;
    transform-origin: center;
  }
  :where(.gg-added .gg-dot) {
    animation: gg-slam 750ms linear var(--gg-delay) backwards;
  }
  :where(.gg-ripple) {
    animation: gg-ripple 700ms cubic-bezier(0.16, 1, 0.3, 1) var(--gg-delay) backwards;
  }
  :where(.gg-ripple + .gg-ripple) {
    --gg-ripple-scale: 12;
    animation-duration: 1000ms;
    animation-delay: calc(var(--gg-delay) + 80ms);
  }
}
/* Rings only show while animating. */
:where(.gg-ripple) { opacity: 0; pointer-events: none; }
@keyframes gg-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes gg-fade { from { opacity: 0; } }
@keyframes gg-slam {
  0% { transform: scale(0); filter: brightness(3); animation-timing-function: cubic-bezier(0.2, 0.9, 0.3, 1); }
  14% { transform: scale(2.6); filter: brightness(2.2); animation-timing-function: ease-in-out; }
  34% { transform: scale(0.72); filter: brightness(1.4); animation-timing-function: ease-in-out; }
  54% { transform: scale(1.18); filter: brightness(1); animation-timing-function: ease-in-out; }
  74% { transform: scale(0.94); animation-timing-function: ease-in-out; }
  100% { transform: scale(1); }
}
@keyframes gg-ripple {
  from { opacity: 0.9; transform: scale(1); stroke-width: 6px; }
  to { opacity: 0; transform: scale(var(--gg-ripple-scale, 7)); stroke-width: 0; }
}
`;

// Graph recoil when a commit lands, pushed along the line's direction.
function recoil(dx: number, dy: number): Keyframe[] {
  const at = (k: number) => ({
    transform: `translate(${dx * k}px, ${dy * k}px)`,
  });
  return [
    at(0),
    { ...at(7), offset: 0.12 },
    { ...at(-4), offset: 0.35 },
    { ...at(2), offset: 0.6 },
    at(0),
  ];
}

// Parent dot charging: squeezes, trembles and glows, then snaps back past
// full size as the line is released.
function charge(color: string): [Keyframe[], KeyframeAnimationOptions] {
  const end = CHARGE_MS / (CHARGE_MS + RELEASE_MS);
  const glow = (px: number, light: number) =>
    `brightness(${light}) drop-shadow(0 0 ${px}px ${color})`;
  const squeeze = (k: number, jitter: number) =>
    `translate(${jitter}px, ${-jitter}px) scale(${k})`;
  return [
    [
      { transform: squeeze(1, 0), filter: glow(0, 1) },
      { transform: squeeze(0.9, 1), offset: end * 0.3 },
      { transform: squeeze(0.84, -1.5), offset: end * 0.55 },
      { transform: squeeze(0.78, 1.5), offset: end * 0.8 },
      { transform: squeeze(0.72, -2), filter: glow(10, 2), offset: end },
      {
        transform: squeeze(1.45, 0),
        filter: glow(6, 1.5),
        offset: end + (1 - end) * 0.3,
      },
      { transform: squeeze(1, 0), filter: glow(0, 1) },
    ],
    { duration: CHARGE_MS + RELEASE_MS, easing: "ease-in" },
  ];
}

// Branch line into the charging parent: swells and glows, then lets go.
function chargeLine(
  color: string,
  width: number,
): [Keyframe[], KeyframeAnimationOptions] {
  const end = CHARGE_MS / (CHARGE_MS + RELEASE_MS);
  return [
    [
      { strokeWidth: `${width}px`, filter: `drop-shadow(0 0 0 ${color})` },
      {
        strokeWidth: `${width * 2.2}px`,
        filter: `drop-shadow(0 0 8px ${color})`,
        offset: end,
      },
      { strokeWidth: `${width}px`, filter: `drop-shadow(0 0 0 ${color})` },
    ],
    { duration: CHARGE_MS + RELEASE_MS, easing: "ease-in" },
  ];
}
