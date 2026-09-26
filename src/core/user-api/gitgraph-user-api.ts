import type { ReactNode } from "react";
import { TagStyle, TemplateOptions } from "../template.js";
import { Commit, CommitRenderOptions } from "../commit.js";
import {
  Branch,
  BranchCommitDefaultOptions,
  BranchRenderOptions,
} from "../branch.js";
import { GitgraphCore } from "../gitgraph.js";
import { Refs } from "../refs.js";
import { BranchUserApi } from "./branch-user-api.js";
import { importGit2json } from "./import.js";

export {
  type GitgraphCommitOptions,
  type GitgraphBranchOptions,
  type GitgraphTagOptions,
  GitgraphUserApi,
};

interface GitgraphCommitOptions extends CommitRenderOptions {
  author?: string;
  subject?: string;
  body?: string;
  hash?: string;
  style?: TemplateOptions["commit"];
  dotText?: string;
  tag?: string;
  onClick?: (commit: Commit) => void;
  onMessageClick?: (commit: Commit) => void;
  onMouseOver?: (commit: Commit) => void;
  onMouseOut?: (commit: Commit) => void;
}

interface GitgraphTagOptions {
  name: string;
  style?: TemplateOptions["tag"];
  ref?: Commit["hash"] | Branch["name"];
  render?: (name: string, style: TagStyle) => ReactNode;
}

interface GitgraphBranchOptions extends BranchRenderOptions {
  /**
   * Branch name
   */
  name: string;
  /**
   * Origin branch or commit hash
   */
  from?: BranchUserApi | Commit["hash"];
  /**
   * Default options for commits
   */
  commitDefaultOptions?: BranchCommitDefaultOptions;
  /**
   * Branch style
   */
  style?: TemplateOptions["branch"];
}

class GitgraphUserApi {
  private _graph: GitgraphCore;
  private _onGraphUpdate: () => void;

  constructor(graph: GitgraphCore, onGraphUpdate: () => void) {
    this._graph = graph;
    this._onGraphUpdate = onGraphUpdate;
  }

  /**
   * Clear everything (as `rm -rf .git && git init`).
   */
  public clear(): this {
    this._graph.refs = new Refs();
    this._graph.tags = new Refs();
    this._graph.commits = [];
    this._graph.branches = new Map();
    this._graph.currentBranch = this._graph.createBranch("master");
    this._onGraphUpdate();
    return this;
  }

  /**
   * Add a new commit in the history (as `git commit`).
   *
   * @param subject Commit subject
   */
  public commit(subject?: string): this;
  /**
   * Add a new commit in the history (as `git commit`).
   *
   * @param options Options of the commit
   */
  public commit(options?: GitgraphCommitOptions): this;
  public commit(options?: any): this {
    this._graph.currentBranch.getUserApi().commit(options);
    return this;
  }

  /**
   * Create a new branch (as `git branch`).
   *
   * @param options Options of the branch
   */
  public branch(options: GitgraphBranchOptions): BranchUserApi;
  /**
   * Create a new branch (as `git branch`).
   *
   * @param name Name of the created branch
   */
  public branch(name: string): BranchUserApi;
  public branch(args: any): BranchUserApi {
    return this._graph.createBranch(args).getUserApi();
  }

  /**
   * Tag a specific commit.
   *
   * @param options Options of the tag
   */
  public tag(options: GitgraphTagOptions): this;
  /**
   * Tag a specific commit.
   *
   * @param name Name of the tag
   * @param ref Commit or branch name or commit hash
   */
  public tag(
    name: GitgraphTagOptions["name"],
    ref?: GitgraphTagOptions["ref"],
  ): this;
  public tag(...args: any[]): this {
    // Deal with shorter syntax
    let name: GitgraphTagOptions["name"];
    let ref: GitgraphTagOptions["ref"];
    let style: GitgraphTagOptions["style"];
    let render: GitgraphTagOptions["render"];

    if (typeof args[0] === "string") {
      name = args[0];
      ref = args[1];
    } else {
      name = args[0].name;
      ref = args[0].ref;
      style = args[0].style;
      render = args[0].render;
    }

    if (!ref) {
      const head = this._graph.refs.getCommit("HEAD");
      if (!head) return this;

      ref = head;
    }

    let commitHash;
    if (this._graph.refs.hasCommit(ref)) {
      // `ref` is a `Commit["hash"]`
      commitHash = ref;
    }

    if (this._graph.refs.hasName(ref)) {
      // `ref` is a `Branch["name"]`
      commitHash = this._graph.refs.getCommit(ref);
    }

    if (!commitHash) {
      throw new Error(`The ref "${ref}" does not exist`);
    }

    this._graph.tags.set(name, commitHash);
    this._graph.tagStyles[name] = style;
    this._graph.tagRenders[name] = render;
    this._onGraphUpdate();
    return this;
  }

  /**
   * Replace the graph with a JSON history.
   *
   * @experimental
   * @param data JSON from `git2json` output
   */
  public import(data: unknown) {
    this.clear();
    importGit2json(this._graph, data, (name) => this.branch(name));
    this._onGraphUpdate();
    return this;
  }
}
