// Own file, so modules can use it without importing `gitgraph.ts`.

export const Orientation = {
  VerticalReverse: "vertical-reverse",
  Horizontal: "horizontal",
  HorizontalReverse: "horizontal-reverse",
} as const;
export type Orientation = (typeof Orientation)[keyof typeof Orientation];
