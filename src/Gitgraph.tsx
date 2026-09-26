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
  charge,
  chargeLine,
  recoil,
  CHARGE_MS,
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
  // Commits added after the first render: they land with an impact.
  private added = new Set<string>();
  private pendingImpacts: Array<{
    /** When the commit lands, in ms. */
    delay: number;
    /** Parents that charge before the line shoots out. */
    parents: Array<CommitCore<ReactSvgElement>>;
  }> = [];
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
                // Impact rings may burst past the graph's edges.
                overflow: "visible",
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
                added={this.added.has(commit.hash)}
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
    if (isPropsWithGraph(props)) {
      // A `graph` may already hold commits and never change again:
      // size the SVG now instead of waiting for an update.
      this.componentDidUpdate();
      return;
    }
    props.children(this.gitgraph.getUserApi());
  }

  public componentWillUnmount() {
    this.unsubscribe();
  }

  public componentDidUpdate() {
    this.playImpacts();

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
      assignDelays(commits, edges, this.delays, timing).forEach((hash) => {
        this.added.add(hash);
        const commit = commits.find((c) => c.hash === hash)!;
        this.pendingImpacts.push({
          delay: this.delays.get(hash)!,
          parents: commits.filter((c) => commit.parents.includes(c.hash)),
        });
      });
    }
    return {
      commits,
      branchesPaths,
      commitMessagesX,
      shouldRecomputeOffsets: true,
    };
  }

  // Added commit: its parents charge (dot + incoming line), then the whole
  // graph jolts when it lands. JS because these play on elements that are
  // already mounted, where a CSS animation can't restart per commit.
  private playImpacts() {
    const svg = this.$graph.current;
    const impacts = this.pendingImpacts.splice(0);
    if (!svg || !svg.animate || !impacts.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const { isVertical, isReverse } = this.gitgraph;
    const [dx, dy] = isVertical
      ? [0, isReverse ? 1 : -1]
      : [isReverse ? -1 : 1, 0];
    const duration = this.timing!.duration;
    impacts.forEach(({ delay, parents }) => {
      const chargeAt = Math.max(0, delay - duration - CHARGE_MS);
      parents.forEach((parent) => {
        const color = parent.style.dot.color as string;
        const dot = svg.querySelector(`[data-hash="${parent.hash}"] .gg-dot`);
        if (dot) {
          const [frames, options] = charge(color);
          dot.animate(frames, { ...options, delay: chargeAt });
        }
        svg
          .querySelectorAll<SVGPathElement>(
            `.gg-edge[data-to="${parent.hash}"]`,
          )
          .forEach((line) => {
            const width = Number(line.getAttribute("stroke-width")) || 2;
            const [frames, options] = chargeLine(color, width);
            line.animate(frames, { ...options, delay: chargeAt });
          });
      });
      svg.animate(recoil(dx, dy), { delay, duration: 420 });
    });
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
              added: this.added.has(edge.to),
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
