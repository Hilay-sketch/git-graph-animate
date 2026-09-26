import { Commit, CommitOptions } from "../commit.js";
import { Branch } from "../branch.js";
import { GitgraphCore } from "../gitgraph.js";
import { getBranches, withBranches } from "../layout.js";

export { importGit2json };

const TAG_PREFIX = "tag: ";

/**
 * Replace the graph with a `git2json` history.
 * Data can't be typed since it comes from a JSON: validate and throw early.
 *
 * @param addBranch Creates a branch through the user API.
 */
function importGit2json(
  graph: GitgraphCore,
  data: unknown,
  addBranch: (name: string) => void,
) {
  const invalidData = new Error(
    "Only `git2json` format is supported for imported data.",
  );

  if (!Array.isArray(data)) {
    throw invalidData;
  }

  const areDataValid = data.every(
    (options) =>
      typeof options === "object" &&
      typeof options.author === "object" &&
      Array.isArray(options.refs),
  );
  if (!areDataValid) {
    throw invalidData;
  }

  const commitOptionsList: Array<CommitOptions & { refs: string[] }> = data
    .map((options) => ({
      ...options,
      style: {
        ...graph.template.commit,
        message: {
          ...graph.template.commit.message,
          display: graph.shouldDisplayCommitMessage,
        },
      },
      author: `${options.author.name} <${options.author.email}>`,
    }))
    // git2json is reverse-chronological; commit in chronological order.
    .reverse();

  graph.commits = commitOptionsList.map((options) => new Commit(options));

  // Create tags & refs.
  commitOptionsList.forEach(({ refs, hash }) => {
    if (!refs || !hash) return;

    refs
      .filter((ref) => ref.startsWith(TAG_PREFIX))
      .forEach((ref) => graph.tags.set(ref.slice(TAG_PREFIX.length), hash));
    refs
      .filter((ref) => !ref.startsWith(TAG_PREFIX))
      .forEach((ref) => graph.refs.set(ref, hash));
  });

  // Create branches.
  const branches = getBranches(graph);
  const names = new Set<Branch["name"]>();
  graph.commits
    .map((commit) => withBranches(branches, commit))
    .forEach((commit) => commit.branches!.forEach((name) => names.add(name)));
  names.forEach(addBranch);
}
