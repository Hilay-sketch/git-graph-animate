import * as React from "react";
import {
  GitgraphCore,
  Orientation,
  TemplateName,
  templateExtend,
  type Branch,
  type EdgeProps,
} from "@gamzo/git-graph";
import { DOT, edgeHooks, textWidth } from "./pieces";

// Four Nations: the story data, the game rules, and every SVG piece handed
// to the library's render props.

type Node = React.ReactElement<SVGElement>;
export type Bending = "water" | "earth" | "fire" | "air";

export interface Scene {
  id: string;
  who: string;
  title: string;
  /** Book and chapter, e.g. 1.9 is Book One, chapter 9. None: added by you. */
  ep?: string;
  note?: string;
  /** First scene of a line: the scene it branches from. Default: Aang's tip. */
  from?: string;
  /** This scene merges that line in. */
  merges?: string;
  /** Added by the viewer. */
  mine?: boolean;
}

export interface Nation {
  element: Bending;
  name: string;
  /** Who the element was first learned from. */
  source: string;
  /** One family of shades, in the order lines first appear. */
  colors: string[];
  lineWidth: number;
  placeholder: string;
  scenes: Scene[];
}

export const AANG = "Aang";
export const FONT_TITLE = "800 14px Nunito";
export const FONT_SMALL = "700 12px Nunito";

// ---------------------------------------------------------------------------
// Game rules

export const XP_SCENE = 10;
/** Someone teaches Aang: their line merges into his. */
export const XP_LESSON = 25;
export const MASTER = 220;
const RANKS: Array<[number, string]> = [
  [MASTER, "Master"],
  [120, "Adept"],
  [60, "Student"],
  [0, "Novice"],
];

export const sceneXp = (s: Scene) =>
  s.who === AANG && s.merges ? XP_LESSON : XP_SCENE;
export const xpOf = (scenes: Scene[]) =>
  scenes.reduce((sum, s) => sum + sceneXp(s), 0);
export const rankOf = (xp: number) => RANKS.find(([min]) => xp >= min)![1];

export type Scenes = Record<Bending, Scene[]>;

export interface Badge {
  id: string;
  name: string;
  how: string;
  /** The symbol on the badge. */
  icon: Bending | "avatar" | "star";
  earned: (all: Scenes) => boolean;
}

const mine = (all: Scenes) =>
  Object.values(all)
    .flat()
    .filter((s) => s.mine);

export const BADGES: Badge[] = [
  {
    id: "first",
    name: "First scene",
    how: "Add a scene of your own.",
    icon: "star",
    earned: (all) => mine(all).length > 0,
  },
  {
    id: "new-face",
    name: "New face",
    how: "Bring a new character into a nation.",
    icon: "star",
    earned: (all) =>
      Object.values(all).some((scenes) =>
        scenes.some(
          (s) => s.mine && !scenes.some((o) => !o.mine && o.who === s.who),
        ),
      ),
  },
  {
    id: "lesson",
    name: "Lesson learned",
    how: "Have someone teach Aang.",
    icon: "star",
    earned: (all) => mine(all).some((s) => s.who === AANG && s.merges),
  },
  {
    id: "tour",
    name: "World tour",
    how: "Add a scene in all four nations.",
    icon: "star",
    earned: (all) =>
      Object.values(all).every((scenes) => scenes.some((s) => s.mine)),
  },
  ...(["water", "earth", "fire", "air"] as Bending[]).map((element) => ({
    id: `master-${element}`,
    name: `${element[0].toUpperCase()}${element.slice(1)}bending master`,
    how: `Reach ${MASTER} XP in ${element}.`,
    icon: element,
    earned: (all: Scenes) => xpOf(all[element]) >= MASTER,
  })),
  {
    id: "avatar",
    name: "Avatar State",
    how: "Master all four elements.",
    icon: "avatar",
    earned: (all) => Object.values(all).every((s) => xpOf(s) >= MASTER),
  },
];

// ---------------------------------------------------------------------------
// The story

export const BOOKS = ["", "One: Water", "Two: Earth", "Three: Fire"];
export const EPISODES: Record<string, string> = {
  "1.1": "The Boy in the Iceberg",
  "1.3": "The Southern Air Temple",
  "1.4": "The Warriors of Kyoshi",
  "1.5": "The King of Omashu",
  "1.9": "The Waterbending Scroll",
  "1.12": "The Storm",
  "1.16": "The Deserter",
  "1.18": "The Waterbending Master",
  "1.20": "The Siege of the North, Part 2",
  "2.1": "The Avatar State",
  "2.4": "The Swamp",
  "2.6": "The Blind Bandit",
  "2.9": "Bitter Work",
  "2.11": "The Desert",
  "2.14": "City of Walls and Secrets",
  "2.16": "Appa's Lost Days",
  "2.17": "Lake Laogai",
  "2.19": "The Guru",
  "2.20": "The Crossroads of Destiny",
  "3.8": "The Puppetmaster",
  "3.11": "The Day of Black Sun, Part 2",
  "3.12": "The Western Air Temple",
  "3.13": "The Firebending Masters",
  "3.19": "Sozin's Comet, Part 2",
  "3.20": "Sozin's Comet, Part 3",
  "3.21": "Sozin's Comet, Part 4",
};
const shortEp = (ep?: string) => {
  if (!ep) return "Your story";
  const [book, ch] = ep.split(".");
  return `Book ${book}, ch. ${ch}`;
};

export const NATIONS: Nation[] = [
  {
    element: "water",
    name: "Water",
    source: "First bent by the moon",
    colors: [
      "#1B3A6B",
      "#2375B3",
      "#0D5566",
      "#5A86B8",
      "#1A8A9A",
      "#3FA0D8",
      "#28508F",
      "#4A7FA0",
    ],
    lineWidth: 3,
    placeholder: "Freezes a waterfall mid-fall",
    scenes: [
      {
        id: "w1",
        who: AANG,
        ep: "1.1",
        title: "Found frozen in an iceberg",
        note: "Katara's untrained wave cracks the ice open after a hundred years.",
      },
      {
        id: "w2",
        who: "Katara",
        ep: "1.9",
        title: "Steals the waterbending scroll",
        note: "From pirates, which goes about as well as you'd think.",
      },
      {
        id: "w3",
        who: AANG,
        ep: "1.9",
        title: "Learns the scroll's first move before her",
        note: "She does not take it well.",
      },
      { id: "w4", who: "Pakku", ep: "1.18", title: "Refuses to teach a girl" },
      {
        id: "w5",
        who: "Katara",
        merges: "Pakku",
        ep: "1.18",
        title: "Wins a place in Pakku's class",
        note: "He recognizes the necklace he once carved for Gran Gran.",
      },
      {
        id: "w6",
        who: "Yue",
        ep: "1.20",
        title: "Gives her life to the Moon Spirit",
      },
      {
        id: "w7",
        who: AANG,
        merges: "Yue",
        ep: "1.20",
        title: "Becomes one with the Ocean Spirit",
        note: "The siege of the North ends in one wave.",
      },
      {
        id: "w8",
        who: "Katara",
        ep: "2.20",
        title: "Brings Aang back with spirit water",
        note: "Water from the Spirit Oasis, saved for exactly this.",
      },
      {
        id: "w9",
        who: "Hama",
        ep: "3.8",
        title: "Reveals the secret of bloodbending",
      },
      {
        id: "w10",
        who: "Katara",
        merges: "Hama",
        ep: "3.8",
        title: "Turns bloodbending back on Hama",
        note: "The one technique she swore never to use again.",
      },
      {
        id: "w11",
        who: AANG,
        merges: "Katara",
        ep: "3.21",
        title: "Waterbends against the Phoenix King",
        note: "Everything Katara taught him, in one fight.",
      },
    ],
  },
  {
    element: "earth",
    name: "Earth",
    source: "First bent by the badgermoles",
    colors: [
      "#3E6B2A",
      "#7C8A1E",
      "#6E4B2A",
      "#2C5C4C",
      "#8C6A2E",
      "#5A8A3A",
      "#4B3A22",
      "#95A03C",
    ],
    lineWidth: 5,
    placeholder: "Surfs a rock wave down the hill",
    scenes: [
      {
        id: "e1",
        who: AANG,
        ep: "1.4",
        title: "Lands on Kyoshi Island",
        note: "A village that still trains in Avatar Kyoshi's name.",
      },
      {
        id: "e2",
        who: "Bumi",
        ep: "1.5",
        title: "Sets Aang three impossible tests",
        note: "Aang's oldest friend: a hundred and twelve, and still mad.",
      },
      {
        id: "e3",
        who: AANG,
        ep: "2.4",
        title: "Sees a blind girl in a swamp vision",
      },
      {
        id: "e4",
        who: "Toph",
        ep: "2.6",
        title: "Wins Earth Rumble Six as the Blind Bandit",
        note: "Undefeated, and nobody in the arena knew she was blind.",
      },
      {
        id: "e5",
        who: AANG,
        merges: "Toph",
        ep: "2.6",
        title: "Finds his earthbending teacher",
        note: "She ran away from home to teach him.",
      },
      {
        id: "e6",
        who: AANG,
        ep: "2.9",
        title: "Stands his ground against a boulder",
        note: "Earth is the opposite of air. He had to stop dodging.",
      },
      {
        id: "e7",
        who: "Long Feng",
        ep: "2.14",
        title: "Runs Ba Sing Se from the shadows",
        note: "There is no war within the walls.",
      },
      {
        id: "e8",
        who: "Long Feng",
        ep: "2.17",
        title: "Brainwashes Jet under Lake Laogai",
      },
      {
        id: "e9",
        who: "Toph",
        ep: "2.19",
        title: "Invents metalbending inside a cage",
        note: "Metal is only earth, purified. Nobody had noticed.",
      },
      {
        id: "e10",
        who: "Long Feng",
        ep: "2.20",
        title: "Loses the Dai Li to Azula",
        note: "He tried to play her. She was playing him.",
      },
      {
        id: "e11",
        who: "Bumi",
        ep: "3.19",
        title: "Takes back Omashu on his own",
        note: "During the eclipse, with nobody's help.",
      },
      {
        id: "e12",
        who: AANG,
        ep: "3.21",
        title: "A rock to the old scar wakes the Avatar State",
      },
    ],
  },
  {
    element: "fire",
    name: "Fire",
    source: "First bent by the dragons",
    colors: [
      "#B3241C",
      "#D4561C",
      "#8C1B2E",
      "#C98517",
      "#E0412B",
      "#9E3A12",
      "#F07A2A",
      "#6E1420",
    ],
    lineWidth: 3,
    placeholder: "Breathes fire like a dragon",
    scenes: [
      {
        id: "f1",
        who: AANG,
        ep: "1.1",
        title: "Wakes a hundred years into the war",
        note: "The Fire Nation took the world while he was frozen.",
      },
      {
        id: "f2",
        who: "Zuko",
        ep: "1.1",
        title: "Sets out to capture the Avatar",
        note: "Banished, with his honor as the price of coming home.",
      },
      {
        id: "f3",
        who: "Iroh",
        from: "f2",
        ep: "1.1",
        title: "Follows his nephew into exile",
        note: "Tea, Pai Sho, and more patience than Zuko deserves.",
      },
      {
        id: "f4",
        who: "Jeong Jeong",
        from: "f1",
        ep: "1.16",
        title: "Gives Aang his first firebending lesson",
      },
      {
        id: "f5",
        who: AANG,
        merges: "Jeong Jeong",
        ep: "1.16",
        title: "Burns Katara and swears off fire",
        note: "One lesson was enough to scare him off it for a year.",
      },
      {
        id: "f6",
        who: "Azula",
        ep: "2.1",
        title: "Is sent to bring her brother home",
        note: "She was lying about that part.",
      },
      {
        id: "f7",
        who: "Zuko",
        merges: "Iroh",
        ep: "2.9",
        title: "Learns to redirect lightning from Iroh",
        note: "A technique Iroh built by studying waterbenders.",
      },
      {
        id: "f8",
        who: "Azula",
        ep: "2.20",
        title: "Takes Ba Sing Se without a siege",
        note: "Iroh spent six hundred days outside those walls. She walked in.",
      },
      {
        id: "f9",
        who: "Zuko",
        ep: "2.20",
        title: "Chooses his sister over his uncle",
      },
      {
        id: "f10",
        who: "Zuko",
        ep: "3.11",
        title: "Faces his father during the eclipse",
        note: "Then leaves to teach the Avatar.",
      },
      {
        id: "f11",
        who: AANG,
        merges: "Zuko",
        ep: "3.12",
        title: "Takes Zuko on as his firebending teacher",
      },
      {
        id: "f12",
        who: "Ran and Shaw",
        ep: "3.13",
        title: "The last dragons judge Aang and Zuko",
        note: "Fire as energy and life, not rage.",
      },
      {
        id: "f13",
        who: AANG,
        merges: "Ran and Shaw",
        ep: "3.13",
        title: "Firebends again, without fear",
      },
      {
        id: "f14",
        who: "Azula",
        ep: "3.21",
        title: "Loses the Agni Kai",
        note: "Zuko and Katara, against a comet-powered Azula.",
      },
    ],
  },
  {
    element: "air",
    name: "Air",
    source: "First bent by the sky bison",
    // Dusk sky: lavender to violet, well clear of Fire's oranges.
    colors: [
      "#5E4FA2",
      "#8A6FC0",
      "#9C6BA8",
      "#4B4A94",
      "#A884C9",
      "#7266C4",
      "#7E4F9E",
      "#6C7DC0",
    ],
    lineWidth: 2.5,
    placeholder: "Rides an air scooter around Appa",
    scenes: [
      {
        id: "a1",
        who: AANG,
        ep: "1.12",
        title: "Earns his master tattoos at twelve",
        note: "The youngest airbending master of his time.",
      },
      {
        id: "a2",
        who: "Gyatso",
        ep: "1.12",
        title: "Is forbidden to keep teaching Aang",
        note: "Aang runs away that night, into the storm.",
      },
      {
        id: "a3",
        who: AANG,
        merges: "Gyatso",
        ep: "1.3",
        title: "Finds Gyatso, and the Avatar State",
        note: "The Southern Air Temple, a hundred years too late.",
      },
      {
        id: "a4",
        who: "Appa",
        ep: "2.11",
        title: "Is stolen in the Si Wong Desert",
      },
      {
        id: "a5",
        who: "Appa",
        ep: "2.16",
        title: "Is sent to Ba Sing Se by Guru Pathik",
      },
      {
        id: "a6",
        who: AANG,
        merges: "Appa",
        ep: "2.17",
        title: "Finds Appa under Lake Laogai",
      },
      {
        id: "a7",
        who: "Guru Pathik",
        ep: "2.19",
        title: "Opens six of Aang's seven chakras",
        note: "The seventh asks him to let go of Katara.",
      },
      {
        id: "a8",
        who: AANG,
        merges: "Guru Pathik",
        ep: "2.19",
        title: "Walks away from the seventh chakra",
        note: "Katara was in danger. He chose her.",
      },
      {
        id: "a9",
        who: "Lion Turtle",
        ep: "3.20",
        title: "Teaches Aang energybending",
        note: "Bend the energy within a person, not the elements around them.",
      },
      {
        id: "a10",
        who: AANG,
        merges: "Lion Turtle",
        ep: "3.21",
        title: "Takes Ozai's bending, spares his life",
        note: "An airbender's answer: nobody had to die.",
      },
    ],
  },
];

export function lineColors(nation: Nation, scenes: Scene[]) {
  const colors = new Map<string, string>();
  scenes.forEach(({ who }) => {
    if (!colors.has(who))
      colors.set(who, nation.colors[colors.size % nation.colors.length]);
  });
  return colors;
}

// ---------------------------------------------------------------------------
// Lines: a cartoon ink outline, then each element moves its own way.

const flow = (edge: EdgeProps, className: string) => ({
  d: edge.d,
  fill: "none",
  className: `av-flow ${className}`,
  style: {
    "--d": `${edge.delay}ms`,
    "--t": `${edge.duration}ms`,
    // Added live: no waiting for the opening sequence.
    ...(edge.added ? { "--o": "0ms" } : {}),
  } as React.CSSProperties,
});

function makeEdge(element: Bending, aangColor: string) {
  return function Edge(edge: EdgeProps) {
    const hooks = edgeHooks(edge);
    const w = edge.strokeWidth;
    const aang = edge.stroke === aangColor;
    return (
      <g className={aang ? "av-line av-aang" : "av-line"}>
        {aang && (
          <path
            {...flow(edge, "av-tattoo")}
            stroke="#5FC4FF"
            strokeWidth={w + 12}
            strokeLinecap="round"
          />
        )}
        {element === "fire" && (
          <g className="av-flicker">
            <path {...hooks} strokeWidth={w * 4} opacity={0.3} />
          </g>
        )}
        <path
          {...hooks}
          stroke="var(--ink)"
          strokeWidth={w + 3.5}
          strokeLinecap={element === "earth" ? "butt" : "round"}
        />
        <path
          {...hooks}
          strokeWidth={w}
          strokeLinecap={element === "earth" ? "butt" : "round"}
        />
        {element === "fire" && (
          <path
            {...flow(edge, "av-sparks")}
            stroke="#FFD566"
            strokeWidth={w * 0.8}
            strokeLinecap="round"
            strokeDasharray="0.1 30"
          />
        )}
        {aang && (
          // Chi runs down Aang's line in every nation, segment after segment.
          <path
            {...flow(edge, "av-chi")}
            stroke="#fff"
            strokeWidth={w * 0.7 + 1}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="0.1 2"
          />
        )}
        {element === "water" && (
          <path
            {...flow(edge, "av-current")}
            stroke="#fff"
            strokeOpacity={0.75}
            strokeWidth={w * 0.5}
            strokeLinecap="round"
            strokeDasharray="8 18"
          />
        )}
        {element === "earth" && (
          <>
            {/* Seams split the line into stone blocks. */}
            <path
              d={edge.d}
              fill="none"
              stroke="var(--ink)"
              strokeWidth={w}
              strokeDasharray="1.5 16"
            />
            {/* Pebbles tumble down, and Toph's seismic sense pulses through. */}
            <path
              {...flow(edge, "av-rocks")}
              stroke="#F3E3BC"
              strokeWidth={w * 0.45}
              strokeLinecap="square"
              strokeDasharray="0.1 34"
            />
            <path
              {...flow(edge, "av-pulse")}
              stroke="#fff"
              strokeWidth={w * 0.6}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="0.12 2"
            />
          </>
        )}
        {element === "air" && (
          <>
            <path
              {...flow(edge, "av-wind")}
              stroke="#fff"
              strokeWidth={w * 1.1}
              strokeLinecap="round"
              strokeDasharray="0.1 22"
            />
            <path
              {...flow(edge, "av-wind av-gust")}
              stroke="#fff"
              strokeOpacity={0.6}
              strokeWidth={w * 0.6}
              strokeLinecap="round"
              strokeDasharray="10 40"
            />
          </>
        )}
      </g>
    );
  };
}

// ---------------------------------------------------------------------------
// Symbols, drawn in a 24 x 24 box centered on (DOT, DOT).

const SPIRAL = Array.from({ length: 48 }, (_, i) => {
  const t = (i / 47) * 3.3 * Math.PI;
  const r = 1 + t;
  return `${i ? "L" : "M"}${(DOT + r * Math.cos(t)).toFixed(2)},${(DOT + r * Math.sin(t)).toFixed(2)}`;
}).join("");

export function Shape({ element }: { element: Bending | "avatar" | "star" }) {
  switch (element) {
    case "water":
      return (
        <>
          <path
            className="av-fill"
            d="M12 1.5C12 1.5 4.5 10 4.5 15a7.5 7.5 0 0 0 15 0C19.5 10 12 1.5 12 1.5Z"
          />
          <path className="av-shine" d="M8.3 15.2a3.8 3.8 0 0 0 2.6 3.6" />
        </>
      );
    case "earth":
      return (
        <>
          <path
            className="av-fill"
            d="M6 3L17 2.5L22 10.5L19 20.5L7 21.5L2 12Z"
          />
          <path
            className="av-facet"
            d="M6 3L11 11L19 20.5M11 11L22 10.5M11 11L2 12"
          />
        </>
      );
    case "fire":
      return (
        <>
          <path
            className="av-fill"
            d="M12 1c1.5 4 7 6.5 7 13a7 7 0 0 1-14 0c0-3.5 2-5.5 3.5-7.5.3 2.2 1.3 3.5 2.5 4C11 7 11 4 12 1Z"
          />
          <path
            className="av-core"
            d="M12 11c1 2 3.5 3 3.5 5.5a3.5 3.5 0 0 1-7 0c0-1.8 1.8-3 3.5-5.5Z"
          />
        </>
      );
    case "air":
      return (
        <>
          <circle className="av-disc" cx={DOT} cy={DOT} r={11.5} />
          <path className="av-swirl-ink" d={SPIRAL} />
          <path className="av-swirl" d={SPIRAL} />
        </>
      );
    case "avatar":
      // Aang's arrow.
      return (
        <>
          <circle className="av-disc" cx={DOT} cy={DOT} r={11.5} />
          <path
            className="av-fill av-arrow"
            d="M12 2.5L19 11H15V21.5H9V11H5Z"
          />
        </>
      );
    case "star":
      return (
        <path
          className="av-fill"
          d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.6 5.6 21.1 7 14l-5.3-5 7.2-.9Z"
        />
      );
  }
}

function Glyph(props: {
  element: Bending;
  color: string;
  /** A merge: someone's line joins another. */
  big: boolean;
  index: number;
  label: string;
  onSelect: () => void;
}) {
  const scale = props.big ? 1.35 : 1.1;
  return (
    <g
      className={`av-glyph av-${props.element}`}
      style={{ color: props.color, "--i": props.index } as React.CSSProperties}
      tabIndex={0}
      role="button"
      aria-label={props.label}
      onClick={(e) => {
        e.stopPropagation();
        props.onSelect();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        props.onSelect();
      }}
    >
      <circle className="av-hit" cx={DOT} cy={DOT} r={18} />
      <circle className="av-ring" cx={DOT} cy={DOT} r={props.big ? 22 : 18} />
      {props.element === "water" && (
        <circle className="av-ripple" cx={DOT} cy={DOT + 3} r={10} />
      )}
      {props.big && <circle className="av-seal" cx={DOT} cy={DOT} r={17} />}
      <g
        transform={`translate(${DOT} ${DOT}) scale(${scale}) translate(${-DOT} ${-DOT})`}
      >
        <g className="av-pop">
          <g className="av-idle">
            <Shape element={props.element} />
          </g>
        </g>
      </g>
      {props.element === "fire" &&
        [0, 1, 2].map((k) => (
          <circle
            key={k}
            className="av-ember"
            cx={DOT + (k - 1) * 4}
            cy={DOT - 8}
            r={1.8}
            style={{ "--k": k } as React.CSSProperties}
          />
        ))}
    </g>
  );
}

/** A scene on a little scroll: paper between two rods, with a hard shadow. */
function Scroll(props: { scene: Scene; color: string; onSelect: () => void }) {
  const { scene } = props;
  const ep = shortEp(scene.ep);
  const whoW = textWidth(scene.who, FONT_SMALL);
  const w =
    Math.max(
      textWidth(scene.title, FONT_TITLE),
      12 + whoW + 14 + textWidth(ep, FONT_SMALL),
    ) + 34;
  return (
    <g
      className={scene.mine ? "av-scroll av-mine" : "av-scroll"}
      style={{ color: props.color }}
      onClick={(e) => {
        e.stopPropagation();
        props.onSelect();
      }}
    >
      <rect
        className="av-shadow"
        x={8}
        y={DOT - 21}
        width={w}
        height={48}
        rx={9}
      />
      <rect
        className="av-paper"
        x={4}
        y={DOT - 24}
        width={w}
        height={48}
        rx={9}
      />
      <rect className="av-rod" y={DOT - 28} width={9} height={56} rx={4.5} />
      <rect
        className="av-rod"
        x={w - 1}
        y={DOT - 28}
        width={9}
        height={56}
        rx={4.5}
      />
      <text className="av-title" x={20} y={DOT - 8} dominantBaseline="central">
        {scene.title}
      </text>
      <circle className="av-who-dot" cx={24} cy={DOT + 11} r={4} />
      <text className="av-meta" x={32} y={DOT + 11} dominantBaseline="central">
        {scene.who}
        <tspan dx={14} className={scene.mine ? "av-yours" : undefined}>
          {ep}
        </tspan>
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// A nation's graph, with a way to add scenes live.

export interface NationGraph {
  core: GitgraphCore<Node>;
  edge: (edge: EdgeProps) => Node;
  add: (scene: Scene) => void;
}

export function buildNation(
  nation: Nation,
  onSelect: (id: string) => void,
): NationGraph {
  const core = new GitgraphCore<Node>({
    template: templateExtend(TemplateName.Metro, {
      colors: nation.colors,
      branch: {
        lineWidth: nation.lineWidth,
        spacing: 44,
        // The name is on every scroll.
        label: { display: false },
      },
      commit: {
        spacing: 72,
        dot: { size: DOT },
        message: { displayHash: false, displayAuthor: false },
      },
    }),
    // Stories read top to bottom.
    orientation: Orientation.VerticalReverse,
    author: AANG,
  });
  const api = core.getUserApi();
  const lines = new Map<string, Branch>();
  const scenes: Scene[] = [];

  const add = (scene: Scene) => {
    scenes.push(scene);
    const color = lineColors(nation, scenes).get(scene.who)!;
    let line = lines.get(scene.who);
    if (!line) {
      const options = { name: scene.who, style: { color } };
      const aang = lines.get(AANG);
      line =
        scene.from || !aang
          ? api.branch({ ...options, from: scene.from })
          : aang.branch(options);
      lines.set(scene.who, line);
    }
    const select = () => onSelect(scene.id);
    const index = scenes.length;
    const commitOptions = {
      hash: scene.id,
      subject: scene.title,
      style: { dot: { color } },
      renderDot: () => (
        <Glyph
          element={nation.element}
          color={color}
          big={!!scene.merges}
          index={index}
          label={`${scene.title}, ${scene.who}, ${shortEp(scene.ep)}`}
          onSelect={select}
        />
      ),
      renderMessage: () => (
        <Scroll scene={scene} color={color} onSelect={select} />
      ),
    };
    if (scene.merges) line.merge({ branch: scene.merges, commitOptions });
    else line.commit(commitOptions);
  };

  nation.scenes.forEach(add);
  return { core, add, edge: makeEdge(nation.element, nation.colors[0]) };
}

// ---------------------------------------------------------------------------
// Effects: particles and floating text in screen space.

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function burst(
  x: number,
  y: number,
  kind: Bending | "avatar",
  count = 16,
) {
  const layer = document.getElementById("fx");
  if (!layer || reduced()) return;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = 36 + Math.random() * (kind === "air" ? 90 : 60);
    let dx = Math.cos(a) * dist;
    let dy = Math.sin(a) * dist;
    // Embers rise, rocks and water fall.
    if (kind === "fire") dy = -Math.abs(dy) - 30;
    if (kind === "earth" || kind === "water") dy += 60;
    const p = document.createElement("i");
    p.className = `p p-${kind}`;
    p.style.cssText = `left:${x}px;top:${y}px;--dx:${dx}px;--dy:${dy}px;--r:${(Math.random() - 0.5) * 720}deg;--s:${0.6 + Math.random() * 0.9};animation-delay:${Math.random() * 90}ms`;
    p.addEventListener("animationend", () => p.remove());
    layer.append(p);
  }
}

export function floatText(x: number, y: number, text: string, color: string) {
  const layer = document.getElementById("fx");
  if (!layer || reduced()) return;
  const t = document.createElement("b");
  t.className = "xp-float";
  t.textContent = text;
  t.style.cssText = `left:${x}px;top:${y}px;--c:${color}`;
  t.addEventListener("animationend", () => t.remove());
  layer.append(t);
}
