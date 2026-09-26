import * as React from "react";
import { Commit } from "../core/index.js";

export interface DotProps {
  commit: Commit;
  onMouseOver: () => void;
  onMouseOut: () => void;
}

export const Dot: React.FC<DotProps> = ({
  commit,
  onMouseOver,
  onMouseOut,
}) => {
  const { size, color, strokeColor, strokeWidth = 0, font } = commit.style.dot;
  return (
    <g
      onClick={commit.onClick}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
    >
      {commit.renderDot ? (
        // Same handlers as the default dot: clicks and tooltips still work.
        commit.renderDot(commit)
      ) : (
        <>
          {/* Stroke drawn inside the dot: shrink the circle by half of it. */}
          <circle
            cx={size}
            cy={size}
            r={size - strokeWidth / 2}
            fill={color}
            stroke={strokeWidth ? strokeColor : undefined}
            strokeWidth={strokeWidth || undefined}
          />
          {commit.dotText && (
            <text
              alignmentBaseline="central"
              textAnchor="middle"
              x={size}
              y={size}
              style={{ font }}
            >
              {commit.dotText}
            </text>
          )}
        </>
      )}
    </g>
  );
};
