import * as React from "react";
import { createRoot } from "react-dom/client";
import { Gitgraph } from "@gitgraph/react";
import { Canvas, type CanvasHandle } from "./canvas";
import {
  AANG,
  BADGES,
  BOOKS,
  EPISODES,
  FONT_SMALL,
  FONT_TITLE,
  MASTER,
  NATIONS,
  Shape,
  XP_LESSON,
  XP_SCENE,
  buildNation,
  burst,
  floatText,
  lineColors,
  rankOf,
  sceneXp,
  xpOf,
  type Badge,
  type Bending,
  type Nation,
  type Scene,
  type Scenes,
} from "./avatar-pieces";

// Four Nations: how Aang learned each element, one graph per nation.
// Add scenes to earn XP, master all four elements, enter the Avatar State.

/** Each nation starts drawing this long after the one before it. */
const STAGGER = 1400;
const NEW = "\0new";

const SEED = Object.fromEntries(
  NATIONS.map((n) => [n.element, n.scenes]),
) as Scenes;

let nextId = 0;
const newId = () => `u${Date.now().toString(36)}${nextId++}`;

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const center = (el: Element) => {
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2, r.top] as const;
};

function Icon(props: { of: Bending | "avatar" | "star"; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={props.size ?? 20}
      height={props.size ?? 20}
      className={`icon av-${props.of}`}
      aria-hidden="true"
    >
      <Shape element={props.of} />
    </svg>
  );
}

function App() {
  const [scenes, setScenes] = React.useState<Scenes>(SEED);
  const scenesRef = React.useRef(scenes);
  scenesRef.current = scenes;
  // A scene still flying in: its XP counts once it lands.
  const [pending, setPending] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [replay, setReplay] = React.useState(0);
  const [toasts, setToasts] = React.useState<Badge[]>([]);
  const [avatarOpen, setAvatarOpen] = React.useState(false);
  const [badgesOpen, setBadgesOpen] = React.useState(false);
  const [deckOpen, setDeckOpen] = React.useState(
    () => matchMedia("(min-width: 1181px)").matches,
  );
  // The form's nation, line and branch point live here: the detail panel sets them.
  const [element, setElement] = React.useState<Bending>("water");
  const [who, setWho] = React.useState(AANG);
  const [from, setFrom] = React.useState("");
  const [focus, setFocus] = React.useState(0);

  const canvasRef = React.useRef<CanvasHandle>(null);
  const rowRef = React.useRef<HTMLDivElement>(null);
  const sections = React.useRef<Array<HTMLElement | null>>([]);

  const toggle = React.useCallback(
    (id: string) => setSelected((s) => (s === id ? null : id)),
    [],
  );
  const graphs = React.useMemo(
    () => NATIONS.map((n) => buildNation(n, toggle)),
    [],
  );

  const fit = () => rowRef.current && canvasRef.current?.frame(rowRef.current);

  // The world never sits still: every couple of seconds a visible symbol
  // hops and puffs a little of its element.
  React.useEffect(() => {
    if (reduced()) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      const visible = Array.from(
        document.querySelectorAll<SVGGElement>(".nation .av-glyph"),
      ).filter((g) => {
        const r = g.getBoundingClientRect();
        return (
          r.top > 90 &&
          r.bottom < innerHeight - 90 &&
          r.left > 0 &&
          r.right < innerWidth
        );
      });
      const glyph = visible[Math.floor(Math.random() * visible.length)];
      if (!glyph) return;
      const kind = NATIONS.find((n) =>
        glyph.classList.contains(`av-${n.element}`),
      )!.element;
      glyph.classList.add("av-ping");
      setTimeout(() => glyph.classList.remove("av-ping"), 800);
      const [x, y] = center(glyph);
      burst(x, y, kind, 7);
    }, 1700);
    return () => clearInterval(id);
  }, []);
  React.useEffect(() => {
    // After the graphs have sized their SVGs.
    setTimeout(fit, 300);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSelected(null);
      setBadgesOpen(false);
      setAvatarOpen(false);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  // One badge banner at a time.
  React.useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((q) => q.slice(1)), 3200);
    return () => clearTimeout(t);
  }, [toasts]);

  const shown = (el: Bending) => scenes[el].filter((s) => s.id !== pending);
  const earned = BADGES.filter((b) => b.earned(scenes));
  const isAvatar = earned.some((b) => b.id === "avatar");
  React.useEffect(() => {
    document.body.classList.toggle("avatar-state", isAvatar);
  }, [isAvatar]);

  const record = (el: Bending, scene: Scene) => {
    const i = NATIONS.findIndex((n) => n.element === el);
    const before = scenesRef.current;
    const next = { ...before, [el]: [...before[el], scene] };
    graphs[i].add(scene); // Live: only the new line draws, and the scene lands.
    setScenes(next);
    setPending(scene.id);
    setSelected(null);
    const fresh = BADGES.filter((b) => b.earned(next) && !b.earned(before));
    const color = lineColors(NATIONS[i], next[el]).get(scene.who)!;

    const land = () => {
      setPending(null);
      if (fresh.length) setToasts((q) => [...q, ...fresh]);
      if (fresh.some((b) => b.id === "avatar"))
        setTimeout(() => setAvatarOpen(true), 900);
    };
    // Once drawn: glide to it, and celebrate when it lands.
    setTimeout(() => {
      const commit = document.querySelector<SVGGElement>(
        `.nation [data-hash="${scene.id}"]`,
      );
      const glyph = commit?.querySelector(".av-glyph");
      if (!commit || !glyph) return land();
      canvasRef.current?.reveal(glyph);
      if (reduced()) return land();
      const delay =
        parseFloat(commit.style.getPropertyValue("--gg-delay")) || 0;
      setTimeout(() => {
        const [x, y, top] = center(glyph);
        burst(x, y, el, scene.merges ? 26 : 16);
        floatText(x, top - 8, `+${sceneXp(scene)} XP`, color);
        if (el === "earth") {
          rowRef.current?.animate(
            [0, 6, -5, 4, -2, 0].map((d) => ({
              transform: `translate(${d}px, ${-d / 2}px)`,
            })),
            { duration: 420 },
          );
        }
        land();
      }, delay + 30);
    }, 60);
  };

  const current = selected
    ? NATIONS.map((n) => ({
        n,
        s: scenes[n.element].find((s) => s.id === selected),
      })).find((x) => x.s)
    : undefined;

  const openDeck = (el: Bending, line: string, fromId = "") => {
    setElement(el);
    setWho(line);
    setFrom(fromId);
    setSelected(null);
    setDeckOpen(true);
    setFocus((f) => f + 1);
  };

  return (
    <>
      <style>{`.nation [data-hash="${selected}"] { --sel: 1; }`}</style>
      <Canvas
        ref={canvasRef}
        inset={deckOpen ? 404 : 0}
        onBackgroundClick={() => setSelected(null)}
        overlay={() => null}
      >
        <div className="row" ref={rowRef}>
          <Clouds />
          {NATIONS.map((n, i) => {
            const xp = xpOf(shown(n.element));
            return (
              <section
                key={`${n.element}-${replay}`}
                ref={(el) => (sections.current[i] = el)}
                className={`nation av-${n.element}`}
                aria-labelledby={`${n.element}-name`}
                style={
                  {
                    "--o": `${i * STAGGER}ms`,
                    "--c": n.colors[0],
                  } as React.CSSProperties
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  className="nation-ghost"
                  aria-hidden="true"
                >
                  <Shape element={n.element} />
                </svg>
                <header className="nation-head">
                  <Icon of={n.element} size={60} />
                  <div>
                    <h2 id={`${n.element}-name`}>{n.name}</h2>
                    <p>{n.source}</p>
                  </div>
                  {xp >= MASTER && (
                    <span className="stamp" aria-label="Mastered">
                      Mastered
                    </span>
                  )}
                </header>
                <Gitgraph
                  graph={graphs[i].core}
                  animation={{ duration: 380, maxTotal: 1800 }}
                  renderEdge={graphs[i].edge}
                />
              </section>
            );
          })}
        </div>
      </Canvas>

      <header className="hud top">
        <span className="brand">
          <span className="seal" aria-hidden="true">
            四
          </span>
          Four Nations
        </span>
        <nav className="meters" aria-label="Nations">
          {NATIONS.map((n, i) => {
            const xp = xpOf(shown(n.element));
            const rank = rankOf(xp);
            return (
              <button
                key={n.element}
                className={xp >= MASTER ? "meter done" : "meter"}
                style={{ "--c": n.colors[0] } as React.CSSProperties}
                aria-label={`${n.name}: ${rank}, ${Math.min(xp, MASTER)} of ${MASTER} XP. Show ${n.name}.`}
                onClick={() => {
                  const el = sections.current[i];
                  if (el) canvasRef.current?.frame(el);
                }}
              >
                <Icon of={n.element} size={26} />
                <span className="meter-text">
                  <b>{n.name}</b>
                  <small key={rank} className="pop-in">
                    {rank}
                  </small>
                </span>
                <span className="bar" aria-hidden="true">
                  <i style={{ width: `${Math.min(1, xp / MASTER) * 100}%` }} />
                </span>
              </button>
            );
          })}
        </nav>
        <button
          className="badges-btn"
          aria-expanded={badgesOpen}
          onClick={() => setBadgesOpen((o) => !o)}
        >
          <Icon of="star" size={20} />
          <span key={earned.length} className="pop-in">
            {earned.length}/{BADGES.length}
          </span>
          <span className="label">Badges</span>
        </button>
      </header>

      {badgesOpen && (
        <BadgeShelf earned={earned} onClose={() => setBadgesOpen(false)} />
      )}

      <div className="hud tools" role="toolbar" aria-label="Map">
        <button
          onClick={() => canvasRef.current?.zoomBy(1 / 1.25)}
          aria-label="Zoom out"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M3 8h10" />
          </svg>
        </button>
        <button onClick={fit}>All four</button>
        <button
          onClick={() => canvasRef.current?.zoomBy(1.25)}
          aria-label="Zoom in"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M3 8h10M8 3v10" />
          </svg>
        </button>
        <span className="sep" aria-hidden="true" />
        <button
          onClick={() => {
            setSelected(null);
            setReplay((r) => r + 1);
          }}
        >
          Replay
        </button>
      </div>

      {current?.s && (
        <Detail
          key={current.s.id}
          nation={current.n}
          scenes={scenes[current.n.element]}
          scene={current.s}
          onClose={() => setSelected(null)}
          onContinue={() => openDeck(current.n.element, current.s!.who)}
          onBranch={() => openDeck(current.n.element, NEW, current.s!.id)}
        />
      )}

      <aside className={deckOpen ? "deck" : "deck deck-min"} aria-label="Train">
        {deckOpen ? (
          <Train
            scenes={scenes}
            element={element}
            onElement={(el) => {
              setElement(el);
              setWho(AANG);
              setFrom("");
            }}
            who={who}
            onWho={setWho}
            from={from}
            onFrom={setFrom}
            focus={focus}
            onAdd={record}
            onMinimize={() => setDeckOpen(false)}
          />
        ) : (
          <button className="fab" onClick={() => setDeckOpen(true)}>
            <Icon of={element} size={22} />
            Train
          </button>
        )}
      </aside>

      <div className="toasts" role="status" aria-live="polite">
        {toasts[0] && (
          <Toast key={toasts[0].id + toasts.length} badge={toasts[0]} />
        )}
      </div>

      {avatarOpen && <AvatarState onClose={() => setAvatarOpen(false)} />}
      <div id="fx" aria-hidden="true" />
    </>
  );
}

// ---------------------------------------------------------------------------

function Clouds() {
  // Placed in canvas space, around and between the nations.
  const spots = [
    [-260, 40, 1.2],
    [700, -120, 0.9],
    [1500, 620, 1.1],
    [2300, -60, 0.8],
    [420, 900, 0.85],
    [2900, 780, 1],
  ];
  return (
    <>
      {spots.map(([x, y, s], i) => (
        <svg
          key={i}
          className="cloud"
          viewBox="0 0 120 56"
          style={{
            left: x,
            top: y,
            width: 150 * s,
            animationDelay: `${-i * 3.1}s`,
          }}
          aria-hidden="true"
        >
          <path d="M22 50a18 18 0 0 1 2-36 22 22 0 0 1 40-6 20 20 0 0 1 34 12 16 16 0 0 1 4 30Z" />
        </svg>
      ))}
    </>
  );
}

function Train(props: {
  scenes: Scenes;
  element: Bending;
  onElement: (el: Bending) => void;
  who: string;
  onWho: (who: string) => void;
  from: string;
  onFrom: (id: string) => void;
  focus: number;
  onAdd: (el: Bending, scene: Scene) => void;
  onMinimize: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const titleRef = React.useRef<HTMLInputElement>(null);
  const nameRef = React.useRef<HTMLInputElement>(null);

  const nation = NATIONS.find((n) => n.element === props.element)!;
  const scenes = props.scenes[props.element];
  const colors = lineColors(nation, scenes);
  const lines = Array.from(colors.keys());
  const isNew = props.who === NEW;
  const who = isNew || lines.includes(props.who) ? props.who : AANG;
  const nextColor = nation.colors[colors.size % nation.colors.length];
  const from = props.from || scenes[scenes.length - 1].id;

  React.useEffect(() => {
    if (!props.focus) return;
    (isNew ? nameRef : titleRef).current?.focus();
  }, [props.focus]);

  const add = (teach: boolean) => {
    const line = name.trim();
    if (isNew) {
      if (!line) return setError("Name the new character.");
      if (colors.has(line))
        return setError(`${line} is already in ${nation.name}.`);
    }
    if (!teach && !title.trim())
      return setError("Say what happens in the scene.");
    setError(null);
    props.onAdd(
      props.element,
      teach
        ? {
            id: newId(),
            who: AANG,
            merges: who,
            title: title.trim() || `Learns from ${who}`,
            mine: true,
          }
        : {
            id: newId(),
            who: isNew ? line : who,
            from: isNew ? from : undefined,
            title: title.trim(),
            mine: true,
          },
    );
    setTitle("");
    if (isNew) {
      props.onWho(line);
      setName("");
    }
  };

  return (
    <form
      className="train"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        add(false);
      }}
    >
      <div className="train-head">
        <h2>Train</h2>
        <button
          type="button"
          className="icon-btn"
          onClick={props.onMinimize}
          aria-label="Minimize"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M3 8h10" />
          </svg>
        </button>
      </div>
      <p className="muted">
        Every scene earns XP. Reach {MASTER} XP to master an element, then
        master all four.
      </p>

      <fieldset className="tiles">
        <legend>Nation</legend>
        {NATIONS.map((n) => (
          <label
            key={n.element}
            className="tile"
            style={{ "--c": n.colors[0] } as React.CSSProperties}
          >
            <input
              type="radio"
              name="nation"
              checked={props.element === n.element}
              onChange={() => props.onElement(n.element)}
            />
            <Icon of={n.element} size={28} />
            {n.name}
          </label>
        ))}
      </fieldset>

      <fieldset className="field">
        <legend>Who</legend>
        <div className="chips">
          {lines.map((l) => (
            <label
              key={l}
              className="chip"
              style={{ "--c": colors.get(l) } as React.CSSProperties}
            >
              <input
                type="radio"
                name="who"
                checked={who === l}
                onChange={() => props.onWho(l)}
              />
              <i aria-hidden="true" />
              {l}
            </label>
          ))}
          <label
            className="chip chip-new"
            style={{ "--c": nextColor } as React.CSSProperties}
          >
            <input
              type="radio"
              name="who"
              checked={isNew}
              onChange={() => props.onWho(NEW)}
            />
            <i aria-hidden="true" />
            Someone new
          </label>
        </div>
        {isNew && (
          <div
            className="new-line"
            style={{ "--c": nextColor } as React.CSSProperties}
          >
            <input
              ref={nameRef}
              value={name}
              maxLength={16}
              placeholder="Name, e.g. Sokka"
              aria-label="New character's name"
              aria-invalid={!!error && !name.trim()}
              onChange={(e) => setName(e.target.value)}
            />
            <label>
              <span>Branches from</span>
              <select
                value={from}
                onChange={(e) => props.onFrom(e.target.value)}
              >
                {[...scenes].reverse().map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.who})
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </fieldset>

      <label className="field">
        <span>What happens?</span>
        <input
          ref={titleRef}
          value={title}
          maxLength={44}
          placeholder={nation.placeholder}
          aria-invalid={!!error && !title.trim()}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button
          className="primary"
          type="submit"
          style={{ "--c": nation.colors[0] } as React.CSSProperties}
        >
          <Icon of={props.element} size={18} />
          Add scene
          <span className="xp">+{XP_SCENE}</span>
        </button>
        {!isNew && who !== AANG && (
          <button
            type="button"
            className="secondary"
            style={{ "--c": colors.get(who) } as React.CSSProperties}
            onClick={() => add(true)}
          >
            {who} teaches Aang
            <span className="xp">+{XP_LESSON}</span>
          </button>
        )}
      </div>
    </form>
  );
}

function Detail(props: {
  nation: Nation;
  scenes: Scene[];
  scene: Scene;
  onClose: () => void;
  onContinue: () => void;
  onBranch: () => void;
}) {
  const { scenes, scene } = props;
  const index = scenes.indexOf(scene);
  const color = lineColors(props.nation, scenes).get(scene.who)!;
  const before = scenes.slice(0, index).reverse();
  const prev = before.find((s) => s.who === scene.who);
  const origin = prev
    ? undefined
    : scene.from
      ? scenes.find((s) => s.id === scene.from)
      : before.find((s) => s.who === AANG);
  const joined = scene.merges
    ? before.find((s) => s.who === scene.merges)
    : undefined;
  const [book, ch] = (scene.ep ?? "").split(".");

  return (
    <aside
      className={`detail av-${props.nation.element}`}
      aria-labelledby="detail-title"
      style={{ "--c": color } as React.CSSProperties}
    >
      <div className="detail-head">
        <span className="detail-who">
          <Icon of={props.nation.element} />
          {scene.who}
        </span>
        <span className="xp-chip">+{sceneXp(scene)} XP</span>
        <button className="icon-btn" onClick={props.onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
      <h3 id="detail-title">{scene.title}</h3>
      {scene.ep ? (
        <p className="detail-ep">
          Book {BOOKS[+book]}, chapter {ch}
          <cite>{EPISODES[scene.ep]}</cite>
        </p>
      ) : (
        <p className="detail-ep">Your own scene</p>
      )}
      {scene.note && <p className="detail-note">{scene.note}</p>}
      <dl>
        <div>
          <dt>Scene</dt>
          <dd>
            {index + 1} of {scenes.length} in {props.nation.name}
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
            <dt>Brings in</dt>
            <dd>
              {scene.merges}: {joined.title}
            </dd>
          </div>
        )}
      </dl>
      <div className="detail-actions">
        <button onClick={props.onContinue}>Continue {scene.who}'s line</button>
        <button onClick={props.onBranch}>Branch someone new</button>
      </div>
    </aside>
  );
}

function BadgeShelf(props: { earned: Badge[]; onClose: () => void }) {
  return (
    <section className="shelf" aria-labelledby="shelf-title">
      <div className="train-head">
        <h2 id="shelf-title">Badges</h2>
        <button className="icon-btn" onClick={props.onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
      <ul>
        {BADGES.map((b) => {
          const got = props.earned.includes(b);
          return (
            <li key={b.id} className={got ? "got" : "locked"}>
              <span className={`medal medal-${b.icon}`}>
                <Icon of={b.icon} size={26} />
              </span>
              <span>
                <b>{b.name}</b>
                <small>{got ? "Earned" : b.how}</small>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Toast({ badge }: { badge: Badge }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const medal = ref.current?.querySelector(".medal");
    if (!medal) return;
    const [x, y] = center(medal);
    const kind = badge.icon === "star" ? "avatar" : badge.icon;
    setTimeout(() => burst(x, y, kind, 22), 250);
  }, []);
  return (
    <div className="toast" ref={ref}>
      <span className={`medal medal-${badge.icon}`}>
        <Icon of={badge.icon} size={30} />
      </span>
      <span>
        <small>Badge earned</small>
        <b>{badge.name}</b>
      </span>
    </div>
  );
}

function AvatarState({ onClose }: { onClose: () => void }) {
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    ref.current?.focus();
    const [x, y] = [innerWidth / 2, innerHeight / 2 - 60];
    const kinds: Bending[] = ["water", "earth", "fire", "air"];
    kinds.forEach((k, i) =>
      setTimeout(() => burst(x, y, k, 30), 300 + i * 220),
    );
  }, []);
  return (
    <div
      className="avatar-state-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="as-title"
    >
      <div className="orbit" aria-hidden="true">
        {(["water", "earth", "fire", "air"] as Bending[]).map((k, i) => (
          <span key={k} style={{ "--k": i } as React.CSSProperties}>
            <Icon of={k} size={44} />
          </span>
        ))}
        <span className="arrow">
          <Icon of="avatar" size={96} />
        </span>
      </div>
      <h2 id="as-title">Avatar State</h2>
      <p>
        You mastered all four elements. Aang's lines now glow like his tattoos.
      </p>
      <button ref={ref} onClick={onClose}>
        Keep training
      </button>
    </div>
  );
}

// Fonts first: scrolls are measured with them.
Promise.all([FONT_TITLE, FONT_SMALL].map((f) => document.fonts.load(f))).then(
  () => createRoot(document.getElementById("root")!).render(<App />),
);
