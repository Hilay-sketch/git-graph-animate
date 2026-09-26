import { TagStyle, CommitStyle, DEFAULT_FONT } from "./template.js";
import { numberOptionOr } from "./utils.js";
import { GitgraphTagOptions } from "./user-api/gitgraph-user-api.js";

export { Tag };

class Tag {
  /**
   * Name
   */
  public readonly name: string;
  /**
   * Custom render function
   */
  public readonly render?: GitgraphTagOptions["render"];
  /**
   * Style
   */
  public get style(): TagStyle {
    return {
      strokeColor: this.tagStyle.strokeColor || this.commitStyle.color,
      bgColor: this.tagStyle.bgColor || this.commitStyle.color,
      color: this.tagStyle.color || "white",
      font: this.tagStyle.font || this.commitStyle.message.font || DEFAULT_FONT,
      borderRadius: numberOptionOr(this.tagStyle.borderRadius, 10),
      pointerWidth: numberOptionOr(this.tagStyle.pointerWidth, 12),
    };
  }

  private readonly tagStyle: Partial<TagStyle>;
  private readonly commitStyle: CommitStyle;

  constructor(
    name: string,
    style: Partial<TagStyle>,
    render: GitgraphTagOptions["render"],
    commitStyle: CommitStyle,
  ) {
    this.name = name;
    this.tagStyle = style;
    this.commitStyle = commitStyle;
    this.render = render;
  }
}
