import { Branch, DELETED_BRANCH_NAME, createDeletedBranch } from "./branch.js";
import { Commit } from "./commit.js";
import { computeRows } from "./rows.js";
import { BranchesOrder } from "./branches-order.js";
import { BranchesPathsCalculator, BranchesPaths } from "./branches-paths.js";
import { Orientation } from "./orientation.js";
import type { GitgraphCore } from "./gitgraph.js";

export { type RenderedData, getRenderedData, getBranches, withBranches };

interface RenderedData {
  commits: Commit[];
  branchesPaths: BranchesPaths;
  commitMessagesX: number;
}

/**
 * Everything needed to draw the graph: positioned and styled commits,
 * branch paths, and where commit messages start.
 */
function getRenderedData(graph: GitgraphCore): RenderedData {
  const { commits, branchesOrder } = computeRenderedCommits(graph);
  const branchesPaths = new BranchesPathsCalculator(
    commits,
    graph.branches,
    graph.template.commit.spacing,
    graph.isVertical,
    graph.isReverse,
    () => createDeletedBranch(graph, graph.template.branch, () => graph.next()),
  ).execute();
  const commitMessagesX =
    Array.from(branchesPaths).length * graph.template.branch.spacing;

  // Branch colors follow branch paths.
  branchesPaths.forEach((_, branch) => {
    branch.computedColor =
      branch.style.color || branchesOrder.getColorOf(branch.name);
  });

  return { commits, branchesPaths, commitMessagesX };
}

function computeRenderedCommits(graph: GitgraphCore) {
  const branches = getBranches(graph);

  // Commits that are not associated to a branch in `branches`
  // were in a deleted branch. If the latter was merged beforehand
  // they are reachable and are rendered. Others are not
  const reachableUnassociatedCommits = (() => {
    const unassociatedCommits = new Set(
      graph.commits
        .filter(({ hash }) => !branches.has(hash))
        .map(({ hash }) => hash),
    );

    const tipsOfMergedBranches = graph.commits.flatMap((commit) =>
      commit.parents
        .slice(1)
        .map((parentHash) =>
          graph.commits.find(({ hash }) => parentHash === hash)!,
        ),
    );

    const reachableCommits = new Set();

    tipsOfMergedBranches.forEach((tip) => {
      let currentCommit: Commit | undefined = tip;

      while (currentCommit && unassociatedCommits.has(currentCommit.hash)) {
        reachableCommits.add(currentCommit.hash);

        currentCommit =
          currentCommit.parents.length > 0
            ? graph.commits.find(
                ({ hash }) => currentCommit!.parents[0] === hash,
              )
            : undefined;
      }
    });

    return reachableCommits;
  })();

  const commitsToRender = graph.commits.filter(
    ({ hash }) => branches.has(hash) || reachableUnassociatedCommits.has(hash),
  );

  const commitsWithBranches = commitsToRender.map((commit) =>
    withBranches(branches, commit),
  );

  const rows = computeRows(graph.mode, commitsToRender);
  const maxRow = new Set(rows.values()).size - 1;
  const branchesOrder = new BranchesOrder(
    commitsWithBranches,
    graph.template.colors,
    graph.branchesOrderFunction,
  );

  const commits = commitsWithBranches
    .map((commit) => commit.setRefs(graph.refs))
    .map((commit) =>
      withPosition(
        graph,
        rows.get(commit.hash) || 0,
        maxRow,
        branchesOrder,
        commit,
      ),
    )
    // Fallback commit computed color on branch color.
    .map((commit) =>
      commit.withDefaultColor(branchesOrder.getColorOf(commit.branchToDisplay)),
    )
    // Tags need commit style to be computed (with default color).
    .map((commit) =>
      commit.setTags(
        graph.tags,
        (name) => Object.assign({}, graph.tagStyles[name], graph.template.tag),
        (name) => graph.tagRenders[name],
      ),
    );
  return { commits, branchesOrder };
}

/**
 * Add `branches` property to commit.
 *
 * @param branches All branches mapped by commit hash
 */
function withBranches(
  branches: Map<Commit["hash"], Set<Branch["name"]>>,
  commit: Commit,
): Commit {
  const commitBranches = Array.from(branches.get(commit.hash) || []);
  // No branch => branch has been deleted.
  return commit.setBranches(
    commitBranches.length ? commitBranches : [DELETED_BRANCH_NAME],
  );
}

/** Branch names of each commit, following first parents from each ref. */
function getBranches(
  graph: GitgraphCore,
): Map<Commit["hash"], Set<Branch["name"]>> {
  const result = new Map<Commit["hash"], Set<Branch["name"]>>();

  const queue: Array<Commit["hash"]> = [];
  const branches = graph.refs.getAllNames().filter((name) => name !== "HEAD");
  branches.forEach((branch) => {
    const commitHash = graph.refs.getCommit(branch);
    if (commitHash) {
      queue.push(commitHash);
    }

    while (queue.length > 0) {
      const currentHash = queue.pop() as Commit["hash"];
      const current = graph.commits.find(({ hash }) => hash === currentHash);
      const prevBranches = result.get(currentHash) || new Set<Branch["name"]>();
      prevBranches.add(branch);
      result.set(currentHash, prevBranches);
      if (current && current.parents.length > 0) {
        queue.push(current.parents[0]);
      }
    }
  });

  return result;
}

function withPosition(
  graph: GitgraphCore,
  row: number,
  maxRow: number,
  branchesOrder: BranchesOrder,
  commit: Commit,
): Commit {
  const order = branchesOrder.get(commit.branchToDisplay);
  const { initCommitOffsetX: x0, initCommitOffsetY: y0 } = graph;
  const commitSpacing = graph.template.commit.spacing;
  const branchSpacing = graph.template.branch.spacing;

  switch (graph.orientation) {
    default:
      return commit.setPosition({
        x: x0 + branchSpacing * order,
        y: y0 + commitSpacing * (maxRow - row),
      });

    case Orientation.VerticalReverse:
      return commit.setPosition({
        x: x0 + branchSpacing * order,
        y: y0 + commitSpacing * row,
      });

    case Orientation.Horizontal:
      return commit.setPosition({
        x: x0 + commitSpacing * row,
        y: y0 + branchSpacing * order,
      });

    case Orientation.HorizontalReverse:
      return commit.setPosition({
        x: x0 + commitSpacing * (maxRow - row),
        y: y0 + branchSpacing * order,
      });
  }
}
