import * as React from "react";
import { Commit } from "../core/index.js";

export const TOOLTIP_PADDING = 10;

interface TooltipProps {
  commit: Commit;
  children?: React.ReactNode;
}

export function Tooltip({ commit, children }: TooltipProps) {
  const [textWidth, setTextWidth] = React.useState(0);
  const $text = React.useRef<SVGTextElement>(null);

  React.useLayoutEffect(() => {
    // A custom `renderTooltip` has no default text to measure.
    if ($text.current) setTextWidth($text.current.getBBox().width);
  }, []);

  if (commit.renderTooltip) return <>{commit.renderTooltip(commit)}</>;

  const commitSize = commit.style.dot.size * 2;
  const offset = 10;
  const padding = TOOLTIP_PADDING;
  const radius = 5;
  const boxHeight = 50;
  const boxWidth = offset + textWidth + 2 * padding;

  const path = [
    "M 0,0",
    `L ${offset},${offset}`,
    `V ${boxHeight / 2 - radius}`,
    `Q ${offset},${boxHeight / 2} ${offset + radius},${boxHeight / 2}`,
    `H ${boxWidth - radius}`,
    `Q ${boxWidth},${boxHeight / 2} ${boxWidth},${boxHeight / 2 - radius}`,
    `V -${boxHeight / 2 - radius}`,
    `Q ${boxWidth},-${boxHeight / 2} ${boxWidth - radius},-${boxHeight / 2}`,
    `H ${offset + radius}`,
    `Q ${offset},-${boxHeight / 2} ${offset},-${boxHeight / 2 - radius}`,
    `V -${offset}`,
    "z",
  ].join(" ");

  return (
    <g transform={`translate(${commitSize}, ${commitSize / 2})`}>
      {/* Themable from CSS: --gg-tooltip-bg / --gg-tooltip-color. */}
      <path d={path} style={{ fill: "var(--gg-tooltip-bg, #eee)" }} />
      <text
        ref={$text}
        x={offset + padding}
        y={0}
        alignmentBaseline="central"
        style={{ fill: "var(--gg-tooltip-color, #333)" }}
      >
        {children}
      </text>
    </g>
  );
}
