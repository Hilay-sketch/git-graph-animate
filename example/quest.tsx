import * as React from "react";
import { STAR_ICON } from "./pieces";

// Quest: the Starlog canvas as a game. Stars earn XP, each track fills a
// ring, and a few firsts are worth an achievement.

export interface Star {
  track: string;
  from?: string;
  finishes?: string;
}

/** Track colors on the ink-blue field, softened so they don't vibrate on it.
 * Off-white comes first: the main path. */
export const QUEST_PALETTE = [
  "#EEF0FA",
  "#F2D65C",
  "#F29BC9",
  "#86E3BC",
  "#9CD8F0",
];

const XP_STAR = 10;
const XP_FINISH = 50;
/** Stars on a track before it's ready to finish. */
const TRACK_GOAL = 4;
export const starXp = (s: Star) => (s.finishes ? XP_FINISH : XP_STAR);

export interface Achievement {
  id: string;
  name: string;
  how: string;
  /** `mine`: the stars you lit this visit. */
  earned: (mine: Star[], all: Star[], open: string[]) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first",
    name: "First light",
    how: "Light a star of your own.",
    earned: (mine) => mine.length > 0,
  },
  {
    id: "trail",
    name: "Trailblazer",
    how: "Start a new track.",
    earned: (mine) => mine.some((s) => s.from),
  },
  {
    id: "hat",
    name: "Hat trick",
    how: "Light three stars in one visit.",
    earned: (mine) => mine.length >= 3,
  },
  {
    id: "finish",
    name: "Constellation",
    how: "Finish a track.",
    earned: (mine) => mine.some((s) => s.finishes),
  },
  {
    id: "rounder",
    name: "All-rounder",
    how: "Light a star on every open track.",
    earned: (mine, _, open) =>
      open.every((t) => mine.some((s) => s.track === t)),
  },
  {
    id: "nova",
    name: "Supernova",
    how: "Light 20 stars in your sky.",
    earned: (_, all) => all.length >= 20,
  },
];

// ---------------------------------------------------------------------------
// Effects, in screen space: a ring echo and a small XP tag.

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export const center = (el: Element) => {
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2, r.top] as const;
};

function fx(tag: string, className: string, style: string) {
  const layer = document.getElementById("fx");
  if (!layer || reduced()) return;
  const el = document.createElement(tag);
  el.className = className;
  el.style.cssText = style;
  el.addEventListener("animationend", () => el.remove());
  layer.append(el);
  return el;
}

/** A ring spreads out from where a star lands. */
export function echo(x: number, y: number, color: string, delay = 0) {
  fx(
    "i",
    "echo",
    `left:${x}px;top:${y}px;--c:${color};animation-delay:${delay}ms`,
  );
}

export function floatText(x: number, y: number, text: string, color: string) {
  const t = fx("b", "xp-float", `left:${x}px;top:${y}px;--c:${color}`);
  if (t) t.textContent = text;
}

/** The field flashes, and every star flares in a wave down the graph. */
export function supernova() {
  if (reduced()) return;
  document.body.classList.add("q-nova");
  setTimeout(() => document.body.classList.remove("q-nova"), 1600);
  const stars = document.querySelectorAll<SVGGElement>(".canvas-sky .sl-star");
  stars.forEach((s, i) => {
    s.style.setProperty("--i", String(stars.length - i));
    s.classList.add("sl-flare");
    setTimeout(() => s.classList.remove("sl-flare"), 1400 + stars.length * 45);
  });
}

/**
 * The sky answers the mouse: a spotlight follows it, nearby stars swell and
 * lean in, stardust trails behind it, and a click on open sky ripples.
 */
export function useAlive(on: boolean) {
  React.useEffect(() => {
    if (!on || reduced()) return;
    let frame = 0;
    let last = { x: 0, y: 0, t: 0 };
    let pointer = { x: 0, y: 0, overSky: false };
    // Only compositor work per frame: the light and the numeral move by
    // transform, and only stars near the cursor get touched.
    const light = document.createElement("div");
    light.className = "q-light";
    document.body.prepend(light); // Before the app, so the sky draws over it.
    const lit = new Set<SVGGElement>();

    const tick = () => {
      frame = 0;
      const { x, y, overSky } = pointer;
      light.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      const numeral = document.querySelector<HTMLElement>(".q-numeral");
      if (numeral)
        numeral.style.transform = `translate3d(${(1 - (x / innerWidth) * 2) * 28}px, ${(1 - (y / innerHeight) * 2) * 18}px, 0)`;
      // Read every position first, then write: interleaving them forces a
      // layout per star.
      const stars = Array.from(
        document.querySelectorAll<SVGGElement>(".canvas-sky .sl-star"),
      );
      const centers = stars.map(center);
      stars.forEach((star, i) => {
        const [cx, cy] = centers[i];
        const d = Math.hypot(x - cx, y - cy);
        const near = overSky ? Math.max(0, 1 - d / 150) : 0;
        if (!near) {
          if (lit.delete(star)) star.style.removeProperty("--near");
          return;
        }
        lit.add(star);
        star.style.setProperty("--near", near.toFixed(3));
        star.style.setProperty("--lx", `${((x - cx) / d) * near * 4}px`);
        star.style.setProperty("--ly", `${((y - cy) / d) * near * 4}px`);
      });
    };

    const onMove = (e: PointerEvent) => {
      pointer = {
        x: e.clientX,
        y: e.clientY,
        overSky: !!(e.target as Element).closest?.(".canvas"),
      };
      if (!frame) frame = requestAnimationFrame(tick);
      // Stardust: a grain every 14px of travel, never more than one per 28ms.
      const moved = Math.hypot(e.clientX - last.x, e.clientY - last.y);
      if (!pointer.overSky || moved < 14 || e.timeStamp - last.t < 28) return;
      last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      const c = QUEST_PALETTE[Math.floor(Math.random() * QUEST_PALETTE.length)];
      fx(
        "i",
        "dust",
        `left:${e.clientX}px;top:${e.clientY}px;--c:${c};--dx:${(Math.random() - 0.5) * 30}px;--s:${0.5 + Math.random() * 0.7}`,
      );
    };

    const onClick = (e: MouseEvent) => {
      const t = e.target as Element;
      if (!t.closest(".canvas") || t.closest(".sl-star, .sl-card, .popover"))
        return;
      echo(e.clientX, e.clientY, "#eef0fa");
      echo(e.clientX, e.clientY, "#f2d65c", 120);
    };

    addEventListener("pointermove", onMove);
    addEventListener("click", onClick);
    return () => {
      removeEventListener("pointermove", onMove);
      removeEventListener("click", onClick);
      cancelAnimationFrame(frame);
      light.remove();
    };
  }, [on]);
}

// ---------------------------------------------------------------------------
// HUD

/** Your level, as a huge outlined numeral behind the sky. */
export function Numeral({ level }: { level: number }) {
  return (
    <div className="q-numeral" aria-hidden="true">
      <span key={level}>{String(level).padStart(2, "0")}</span>
    </div>
  );
}

function Segments(props: { of: number; lit: number; label: string }) {
  return (
    <span
      className="q-segs"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={props.of}
      aria-valuenow={props.lit}
      aria-label={props.label}
    >
      {Array.from({ length: props.of }, (_, i) => (
        <i
          key={i}
          className={i < props.lit ? "on" : undefined}
          style={{ "--k": i } as React.CSSProperties}
        />
      ))}
    </span>
  );
}

/** A round sticker with the achievement's name set around the rim. */
function Sticker({
  a,
  got,
  turn,
}: {
  a: Achievement;
  got: boolean;
  turn: number;
}) {
  return (
    <li
      className={got ? "q-sticker got" : "q-sticker"}
      style={{ "--turn": `${turn}deg` } as React.CSSProperties}
      title={got ? `${a.name}: earned` : `${a.name}: ${a.how}`}
    >
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
        <defs>
          <path
            id={`rim-${a.id}`}
            d="M32 32m-21 0a21 21 0 1 1 42 0a21 21 0 1 1-42 0"
          />
        </defs>
        <circle className="q-disc" cx="32" cy="32" r="30" />
        <text>
          <textPath href={`#rim-${a.id}`} startOffset="25%" textAnchor="middle">
            {a.name}
          </textPath>
        </text>
        <path
          className="q-mark"
          d={STAR_ICON}
          transform="translate(23 23) scale(0.75)"
        />
      </svg>
      <span className="q-sr">
        {a.name}, {got ? "earned" : `locked. ${a.how}`}
      </span>
    </li>
  );
}

export function QuestHud(props: {
  events: Star[];
  colors: Map<string, string>;
  open: string[];
  main: string;
  level: number;
  progress: number;
  perLevel: number;
  earned: Achievement[];
  onTrack: (track: string) => void;
}) {
  const xp = props.events.reduce((sum, s) => sum + starXp(s), 0);
  const left = props.perLevel - props.progress;
  const tracks = Array.from(props.colors.keys()).filter(
    (t) => t !== props.main,
  );

  return (
    <aside className="q-hud" aria-label="Quest">
      <p className="q-xp">
        <b key={xp}>{xp}</b>
        <span>XP</span>
      </p>
      <div className="q-level">
        <Segments
          of={props.perLevel}
          lit={props.progress}
          label={`Progress to level ${props.level + 1}`}
        />
        <p>
          Level {props.level}. {left === 1 ? "1 star" : `${left} stars`} to the
          next.
        </p>
      </div>

      <h2>Tracks</h2>
      <ul className="q-tracks">
        {tracks.map((t) => {
          const n = props.events.filter(
            (s) => s.track === t && !s.finishes,
          ).length;
          const done = !props.open.includes(t);
          return (
            <li key={t}>
              <button
                style={{ "--c": props.colors.get(t) } as React.CSSProperties}
                onClick={() => props.onTrack(t)}
              >
                <span className="q-name">{t}</span>
                <Segments
                  of={TRACK_GOAL}
                  lit={done ? TRACK_GOAL : Math.min(n, TRACK_GOAL)}
                  label={`${t}: ${n} stars`}
                />
                <small>
                  {done
                    ? "Finished"
                    : n >= TRACK_GOAL
                      ? "Ready"
                      : `${n}/${TRACK_GOAL}`}
                </small>
              </button>
            </li>
          );
        })}
      </ul>

      <h2>
        Achievements{" "}
        <small>
          {props.earned.length} of {ACHIEVEMENTS.length}
        </small>
      </h2>
      <ul className="q-stickers">
        {ACHIEVEMENTS.map((a, i) => (
          <Sticker
            key={a.id}
            a={a}
            got={props.earned.includes(a)}
            turn={((i * 37) % 26) - 13}
          />
        ))}
      </ul>
    </aside>
  );
}

/** Anything worth a roar: an achievement, a new level, a finished track. */
export interface Goal {
  key: string;
  /** Small line above the name, e.g. "Achievement". */
  kicker: string;
  name: string;
  color: string;
  /** Where it was earned, in screen space. */
  x: number;
  y: number;
}

export function Unlocked({ goal }: { goal: Goal }) {
  return (
    <span className="unlocked">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d={STAR_ICON} />
      </svg>
      {goal.kicker}: {goal.name}
    </span>
  );
}

/**
 * The whole sky celebrates: a shockwave and light rays from the star that
 * earned it and sparks flying out, behind the graph, and the name slammed
 * in huge above it while the graph dims.
 */
export function Roar({ goal, inset }: { goal: Goal; inset: [number, number] }) {
  React.useEffect(() => {
    // The graph steps back while the name is up, so nothing covers it.
    document.body.classList.add("q-roaring");
    if (reduced()) return () => document.body.classList.remove("q-roaring");
    document.body.classList.add("q-roar");
    const t = setTimeout(() => document.body.classList.remove("q-roar"), 700);
    return () => {
      clearTimeout(t);
      document.body.classList.remove("q-roar", "q-roaring");
    };
  }, []);
  // The name spans the open sky, between the HUD and the deck.
  const [l, r] = inset;
  const open = innerWidth - l - r;
  const size = Math.min(
    innerHeight * 0.3,
    (1.7 * open) / (goal.name.length + 1),
  );
  const vars = {
    "--c": goal.color,
    "--x": `${goal.x}px`,
    "--y": `${goal.y}px`,
    "--cx": `${l + open / 2}px`,
  } as React.CSSProperties;
  return (
    <>
      <div className="q-roar-layer" aria-hidden="true" style={vars}>
        <i className="q-bloom" />
        <i className="q-rays" />
        {[0, 1, 2].map((i) => (
          <i
            key={i}
            className="q-wave"
            style={{ animationDelay: `${i * 140}ms` }}
          />
        ))}
        {Array.from({ length: 28 }, (_, i) => (
          <i
            key={`s${i}`}
            className="q-spark"
            style={
              {
                "--a": `${(i / 28) * 360 + Math.random() * 10}deg`,
                "--d": `${40 + Math.random() * 45}vmax`,
                animationDelay: `${Math.random() * 160}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      {/* The name goes above the graph. */}
      <div className="q-roar-layer q-roar-top" aria-hidden="true" style={vars}>
        <div className="q-words">
          <span className="q-kicker">{goal.kicker}</span>
          <b style={{ fontSize: size }}>
            {Array.from(goal.name).map((ch, i) => (
              <span key={i} style={{ "--i": i } as React.CSSProperties}>
                {ch === " " ? " " : ch}
              </span>
            ))}
          </b>
        </div>
      </div>
    </>
  );
}
