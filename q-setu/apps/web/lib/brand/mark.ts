/**
 * The Q-Setu mark: a "Q" whose bowl holds a suspension bridge (setu) over a lattice of three nodes,
 * the deck running out as the Q's tail. One source of truth for the logo, favicons and OG images.
 * 24 × 24 viewBox, stroke-only, 1.6 px at 24 px.
 */
export const MARK_PATHS = [
  // the Q's bowl
  "M12 3.2a8.8 8.8 0 1 0 0 17.6a8.8 8.8 0 0 0 0-17.6Z",
  // the bridge's arch (main cable)
  "M5.6 14.2C8 9.6 16 9.6 18.4 14.2",
  // hangers: lattice nodes tied to the deck
  "M9 11.4V14.2M12 10.3V14.2M15 11.4V14.2",
  // the deck, running out of the bowl as the Q's tail
  "M4.2 14.2H15.6L21.2 20.8",
];
