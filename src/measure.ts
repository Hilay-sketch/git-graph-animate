import {
  BRANCH_LABEL_PADDING_X,
  BRANCH_LABEL_PADDING_Y,
} from "./components/BranchLabel.js";
import { TOOLTIP_PADDING } from "./components/Tooltip.js";

export { type CommitYOffsets, computeOffsets, sizeSvg };

/**
 * Commit y → y shifted down by the custom HTML messages above it.
 * E.g. `{20: 30}` means for commit: y=20 -> y=30.
 */
type CommitYOffsets = { [y: number]: number };

/** Fit the SVG to its content, plus room for tooltips and branch labels. */
function sizeSvg(svg: SVGSVGElement) {
  const { height, width } = svg.getBBox();
  svg.setAttribute(
    "width",
    (width + TOOLTIP_PADDING + BRANCH_LABEL_PADDING_X).toString(),
  );
  svg.setAttribute(
    "height",
    (height + TOOLTIP_PADDING + BRANCH_LABEL_PADDING_Y).toString(),
  );
}

/**
 * Measure custom HTML messages (`foreignObject`) and push the commits
 * below them down, so messages of any height never overlap.
 *
 * @param commits Rendered commit elements, in DOM order.
 * @param isVerticalReverse In VerticalReverse, DOM order is already top to bottom.
 */
function computeOffsets(
  commits: Element[],
  isVerticalReverse: boolean,
): CommitYOffsets {
  let totalOffsetY = 0;
  const orientedCommits = isVerticalReverse ? commits : commits.reverse();

  return orientedCommits.reduce<CommitYOffsets>((newOffsets, commit) => {
    const commitY = parseInt(
      commit.getAttribute("transform")!.split(",")[1].slice(0, -1),
      10,
    );

    const firstForeignObject = commit.getElementsByTagName("foreignObject")[0];
    const customHtmlMessage =
      firstForeignObject && firstForeignObject.firstElementChild;

    let messageHeight = 0;
    if (customHtmlMessage) {
      const height = customHtmlMessage.getBoundingClientRect().height;
      const marginTop = parseInt(
        window.getComputedStyle(customHtmlMessage).marginTop || "0",
        10,
      );
      messageHeight = height + marginTop;
    }

    // Force the height of the foreignObject (browser issue)
    if (firstForeignObject) {
      firstForeignObject.setAttribute("height", `${messageHeight}px`);
    }

    newOffsets[commitY] = commitY + totalOffsetY;
    totalOffsetY += messageHeight;
    return newOffsets;
  }, {});
}
