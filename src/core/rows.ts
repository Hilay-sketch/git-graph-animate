import { Commit } from "./commit.js";
import { Mode } from "./mode.js";

export { computeRows };

/**
 * Row of each commit: one row per commit, or shared rows in compact mode
 * (a commit goes right under its parent when nothing is in the way).
 */
function computeRows(
  mode: Mode | undefined,
  commits: Commit[],
): Map<Commit["hash"], number> {
  const rows = new Map<Commit["hash"], number>();
  const rowOf = (hash: Commit["hash"]) => rows.get(hash) || 0;

  commits.forEach((commit, i) => {
    let row = i;
    if (mode === Mode.Compact && i > 0) {
      const parentRow = rowOf(commit.parents[0]);
      row = Math.max(parentRow + 1, rowOf(commits[i - 1].hash));
      // Merge commit: push to next row to avoid collision when the branch in
      // which the merge happens has more commits than the merged branch.
      const isMergeCommit = commit.parents.length > 1;
      if (isMergeCommit && parentRow < rowOf(commit.parents[1])) row++;
    }
    rows.set(commit.hash, row);
  });

  return rows;
}
