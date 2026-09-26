import * as React from "react";

// A pan-and-zoom surface: drag to move, wheel (or pinch on a trackpad) to
// zoom around the pointer. Children are drawn in canvas space; overlays
// (popovers) sit in screen space on top.

export interface View {
  x: number;
  y: number;
  k: number;
}

export interface CanvasHandle {
  fit: () => void;
  zoomBy: (factor: number) => void;
  /** Glide so this element sits in the open part of the screen. */
  reveal: (el: Element) => void;
  /** Glide and zoom so this element fills the open part of the screen. */
  frame: (el: Element) => void;
}

const MIN = 0.25;
const MAX = 2.5;
const clamp = (k: number) => Math.min(MAX, Math.max(MIN, k));

export const Canvas = React.forwardRef<
  CanvasHandle,
  {
    children: React.ReactNode;
    overlay: (
      viewport: React.RefObject<HTMLDivElement>,
      view: View,
    ) => React.ReactNode;
    /** Pixels on the right covered by floating UI (the deck). */
    inset: number;
    /** Pixels on the left covered by floating UI (the quest HUD). */
    insetLeft?: number;
    onView?: (view: View) => void;
    onBackgroundClick?: () => void;
  }
>(function Canvas(props, ref) {
  const viewport = React.useRef<HTMLDivElement>(null);
  const layer = React.useRef<HTMLDivElement>(null);
  const [view, setView] = React.useState<View>({ x: 0, y: 0, k: 1 });
  const [glide, setGlide] = React.useState(false);
  const drag = React.useRef<{
    x: number;
    y: number;
    sx: number;
    sy: number;
    id: number;
    moved: boolean;
  } | null>(null);
  const justDragged = React.useRef(false);

  const animateTo = (next: View) => {
    setGlide(true);
    setView(next);
    setTimeout(() => setGlide(false), 650);
  };

  const open = () => {
    const r = viewport.current!.getBoundingClientRect();
    const l = props.insetLeft ?? 0;
    return { l, w: r.width - props.inset - l, h: r.height };
  };

  const fit = () => {
    const svg = layer.current?.querySelector("svg");
    if (!svg) return;
    const { l, w, h } = open();
    // Content size in layout pixels, independent of the current zoom.
    const box = svg.getBBox();
    const gw = box.x + box.width + 40;
    const gh = box.y + box.height + 40;
    // Keep text readable: never below ~0.75 (pan for the rest).
    const floor = w < 640 ? 0.7 : 0.8;
    const k = clamp(
      Math.max(floor, Math.min((w - 120) / gw, (h - 220) / gh, 1.1)),
    );
    // Room for the floating bars: top and bottom 110px.
    const x = l + Math.max(24, (w - gw * k) / 2);
    const y = gh * k < h - 220 ? (h - gh * k) / 2 : 110;
    animateTo({ k, x, y });
  };

  React.useImperativeHandle(ref, () => ({
    fit,
    frame: (el) => {
      const r = el.getBoundingClientRect();
      const vp = viewport.current!.getBoundingClientRect();
      const { l, w, h } = open();
      // The element's box in canvas space.
      const x = (r.left - vp.left - view.x) / view.k;
      const y = (r.top - vp.top - view.y) / view.k;
      const cw = r.width / view.k;
      const ch = r.height / view.k;
      const k = clamp(Math.min((w - 80) / cw, (h - 200) / ch, 1.1));
      animateTo({
        k,
        x: l + (w - cw * k) / 2 - x * k,
        y: Math.max(124, (h - ch * k) / 2) - y * k,
      });
    },
    zoomBy: (f) => {
      const { w, h } = open();
      setView((v) => zoomAt(v, w / 2, h / 2, clamp(v.k * f)));
    },
    reveal: (el) => {
      const r = el.getBoundingClientRect();
      const { l, w, h } = open();
      const inside =
        r.left > l + 40 &&
        r.right < l + w - 40 &&
        r.top > 90 &&
        r.bottom < h - 90;
      if (inside) return;
      setView((v) => {
        const next = {
          ...v,
          x: v.x + (l + w / 2 - (r.left + r.width / 2)),
          y: v.y + (h / 2 - (r.top + r.height / 2)),
        };
        setGlide(true);
        setTimeout(() => setGlide(false), 650);
        return next;
      });
    },
  }));

  React.useEffect(() => props.onView?.(view), [view]);

  // Wheel must be non-passive to keep the page from scrolling.
  React.useEffect(() => {
    const el = viewport.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      // Trackpad pinch arrives as ctrl+wheel with small deltas.
      const speed = e.ctrlKey ? 0.01 : 0.0015;
      setView((v) =>
        zoomAt(v, px, py, clamp(v.k * Math.exp(-e.deltaY * speed))),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      ref={viewport}
      className={drag.current?.moved ? "canvas dragging" : "canvas"}
      style={
        {
          "--gx": `${view.x}px`,
          "--gy": `${view.y}px`,
          "--gs": `${36 * view.k}px`,
        } as React.CSSProperties
      }
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        if ((e.target as Element).closest("button, input, .popover")) return;
        drag.current = {
          x: e.clientX - view.x,
          y: e.clientY - view.y,
          sx: e.clientX,
          sy: e.clientY,
          id: e.pointerId,
          moved: false,
        };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        if (!d.moved) {
          if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
          // Capture only once it's a drag: a plain click still reaches the star.
          d.moved = true;
          viewport.current!.setPointerCapture(d.id);
        }
        setView((v) => ({ ...v, x: e.clientX - d.x, y: e.clientY - d.y }));
      }}
      onPointerUp={() => {
        justDragged.current = !!drag.current?.moved;
        drag.current = null;
      }}
      onPointerCancel={() => (drag.current = null)}
      onClickCapture={(e) => {
        // The click that ends a drag is not a click.
        if (justDragged.current) {
          e.stopPropagation();
          justDragged.current = false;
        }
      }}
      onClick={(e) => {
        if (!(e.target as Element).closest(".sl-star, .sl-card, .popover"))
          props.onBackgroundClick?.();
      }}
    >
      <div
        ref={layer}
        className={glide ? "canvas-layer glide" : "canvas-layer"}
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
        }}
      >
        {props.children}
      </div>
      {props.overlay(viewport, view)}
    </div>
  );
});

function zoomAt(v: View, px: number, py: number, k: number): View {
  return { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
}
