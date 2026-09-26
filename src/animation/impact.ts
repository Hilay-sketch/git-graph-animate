import type { Commit } from "../core/index.js";
import { chargeTime } from "./delays.js";

export { type Impact, playImpacts };

interface Impact {
  /** When the commit lands, in ms. */
  delay: number;
  /** Parents that charge before the line shoots out. */
  parents: Commit[];
}

/**
 * Added commit: its parents charge (dot + incoming line), then the whole
 * graph jolts when it lands. JS because these play on elements that are
 * already mounted, where a CSS animation can't restart per commit.
 *
 * @param direction Unit vector the graph grows towards, e.g. `[0, -1]`.
 * @param duration Time to draw one line, in ms.
 */
function playImpacts(
  svg: SVGSVGElement,
  impacts: Impact[],
  [dx, dy]: [number, number],
  duration: number,
) {
  if (!svg.animate || !impacts.length) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  impacts.forEach(({ delay, parents }) => {
    const chargeAt = Math.max(0, delay - duration - chargeTime(duration));
    parents.forEach((parent) => {
      const color = parent.style.dot.color as string;
      const hash = CSS.escape(parent.hash);
      const dot = svg.querySelector(`[data-hash="${hash}"] .gg-dot`);
      if (dot) {
        const [frames, options] = charge(color, duration);
        dot.animate(frames, { ...options, delay: chargeAt });
      }
      svg
        .querySelectorAll<SVGPathElement>(`.gg-edge[data-to="${hash}"]`)
        .forEach((line) => {
          const width = Number(line.getAttribute("stroke-width")) || 2;
          const [frames, options] = chargeLine(color, width, duration);
          line.animate(frames, { ...options, delay: chargeAt });
        });
    });
    svg.animate(recoil(dx, dy), { delay, duration: duration * 1.4 });
  });
}

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

// Charge, then snap back (release) in 5/6 of a line's duration.
const chargeTiming = (duration: number) => {
  const total = chargeTime(duration) + (duration * 5) / 6;
  return { end: chargeTime(duration) / total, total };
};

// Parent dot charging: squeezes, trembles and glows, then snaps back past
// full size as the line is released.
function charge(
  color: string,
  duration: number,
): [Keyframe[], KeyframeAnimationOptions] {
  const { end, total } = chargeTiming(duration);
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
    { duration: total, easing: "ease-in" },
  ];
}

// Branch line into the charging parent: swells and glows, then lets go.
function chargeLine(
  color: string,
  width: number,
  duration: number,
): [Keyframe[], KeyframeAnimationOptions] {
  const { end, total } = chargeTiming(duration);
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
    { duration: total, easing: "ease-in" },
  ];
}
