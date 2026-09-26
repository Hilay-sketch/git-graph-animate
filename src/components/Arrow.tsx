import * as React from "react";
import { GitgraphCore, Commit, arrowSvgPath } from "../core/index.js";

interface ArrowProps {
  commits: Commit[];
  commit: Commit;
  gitgraph: GitgraphCore;
  parentHash: string;
  commitRadius: number;
}

export function Arrow({
  commits,
  commit,
  gitgraph,
  parentHash,
  commitRadius,
}: ArrowProps) {
  const parent = commits.find(({ hash }) => hash === parentHash);
  if (!parent) return null;

  // Starting point, relative to commit
  const origin = gitgraph.reverseArrow
    ? {
        x: commitRadius + (parent.x - commit.x),
        y: commitRadius + (parent.y - commit.y),
      }
    : { x: commitRadius, y: commitRadius };

  return (
    <g transform={`translate(${origin.x}, ${origin.y})`}>
      <path
        d={arrowSvgPath(gitgraph, parent, commit)}
        fill={gitgraph.template.arrow.color!}
      />
    </g>
  );
}
