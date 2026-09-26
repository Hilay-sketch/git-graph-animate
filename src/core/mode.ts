export { Mode };

const Mode = { Compact: "compact" } as const;
type Mode = (typeof Mode)[keyof typeof Mode];
