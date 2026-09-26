import type { ReactNode } from "react";
import { Commit, CommitRenderOptions } from "./commit.js";
import { GitgraphCore } from "./gitgraph.js";
import { BranchUserApi } from "./user-api/branch-user-api.js";
import { TemplateOptions, BranchStyle } from "./template.js";

export {
  type BranchCommitDefaultOptions,
  type BranchRenderOptions,
  type BranchOptions,
  DELETED_BRANCH_NAME,
  createDeletedBranch,
  Branch,
};

interface BranchCommitDefaultOptions extends CommitRenderOptions {
  author?: string;
  subject?: string;
  style?: TemplateOptions["commit"];
}

interface BranchRenderOptions {
  renderLabel?: (branch: Branch) => ReactNode;
}

interface BranchOptions extends BranchRenderOptions {
  /** Gitgraph constructor */
  gitgraph: GitgraphCore;
  /** Branch name */
  name: string;
  /** Branch style */
  style: BranchStyle;
  /** Parent commit */
  parentCommitHash?: Commit["hash"];
  /** Default options for commits */
  commitDefaultOptions?: BranchCommitDefaultOptions;
  /** On graph update. */
  onGraphUpdate: () => void;
}

const DELETED_BRANCH_NAME = "";

class Branch {
  public name: BranchOptions["name"];
  public style: BranchStyle;
  public computedColor?: BranchStyle["color"];
  public parentCommitHash: BranchOptions["parentCommitHash"];
  public commitDefaultOptions: BranchCommitDefaultOptions;
  public renderLabel: BranchOptions["renderLabel"];

  private gitgraph: GitgraphCore;
  private onGraphUpdate: () => void;

  constructor(options: BranchOptions) {
    this.gitgraph = options.gitgraph;
    this.name = options.name;
    this.style = options.style;
    this.parentCommitHash = options.parentCommitHash;
    this.commitDefaultOptions = options.commitDefaultOptions || { style: {} };
    this.onGraphUpdate = options.onGraphUpdate;
    this.renderLabel = options.renderLabel;
  }

  /** Return the API to manipulate Gitgraph branch as a user. */
  public getUserApi(): BranchUserApi {
    return new BranchUserApi(this, this.gitgraph, this.onGraphUpdate);
  }

  /** Return true if branch was deleted. */
  public isDeleted(): boolean {
    return this.name === DELETED_BRANCH_NAME;
  }
}

function createDeletedBranch(
  gitgraph: GitgraphCore,
  style: BranchStyle,
  onGraphUpdate: () => void,
): Branch {
  return new Branch({
    name: DELETED_BRANCH_NAME,
    gitgraph,
    style,
    onGraphUpdate,
  });
}
