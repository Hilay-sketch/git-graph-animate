import * as React from "react";

export interface EdgeProps {
  /** `svg.path.d` of the line, from parent to child. */
  d: string;
  /** Parent commit hash. */
  from: string;
  /** Child commit hash. */
  to: string;
  stroke?: string;
  strokeWidth: number;
  /** When this line should start drawing, in ms (negative = already drawn). */
  delay: number;
  /** How long drawing one line takes, in ms. */
  duration: number;
  /** `false` when the `animation` prop disables animations. */
  animated: boolean;
  /** Line into a commit added after the first render. */
  added: boolean;
}

export function defaultEdge(edge: EdgeProps): React.ReactElement {
  return (
    <path
      d={edge.d}
      fill="none"
      stroke={edge.stroke}
      strokeWidth={edge.strokeWidth}
      pathLength={1}
      className={edge.added ? "gg-edge gg-added" : "gg-edge"}
      data-from={edge.from}
      data-to={edge.to}
      style={{ "--gg-delay": `${edge.delay}ms` } as React.CSSProperties}
    />
  );
}
