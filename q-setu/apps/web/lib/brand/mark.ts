/**
 * The QuantumLedger mark: a lattice cube. An isometric cube whose three faces are each split into a
 * 2 × 2 lattice: the structure behind ML-KEM and ML-DSA, and a block in a chain. One source of
 * truth for the logo, favicons and OG images. 24 × 24 viewBox, stroke-only, 1.6 px at 24 px.
 */
export const MARK_PATHS = [
  // the cube's silhouette and its near vertical edge
  "M12 2.8L20.2 7.4V16.6L12 21.2L3.8 16.6V7.4Z",
  "M3.8 7.4L12 12L20.2 7.4M12 12V21.2",
  // the lattice: each face divided at its midlines
  "M7.9 5.1L16.1 9.7M16.1 5.1L7.9 9.7",
  "M3.8 12L12 16.6M7.9 9.7V18.9",
  "M20.2 12L12 16.6M16.1 9.7V18.9",
];

/** The wordmark, set in the mono face. */
export const WORDMARK = "QUANTUMLEDGER";
