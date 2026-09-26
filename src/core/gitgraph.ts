import { Branch } from "./branch.js";
import { Commit } from "./commit.js";
import { Mode } from "./mode.js";
import { CompareBranchesOrder } from "./branches-order.js";
import {
  Template,
  TemplateOptions,
  TemplateName,
  getTemplate,
} from "./template.js";
import { Refs } from "./refs.js";
import { getRenderedData, RenderedData } from "./layout.js";
import { booleanOptionOr, numberOptionOr } from "./utils.js";
import { Orientation } from "./orientation.js";
import {
  GitgraphUserApi,
  GitgraphBranchOptions,
  GitgraphTagOptions,
} from "./user-api/gitgraph-user-api.js";

export { type GitgraphOptions, GitgraphCore };

interface GitgraphOptions {
  template?: TemplateName | Template;
  orientation?: Orientation;
  reverseArrow?: boolean;
  initCommitOffsetX?: number;
  initCommitOffsetY?: number;
  mode?: Mode;
  author?: string;
  branchLabelOnEveryCommit?: boolean;
  commitMessage?: string;
  generateCommitHash?: () => Commit["hash"];
  compareBranchesOrder?: CompareBranchesOrder;
}

class GitgraphCore {
  public orientation?: Orientation;
  public get isHorizontal(): boolean {
    return (
      this.orientation === Orientation.Horizontal ||
      this.orientation === Orientation.HorizontalReverse
    );
  }
  public get isVertical(): boolean {
    return !this.isHorizontal;
  }
  public get isReverse(): boolean {
    return (
      this.orientation === Orientation.HorizontalReverse ||
      this.orientation === Orientation.VerticalReverse
    );
  }
  public get shouldDisplayCommitMessage(): boolean {
    return !this.isHorizontal && this.mode !== Mode.Compact;
  }

  public reverseArrow: boolean;
  public initCommitOffsetX: number;
  public initCommitOffsetY: number;
  public mode?: Mode;
  public author: string;
  public commitMessage: string;
  public generateCommitHash: () => Commit["hash"] | undefined;
  public branchesOrderFunction: CompareBranchesOrder | undefined;
  public template: Template;
  public branchLabelOnEveryCommit: boolean;

  public refs = new Refs();
  public tags = new Refs();
  public tagStyles: { [name: string]: TemplateOptions["tag"] } = {};
  public tagRenders: {
    [name: string]: GitgraphTagOptions["render"];
  } = {};
  public commits: Array<Commit> = [];
  public branches: Map<Branch["name"], Branch> = new Map();
  public currentBranch: Branch;

  private listeners: Array<(data: RenderedData) => void> = [];
  private nextTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(options: GitgraphOptions = {}) {
    this.template = getTemplate(options.template);

    // Set a default `master` branch
    this.currentBranch = this.createBranch("master");

    // Set all options with default values
    this.orientation = options.orientation;
    this.reverseArrow = booleanOptionOr(options.reverseArrow, false);
    this.initCommitOffsetX = numberOptionOr(options.initCommitOffsetX, 0);
    this.initCommitOffsetY = numberOptionOr(options.initCommitOffsetY, 0);
    this.mode = options.mode;
    this.author = options.author || "Sergio Flores <saxo-guy@epic.com>";
    this.commitMessage =
      options.commitMessage || "He doesn't like George Michael! Boooo!";
    this.generateCommitHash =
      typeof options.generateCommitHash === "function"
        ? options.generateCommitHash
        : () => undefined;
    this.branchesOrderFunction =
      typeof options.compareBranchesOrder === "function"
        ? options.compareBranchesOrder
        : undefined;
    this.branchLabelOnEveryCommit = booleanOptionOr(
      options.branchLabelOnEveryCommit,
      false,
    );
  }

  /**
   * Return the API to manipulate Gitgraph as a user.
   */
  public getUserApi(): GitgraphUserApi {
    return new GitgraphUserApi(this, () => this.next());
  }

  /**
   * Add a change listener.
   * It will be called any time the graph have changed (commit, merge…).
   *
   * @param listener A callback to be invoked on every change.
   * @returns A function to remove this change listener.
   */
  public subscribe(listener: (data: RenderedData) => void): () => void {
    this.listeners.push(listener);

    let isSubscribed = true;

    return () => {
      if (!isSubscribed) return;
      isSubscribed = false;
      const index = this.listeners.indexOf(listener);
      this.listeners.splice(index, 1);
    };
  }

  /** Positioned, styled commits and branch paths, ready to draw. */
  public getRenderedData(): RenderedData {
    return getRenderedData(this);
  }

  /**
   * Create a new branch.
   *
   * @param options Options of the branch
   */
  public createBranch(options: GitgraphBranchOptions): Branch;
  /**
   * Create a new branch. (as `git branch`)
   *
   * @param name Name of the created branch
   */
  public createBranch(name: string): Branch;
  public createBranch(args: any): Branch {
    const defaultParentBranchName = "HEAD";

    let options = {
      gitgraph: this,
      name: "",
      parentCommitHash: this.refs.getCommit(defaultParentBranchName),
      style: this.template.branch,
      onGraphUpdate: () => this.next(),
    };

    if (typeof args === "string") {
      options.name = args;
      options.parentCommitHash = this.refs.getCommit(defaultParentBranchName);
    } else {
      const parentBranchName = args.from
        ? args.from.name
        : defaultParentBranchName;
      const parentCommitHash =
        this.refs.getCommit(parentBranchName) ||
        (this.refs.hasCommit(args.from) ? args.from : undefined);
      args.style = args.style || {};
      options = {
        ...options,
        ...args,
        parentCommitHash,
        style: {
          ...options.style,
          ...args.style,
          label: {
            ...options.style.label,
            ...args.style.label,
          },
        },
      };
    }

    const branch = new Branch(options);
    this.branches.set(branch.name, branch);

    return branch;
  }

  /**
   * Tell each listener something new happened, on the next tick
   * (several changes in a row notify once).
   * @internal Called by the user API after each change.
   */
  public next() {
    if (this.nextTimeoutId) {
      clearTimeout(this.nextTimeoutId);
    }

    this.nextTimeoutId = setTimeout(() => {
      this.listeners.forEach((listener) => listener(this.getRenderedData()));
    }, 0);
  }
}
