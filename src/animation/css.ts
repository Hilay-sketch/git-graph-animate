export { ANIMATION_CSS };

// Fixed string: per-graph values come from `--gg-*` variables, so several
// graphs on one page don't clash. `:where()` keeps specificity at 0 so any
// user CSS wins. Reduced motion gets a static, fully drawn graph.
const ANIMATION_CSS = `
@media (prefers-reduced-motion: no-preference) {
  :where(.gg-edge) {
    /* Gap (2) longer than the path (1): nothing leaks while hidden. */
    stroke-dasharray: 1 2;
    animation: gg-draw var(--gg-duration) linear var(--gg-delay) backwards;
  }
  :where(.gg-commit) {
    animation: gg-fade var(--gg-duration) ease-out var(--gg-delay) backwards;
  }

  /* Added commit: the line speeds up into it, then the commit slams in. */
  :where(.gg-edge.gg-added) {
    animation-timing-function: cubic-bezier(0.55, 0, 1, 0.45);
  }
  :where(.gg-commit.gg-added) {
    animation-duration: 60ms;
  }
  :where(.gg-dot, .gg-ripple) {
    transform-box: fill-box;
    transform-origin: center;
  }
  :where(.gg-added .gg-dot) {
    animation: gg-slam calc(var(--gg-duration) * 2.5) linear var(--gg-delay) backwards;
  }
  :where(.gg-ripple) {
    animation: gg-ripple calc(var(--gg-duration) * 7 / 3) cubic-bezier(0.16, 1, 0.3, 1) var(--gg-delay) backwards;
  }
  :where(.gg-ripple + .gg-ripple) {
    --gg-ripple-scale: 12;
    animation-duration: calc(var(--gg-duration) * 10 / 3);
    animation-delay: calc(var(--gg-delay) + var(--gg-duration) * 0.27);
  }
}
/* Rings only show while animating. */
:where(.gg-ripple) { opacity: 0; pointer-events: none; }
@keyframes gg-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes gg-fade { from { opacity: 0; } }
@keyframes gg-slam {
  0% { transform: scale(0); filter: brightness(3); animation-timing-function: cubic-bezier(0.2, 0.9, 0.3, 1); }
  14% { transform: scale(2.6); filter: brightness(2.2); animation-timing-function: ease-in-out; }
  34% { transform: scale(0.72); filter: brightness(1.4); animation-timing-function: ease-in-out; }
  54% { transform: scale(1.18); filter: brightness(1); animation-timing-function: ease-in-out; }
  74% { transform: scale(0.94); animation-timing-function: ease-in-out; }
  100% { transform: scale(1); }
}
@keyframes gg-ripple {
  from { opacity: 0.9; transform: scale(1); stroke-width: 6px; }
  to { opacity: 0; transform: scale(var(--gg-ripple-scale, 7)); stroke-width: 0; }
}
`;
