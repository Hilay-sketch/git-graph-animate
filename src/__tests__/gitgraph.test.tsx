import * as React from "react";
import { renderToString } from "react-dom/server";
import { Gitgraph, GitgraphCore } from "../Gitgraph.js";

describe("Gitgraph", () => {
  it("renders commits and lines of a given graph", () => {
    const graph = new GitgraphCore<React.ReactElement<SVGElement>>();
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
});
