import * as React from "react";
import {
  Gitgraph,
  GitgraphCore,
  TemplateName,
  templateExtend,
  type EdgeProps,
} from "@gamzo/git-graph";
import {
  Badge,
  Card,
  cardWidth,
  FONT_SMALL,
  textWidth,
  CometEdge,
  DOT,
  Initial,
  PALETTE,
  Pill,
  Planet,
  Sparkle,
  dottedEdge,
  glowEdge,
} from "./pieces";

// "Make it yours": swap each render prop and watch the graph and the code.

type Node = React.ReactElement<SVGElement>;
// The commit fields these renders read (dot color is set by the branch).
interface Commit {
  subject: string;
  branchToDisplay: string;
  style: { dot: { color?: string } };
}

interface Choice<T> {
  label: string;
  value?: T;
  /** Code shown for this choice; empty for the library default. */
  code: string;
}

const DOTS: Array<Choice<(c: Commit) => Node>> = [
  {
    label: "Sparkle",
    value: (c) => <Sparkle color={c.style.dot.color!} />,
    code: `renderDot: (commit) => <Sparkle color={commit.style.dot.color} />`,
  },
  {
    label: "Planet",
    value: (c) => <Planet color={c.style.dot.color!} />,
    code: `renderDot: (commit) => <Planet color={commit.style.dot.color} />`,
  },
  {
    label: "Initial",
    value: (c) => <Initial color={c.style.dot.color!} text={c.subject} />,
    code: `renderDot: (commit) => (
  <Initial color={commit.style.dot.color} text={commit.subject} />
)`,
  },
  { label: "Default", code: "" },
];

const EDGES: Array<Choice<(e: EdgeProps) => React.ReactElement>> = [
  {
    label: "Glow",
    value: glowEdge,
    code: `// Two strokes; the "gg-edge" class keeps the built-in draw-in.
const glowEdge = (edge) => (
  <g>
    <path d={edge.d} className="gg-edge" pathLength={1}
      style={{ "--gg-delay": \`\${edge.delay}ms\` }}
      stroke={edge.stroke} strokeWidth={edge.strokeWidth * 4} opacity={0.16} />
    <path d={edge.d} className="gg-edge" pathLength={1}
      style={{ "--gg-delay": \`\${edge.delay}ms\` }}
      stroke={edge.stroke} strokeWidth={edge.strokeWidth} />
  </g>
);`,
  },
  {
    label: "Comet",
    value: (e) => <CometEdge {...e} />,
    code: `// A component with its own hooks: a comet rides each new line.
function CometEdge(edge) {
  const motion = useRef(null);
  useEffect(() => {
    if (edge.delay < 0) return; // already drawn
    const id = setTimeout(() => motion.current.beginElement(), edge.delay);
    return () => clearTimeout(id);
  }, []);
  return (
    <g>
      <path d={edge.d} className="gg-edge" pathLength={1} ... />
      <circle r={4.5}>
        <animateMotion ref={motion} begin="indefinite"
          dur={\`\${edge.duration}ms\`} path={edge.d} />
      </circle>
    </g>
  );
}`,
  },
  {
    label: "Dotted",
    value: dottedEdge,
    code: `// Your own animation: no "gg-edge" class, so it fades in instead.
const dottedEdge = (edge) => (
  <path d={edge.d} stroke={edge.stroke} strokeWidth={edge.strokeWidth}
    className="dotted"  /* @keyframes of your own */
    style={{ "--delay": \`\${edge.delay}ms\`, "--duration": \`\${edge.duration}ms\` }} />
);`,
  },
  { label: "Default", code: "" },
];

const BRANCHES = ["guitar", "chords", "songs"];
const SUBJECTS = [
  "Bought a used guitar",
  "First clean G chord",
  "G to C without looking",
  "Played a whole song, badly",
  "Barre chords, sort of",
  "Chords feel easy",
  "Played for a friend",
];

// Measured at render time: the fonts have loaded by then.
const cardW = () =>
  Math.max(
    ...SUBJECTS.map((s) => cardWidth(s, textWidth("chords", FONT_SMALL))),
  );

const MESSAGES: Array<Choice<(c: Commit) => Node>> = [
  {
    label: "Card",
    value: (c) => (
      <Card
        title={c.subject}
        meta={c.branchToDisplay}
        color={c.style.dot.color!}
        minWidth={cardW()}
      />
    ),
    code: `renderMessage: (commit) => (
  <Card title={commit.subject} meta={commit.branchToDisplay}
    color={commit.style.dot.color} />
)`,
  },
  {
    label: "Plain",
    value: (c) => (
      <text
        className="cm-plain"
        y={DOT}
        dominantBaseline="central"
        fill={c.style.dot.color!}
      >
        {c.subject}
      </text>
    ),
    code: `renderMessage: (commit) => (
  <text y={12} dominantBaseline="central" fill={commit.style.dot.color}>
    {commit.subject}
  </text>
)`,
  },
  { label: "Default", code: "" },
];

const LABELS: Array<Choice<true>> = [
  {
    label: "Pill",
    value: true,
    code: `renderLabel: (branch) => (
  <Pill text={branch.name} color={branch.computedColor} />
)`,
  },
  { label: "Default", code: "" },
];

const TAGS: Array<Choice<true>> = [
  {
    label: "Badge",
    value: true,
    code: `render: (name) => <Badge name={name} />`,
  },
  { label: "Default", code: "" },
];

interface Picks {
  dot: number;
  edge: number;
  message: number;
  label: number;
  tag: number;
}

function build(p: Picks) {
  // Equal pills and cards: every row's message starts at the same x.
  const pillW = Math.max(...BRANCHES.map((b) => textWidth(b, FONT_SMALL))) + 24;
  const core = new GitgraphCore<Node>({
    template: templateExtend(TemplateName.Metro, {
      colors: PALETTE,
      branch: {
        lineWidth: 2.5,
        spacing: 52,
        label: {
          bgColor: "#1e2238",
          font: "600 12px Figtree",
          borderRadius: 12,
        },
      },
      commit: {
        spacing: 64,
        dot: { size: DOT },
        message: {
          displayHash: false,
          displayAuthor: false,
          font: "500 15px Figtree",
          color: "#ECE8F7",
        },
      },
      tag: { font: "600 12px Figtree", color: "#151829" },
    }),
    branchLabelOnEveryCommit: true,
  });
  const api = core.getUserApi();
  const renders = {
    renderDot: DOTS[p.dot].value,
    renderMessage: MESSAGES[p.message].value,
  };
  const branch = (name: string, from?: ReturnType<typeof api.branch>) => {
    const options = {
      name,
      renderLabel: LABELS[p.label].value
        ? (b: { name: string; computedColor?: string }) => (
            <Pill text={b.name} color={b.computedColor!} width={pillW} />
          )
        : undefined,
    };
    return from ? from.branch(options) : api.branch(options);
  };
  const commit = (subject: string) => ({ subject, ...renders });

  const main = branch("guitar");
  main.commit(commit("Bought a used guitar"));
  const chords = branch("chords", main);
  chords.commit(commit("First clean G chord"));
  chords.commit(commit("G to C without looking"));
  const songs = branch("songs", main);
  songs.commit(commit("Played a whole song, badly"));
  chords.commit(commit("Barre chords, sort of"));
  main.merge({ branch: chords, commitOptions: commit("Chords feel easy") });
  main.tag({
    name: "Chord hands",
    render: TAGS[p.tag].value ? (name) => <Badge name={name} /> : undefined,
  });
  songs.commit(commit("Played for a friend"));
  return core;
}

function composeCode(p: Picks) {
  const indent = (code: string, pad: string) => code.replace(/\n/g, `\n${pad}`);
  const commitProps = [DOTS[p.dot].code, MESSAGES[p.message].code]
    .filter(Boolean)
    .map((c) => `      ${indent(c, "      ")},`);
  const label = LABELS[p.label].code;
  const tag = TAGS[p.tag].code;
  const edge = EDGES[p.edge];
  const lines = [
    edge.code && `${edge.code}\n`,
    `<Gitgraph${edge.code ? ` renderEdge={${edge.label === "Comet" ? "(e) => <CometEdge {...e} />" : `${edge.label.toLowerCase()}Edge`}}` : ""}>`,
    `  {(gitgraph) => {`,
    label
      ? `    const guitar = gitgraph.branch({\n      name: "guitar",\n      ${indent(label, "      ")},\n    });`
      : `    const guitar = gitgraph.branch("guitar");`,
    commitProps.length
      ? `    guitar.commit({\n      subject: "Bought a used guitar",\n${commitProps.join("\n")}\n    });`
      : `    guitar.commit("Bought a used guitar");`,
    `    // ...more commits, branches and a merge`,
    tag
      ? `    guitar.tag({ name: "Chord hands", ${tag} });`
      : `    guitar.tag("Chord hands");`,
    `  }}`,
    `</Gitgraph>`,
  ];
  return lines.filter(Boolean).join("\n");
}

// Tiny highlighter: comments, strings, tags and keywords are enough here.
const TOKENS =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("[^"]*"|`[^`]*`)|(<\/?[A-Za-z][\w.]*|\/?>)|\b(const|function|return|if|useRef|useEffect|setTimeout|clearTimeout)\b/g;

function highlight(code: string) {
  const out: React.ReactNode[] = [];
  let last = 0;
  code.replace(TOKENS, (match, comment, str, tag, kw, at: number) => {
    out.push(code.slice(last, at));
    const cls = comment ? "t-c" : str ? "t-s" : tag ? "t-t" : "t-k";
    out.push(
      <span key={at} className={cls}>
        {match}
      </span>,
    );
    last = at + match.length;
    return match;
  });
  out.push(code.slice(last));
  return out;
}

export function MakeItYours() {
  const [picks, setPicks] = React.useState<Picks>({
    dot: 0,
    edge: 1,
    message: 0,
    label: 0,
    tag: 0,
  });
  const core = React.useMemo(() => build(picks), [picks]);
  const code = React.useMemo(() => composeCode(picks), [picks]);
  const [copied, setCopied] = React.useState(false);

  const rows: Array<[keyof Picks, string, Array<Choice<unknown>>]> = [
    ["dot", "Dots", DOTS],
    ["edge", "Lines", EDGES],
    ["message", "Messages", MESSAGES],
    ["label", "Branch labels", LABELS],
    ["tag", "Tags", TAGS],
  ];

  return (
    <section className="yours" id="make-it-yours">
      <div className="yours-intro">
        <h2>Make it yours</h2>
        <p>
          Every piece of the graph is a render prop that takes plain SVG. Swap
          them below: the graph redraws and the code follows.
        </p>
      </div>

      <div className="yours-grid">
        <div className="yours-play">
          <div className="pickers">
            {rows.map(([key, label, choices]) => (
              <div className="picker" key={key}>
                <span id={`pick-${key}`}>{label}</span>
                <div
                  className="segmented"
                  role="radiogroup"
                  aria-labelledby={`pick-${key}`}
                >
                  {choices.map((c, i) => (
                    <button
                      key={c.label}
                      role="radio"
                      aria-checked={picks[key] === i}
                      onClick={() => setPicks({ ...picks, [key]: i })}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="yours-graph">
            <Gitgraph
              key={JSON.stringify(picks)}
              graph={core}
              animation={{ duration: 520, maxTotal: 3000, impact: true }}
              renderEdge={EDGES[picks.edge].value}
            />
          </div>
        </div>

        <div className="code">
          <div className="code-bar">
            <span>Your graph, in code</span>
            <button
              className="ghost"
              onClick={() => {
                navigator.clipboard?.writeText(code).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                });
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre>
            <code>{highlight(code)}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}
