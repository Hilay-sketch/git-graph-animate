import { Commit } from "./commit";
import { Branch } from "./branch";
import { CommitStyleBase } from "./template";
import { pick } from "./utils";

export {
  type BranchesPaths,
  type Coordinate,
  BranchesPathsCalculator,
  toSvgEdges,
};

type BranchesPaths<TNode> = Map<Branch<TNode>, Coordinate[][]>;

interface Coordinate {
  x: number;
  y: number;
}

interface Edge<TNode> {
  /** Parent commit hash (or `x,y` if no commit is there) */
  from: string;
  /** Child commit hash (or `x,y` if no commit is there) */
  to: string;
  branch: Branch<TNode>;
  d: string;
}

type InternalBranchesPaths<TNode> = Map<Branch<TNode>, InternalCoordinate[]>;

interface InternalCoordinate extends Coordinate {
  mergeCommit?: boolean;
}

/**
 * Calculate branches paths of the graph.
 *
 * It follows the Command pattern:
 * => a class with a single `execute()` public method.
 *
 * Main benefit is we can split computation in smaller steps without
 * passing around parameters (we can rely on private data).
 */
class BranchesPathsCalculator<TNode> {
  private commits: Array<Commit<TNode>>;
  private branches: Map<Branch["name"], Branch<TNode>>;
  private commitSpacing: CommitStyleBase["spacing"];
  private isGraphVertical: boolean;
  private isGraphReverse: boolean;
  private createDeletedBranch: () => Branch<TNode>;
  private branchesPaths: InternalBranchesPaths<TNode> = new Map<
    Branch<TNode>,
    InternalCoordinate[]
  >();

  constructor(
    commits: Array<Commit<TNode>>,
    branches: Map<Branch["name"], Branch<TNode>>,
    commitSpacing: CommitStyleBase["spacing"],
    isGraphVertical: boolean,
    isGraphReverse: boolean,
    createDeletedBranch: () => Branch<TNode>,
  ) {
    this.commits = commits;
    this.branches = branches;
    this.commitSpacing = commitSpacing;
    this.isGraphVertical = isGraphVertical;
    this.isGraphReverse = isGraphReverse;
    this.createDeletedBranch = createDeletedBranch;
  }

  /**
   * Compute branches paths for graph.
   */
  public execute(): BranchesPaths<TNode> {
    this.fromCommits();
    this.withMergeCommits();
    return this.smoothBranchesPaths();
  }

  /**
   * Initialize branches paths from calculator's commits.
   */
  private fromCommits() {
    this.commits.forEach((commit) => {
      let branch = this.branches.get(commit.branchToDisplay);

      if (!branch) {
        // NB: may not work properly if there are many deleted branches.
        branch = this.getDeletedBranchInPath() || this.createDeletedBranch();
      }

      const path: Coordinate[] = [];
      const existingBranchPath = this.branchesPaths.get(branch);
      const firstParentCommit = this.commits.find(
        ({ hash }) => hash === commit.parents[0],
      );
      if (existingBranchPath) {
        path.push(...existingBranchPath);
      } else if (firstParentCommit) {
        // Make branch path starts from parent branch (parent commit).
        path.push({ x: firstParentCommit.x, y: firstParentCommit.y });
      }

      path.push({ x: commit.x, y: commit.y });

      this.branchesPaths.set(branch, path);
    });
  }

  /**
   * Insert merge commits points into `branchesPaths`.
   *
   * @example
   *     // Before
   *     [
   *       { x: 0, y: 640 },
   *       { x: 50, y: 560 }
   *     ]
   *
   *     // After
   *     [
   *       { x: 0, y: 640 },
   *       { x: 50, y: 560 },
   *       { x: 50, y: 560, mergeCommit: true }
   *     ]
   */
  private withMergeCommits() {
    const mergeCommits = this.commits.filter(
      ({ parents }) => parents.length > 1,
    );

    mergeCommits.forEach((mergeCommit) => {
      const parentOnOriginBranch = this.commits.find(({ hash }) => {
        return hash === mergeCommit.parents[1];
      });
      if (!parentOnOriginBranch) return;

      const originBranchName = parentOnOriginBranch.branches
        ? parentOnOriginBranch.branches[0]
        : "";
      let branch = this.branches.get(originBranchName);

      if (!branch) {
        branch = this.getDeletedBranchInPath();

        if (!branch) {
          // Still no branch? That's strange, we shouldn't set anything.
          return;
        }
      }

      const lastPoints = [...(this.branchesPaths.get(branch) || [])];
      this.branchesPaths.set(branch, [
        ...lastPoints,
        { x: mergeCommit.x, y: mergeCommit.y, mergeCommit: true },
      ]);
    });
  }

  /**
   * Retrieve deleted branch from calculator's branches paths.
   */
  private getDeletedBranchInPath(): Branch<TNode> | undefined {
    return Array.from(this.branchesPaths.keys()).find((branch) =>
      branch.isDeleted(),
    );
  }

  /**
   * Smooth all paths by putting points on each row.
   */
  private smoothBranchesPaths(): BranchesPaths<TNode> {
    const branchesPaths = new Map<Branch<TNode>, Coordinate[][]>();

    this.branchesPaths.forEach((points, branch) => {
      if (points.length <= 1) {
        branchesPaths.set(branch, [points]);
        return;
      }

      // Cut path on each merge commits
      // Coordinate[] -> Coordinate[][]
      if (this.isGraphVertical) {
        points = points.sort((a, b) => (a.y > b.y ? -1 : 1));
      } else {
        points = points.sort((a, b) => (a.x > b.x ? 1 : -1));
      }

      if (this.isGraphReverse) {
        points = points.reverse();
      }

      const paths = points.reduce<Coordinate[][]>(
        (mem, point, i) => {
          if (point.mergeCommit) {
            mem[mem.length - 1].push(pick(point, ["x", "y"]));
            let j = i - 1;
            let previousPoint = points[j];

            // Find the last point which is not a merge
            while (j >= 0 && previousPoint.mergeCommit) {
              j--;
              previousPoint = points[j];
            }

            // Start a new array with this point
            if (j >= 0) {
              mem.push([previousPoint]);
            }
          } else {
            mem[mem.length - 1].push(point);
          }
          return mem;
        },
        [[]],
      );

      if (this.isGraphReverse) {
        paths.forEach((path) => path.reverse());
      }

      // Add intermediate points on each sub paths
      if (this.isGraphVertical) {
        paths.forEach((subPath) => {
          if (subPath.length <= 1) return;
          const firstPoint = subPath[0];
          const lastPoint = subPath[subPath.length - 1];
          const column = subPath[1].x;
          const branchSize =
            Math.round(
              Math.abs(firstPoint.y - lastPoint.y) / this.commitSpacing,
            ) - 1;
          const branchPoints =
            branchSize > 0
              ? new Array(branchSize).fill(0).map((_, i) => ({
                  x: column,
                  y: subPath[0].y - this.commitSpacing * (i + 1),
                }))
              : [];
          const lastSubPaths = branchesPaths.get(branch) || [];
          branchesPaths.set(branch, [
            ...lastSubPaths,
            [firstPoint, ...branchPoints, lastPoint],
          ]);
        });
      } else {
        paths.forEach((subPath) => {
          if (subPath.length <= 1) return;
          const firstPoint = subPath[0];
          const lastPoint = subPath[subPath.length - 1];
          const column = subPath[1].y;
          const branchSize =
            Math.round(
              Math.abs(firstPoint.x - lastPoint.x) / this.commitSpacing,
            ) - 1;
          const branchPoints =
            branchSize > 0
              ? new Array(branchSize).fill(0).map((_, i) => ({
                  y: column,
                  x: subPath[0].x + this.commitSpacing * (i + 1),
                }))
              : [];
          const lastSubPaths = branchesPaths.get(branch) || [];
          branchesPaths.set(branch, [
            ...lastSubPaths,
            [firstPoint, ...branchPoints, lastPoint],
          ]);
        });
      }
    });

    return branchesPaths;
  }
}

/**
 * Split branches paths into one edge per parent → child link, each with its
 * own `svg.path.d`. Geometry is the same as drawing the whole branch path.
 *
 * @param mapPoint Applied to each point when building `d` (e.g. message offsets)
 */
function toSvgEdges<TNode>(
  branchesPaths: BranchesPaths<TNode>,
  commits: Array<Commit<TNode>>,
  isBezier: boolean,
  isVertical: boolean,
  mapPoint: (point: Coordinate) => Coordinate = (point) => point,
): Array<Edge<TNode>> {
  const commitAt = new Map(commits.map((c) => [`${c.x},${c.y}`, c]));
  const idOf = ({ x, y }: Coordinate) => commitAt.get(`${x},${y}`)?.hash;
  const edges: Array<Edge<TNode>> = [];

  branchesPaths.forEach((paths, branch) => {
    paths.forEach((path) => {
      let start = 0;
      path.forEach((point, i) => {
        if (i === 0) return;
        const isLast = i === path.length - 1;
        // Cut on commits; points in between are rows crossed by the line.
        if (!idOf(point) && !isLast) return;

        let points = path.slice(start, i + 1);
        // One flag per segment: curve on the first and last segments of the path.
        let curves = points
          .slice(1)
          .map(
            (_, j) =>
              isBezier &&
              (start + j === 0 || start + j + 1 === path.length - 1),
          );
        let from = idOf(points[0]) || `${points[0].x},${points[0].y}`;
        let to = idOf(point) || `${point.x},${point.y}`;

        // Reverse orientations list points child → parent.
        const fromCommit = commitAt.get(`${points[0].x},${points[0].y}`);
        if (fromCommit && fromCommit.parents.includes(to)) {
          points = points.reverse();
          curves = curves.reverse();
          [from, to] = [to, from];
        }

        const mapped = points.map(mapPoint);
        const d = mapped
          .slice(1)
          .map(({ x, y }, j) => {
            if (!curves[j]) return `L ${x} ${y}`;
            const previous = mapped[j];
            if (isVertical) {
              const middleY = (previous.y + y) / 2;
              return `C ${previous.x} ${middleY} ${x} ${middleY} ${x} ${y}`;
            }
            const middleX = (previous.x + x) / 2;
            return `C ${middleX} ${previous.y} ${middleX} ${y} ${x} ${y}`;
          })
          .join(" ");

        edges.push({
          from,
          to,
          branch,
          d: `M ${mapped[0].x} ${mapped[0].y} ${d}`,
        });
        start = i;
      });
    });
  });

  return edges;
}
