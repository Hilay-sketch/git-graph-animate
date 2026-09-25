import * as React from "react";
import { createRoot } from "react-dom/client";
import {
  Gitgraph,
  GitgraphCore,
  Mode,
  Orientation,
  TemplateName,
  templateExtend,
} from "@gitgraph/react";

function Section(props: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2>{props.title}</h2>
      <p>{props.note}</p>
      {props.children}
    </section>
  );
}

function Playground() {
  const [template, setTemplate] = React.useState(TemplateName.Metro);
  const [orientation, setOrientation] = React.useState("");
  const [mode, setMode] = React.useState("");
  const [clicked, setClicked] = React.useState("none");
  const options = {
    template,
    orientation: (orientation || undefined) as Orientation | undefined,
    mode: (mode || undefined) as Mode | undefined,
  };

  return (
    <Section
      title="Playground"
      note="Change the options; hover a commit (horizontal or compact) for its tooltip, click a dot to select it."
    >
      <div style={{ marginBottom: 12 }}>
        <label>
          Template{" "}
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value as TemplateName)}
          >
            <option value={TemplateName.Metro}>metro</option>
            <option value={TemplateName.BlackArrow}>blackarrow</option>
          </select>
        </label>
        <label>
          Orientation{" "}
          <select
            value={orientation}
            onChange={(e) => setOrientation(e.target.value)}
          >
            <option value="">vertical</option>
            <option value={Orientation.VerticalReverse}>
              vertical-reverse
            </option>
            <option value={Orientation.Horizontal}>horizontal</option>
            <option value={Orientation.HorizontalReverse}>
              horizontal-reverse
            </option>
          </select>
        </label>
        <label>
          Mode{" "}
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="">regular</option>
            <option value={Mode.Compact}>compact</option>
          </select>
        </label>
        <span>Last clicked: {clicked}</span>
      </div>
      {/* <Gitgraph> reads options only on mount, so remount when they change. */}
      <Gitgraph key={JSON.stringify(options)} options={options}>
        {(gitgraph) => {
          const onClick = (commit: { subject: string }) =>
            setClicked(commit.subject);
          const master = gitgraph.branch("master");
          master.commit({ subject: "Initial commit", onClick });

          const develop = master.branch("develop");
          develop.commit({ subject: "Add TypeScript", onClick });

          const feature = develop.branch("a-feature");
          feature
            .commit({ subject: "Make it work", onClick })
            .commit({ subject: "Make it right", onClick })
            .commit({ subject: "Make it fast", onClick });

          develop.merge(feature);
          develop.commit({ subject: "Prepare v1", onClick });
          master.merge(develop).tag("v1.0.0");
        }}
      </Gitgraph>
    </Section>
  );
}

const customTemplate = templateExtend(TemplateName.Metro, {
  colors: ["#e63946", "#2a9d8f", "#f4a261"],
  commit: { message: { displayHash: false, displayAuthor: false } },
});

function CustomTemplate() {
  return (
    <Section
      title="Custom template"
      note="templateExtend: own colours, no hash or author."
    >
      <Gitgraph options={{ template: customTemplate }}>
        {(gitgraph) => {
          const main = gitgraph.branch("main");
          main.commit("Start");
          const fix = main.branch("fix");
          fix.commit("Patch bug");
          const docs = main.branch("docs");
          docs.commit("Write docs");
          main.merge(fix).merge(docs);
        }}
      </Gitgraph>
    </Section>
  );
}

function CustomRender() {
  return (
    <Section
      title="Custom render"
      note="renderDot and renderMessage return your own SVG."
    >
      <Gitgraph>
        {(gitgraph) => {
          const main = gitgraph.branch("main");
          main.commit("Regular commit");
          main.commit({
            subject: "Custom dot and message",
            renderDot: (commit) => (
              <rect
                width={commit.style.dot.size * 2}
                height={commit.style.dot.size * 2}
                fill="#e63946"
              />
            ),
            renderMessage: (commit) => (
              <text
                y={commit.style.dot.size}
                alignmentBaseline="central"
                fill="#e63946"
                fontWeight="bold"
              >
                ★ {commit.subject}
              </text>
            ),
          });
          main.commit("Back to normal");
        }}
      </Gitgraph>
    </Section>
  );
}

function makeHistory() {
  const graph = new GitgraphCore<React.ReactElement<SVGElement>>();
  const main = graph.getUserApi().branch("main");
  main.commit("Start");
  const feature = main.branch("feature");
  feature.commit("Build it").commit("Test it");
  main.commit("Hotfix");
  main.merge(feature);
  return graph;
}

function Animation() {
  const [on, setOn] = React.useState(true);
  const [replay, setReplay] = React.useState(0);
  // Remounting over an existing graph replays its initial draw.
  const [graphs] = React.useState(() => [makeHistory(), makeHistory()]);

  return (
    <Section
      title="Animation"
      note="animation={{ duration }} slows it down; renderEdge draws each line yourself (here: dashed, drawn by your own CSS)."
    >
      <div style={{ marginBottom: 12 }}>
        <label>
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => setOn(e.target.checked)}
          />{" "}
          animation
        </label>{" "}
        <button onClick={() => setReplay(replay + 1)}>Replay</button>
      </div>
      <div style={{ display: "flex", gap: 48 }}>
        <Gitgraph
          key={`slow-${on}-${replay}`}
          graph={graphs[0]}
          animation={on && { duration: 800, maxTotal: 4000 }}
        />
        <Gitgraph
          key={`custom-${on}-${replay}`}
          graph={graphs[1]}
          animation={on}
          renderEdge={(edge) => (
            <path
              d={edge.d}
              fill="none"
              stroke={edge.stroke}
              strokeWidth={edge.strokeWidth}
              strokeDasharray="6 4"
              style={
                edge.animated
                  ? {
                      opacity: 0,
                      animation: `fade-in ${edge.duration}ms ${edge.delay}ms forwards`,
                    }
                  : undefined
              }
            />
          )}
        />
      </div>
    </Section>
  );
}

function LiveGraph() {
  const [{ graph, master }] = React.useState(() => {
    const graph = new GitgraphCore<React.ReactElement<SVGElement>>();
    const master = graph.getUserApi().branch("master");
    master.commit("Initial commit");
    return { graph, master };
  });
  const count = React.useRef(1);

  return (
    <Section
      title="Live updates"
      note="graph prop: drive a GitgraphCore instance from outside the component."
    >
      <button
        onClick={() => master.commit(`Commit #${++count.current}`)}
        style={{ marginBottom: 12 }}
      >
        Add commit
      </button>
      <Gitgraph graph={graph} />
    </Section>
  );
}

createRoot(document.getElementById("root")!).render(
  <>
    <h1>@gitgraph/react</h1>
    <Playground />
    <CustomTemplate />
    <CustomRender />
    <Animation />
    <LiveGraph />
  </>,
);
