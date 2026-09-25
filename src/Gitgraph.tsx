import * as React from "react";
import {
  GitgraphCore,
  GitgraphOptions,
  GitgraphUserApi,
  Commit as CommitCore,
  MergeStyle,
  Mode,
  Orientation,
  TemplateName,
  templateExtend,
  BranchesPaths,
  Coordinate,
  toSvgEdges,
} from "./core";

import { BranchLabel } from "./BranchLabel";
import { Tooltip } from "./Tooltip";
import {
  ReactSvgElement,
  CommitOptions,
  BranchOptions,
  TagOptions,
  MergeOptions,
  Branch,
} from "./types";
import { Commit } from "./Commit";
import { defaultEdge, EdgeProps } from "./Edge";
import {
  AnimationOptions,
  ANIMATION_CSS,
  assignDelays,
  edgeKey,
} from "./animation";

export {
  Gitgraph,
  GitgraphCore,
  type GitgraphProps,
  type GitgraphState,
  TemplateName,
  templateExtend,
  MergeStyle,
  Mode,
  Orientation,
  type CommitOptions,
  type BranchOptions,
  type TagOptions,
  type MergeOptions,
  type Branch,
  type EdgeProps,
};

type GitgraphProps = GitgraphPropsWithChildren | GitgraphPropsWithGraph;

interface GitgraphPropsBase {
  /** Draw lines in order and fade commits in. `false` disables it. Default: on. */
  animation?: boolean | Partial<AnimationOptions>;
  /** Render each line yourself, e.g. with an animation library. */
  renderEdge?: (edge: EdgeProps) => React.ReactElement;
}

interface GitgraphPropsWithChildren extends GitgraphPropsBase {
  options?: GitgraphOptions;
  children: (gitgraph: GitgraphUserApi<ReactSvgElement>) => void;
}

interface GitgraphPropsWithGraph extends GitgraphPropsBase {
  graph: GitgraphCore<ReactSvgElement>;
}

function isPropsWithGraph(
  props: GitgraphProps,
): props is GitgraphPropsWithGraph {
  return "graph" in props;
}

interface GitgraphState {
  commits: Array<CommitCore<ReactSvgElement>>;
  branchesPaths: BranchesPaths<ReactSvgElement>;
  commitMessagesX: number;
  // Store a map to replace commits y with the correct value,
  // including the message offset. Allows custom, flexible message height.
  // E.g. {20: 30} means for commit: y=20 -> y=30
  // Offset should be computed when graph is rendered (componentDidUpdate).
  commitYWithOffsets: { [key: number]: number };
  shouldRecomputeOffsets: boolean;
  currentCommitOver: CommitCore<ReactSvgElement> | null;
}

class Gitgraph extends React.Component<GitgraphProps, GitgraphState> {
  public static defaultProps: Partial<GitgraphProps> = {
    options: {},
  };

  private gitgraph: GitgraphCore<ReactSvgElement>;
  private $graph = React.createRef<SVGSVGElement>();
  private $commits = React.createRef<SVGGElement>();
  // Animation delay (ms) of each commit hash and edge key, set once.
  private delays = new Map<string, number>();
  private unsubscribe = () => {};

  constructor(props: GitgraphProps) {
    super(props);
    this.gitgraph = isPropsWithGraph(props)
      ? props.graph
      : new GitgraphCore<ReactSvgElement>(props.options);
    // A `graph` may already hold commits: show them without waiting for a change.
    this.state = {
      ...this.fromRenderedData(this.gitgraph.getRenderedData()),
      commitYWithOffsets: {},
      currentCommitOver: null,
    };
  }

  public render() {
    const timing = this.timing;
    return (
      <svg
        ref={this.$graph}
        style={
          timing
            ? ({
                "--gg-duration": `${timing.duration}ms`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {timing && <style>{ANIMATION_CSS}</style>}
        {/* Translate graph left => left-most branch label is not cropped (horizontal) */}
        {/* Translate graph down => top-most commit tooltip is not cropped */}
        <g transform={`translate(${BranchLabel.paddingX}, ${Tooltip.padding})`}>
          {this.renderEdges(timing)}
          <g ref={this.$commits}>
            {this.state.commits.map((commit) => (
              <Commit
                key={commit.hash}
                delay={timing ? this.delays.get(commit.hash) : undefined}
                commits={this.state.commits}
                commit={commit}
                setCurrentCommitOver={this.setCurrentCommitOver.bind(this)}
                gitgraph={this.gitgraph}
                getWithCommitOffset={this.getWithCommitOffset.bind(this)}
                commitMessagesX={this.state.commitMessagesX}
              />
            ))}
          </g>
          {this.renderTooltip()}
        </g>
      </svg>
    );
  }

  public componentDidMount() {
    this.unsubscribe = this.gitgraph.subscribe((data) =>
      this.setState(this.fromRenderedData(data)),
    );
    const props: GitgraphProps = this.props;
    if (isPropsWithGraph(props)) return;
    props.children(this.gitgraph.getUserApi());
  }

  public componentWillUnmount() {
    this.unsubscribe();
  }

  public componentDidUpdate() {
    if (this.$graph.current) {
      const { height, width } = this.$graph.current.getBBox();
      this.$graph.current.setAttribute(
        "width",
        // Add `Tooltip.padding` so we don't crop the tooltip text.
        // Add `BranchLabel.paddingX` so we don't cut branch label.
        (width + Tooltip.padding + BranchLabel.paddingX).toString(),
      );
      this.$graph.current.setAttribute(
        "height",
        // Add `Tooltip.padding` so we don't crop tooltip text
        // Add `BranchLabel.paddingY` so we don't crop branch label.
        (height + Tooltip.padding + BranchLabel.paddingY).toString(),
      );
    }

    if (!this.state.shouldRecomputeOffsets) return;
    if (!this.$commits.current) return;

    const commits = Array.from(this.$commits.current.children);
    this.setState({
      commitYWithOffsets: this.computeOffsets(commits),
      shouldRecomputeOffsets: false,
    });
  }

  private get timing(): AnimationOptions | null {
    const { animation = true } = this.props;
    if (!animation) return null;
    return {
      duration: 300,
      maxTotal: 1500,
      ...(animation === true ? {} : animation),
    };
  }

  private fromRenderedData({
    commits,
    branchesPaths,
    commitMessagesX,
  }: {
    commits: GitgraphState["commits"];
    branchesPaths: GitgraphState["branchesPaths"];
    commitMessagesX: number;
  }) {
    const timing = this.timing;
    if (timing) {
      // Only from/to matter here, not the geometry.
      const edges = toSvgEdges(branchesPaths, commits, false, false);
      assignDelays(commits, edges, this.delays, timing);
    }
    return {
      commits,
      branchesPaths,
      commitMessagesX,
      shouldRecomputeOffsets: true,
    };
  }

  private setCurrentCommitOver(v: CommitCore<ReactSvgElement> | null) {
    this.setState({ currentCommitOver: v });
  }

  private renderTooltip() {
    const commit = this.state.currentCommitOver;
    if (!commit) return null;
    const showTooltip =
      this.gitgraph.isHorizontal ||
      (this.gitgraph.mode === Mode.Compact &&
        commit.style.hasTooltipInCompactMode);
    if (!showTooltip) return null;

    const { x, y } = this.getWithCommitOffset(commit);
    return (
      <g transform={`translate(${x}, ${y})`}>
        <Tooltip commit={commit}>
          {commit.hashAbbrev} - {commit.subject}
        </Tooltip>
      </g>
    );
  }

  private renderEdges(timing: AnimationOptions | null) {
    const offset = this.gitgraph.template.commit.dot.size;
    const isBezier =
      this.gitgraph.template.branch.mergeStyle === MergeStyle.Bezier;
    const render = this.props.renderEdge || defaultEdge;
    const edges = toSvgEdges(
      this.state.branchesPaths,
      this.state.commits,
      isBezier,
      this.gitgraph.isVertical,
      this.getWithCommitOffset.bind(this),
    );

    // Flat and keyed by commits: a line never remounts (and replays)
    // when its branch changes.
    return (
      <g transform={`translate(${offset}, ${offset})`}>
        {edges.map((edge) => (
          <React.Fragment key={edgeKey(edge)}>
            {render({
              d: edge.d,
              from: edge.from,
              to: edge.to,
              stroke: edge.branch.computedColor,
              strokeWidth: edge.branch.style.lineWidth,
              delay: this.delays.get(edgeKey(edge)) || 0,
              duration: timing ? timing.duration : 0,
              animated: !!timing,
            })}
          </React.Fragment>
        ))}
      </g>
    );
  }

  private computeOffsets(
    commits: Element[],
  ): GitgraphState["commitYWithOffsets"] {
    let totalOffsetY = 0;

    // In VerticalReverse orientation, commits are in the same order in the DOM.
    const orientedCommits =
      this.gitgraph.orientation === Orientation.VerticalReverse
        ? commits
        : commits.reverse();

    return orientedCommits.reduce<GitgraphState["commitYWithOffsets"]>(
      (newOffsets, commit) => {
        const commitY = parseInt(
          commit.getAttribute("transform")!.split(",")[1].slice(0, -1),
          10,
        );

        const firstForeignObject =
          commit.getElementsByTagName("foreignObject")[0];
        const customHtmlMessage =
          firstForeignObject && firstForeignObject.firstElementChild;

        let messageHeight = 0;
        if (customHtmlMessage) {
          const height = customHtmlMessage.getBoundingClientRect().height;
          const marginTopInPx =
            window.getComputedStyle(customHtmlMessage).marginTop || "0px";
          const marginTop = parseInt(marginTopInPx.replace("px", ""), 10);

          messageHeight = height + marginTop;
        }

        // Force the height of the foreignObject (browser issue)
        if (firstForeignObject) {
          firstForeignObject.setAttribute("height", `${messageHeight}px`);
        }

        newOffsets[commitY] = commitY + totalOffsetY;

        // Increment total offset after setting the offset
        // => offset next commits accordingly.
        totalOffsetY += messageHeight;

        return newOffsets;
      },
      {},
    );
  }

  private getWithCommitOffset({ x, y }: Coordinate): Coordinate {
    return { x, y: this.state.commitYWithOffsets[y] || y };
  }
}
