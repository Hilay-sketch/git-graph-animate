import { Mode } from "../mode.js";
import { Commit } from "../commit.js";

import { CompactGraphRows } from "./compact.js";
import { RegularGraphRows } from "./regular.js";

export { createGraphRows, RegularGraphRows as GraphRows };

function createGraphRows<TNode>(
  mode: Mode | undefined,
  commits: Array<Commit<TNode>>,
) {
  return mode === Mode.Compact
    ? new CompactGraphRows(commits)
    : new RegularGraphRows(commits);
}
