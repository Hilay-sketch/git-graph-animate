import { assignDelays } from "../animation/delays.js";

const timing = { duration: 300, maxTotal: 1500, impact: true };
const commit = (hash: string) => ({ hash });
const edge = (from: string, to: string) => ({ from, to });

describe("assignDelays", () => {
  it("staggers new commits in order; commits fade in when their line arrives", () => {
    const delays = new Map<string, number>();

    assignDelays(
      [commit("a"), commit("b"), commit("c")],
      [edge("a", "b"), edge("b", "c")],
      delays,
      timing,
    );

    expect(Object.fromEntries(delays)).toEqual({
      a: 0, // root: no incoming line
      "a->b": 300,
      b: 600,
      "b->c": 600,
      c: 900,
    });
  });

  it("caps the stagger of a long history to maxTotal", () => {
    const hashes = Array.from({ length: 100 }, (_, i) => `c${i}`);
    const delays = new Map<string, number>();

    assignDelays(
      hashes.map(commit),
      hashes.slice(1).map((h, i) => edge(hashes[i], h)),
      delays,
      timing,
    );

    expect(delays.get("c1->c2")).toBe(30); // 1500 / 100 * 2
    expect(delays.get("c98->c99")).toBe(1485);
  });

  it("delays added commits by the charge time and keeps existing delays", () => {
    const delays = new Map<string, number>();
    assignDelays([commit("a"), commit("b")], [edge("a", "b")], delays, timing);

    assignDelays(
      [commit("a"), commit("b"), commit("c"), commit("d")],
      [edge("a", "b"), edge("b", "c"), edge("b", "d"), edge("c", "d")],
      delays,
      timing,
    );

    expect(delays.get("a->b")).toBe(300);
    // Lines shoot out once the parent has charged (1.5 × duration).
    expect(delays.get("b->c")).toBe(450);
    expect(delays.get("c")).toBe(750);
    // Merge: both lines into d draw together.
    expect(delays.get("b->d")).toBe(750);
    expect(delays.get("c->d")).toBe(750);
    expect(delays.get("d")).toBe(1050);
  });

  it("returns commits added after the first batch", () => {
    const delays = new Map<string, number>();

    const first = assignDelays([commit("a")], [], delays, timing);
    const second = assignDelays(
      [commit("a"), commit("b")],
      [edge("a", "b")],
      delays,
      timing,
    );
    const third = assignDelays(
      [commit("a"), commit("b")],
      [edge("a", "b")],
      delays,
      timing,
    );

    expect(first).toEqual([]);
    expect(second).toEqual(["b"]);
    expect(third).toEqual([]);
  });

  it("shows a new line into an existing commit already drawn", () => {
    const delays = new Map<string, number>();
    assignDelays([commit("a"), commit("b")], [], delays, timing);

    assignDelays([commit("a"), commit("b")], [edge("a", "b")], delays, timing);

    expect(delays.get("a->b")).toBe(-300);
  });

  it("starts added commits right away without the impact", () => {
    const delays = new Map<string, number>();
    const noImpact = { ...timing, impact: false };
    assignDelays([commit("a")], [], delays, noImpact);

    assignDelays(
      [commit("a"), commit("b")],
      [edge("a", "b")],
      delays,
      noImpact,
    );

    expect(delays.get("a->b")).toBe(0);
    expect(delays.get("b")).toBe(300);
  });

  it("scales the charge with the duration", () => {
    const delays = new Map<string, number>();
    const slow = { ...timing, duration: 600 };
    assignDelays([commit("a")], [], delays, slow);

    assignDelays([commit("a"), commit("b")], [edge("a", "b")], delays, slow);

    expect(delays.get("a->b")).toBe(900);
  });
});
