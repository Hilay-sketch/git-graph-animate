import * as React from "react";
import { renderToString } from "react-dom/server";
import { Gitgraph, GitgraphCore, useGitgraph } from "../index.js";

describe("Gitgraph", () => {
  it("renders commits and lines of a given graph", () => {
    const graph = new GitgraphCore();
    graph.getUserApi().branch("master").commit("one").commit("two");

    const html = renderToString(<Gitgraph graph={graph} />);

    expect(html.match(/class="gg-commit"/g)).toHaveLength(2);
    expect(html.match(/<path[^>]*class="gg-edge"/g)).toHaveLength(1);
  });

  it("builds the graph once, even when StrictMode remounts it", () => {
    const children = vi.fn((gitgraph) => gitgraph.commit("one"));
    const component = new Gitgraph({ children });

    // StrictMode in dev: mount, unmount, mount again on the same instance.
    component.componentDidMount();
    component.componentWillUnmount();
    component.componentDidMount();
    component.componentWillUnmount();

    expect(children).toHaveBeenCalledTimes(1);
  });

  it("makes clickable commits keyboard buttons, and only those", () => {
    const graph = new GitgraphCore();
    graph
      .getUserApi()
      .branch("master")
      .commit({ subject: "click me", onClick: () => {} })
      .commit("plain");

    const html = renderToString(<Gitgraph graph={graph} />);

    expect(html.match(/role="button"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="click me"');
    expect(html).toContain('tabindex="0"');
  });

  it("builds a useGitgraph graph from its init callback", () => {
    function App() {
      const graph = useGitgraph({}, (gitgraph) =>
        gitgraph.branch("master").commit("one"),
      );
      return <Gitgraph graph={graph} />;
    }

    const html = renderToString(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );

    expect(html.match(/class="gg-commit"/g)).toHaveLength(1);
  });
});
