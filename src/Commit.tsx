import * as React from "react";
import {
  GitgraphCore,
  Commit as CommitCore,
  Coordinate,
} from "./core/index.js";
import { ReactSvgElement } from "./types.js";
import { Dot } from "./Dot.js";
import { Arrow } from "./Arrow.js";
import { Message } from "./Message.js";
import { Tag, TAG_PADDING_X } from "./Tag.js";
import { BranchLabel } from "./BranchLabel.js";
import { MutableRefObject } from "react";

interface CommitsProps {
  commits: Array<CommitCore<ReactSvgElement>>;
  commit: CommitCore<ReactSvgElement>;
  gitgraph: GitgraphCore<ReactSvgElement>;
  getWithCommitOffset: (props: any) => Coordinate;
  setCurrentCommitOver: (val: CommitCore<ReactSvgElement> | null) => void;
  commitMessagesX: number;
  /** Fade-in delay in ms; `undefined` when not animated. */
  delay?: number;
  /** Added after the first render: lands with an impact. */
  added?: boolean;
}

export const Commit = (props: CommitsProps) => {
  const { commit, commits, gitgraph, commitMessagesX } = props;

  /**
   * This _should_ likely be an array, but is not in order to intentionally keep
   *  a potential bug in the codebase that existed prior to Hook-ifying this component
   * @see https://github.com/nicoespeon/gitgraph.js/blob/be9cdf45c7f00970e68e1a4ba579ca7f5c672da4/packages/gitgraph-react/src/Gitgraph.tsx#L197
   * (notice that it's a single `null` value instead of an array
   *
   * The potential bug in question is "what happens when there are more than one
   * branch label rendered? Do they overlap or cause the message X position to be
   * in the wrong position?"
   *
   * TODO: Investigate potential bug outlined above
   */
  const branchLabelRef = React.useRef<SVGGElement>();
  const tagRefs: MutableRefObject<SVGGElement[]> = React.useRef([]);
  // "as unknown as any" needed to avoid `ref` mistypings later. :(
  const messageRef: MutableRefObject<SVGGElement> =
    React.useRef<SVGGElement>() as unknown as any;

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
          commits={commits}
          commit={commit}
          gitgraph={gitgraph}
          parentHash={parentHash}
          commitRadius={commitRadius}
        />
      );
    });
  }, [commits, commit, gitgraph]);

  const branchLabels = React.useMemo(() => {
    // @gitgraph/core could compute branch labels into commits directly.
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

  const { x, y } = props.getWithCommitOffset(commit);

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
        branchLabelRef.current.getBBox().width + BranchLabel.paddingX;
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
  }, [tagRefs, gitgraph, commitMessagesX]);

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
};
