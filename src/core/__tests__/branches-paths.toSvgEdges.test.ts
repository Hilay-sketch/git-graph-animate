import { GitgraphCore } from "../gitgraph";
import { Orientation } from "../orientation";
import { Mode } from "../mode";
import { toSvgEdges } from "../branches-paths";
import { MergeStyle, TemplateName, templateExtend } from "../template";

function simpleGraph(core: GitgraphCore) {
  const gitgraph = core.getUserApi();
  const master = gitgraph.branch("master");
  master.commit("one").commit("two");
  const dev = gitgraph.branch("dev");
  dev.commit("three");
  master.commit("four");
  dev.commit("five");
  master.merge(dev);
}

function edgesOf(core: GitgraphCore, isBezier = true) {
  const { commits, branchesPaths } = core.getRenderedData();
  const subject = (hash: string) =>
    commits.find((c) => c.hash === hash)?.subject;
  const edges = toSvgEdges(branchesPaths, commits, isBezier, core.isVertical);
  return { commits, edges, subject };
}

describe("toSvgEdges", () => {
  it("splits branch paths into one bezier edge per parent → child", () => {
    const core = new GitgraphCore();
    simpleGraph(core);

    const { edges, subject } = edgesOf(core);

    expect(
      edges.map((e) => [subject(e.from), subject(e.to), e.branch.name, e.d]),
    ).toEqual([
      ["one", "two", "master", "M 0 400 C 0 360 0 360 0 320"],
      ["two", "four", "master", "M 0 320 L 0 240 L 0 160"],
      [
        "four",
        expect.stringMatching(/^Merge/),
        "master",
        "M 0 160 L 0 80 C 0 40 0 40 0 0",
      ],
      ["two", "three", "dev", "M 0 320 C 0 280 50 280 50 240"],
      ["three", "five", "dev", "M 50 240 L 50 160 L 50 80"],
      [
        "five",
        expect.stringMatching(/^Merge/),
        "dev",
        "M 50 80 C 50 40 0 40 0 0",
      ],
    ]);
  });

  it("draws straight segments when not bezier", () => {
    const core = new GitgraphCore({
      template: templateExtend(TemplateName.Metro, {
        branch: { mergeStyle: MergeStyle.Straight },
      }),
    });
    simpleGraph(core);

    const { edges } = edgesOf(core, false);

    expect(edges.map((e) => e.d)).toEqual([
      "M 0 400 L 0 320",
      "M 0 320 L 0 240 L 0 160",
      "M 0 160 L 0 80 L 0 0",
      "M 0 320 L 50 240",
      "M 50 240 L 50 160 L 50 80",
      "M 50 80 L 0 0",
    ]);
  });

  it("maps points when building d", () => {
    const core = new GitgraphCore();
    core.getUserApi().branch("master").commit("one").commit("two");
    const { commits, branchesPaths } = core.getRenderedData();

    const edges = toSvgEdges(branchesPaths, commits, false, true, (p) => ({
      x: p.x + 1,
      y: p.y * 2,
    }));

    expect(edges.map((e) => e.d)).toEqual(["M 1 160 L 1 0"]);
  });

  it("returns no edge for a single commit", () => {
    const core = new GitgraphCore();
    core.getUserApi().branch("master").commit("one");

    expect(edgesOf(core).edges).toEqual([]);
  });

  const cases: Array<[string, Orientation | undefined, Mode | undefined]> = [
    ["vertical", undefined, undefined],
    ["vertical-reverse", Orientation.VerticalReverse, undefined],
    ["horizontal", Orientation.Horizontal, undefined],
    ["horizontal-reverse", Orientation.HorizontalReverse, undefined],
    ["compact", undefined, Mode.Compact],
  ];
  cases.forEach(([name, orientation, mode]) => {
    it(`draws every edge from parent to child (${name})`, () => {
      const core = new GitgraphCore({ orientation, mode });
      simpleGraph(core);

      const { commits, edges } = edgesOf(core);

      const expectedPairs = commits.flatMap((c) =>
        c.parents.map((p) => `${p}->${c.hash}`),
      );
      expect(edges.map((e) => `${e.from}->${e.to}`).sort()).toEqual(
        expectedPairs.sort(),
      );
      edges.forEach((edge) => {
        const from = commits.find((c) => c.hash === edge.from)!;
        const to = commits.find((c) => c.hash === edge.to)!;
        expect(edge.d.startsWith(`M ${from.x} ${from.y} `)).toBe(true);
        expect(edge.d.endsWith(` ${to.x} ${to.y}`)).toBe(true);
      });
    });
  });
});
