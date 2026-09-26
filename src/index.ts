"use client";

export { Gitgraph, type GitgraphProps, useGitgraph } from "./Gitgraph.js";
export { type EdgeProps } from "./components/Edge.js";
export {
  GitgraphCore,
  MergeStyle,
  Mode,
  Orientation,
  TemplateName,
  templateExtend,
  type GitgraphCommitOptions as CommitOptions,
  type GitgraphBranchOptions as BranchOptions,
  type GitgraphTagOptions as TagOptions,
  type GitgraphMergeOptions as MergeOptions,
  type BranchUserApi as Branch,
  type Commit,
  type GitgraphOptions,
  type GitgraphUserApi,
  type Template,
  type TemplateOptions,
  type TagStyle,
} from "./core/index.js";
