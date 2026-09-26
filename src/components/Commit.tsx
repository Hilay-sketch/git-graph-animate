import * as React from "react";
import { GitgraphCore, Commit as CommitCore } from "../core/index.js";
import { Dot } from "./Dot.js";
import { Arrow } from "./Arrow.js";
import { Message } from "./Message.js";
import { Tag, TAG_PADDING_X } from "./Tag.js";
import { BranchLabel, BRANCH_LABEL_PADDING_X } from "./BranchLabel.js";

interface CommitsProps {
  commitsByHash: Map<CommitCore["hash"], CommitCore>;
  commit: CommitCore;
  gitgraph: GitgraphCore;
  /** Commit y, shifted down by custom HTML messages above it. */
  y: number;
  setCurrentCommitOver: (val: CommitCore | null) => void;
  commitMessagesX: number;
  /** Fade-in delay in ms; `undefined` when not animated. */
  delay?: number;
  /** Added after the first render: lands with an impact. */
  added?: boolean;
}

// Memoized: hovering or measuring re-renders the graph, not every commit.
export const Commit = React.memo(function Commit(props: CommitsProps) {
  const { commit, commitsByHash, gitgraph, commitMessagesX } = props;

  // One ref is enough: a commit shows at most one branch label.
  const branchLabelRef = React.useRef<SVGGElement>(null);
  const tagRefs = React.useRef<SVGGElement[]>([]);
  const messageRef = React.useRef<SVGGElement>(null);

  const [branchLabelX, setBranchLabelX] = React.useState(0);
  const [tagXs, setTagXs] = React.useState<number[]>([]);
  const [messageX, setMessageX] = React.useState(0);

  const arrows = React.useMemo(() => {
    if (!gitgraph.template.arrow.size) return null;
    const commitRadius = commit.style.dot.size;

    return commit.parents.map((parentHash: string) => {
      return (
        <Arrow
          key={parentHash}
          parent={commitsByHash.get(parentHash)}
          commit={commit}
          gitgraph={gitgraph}
          commitRadius={commitRadius}
        />
      );
    });
  }, [commitsByHash, commit, gitgraph]);

  const branchLabels = React.useMemo(() => {
    // Core could compute branch labels into commits directly,
    // That will make it easier to retrieve them, just like tags.
    const branches = Array.from(gitgraph.branches.values());
    return branches.map((branch) => {
      return (
        <BranchLabel
          key={branch.name}
          gitgraph={gitgraph}
          branch={branch}
          commit={commit}
          ref={branchLabelRef}
          branchLabelX={branchLabelX}
        />
      );
    });
  }, [gitgraph, commit, branchLabelX]);

  const tags = React.useMemo(() => {
    tagRefs.current = [];
    if (!commit.tags) return null;
    if (gitgraph.isHorizontal) return null;

    return commit.tags.map((tag, i) => (
      <Tag
        key={`${commit.hashAbbrev}-${tag.name}`}
        commit={commit}
        tag={tag}
        ref={(r) => (tagRefs.current[i] = r!)}
        tagX={tagXs[i] || 0}
      />
    ));
  }, [commit, gitgraph, tagXs]);

  const { x } = commit;
  const { y } = props;

  // positionCommitsElements
  React.useLayoutEffect(() => {
    if (gitgraph.isHorizontal) {
      // Elements don't appear on horizontal mode, yet.
      return;
    }

    const padding = 10;

    let translateX = commitMessagesX;

    if (branchLabelRef.current) {
      setBranchLabelX(translateX);

      // For some reason, one paddingX is missing in BBox width.
      const branchLabelWidth =
        branchLabelRef.current.getBBox().width + BRANCH_LABEL_PADDING_X;
      translateX += branchLabelWidth + padding;
    }

    const allTagXs = tagRefs.current.map((tag) => {
      if (!tag) return 0;

      const tagX = translateX;

      // For some reason, one paddingX is missing in BBox width.
      const tagWidth = tag.getBBox().width + TAG_PADDING_X;
      translateX += tagWidth + padding;

      return tagX;
    });

    setTagXs(allTagXs);

    if (messageRef.current) {
      setMessageX(translateX);
    }
    // Re-measure when the commit (its tags, label, message) changes.
  }, [commit, gitgraph, commitMessagesX]);

  return (
    <g
      transform={`translate(${x}, ${y})`}
      className={props.added ? "gg-commit gg-added" : "gg-commit"}
      data-hash={commit.hash}
      style={
        props.delay === undefined
          ? undefined
          : ({ "--gg-delay": `${props.delay}ms` } as React.CSSProperties)
      }
    >
      {props.added &&
        // Shockwave rings, behind the dot.
        [0, 1].map((i) => (
          <circle
            key={i}
            className="gg-ripple"
            cx={commit.style.dot.size}
            cy={commit.style.dot.size}
            r={commit.style.dot.size}
            fill="none"
            stroke={commit.style.dot.color}
          />
        ))}
      {/* Wrapper without a `transform` attribute, so CSS can scale the dot. */}
      <g className="gg-dot">
        <Dot
          commit={commit}
          onMouseOver={() => {
            props.setCurrentCommitOver(commit);
            commit.onMouseOver();
          }}
          onMouseOut={() => {
            props.setCurrentCommitOver(null);
            commit.onMouseOut();
          }}
        />
      </g>
      {arrows}
      <g transform={`translate(${-x}, 0)`}>
        {commit.style.message.display && (
          <Message commit={commit} ref={messageRef} messageX={messageX} />
        )}
        {branchLabels}
        {tags}
      </g>
    </g>
  );
});
