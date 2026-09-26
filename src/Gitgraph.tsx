import * as React from "react";
import {
  GitgraphCore,
  GitgraphOptions,
  GitgraphUserApi,
  Commit as CommitCore,
  MergeStyle,
  Mode,
  Orientation,
  BranchesPaths,
  Coordinate,
  toSvgEdges,
} from "./core/index.js";
import { BRANCH_LABEL_PADDING_X } from "./components/BranchLabel.js";
import { Tooltip, TOOLTIP_PADDING } from "./components/Tooltip.js";
import { Commit } from "./components/Commit.js";
import { defaultEdge, EdgeProps } from "./components/Edge.js";
import { AnimationOptions, assignDelays, edgeKey } from "./animation/delays.js";
import { ANIMATION_CSS } from "./animation/css.js";
import { Impact, playImpacts } from "./animation/impact.js";
import { CommitYOffsets, computeOffsets, sizeSvg } from "./measure.js";

export { Gitgraph, type GitgraphProps, useGitgraph };

/**
 * A graph kept for the component's lifetime, to draw with `<Gitgraph graph>`
 * and change later from event handlers.
 *
 * @param init Builds the initial history, once. Prefer it to an effect:
 * StrictMode runs effects twice, which would commit everything twice.
 */
function useGitgraph(
  options?: GitgraphOptions,
  init?: (gitgraph: GitgraphUserApi) => void,
): GitgraphCore {
  const [graph] = React.useState(() => {
    const graph = new GitgraphCore(options);
    init?.(graph.getUserApi());
    return graph;
  });
  return graph;
}

type GitgraphProps = GitgraphPropsWithChildren | GitgraphPropsWithGraph;

interface GitgraphPropsBase {
  /**
   * Draw lines in order and fade commits in. `false` disables it.
   * `{ impact: true }` also makes commits added later land with an impact.
   * Default: on, without impact.
   */
  animation?: boolean | Partial<AnimationOptions>;
  /** Nonce for the injected `<style>`, for a strict Content-Security-Policy. */
  nonce?: string;
  /** Render each line yourself, e.g. with an animation library. */
  renderEdge?: (edge: EdgeProps) => React.ReactElement;
}

interface GitgraphPropsWithChildren extends GitgraphPropsBase {
  options?: GitgraphOptions;
  children: (gitgraph: GitgraphUserApi) => void;
}

interface GitgraphPropsWithGraph extends GitgraphPropsBase {
  graph: GitgraphCore;
}

function isPropsWithGraph(
  props: GitgraphProps,
): props is GitgraphPropsWithGraph {
  return "graph" in props;
}

interface GitgraphState {
  commits: CommitCore[];
  commitsByHash: Map<CommitCore["hash"], CommitCore>;
  branchesPaths: BranchesPaths;
  commitMessagesX: number;
  // Computed once the graph is in the DOM (componentDidUpdate).
  commitYWithOffsets: CommitYOffsets;
  shouldRecomputeOffsets: boolean;
  currentCommitOver: CommitCore | null;
}

class Gitgraph extends React.Component<GitgraphProps, GitgraphState> {
  private gitgraph: GitgraphCore;
  private $graph = React.createRef<SVGSVGElement>();
  private $commits = React.createRef<SVGGElement>();
  // Animation delay (ms) of each commit hash and edge key, set once.
  private delays = new Map<string, number>();
  // Commits added after the first render: they land with an impact.
  private added = new Set<string>();
  private pendingImpacts: Impact[] = [];
  private unsubscribe = () => {};
  private isBuilt = false;

  constructor(props: GitgraphProps) {
    super(props);
    this.gitgraph = isPropsWithGraph(props)
      ? props.graph
      : new GitgraphCore(props.options);
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
                // Impact rings may burst past the graph's edges.
                overflow: "visible",
              } as React.CSSProperties)
            : undefined
        }
      >
        {timing && <style nonce={this.props.nonce}>{ANIMATION_CSS}</style>}
        {/* Translate graph left => left-most branch label is not cropped (horizontal) */}
        {/* Translate graph down => top-most commit tooltip is not cropped */}
        <g
          transform={`translate(${BRANCH_LABEL_PADDING_X}, ${TOOLTIP_PADDING})`}
        >
          {this.renderEdges(timing)}
          <g ref={this.$commits}>
            {this.state.commits.map((commit) => (
              <Commit
                key={commit.hash}
                delay={timing ? this.delays.get(commit.hash) : undefined}
                added={this.added.has(commit.hash)}
                commitsByHash={this.state.commitsByHash}
                commit={commit}
                setCurrentCommitOver={this.setCurrentCommitOver}
                gitgraph={this.gitgraph}
                y={this.getWithCommitOffset(commit).y}
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
    if (isPropsWithGraph(props)) {
      // A `graph` may already hold commits and never change again:
      // size the SVG now instead of waiting for an update.
      this.componentDidUpdate();
      return;
    }
    // StrictMode remounts the same instance: build the graph only once.
    if (this.isBuilt) return;
    this.isBuilt = true;
    props.children(this.gitgraph.getUserApi());
  }

  public componentWillUnmount() {
    this.unsubscribe();
  }

  public componentDidUpdate() {
    const svg = this.$graph.current;
    const impacts = this.pendingImpacts.splice(0);
    if (svg && this.timing) {
      const { isVertical, isReverse } = this.gitgraph;
      const direction: [number, number] = isVertical
        ? [0, isReverse ? 1 : -1]
        : [isReverse ? -1 : 1, 0];
      playImpacts(svg, impacts, direction, this.timing.duration);
    }
    if (svg) sizeSvg(svg);

    if (!this.state.shouldRecomputeOffsets) return;
    if (!this.$commits.current) return;

    this.setState({
      commitYWithOffsets: computeOffsets(
        Array.from(this.$commits.current.children),
        this.gitgraph.orientation === Orientation.VerticalReverse,
      ),
      shouldRecomputeOffsets: false,
    });
  }

  private get timing(): AnimationOptions | null {
    const { animation = true } = this.props;
    if (!animation) return null;
    return {
      duration: 300,
      maxTotal: 1500,
      impact: false,
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
    const commitsByHash = new Map(commits.map((c) => [c.hash, c]));
    if (timing) {
      // Only from/to matter here, not the geometry.
      const edges = toSvgEdges(branchesPaths, commits, false, false);
      const added = assignDelays(commits, edges, this.delays, timing);
      if (timing.impact)
        added.forEach((hash) => {
          this.added.add(hash);
          this.pendingImpacts.push({
            delay: this.delays.get(hash)!,
            parents: commitsByHash
              .get(hash)!
              .parents.flatMap((parent) => commitsByHash.get(parent) || []),
          });
        });
    }
    return {
      commits,
      commitsByHash,
      branchesPaths,
      commitMessagesX,
      shouldRecomputeOffsets: true,
    };
  }

  // Arrow field: a stable callback, so memoized commits don't re-render.
  private setCurrentCommitOver = (v: CommitCore | null) => {
    this.setState({ currentCommitOver: v });
  };

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
              added: this.added.has(edge.to),
            })}
          </React.Fragment>
        ))}
      </g>
    );
  }

  private getWithCommitOffset({ x, y }: Coordinate): Coordinate {
    return { x, y: this.state.commitYWithOffsets[y] || y };
  }
}
