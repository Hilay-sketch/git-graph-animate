import { GitgraphCore, Commit, arrowSvgPath } from "../core/index.js";

interface ArrowProps {
  /** `undefined` when the parent isn't rendered. */
  parent: Commit | undefined;
  commit: Commit;
  gitgraph: GitgraphCore;
  commitRadius: number;
}

export function Arrow({ parent, commit, gitgraph, commitRadius }: ArrowProps) {
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
