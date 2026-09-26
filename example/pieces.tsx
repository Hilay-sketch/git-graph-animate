import * as React from "react";
import type { EdgeProps } from "@gamzo/git-graph";

// SVG pieces handed to the library's render props. Shared by the sky and
// the "Make it yours" section.

// Butter comes last: it is also the badge color.
export const PALETTE = ["#C6B4F7", "#9FE3C9", "#F6B8A2", "#9DC9F3", "#F1DC98"];
export const FONT_TITLE = "600 15px Figtree";
export const FONT_SMALL = "500 12px Figtree";
/** Commit dot radius: every custom dot is centered on (DOT, DOT). */
export const DOT = 12;

// Canvas text width, so SVG boxes size themselves synchronously.
const ctx = document.createElement("canvas").getContext("2d")!;
export function textWidth(text: string, font: string) {
  ctx.font = font;
  return ctx.measureText(text).width;
}

const sparkle = (c: number, r: number) =>
  `M${c},${c - r} Q${c},${c} ${c + r},${c} Q${c},${c} ${c},${c + r} Q${c},${c} ${c - r},${c} Q${c},${c} ${c},${c - r}Z`;

export const STAR_ICON = sparkle(12, 11);

export function Sparkle(props: {
  color: string;
  big?: boolean;
  label?: string;
  onSelect?: () => void;
}) {
  const r = props.big ? 19 : 14;
  return (
    <g
      className="sl-star"
      style={{ color: props.color }}
      tabIndex={props.onSelect ? 0 : undefined}
      role={props.onSelect ? "button" : undefined}
      aria-label={props.label}
      onKeyDown={(e) => {
        if (!props.onSelect || (e.key !== "Enter" && e.key !== " ")) return;
        e.preventDefault();
        props.onSelect();
      }}
    >
      <circle className="sl-aura" cx={DOT} cy={DOT} r={r + 8} />
      <circle className="sl-halo" cx={DOT} cy={DOT} r={r * 0.75} />
      <circle className="sl-ring" cx={DOT} cy={DOT} r={r + 6} />
      <path className="sl-spark" d={sparkle(DOT, r)} />
      <circle className="sl-core" cx={DOT} cy={DOT} r={props.big ? 3.4 : 2.6} />
    </g>
  );
}

export function Planet({ color }: { color: string }) {
  return (
    <g className="cm-planet" style={{ color }}>
      <circle cx={DOT} cy={DOT} r={DOT - 3} />
      <ellipse
        cx={DOT}
        cy={DOT}
        rx={DOT + 5}
        ry={4}
        transform={`rotate(-20 ${DOT} ${DOT})`}
      />
    </g>
  );
}

export function Initial({ color, text }: { color: string; text: string }) {
  return (
    <g className="cm-initial" style={{ color }}>
      <circle cx={DOT} cy={DOT} r={DOT} />
      <text x={DOT} y={DOT} textAnchor="middle" dominantBaseline="central">
        {text.charAt(0)}
      </text>
    </g>
  );
}

export function cardWidth(title: string, metaWidth: number) {
  return Math.max(textWidth(title, FONT_TITLE), metaWidth) + 32;
}

/** Title + meta (and an accent in the track color), on a card sized to its text. */
export function Card(props: {
  title: string;
  meta: string;
  accent?: string;
  color: string;
  badge?: string;
  /** Cards in one list share a width. */
  minWidth?: number;
}) {
  const metaW =
    textWidth(props.meta, FONT_SMALL) +
    (props.accent ? textWidth(props.accent, FONT_SMALL) + 8 : 0);
  const badgeW = props.badge ? textWidth(props.badge, FONT_SMALL) + 31 : 0;
  const w = Math.max(
    cardWidth(props.title, metaW + badgeW),
    props.minWidth || 0,
  );
  return (
    <g className="sl-card" style={{ color: props.color }}>
      <rect y={DOT - 25} width={w} height={50} rx={12} />
      <text className="sl-title" x={16} y={DOT - 8} dominantBaseline="central">
        {props.title}
      </text>
      <text className="sl-meta" x={16} y={DOT + 11} dominantBaseline="central">
        {props.meta}
        {props.accent && (
          <tspan dx={8} className="sl-accent">
            {props.accent}
          </tspan>
        )}
      </text>
      {props.badge && (
        <g
          className="sl-earned"
          transform={`translate(${16 + metaW + 14}, ${DOT + 11})`}
        >
          <path d={STAR_ICON} transform="translate(0,-6) scale(0.5)" />
          <text x={17} dominantBaseline="central">
            {props.badge}
          </text>
        </g>
      )}
    </g>
  );
}

export function Pill(props: { text: string; color: string; width?: number }) {
  const { text, color } = props;
  const w = props.width || textWidth(text, FONT_SMALL) + 24;
  return (
    <g className="sl-pill" style={{ color }}>
      <rect width={w} height={24} rx={12} />
      <text x={12} y={12} dominantBaseline="central">
        {text}
      </text>
    </g>
  );
}

export function Badge({ name }: { name: string }) {
  const w = textWidth(name, FONT_SMALL) + 38;
  return (
    <g className="sl-badge">
      <rect y={-13} width={w} height={26} rx={13} />
      <path d={STAR_ICON} transform="translate(10,-6) scale(0.5)" />
      <text x={28} dominantBaseline="central">
        {name}
      </text>
    </g>
  );
}

// Keep the library's `gg-edge` hooks on every stroke: the built-in draw-in
// animation (and the landing impact) then runs on custom lines too.
export function edgeHooks(edge: EdgeProps) {
  return {
    d: edge.d,
    fill: "none",
    stroke: edge.stroke,
    pathLength: 1,
    strokeLinecap: "round" as const,
    className: edge.added ? "gg-edge gg-added" : "gg-edge",
    "data-from": edge.from,
    "data-to": edge.to,
    style: { "--gg-delay": `${edge.delay}ms` } as React.CSSProperties,
  };
}

/** A soft glow under a crisp core. */
export function glowEdge(edge: EdgeProps) {
  const hooks = edgeHooks(edge);
  return (
    <g>
      <path {...hooks} strokeWidth={edge.strokeWidth * 4} opacity={0.16} />
      <path {...hooks} strokeWidth={edge.strokeWidth} />
    </g>
  );
}

/** Dotted, and faded in by our own CSS instead of drawn. */
export function dottedEdge(edge: EdgeProps) {
  return (
    <path
      d={edge.d}
      fill="none"
      stroke={edge.stroke}
      strokeWidth={edge.strokeWidth}
      strokeLinecap="round"
      className="cm-dotted"
      style={
        {
          "--delay": `${edge.delay}ms`,
          "--duration": `${edge.duration}ms`,
        } as React.CSSProperties
      }
    />
  );
}

/** A comet rides each line as it draws: a component with its own hooks. */
export function CometEdge(edge: EdgeProps) {
  const motion = React.useRef<SVGAnimateMotionElement>(null);
  const fade = React.useRef<SVGAnimateElement>(null);
  React.useEffect(() => {
    // Lines already drawn (negative delay) get no comet.
    if (!edge.animated || edge.delay < 0) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setTimeout(() => {
      motion.current?.beginElement();
      fade.current?.beginElement();
    }, edge.delay);
    return () => clearTimeout(id);
  }, []);
  return (
    <g>
      <path {...edgeHooks(edge)} strokeWidth={edge.strokeWidth} />
      <circle
        r={4.5}
        opacity={0}
        className="cm-comet"
        style={{ color: edge.stroke }}
      >
        <animateMotion
          ref={motion}
          begin="indefinite"
          dur={`${edge.duration}ms`}
          path={edge.d}
        />
        <animate
          ref={fade}
          attributeName="opacity"
          begin="indefinite"
          dur={`${edge.duration}ms`}
          values="0;1;1;0"
          keyTimes="0;0.1;0.85;1"
        />
      </circle>
    </g>
  );
}
