import { Branch } from "./branch.js";
import { Commit } from "./commit.js";

export { BranchesOrder, type CompareBranchesOrder };

/**
 * Function used to determine the order of the branches in the rendered graph.
 *
 * Returns a value:
 * - < 0 if `branchNameA` should render before `branchNameB`
 * - \> 0 if `branchNameA` should render after `branchNameB`
 * - = 0 if ordering of both branches shouldn't change
 */
type CompareBranchesOrder = (
  branchNameA: Branch["name"],
  branchNameB: Branch["name"],
) => number;

/** Column and default color of each displayed branch. */
class BranchesOrder {
  private order: Map<Branch["name"], number>;

  public constructor(
    commits: Commit[],
    private colors: string[],
    compareFunction: CompareBranchesOrder | undefined,
  ) {
    const names = Array.from(new Set(commits.map((c) => c.branchToDisplay)));
    if (compareFunction) names.sort(compareFunction);
    this.order = new Map(names.map((name, i) => [name, i]));
  }

  /** Column of the branch, `-1` if no commit displays it. */
  public get(branchName: Branch["name"]): number {
    return this.order.get(branchName) ?? -1;
  }

  public getColorOf(branchName: Branch["name"]): string {
    return this.colors[this.get(branchName) % this.colors.length];
  }
}
