import { GitgraphCore } from "../gitgraph";

vi.useFakeTimers();

describe("Gitgraph.subscribe", () => {
  it("should call onUpdate on each commit", () => {
    const core = new GitgraphCore();
    const gitgraph = core.getUserApi();

    const onUpdate = vi.fn();
    core.subscribe(onUpdate);

    gitgraph.commit().commit().commit();

    vi.runAllTimers();

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0].commits.length).toBe(3);
  });

  it("should call render on merge", () => {
    const core = new GitgraphCore();
    const gitgraph = core.getUserApi();

    const onUpdate = vi.fn();
    core.subscribe(onUpdate);

    const master = gitgraph.branch("master").commit().commit().commit();
    const dev = gitgraph.branch("dev").commit().commit();
    master.merge(dev);

    vi.runAllTimers();

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0].commits.length).toBe(6);
  });

  it("should be able to unsubscribe", () => {
    const core = new GitgraphCore();
    const gitgraph = core.getUserApi();

    const onUpdate = vi.fn();
    const unsubscribe = core.subscribe(onUpdate);

    const master = gitgraph.branch("master").commit().commit().commit();

    vi.runAllTimers();

    unsubscribe();

    const dev = gitgraph.branch("dev").commit().commit();
    master.merge(dev);

    vi.runAllTimers();

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0].commits.length).toBe(3);
  });
});
