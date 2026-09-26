import * as React from "react";
import { createRoot } from "react-dom/client";
import {
  Gitgraph,
  GitgraphCore,
  Mode,
  Orientation,
  TemplateName,
  templateExtend,
  type Branch,
} from "@gitgraph/react";
import {
  Card,
  cardWidth,
  DOT,
  FONT_SMALL,
  FONT_TITLE,
  PALETTE,
  Pill,
  Sparkle,
  STAR_ICON,
  glowEdge,
  textWidth,
} from "./pieces";
import { MakeItYours } from "./custom";
import { Canvas, type CanvasHandle, type View } from "./canvas";
import {
  ACHIEVEMENTS,
  QuestHud,
  Unlocked,
  echo,
  Numeral,
  QUEST_PALETTE,
  center,
  floatText,
  starXp,
  supernova,
  useAlive,
  Roar,
  type Goal,
} from "./quest";

// Starlog: every milestone is a star, every track a constellation.
// Events are the source of truth; the graph is replayed from them.

type Node = React.ReactElement<SVGElement>;

interface Milestone {
  id: string;
  track: string;
  title: string;
  /** ISO date-time. */
  lit: string;
  note?: string;
  /** First star of a track: the star it branches from. Default: main path's tip. */
  from?: string;
  /** Finishing a track: merge it into the main path. */
  finishes?: string;
  badge?: string;
}

const MAIN = "main path";
const STARS_PER_LEVEL = 5;

const SEED: Milestone[] = [
  {
    id: "s01",
    track: MAIN,
    title: "Started the Starlog",
    lit: "2026-01-03T09:12",
    note: "One rule: write it down the day it happens.",
  },
  {
    id: "s02",
    track: "craft",
    title: "Finished a JavaScript course",
    lit: "2026-01-20T06:40",
    note: "42 lessons, most of them at 6 am.",
  },
  {
    id: "s03",
    track: "body",
    title: "Ran 2 km without stopping",
    lit: "2026-01-28T18:05",
  },
  {
    id: "s04",
    track: "craft",
    title: "Built a to-do app from scratch",
    lit: "2026-02-14T22:30",
    note: "No tutorial open. Ugly, but mine.",
  },
  {
    id: "s05",
    track: "body",
    title: "First 5k without stopping",
    lit: "2026-03-08T08:15",
  },
  {
    id: "s06",
    track: MAIN,
    title: "Moved to a new city",
    lit: "2026-03-22T14:00",
    note: "Two suitcases and a houseplant.",
  },
  {
    id: "s07",
    track: "craft",
    title: "Opened my first pull request",
    lit: "2026-04-05T21:48",
    note: "A typo fix in the docs. It still counts.",
  },
  {
    id: "s08",
    track: MAIN,
    finishes: "craft",
    badge: "First PR merged",
    title: "Finished the craft track",
    lit: "2026-04-19T11:20",
  },
  {
    id: "s09",
    track: "side quests",
    from: "s06",
    title: "Baked sourdough that actually rose",
    lit: "2026-05-02T10:00",
  },
  {
    id: "s10",
    track: "body",
    title: "Ran a 10k in under an hour",
    lit: "2026-05-30T07:30",
    note: "59:41. Every second of it.",
  },
  {
    id: "s11",
    track: "side quests",
    title: "Read twelve books",
    lit: "2026-06-21T20:10",
  },
  {
    id: "s12",
    track: "body",
    title: "Half-marathon finish in 2:04",
    lit: "2026-07-14T10:04",
    note: "Cried a little at kilometre 19.",
  },
  {
    id: "s13",
    track: MAIN,
    finishes: "body",
    badge: "Half-marathoner",
    title: "Finished the body track",
    lit: "2026-07-20T09:00",
  },
  {
    id: "s14",
    track: MAIN,
    title: "Shipped a side project to 10 users",
    lit: "2026-09-12T16:45",
    note: "Ten strangers. Two of them came back.",
  },
];

// Track colors follow the order tracks first appear, like branch columns.
function trackColors(
  events: Milestone[],
  palette = PALETTE,
): Map<string, string> {
  const colors = new Map<string, string>();
  events.forEach(({ track }) => {
    if (!colors.has(track))
      colors.set(track, palette[colors.size % palette.length]);
  });
  return colors;
}

function openTracks(events: Milestone[]): string[] {
  const finished = new Set(events.map((e) => e.finishes));
  return Array.from(trackColors(events).keys()).filter((t) => !finished.has(t));
}

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
    new Date(iso),
  );

// ---------------------------------------------------------------------------
// Building the sky from events.

interface Sky {
  core: GitgraphCore<Node>;
  add: (m: Milestone) => void;
}

function buildSky(
  events: Milestone[],
  horizontal: boolean,
  compact: boolean,
  onSelect: (id: string) => void,
  palette = PALETTE,
): Sky {
  const core = new GitgraphCore<Node>({
    template: templateExtend(TemplateName.Metro, {
      colors: palette,
      branch: {
        lineWidth: 2.5,
        spacing: 52,
        // Vertical: the track is on every card, labels would push them around.
        label: { display: horizontal },
      },
      commit: {
        spacing: horizontal ? 84 : 72,
        dot: { size: DOT },
        message: { displayHash: false, displayAuthor: false },
      },
    }),
    orientation: horizontal ? Orientation.Horizontal : undefined,
    mode: compact ? Mode.Compact : undefined,
    author: "You",
  });
  const api = core.getUserApi();
  const tracks = new Map<string, Branch>();
  const colors = new Map<string, string>();
  // One width for every card, so the list has a clean right edge.
  const cardW = Math.max(
    ...events.map((m) =>
      cardWidth(
        m.title,
        textWidth(`${shortDate(m.lit)} ${m.track}`, FONT_SMALL) +
          8 +
          (m.badge ? textWidth(m.badge, FONT_SMALL) + 31 : 0),
      ),
    ),
  );

  const add = (m: Milestone) => {
    if (!colors.has(m.track))
      colors.set(m.track, palette[colors.size % palette.length]);
    const color = colors.get(m.track)!;
    const meta = shortDate(m.lit);

    let branch = tracks.get(m.track);
    if (!branch) {
      const options = {
        name: m.track,
        style: { color },
        renderLabel: () => <Pill text={m.track} color={color} />,
      };
      const main = tracks.get(MAIN);
      branch =
        m.from || !main
          ? api.branch({ ...options, from: m.from })
          : main.branch(options);
      tracks.set(m.track, branch);
    }

    const commitOptions = {
      hash: m.id,
      subject: m.title,
      style: { dot: { color } },
      onClick: () => onSelect(m.id),
      onMessageClick: () => onSelect(m.id),
      renderDot: () => (
        <Sparkle
          color={color}
          big={!!m.finishes}
          label={`${m.title}, ${m.track}, ${shortDate(m.lit)}`}
          onSelect={() => onSelect(m.id)}
        />
      ),
      renderMessage: () => (
        <Card
          title={m.title}
          meta={meta}
          accent={m.track}
          color={color}
          badge={m.badge}
          minWidth={cardW}
        />
      ),
      renderTooltip: () => (
        <Tip title={m.title} meta={`${meta}   ${m.track}`} color={color} />
      ),
    };

    if (m.finishes) {
      branch.merge({ branch: m.finishes, commitOptions });
    } else {
      branch.commit(commitOptions);
    }
  };

  events.forEach(add);
  return { core, add };
}

function Tip(props: { title: string; meta: string; color: string }) {
  const w =
    Math.max(
      textWidth(props.title, FONT_TITLE),
      textWidth(props.meta, FONT_SMALL),
    ) + 34;
  return (
    <g className="sl-tip" transform={`translate(${DOT * 2 + 14}, ${DOT})`}>
      <rect x={0} y={-27} width={w} height={54} rx={12} />
      <rect x={0} y={-27} width={4} height={54} rx={2} fill={props.color} />
      <text className="sl-title" x={18} y={-8} dominantBaseline="central">
        {props.title}
      </text>
      <text className="sl-meta" x={18} y={11} dominantBaseline="central">
        {props.meta}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// App

function useToast(): [string | null, (msg: string) => void] {
  const [msg, setMsg] = React.useState<string | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout>>();
  const show = React.useCallback((text: string) => {
    setMsg(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3400);
  }, []);
  return [msg, show];
}

const TABS = ["canvas", "quest"];
const tabOf = () => {
  const hash = location.hash.slice(1);
  return TABS.includes(hash) ? hash : "journal";
};

let nextId = 0;
const newId = () => `n${Date.now().toString(36)}${nextId++}`;
const NEW_TRACK = "\0new";

function App() {
  const [events, setEvents] = React.useState(SEED);
  const eventsRef = React.useRef(events);
  eventsRef.current = events;
  const [horizontal, setHorizontal] = React.useState(false);
  const [compact, setCompact] = React.useState(false);
  const [replay, setReplay] = React.useState(0);
  const [selected, setSelected] = React.useState<string | null>(null);
  // The form's track and branch point live here: a popover can set them.
  const [track, setTrack] = React.useState("side quests");
  const [from, setFrom] = React.useState(SEED[SEED.length - 1].id);
  const [focusName, setFocusName] = React.useState(0);
  const [toast, showToast] = useToast();
  const skyRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<CanvasHandle>(null);
  // Three tabs: the journal page, the sky as a pannable canvas, and the
  // same canvas played as a game.
  const [tab, setTab] = React.useState(tabOf);
  React.useEffect(() => {
    const onHash = () => setTab(tabOf());
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  const onCanvas = tab !== "journal";
  const quest = tab === "quest";
  React.useEffect(() => {
    setSelected(null);
    document.body.classList.toggle("on-canvas", onCanvas);
    document.body.classList.toggle("on-quest", quest);
    if (onCanvas) setTimeout(() => canvasRef.current?.fit(), 80);
  }, [tab]);
  useAlive(quest);
  const [goals, setGoals] = React.useState<Goal[]>([]);
  // One medal banner at a time.
  React.useEffect(() => {
    if (!goals.length) return;
    const t = setTimeout(() => setGoals((q) => q.slice(1)), 3200);
    return () => clearTimeout(t);
  }, [goals]);
  const [deckOpen, setDeckOpen] = React.useState(
    () => matchMedia("(min-width: 1181px)").matches,
  );
  // The deck steps aside while "Make it yours" is on screen.
  const [away, setAway] = React.useState(false);
  React.useEffect(() => {
    const section = document.getElementById("make-it-yours");
    if (!section) return setAway(false);
    const io = new IntersectionObserver(([e]) => setAway(e.isIntersecting), {
      rootMargin: "0px 0px -35% 0px",
    });
    io.observe(section);
    return () => io.disconnect();
  }, [onCanvas]);

  // Clicking the open star again closes it.
  const toggle = React.useCallback(
    (id: string) => setSelected((s) => (s === id ? null : id)),
    [],
  );

  // Layout options live on the core: a change rebuilds it, and the sky redraws.
  // Quest paints the sky in its own palette.
  const palette = quest ? QUEST_PALETTE : PALETTE;
  const sky = React.useMemo(
    () => buildSky(eventsRef.current, horizontal, compact, toggle, palette),
    [horizontal, compact, quest],
  );

  const colors = trackColors(events, palette);
  const open = openTracks(events);
  const stars = events.length;
  const badges = events.filter((e) => e.badge).length;
  const level = Math.floor(stars / STARS_PER_LEVEL) + 1;
  const progress = stars % STARS_PER_LEVEL;
  const latest = events[events.length - 1].id;
  const achieved = (all: Milestone[]) =>
    ACHIEVEMENTS.filter((a) =>
      a.earned(all.slice(SEED.length), all, openTracks(all)),
    );
  const earned = achieved(events);

  const record = (m: Milestone, message: string) => {
    sky.add(m); // Live: only the new line draws, and the star lands.
    setEvents((all) => [...all, m]);
    setSelected(null);
    setFrom(m.id);
    const levelUp = (stars + 1) % STARS_PER_LEVEL === 0;
    showToast(levelUp ? `${message}. Level ${level + 1} reached!` : message);
    const next = [...events, m];
    const fresh = achieved(next).filter((a) => !earned.includes(a));
    // Bring the new star into view once it lands: until its delay passes
    // the dot is scaled to nothing and measures wrong.
    setTimeout(() => {
      // The glyph, not the group: impact rings inflate the group's box.
      const star = document.querySelector(
        `.sky [data-hash="${m.id}"] .sl-spark`,
      );
      if (!star) return;
      const delay =
        parseFloat(
          (star.closest("[data-hash]") as SVGElement).style.getPropertyValue(
            "--gg-delay",
          ),
        ) || 0;
      setTimeout(() => {
        if (onCanvas) canvasRef.current?.reveal(star);
        else
          star.scrollIntoView({
            block: "nearest",
            inline: "nearest",
            behavior: "smooth",
          });
        if (!quest) return;
        // Celebrate where it lands, once the glide settles.
        setTimeout(() => {
          const color = trackColors(next, palette).get(m.track)!;
          const [x, y, top] = center(star);
          echo(x, y, color);
          if (m.finishes || levelUp) echo(x, y, "#f1dc98", 220);
          floatText(x, top - 6, `+${starXp(m)} XP`, color);
          // Each goal gets its own roar, the biggest news first.
          const won: Goal[] = [];
          if (m.finishes)
            won.push({
              key: m.id,
              kicker: `${m.finishes} track finished`,
              name: m.badge ?? m.finishes,
              color: trackColors(next, palette).get(m.finishes)!,
              x,
              y,
            });
          if (levelUp)
            won.push({
              key: `level${level + 1}`,
              kicker: "Level up",
              name: `Level ${level + 1}`,
              color: "#f2d65c",
              x,
              y,
            });
          fresh.forEach((a) =>
            won.push({
              key: a.id,
              kicker: "Achievement",
              name: a.name,
              color,
              x,
              y,
            }),
          );
          if (won.length) setGoals((q) => [...q, ...won]);
          if (fresh.some((a) => a.id === "nova")) setTimeout(supernova, 500);
        }, 250);
      }, delay + 30);
    }, 60);
  };

  // Game HUDs: glide to a track's newest star, and aim the form at it.
  const showTrack = (t: string) => {
    const last = [...events].reverse().find((e) => e.track === t);
    const star = document.querySelector(
      `.sky [data-hash="${last?.id}"] .sl-spark`,
    );
    if (star) canvasRef.current?.reveal(star);
    if (open.includes(t)) {
      setTrack(t);
      setDeckOpen(true);
    }
  };

  const current = events.find((e) => e.id === selected);
  const picking = track === NEW_TRACK;

  const skyGraph = (
    <>
      <style>{`
        .sky [data-hash="${selected}"] { --sel: 1; }
        .sky [data-hash="${selected}"] .sl-ring { animation-name: spin; }
        ${picking ? `.sky [data-hash="${from}"] { --from: 1; }` : ""}
        .sky [data-hash="${latest}"] .sl-aura { animation-name: breathe; }
      `}</style>
      <Gitgraph
        key={`${horizontal}-${compact}-${quest}-${replay}`}
        graph={sky.core}
        animation={{ duration: 380, maxTotal: 2200 }}
        renderEdge={glowEdge}
      />
    </>
  );
  const popover = (
    within: React.RefObject<HTMLDivElement>,
    beside: "all" | "own",
    view?: View,
  ) =>
    current && (
      <Popover
        key={current.id}
        m={current}
        events={events}
        color={colors.get(current.track)!}
        skyRef={within}
        beside={beside}
        view={view}
        onClose={() => setSelected(null)}
        onBranch={() => {
          setTrack(NEW_TRACK);
          setFrom(current.id);
          setSelected(null);
          setDeckOpen(true);
          setFocusName((n) => n + 1);
        }}
      />
    );
  const tabs = (
    <nav className="tabs" aria-label="Views">
      <a href="#journal" aria-current={onCanvas ? undefined : "page"}>
        Journal
      </a>
      <a href="#canvas" aria-current={tab === "canvas" ? "page" : undefined}>
        Canvas
      </a>
      <a href="#quest" aria-current={quest ? "page" : undefined}>
        Quest
      </a>
    </nav>
  );
  const brand = (
    <a className="brand" href="#journal">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d={STAR_ICON} />
      </svg>
      Starlog
    </a>
  );
  const layoutControls = (
    <>
      <Segmented
        label="Direction"
        value={horizontal ? "h" : "v"}
        options={[
          ["v", "Vertical"],
          ["h", "Horizontal"],
        ]}
        onChange={(v) => {
          setSelected(null);
          setHorizontal(v === "h");
          if (onCanvas) setTimeout(() => canvasRef.current?.fit(), 80);
        }}
      />
      <Segmented
        label="Density"
        value={compact ? "c" : "f"}
        options={[
          ["f", "Detailed"],
          ["c", "Compact"],
        ]}
        onChange={(v) => {
          setSelected(null);
          setCompact(v === "c");
          if (onCanvas) setTimeout(() => canvasRef.current?.fit(), 80);
        }}
      />
    </>
  );

  return (
    <>
      {onCanvas ? (
        <>
          {quest && <Numeral level={level} />}
          {quest && goals[0] && (
            <Roar
              key={goals[0].key + goals.length}
              goal={goals[0]}
              inset={[innerWidth > 900 ? 260 : 0, deckOpen ? 412 : 0]}
            />
          )}
          <Canvas
            ref={canvasRef}
            inset={deckOpen ? 412 : 0}
            insetLeft={quest && innerWidth > 900 ? 260 : 0}
            onBackgroundClick={() => setSelected(null)}
            overlay={(viewport, view) => popover(viewport, "own", view)}
          >
            <div className="sky canvas-sky">{skyGraph}</div>
          </Canvas>
          <div className="canvas-top">
            {brand}
            {tabs}
          </div>
          <div className="canvas-tools" role="toolbar" aria-label="Canvas">
            <div className="zoom">
              <button
                onClick={() => canvasRef.current?.zoomBy(1 / 1.25)}
                aria-label="Zoom out"
              >
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  aria-hidden="true"
                >
                  <path d="M3 8h10" />
                </svg>
              </button>
              <button onClick={() => canvasRef.current?.fit()} className="fit">
                Fit
              </button>
              <button
                onClick={() => canvasRef.current?.zoomBy(1.25)}
                aria-label="Zoom in"
              >
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  aria-hidden="true"
                >
                  <path d="M3 8h10M8 3v10" />
                </svg>
              </button>
            </div>
            {layoutControls}
            <button
              className="ghost"
              onClick={() => {
                setSelected(null);
                setReplay((r) => r + 1);
              }}
            >
              <svg
                viewBox="0 0 20 20"
                width="16"
                height="16"
                aria-hidden="true"
              >
                <path d="M4 10a6 6 0 1 0 2-4.5M4 3v3.5h3.5" />
              </svg>
              Redraw
            </button>
          </div>
          {quest ? (
            <QuestHud
              events={events}
              colors={colors}
              open={open}
              main={MAIN}
              level={level}
              progress={progress}
              perLevel={STARS_PER_LEVEL}
              earned={earned}
              onTrack={showTrack}
            />
          ) : (
            <p className="canvas-hint">
              Drag to move around. Scroll or pinch to zoom.
            </p>
          )}
        </>
      ) : (
        <>
          <header className="top">
            {brand}
            {tabs}
            <a className="jump" href="#make-it-yours">
              Make it yours
            </a>
          </header>

          <section className="hero">
            <div>
              <h1>A year of milestones, charted as stars.</h1>
              <p>
                Each thing you work toward becomes a track across the sky. Light
                a star when you reach something. Finish a track and it joins
                your main path with a badge.
              </p>
            </div>
            <dl className="stats">
              <div>
                <dt>Stars lit</dt>
                <dd key={stars} className="bump">
                  {stars}
                </dd>
              </div>
              <div>
                <dt>Tracks</dt>
                <dd key={colors.size} className="bump">
                  {colors.size}
                </dd>
              </div>
              <div>
                <dt>Badges</dt>
                <dd key={badges} className="bump">
                  {badges}
                </dd>
              </div>
              <div className="level">
                <dt key={level} className="bump">
                  Level {level}
                </dt>
                <dd>
                  <span
                    className="meter"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={STARS_PER_LEVEL}
                    aria-valuenow={progress}
                    aria-label={`Progress to level ${level + 1}`}
                  >
                    <span
                      style={{
                        width: `${(progress / STARS_PER_LEVEL) * 100}%`,
                      }}
                    />
                  </span>
                  {STARS_PER_LEVEL - progress === 1
                    ? `1 star to level ${level + 1}`
                    : `${STARS_PER_LEVEL - progress} stars to level ${level + 1}`}
                </dd>
              </div>
            </dl>
          </section>

          <main className="layout" id="sky">
            <div className="sky-wrap">
              <div className="sky-bar">
                <div className="controls" role="group" aria-label="Sky layout">
                  {layoutControls}
                </div>
                <button
                  className="ghost"
                  onClick={() => {
                    setSelected(null);
                    setReplay((r) => r + 1);
                  }}
                >
                  <svg
                    viewBox="0 0 20 20"
                    width="16"
                    height="16"
                    aria-hidden="true"
                  >
                    <path d="M4 10a6 6 0 1 0 2-4.5M4 3v3.5h3.5" />
                  </svg>
                  Redraw
                </button>
              </div>
              <div
                className={horizontal ? "sky sky-h" : "sky"}
                ref={skyRef}
                onClick={(e) => {
                  // A click on empty sky closes the popover.
                  if (
                    !(e.target as Element).closest(
                      ".sl-star, .sl-card, .popover",
                    )
                  )
                    setSelected(null);
                }}
              >
                {skyGraph}
                {current && popover(skyRef, "all")}
              </div>
              <p className="hint">
                {horizontal || compact
                  ? "Hover a star for its title. Click it for the full story."
                  : "Click a star for the full story."}
              </p>
            </div>
          </main>

          <MakeItYours />

          <footer className="foot">
            Drawn with @gitgraph/react. Every star, line, card and label on this
            page comes from a render prop.
          </footer>
        </>
      )}

      <aside
        className={`deck${deckOpen ? "" : " deck-min"}${away && !onCanvas ? " deck-away" : ""}`}
        aria-label="Add to your sky"
        // Off screen: out of the tab order too. (React 18 has no `inert` type.)
        {...({ inert: away && !onCanvas ? "" : undefined } as {})}
      >
        {deckOpen ? (
          <>
            <button
              className="deck-toggle"
              onClick={() => setDeckOpen(false)}
              aria-label="Minimize"
              title="Minimize"
            >
              <svg
                viewBox="0 0 16 16"
                width="14"
                height="14"
                aria-hidden="true"
              >
                <path d="M3 8h10" />
              </svg>
            </button>
            <LightStar
              palette={palette}
              tracks={open}
              colors={colors}
              events={events}
              track={track}
              onTrack={setTrack}
              from={from}
              onFrom={setFrom}
              focusName={focusName}
              onLight={(m) =>
                record(
                  m,
                  colors.has(m.track)
                    ? `Star lit on ${m.track}`
                    : `New track started: ${m.track}`,
                )
              }
            />
            <FinishTrack
              tracks={open.filter((t) => t !== MAIN)}
              colors={colors}
              onFinish={(m) => record(m, `Badge earned: ${m.badge}`)}
            />
          </>
        ) : (
          <button className="deck-fab" onClick={() => setDeckOpen(true)}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d={STAR_ICON} />
            </svg>
            Light a star
          </button>
        )}
      </aside>

      {quest && (
        <>
          <div className="toast medals" role="status" aria-live="polite">
            {goals[0] && (
              <Unlocked key={goals[0].key + goals.length} goal={goals[0]} />
            )}
          </div>
          <div id="fx" aria-hidden="true" />
        </>
      )}
      <div className="toast" role="status" aria-live="polite">
        {toast && (
          <span key={toast + stars}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d={STAR_ICON} />
            </svg>
            {toast}
          </span>
        )}
      </div>
    </>
  );
}

// Popover anchored to the open star, inside the scrolling sky.
function Popover(props: {
  m: Milestone;
  events: Milestone[];
  color: string;
  skyRef: React.RefObject<HTMLDivElement>;
  /** "all": right of every card (the journal); "own": beside its own card. */
  beside: "all" | "own";
  /** Canvas pan/zoom: re-place when it changes. */
  view?: View;
  onClose: () => void;
  onBranch: () => void;
}) {
  const { m, events, color } = props;
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{
    x: number;
    y: number;
    flip: boolean;
    reach: number;
  }>();

  React.useLayoutEffect(() => {
    const place = () => {
      const sky = props.skyRef.current;
      const star = sky?.querySelector(`[data-hash="${m.id}"] .sl-spark`);
      if (!sky || !star || !ref.current) return;
      const own = sky.querySelector(`[data-hash="${m.id}"] .sl-card rect`);
      const s = star.getBoundingClientRect();
      const k = sky.getBoundingClientRect();
      const w = ref.current.offsetWidth;
      const ownRight = (own || star).getBoundingClientRect().right - k.left;
      // Journal: in the open sky right of all the cards, so none is covered.
      const cards = Array.from(sky.querySelectorAll(".sl-card rect"));
      const edge =
        props.beside === "all" && cards.length
          ? Math.max(...cards.map((c) => c.getBoundingClientRect().right)) -
            k.left
          : ownRight;
      const right = edge + 18;
      const cy = s.top + s.height / 2 - k.top + sky.scrollTop;
      const flip = right + w > sky.clientWidth - 8;
      const x = flip ? s.left - k.left - 18 - w : right;
      // A dashed line reaches back from the popover to its own row.
      setPos({
        x: x + sky.scrollLeft,
        y: cy,
        flip,
        reach: flip ? 0 : x - ownRight,
      });
    };
    place();
    addEventListener("resize", place);
    return () => removeEventListener("resize", place);
  }, [m.id, props.view]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const index = events.findIndex((e) => e.id === m.id);
  const before = events.slice(0, index).reverse();
  // What it grew from: the track's previous star, or where the track branched.
  const prev = before.find((e) => e.track === m.track);
  const origin = prev
    ? undefined
    : m.from
      ? events.find((e) => e.id === m.from)
      : before.find((e) => e.track === MAIN);
  const joined = m.finishes
    ? before.find((e) => e.track === m.finishes)
    : undefined;
  const lit = new Date(m.lit);
  const days = Math.floor((Date.now() - lit.getTime()) / 864e5);
  const ago =
    days < 1
      ? "Today"
      : new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
          days < 45 ? -days : -Math.round(days / 30.4),
          days < 45 ? "day" : "month",
        );

  return (
    <div
      ref={ref}
      className={pos?.flip ? "popover flip" : "popover"}
      role="dialog"
      aria-labelledby="pop-title"
      style={
        {
          "--c": color,
          "--reach": `${pos?.reach ?? 0}px`,
          left: pos?.x,
          top: pos?.y,
          visibility: pos ? "visible" : "hidden",
        } as React.CSSProperties
      }
    >
      <div className="pop-head">
        <span className="pop-track">
          <i aria-hidden="true" />
          {m.track}
        </span>
        <button
          className="pop-close"
          onClick={props.onClose}
          aria-label="Close"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
      <h3 id="pop-title">{m.title}</h3>
      <p className="pop-when">
        <strong>Lit {ago.toLowerCase()}</strong>
        {new Intl.DateTimeFormat("en", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }).format(lit)}
      </p>
      {m.badge && (
        <p className="pop-badge">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d={STAR_ICON} />
          </svg>
          Earned the {m.badge} badge
        </p>
      )}
      {m.note && <p className="pop-note">{m.note}</p>}
      <dl className="pop-facts">
        <div>
          <dt>Star</dt>
          <dd>
            {index + 1} of {events.length}
          </dd>
        </div>
        {prev && (
          <div>
            <dt>After</dt>
            <dd>{prev.title}</dd>
          </div>
        )}
        {origin && (
          <div>
            <dt>Branched from</dt>
            <dd>{origin.title}</dd>
          </div>
        )}
        {joined && (
          <div>
            <dt>Joined</dt>
            <dd>{joined.title}</dd>
          </div>
        )}
        <div>
          <dt>Hash</dt>
          <dd className="hash">{m.id}</dd>
        </div>
      </dl>
      <button className="pop-branch" onClick={props.onBranch}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M5 2v12M5 10c0-3 6-2 6-6M11 2v2" />
        </svg>
        Start a track from here
      </button>
    </div>
  );
}

function Segmented(props: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={props.label}>
      {props.options.map(([value, text]) => (
        <button
          key={value}
          role="radio"
          aria-checked={props.value === value}
          onClick={() => props.onChange(value)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function TrackChips(props: {
  name: string;
  tracks: string[];
  colors: Map<string, string>;
  value: string;
  onChange: (track: string) => void;
}) {
  return (
    <>
      {props.tracks.map((t) => (
        <label
          key={t}
          className="chip"
          style={{ "--c": props.colors.get(t) } as React.CSSProperties}
        >
          <input
            type="radio"
            name={props.name}
            checked={props.value === t}
            onChange={() => props.onChange(t)}
          />
          <i aria-hidden="true" />
          {t}
        </label>
      ))}
    </>
  );
}

function LightStar(props: {
  palette: string[];
  tracks: string[];
  colors: Map<string, string>;
  events: Milestone[];
  track: string;
  onTrack: (track: string) => void;
  from: string;
  onFrom: (id: string) => void;
  focusName: number;
  onLight: (m: Milestone) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [note, setNote] = React.useState("");
  const [newTrack, setNewTrack] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const nameRef = React.useRef<HTMLInputElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  // "Start a track from here" in a popover lands on the name field.
  React.useEffect(() => {
    if (!props.focusName) return;
    formRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    nameRef.current?.focus({ preventScroll: true });
  }, [props.focusName]);

  // A finished track can't take new stars.
  const chosen =
    props.track === NEW_TRACK || props.tracks.includes(props.track)
      ? props.track
      : MAIN;
  const nextColor = props.palette[props.colors.size % props.palette.length];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTrack.trim().toLowerCase();
    if (!title.trim()) return setError("Give the milestone a title.");
    if (chosen === NEW_TRACK) {
      if (!name) return setError("Name the new track.");
      if (props.colors.has(name))
        return setError(`There's already a track called ${name}.`);
    }
    setError(null);
    props.onLight({
      id: newId(),
      track: chosen === NEW_TRACK ? name : chosen,
      from: chosen === NEW_TRACK ? props.from : undefined,
      title: title.trim(),
      note: note.trim() || undefined,
      lit: new Date().toISOString(),
    });
    setTitle("");
    setNote("");
    if (chosen === NEW_TRACK) {
      props.onTrack(name);
      setNewTrack("");
    }
  };

  return (
    <form className="card" onSubmit={submit} noValidate ref={formRef}>
      <h2>Light a star</h2>
      <label className="field">
        <span>What did you reach?</span>
        <input
          value={title}
          maxLength={44}
          placeholder="Ran my first trail race"
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={!!error && !title.trim()}
        />
      </label>

      <fieldset className="field">
        <legend>Track</legend>
        <div className="chips">
          <TrackChips
            name="track"
            tracks={props.tracks}
            colors={props.colors}
            value={chosen}
            onChange={props.onTrack}
          />
          <label
            className="chip chip-new"
            style={{ "--c": nextColor } as React.CSSProperties}
          >
            <input
              type="radio"
              name="track"
              checked={chosen === NEW_TRACK}
              onChange={() => props.onTrack(NEW_TRACK)}
            />
            <i aria-hidden="true" />
            New track
          </label>
        </div>
        {chosen === NEW_TRACK && (
          <div
            className="new-track"
            style={{ "--c": nextColor } as React.CSSProperties}
          >
            <input
              ref={nameRef}
              value={newTrack}
              maxLength={16}
              placeholder="Name it, e.g. music"
              aria-label="New track name"
              aria-invalid={!!error && !newTrack.trim()}
              onChange={(e) => setNewTrack(e.target.value)}
            />
            <label className="from">
              <span>Branch from</span>
              <select
                value={props.from}
                onChange={(e) => props.onFrom(e.target.value)}
              >
                {[...props.events].reverse().map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} ({e.track})
                  </option>
                ))}
              </select>
            </label>
            <p className="from-hint">
              Or open any star in the sky and pick “Start a track from here”.
            </p>
          </div>
        )}
      </fieldset>

      <label className="field">
        <span>
          Note <em>optional</em>
        </span>
        <textarea
          rows={2}
          value={note}
          maxLength={120}
          placeholder="How it felt, who was there"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="primary" type="submit">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d={STAR_ICON} />
        </svg>
        Light this star
      </button>
    </form>
  );
}

function FinishTrack(props: {
  tracks: string[];
  colors: Map<string, string>;
  onFinish: (m: Milestone) => void;
}) {
  const [track, setTrack] = React.useState("");
  const [badge, setBadge] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const chosen = props.tracks.includes(track) ? track : props.tracks[0];

  if (!chosen) {
    return (
      <section className="card">
        <h2>Finish a track</h2>
        <p className="muted">
          Every track is finished. Start a new one above and it will show up
          here.
        </p>
      </section>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!badge.trim()) return setError("Name the badge you earned.");
    setError(null);
    props.onFinish({
      id: newId(),
      track: MAIN,
      finishes: chosen,
      badge: badge.trim(),
      title: `Finished the ${chosen} track`,
      lit: new Date().toISOString(),
    });
    setBadge("");
  };

  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2>Finish a track</h2>
      <p className="muted">
        It joins your main path, and you name the badge you earned.
      </p>
      <div className="chips">
        <TrackChips
          name="finish"
          tracks={props.tracks}
          colors={props.colors}
          value={chosen}
          onChange={setTrack}
        />
      </div>
      <div className="row">
        <input
          value={badge}
          maxLength={22}
          placeholder="Badge name"
          aria-label="Badge name"
          aria-invalid={!!error}
          onChange={(e) => setBadge(e.target.value)}
        />
        <button className="secondary" type="submit">
          Finish track
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

// Fonts first: cards, pills and badges are measured with them.
Promise.all([FONT_TITLE, FONT_SMALL].map((f) => document.fonts.load(f))).then(
  () => createRoot(document.getElementById("root")!).render(<App />),
);
