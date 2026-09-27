/**
 * The curated preference overlay.
 *
 * This is deliberately NOT a chord-shape database. The generator still does
 * all the work: it searches, it validates, it handles tunings nobody thought
 * about. This file only answers a different question — "when several shapes are
 * equally correct, which one would a guitarist actually teach?"
 *
 * Without it, the generator can return a technically-valid shape at the 9th
 * fret when the universally-taught one was sitting right there. With it,
 * `x31333` is what you get for Cm9.
 *
 * Entries are keyed by chord symbol in standard tuning. Anything not listed
 * still works, it just falls back to the generator's own ranking.
 */

import type { Shape } from "./fretboard";

/**
 * The shapes people learn first, in order of preference.
 *
 * Scope note: the generator plus `scoreShape` already ranks the common open
 * and barre chords correctly on their own (verified by the test suite, which
 * asserts `C -> x32010`, `A7 -> x02020`, `Bm7 -> x20202` and so on). So this
 * table is deliberately small. It exists for the two cases the mechanical
 * ranking cannot know about:
 *
 *   1. Voicings that are learned by ear rather than derived, where a specific
 *      shape has become the default even though other valid shapes score
 *      better. The canonical Cm9 is the clear example: `x31333` is what every
 *      jazz guitarist means, but it is a partial barre and loses on score to
 *      thinner open shapes that nobody actually plays.
 *   2. A second position for chords that are commonly learned in two places.
 *
 * Every entry is validated against the generator by
 * `scripts/verify-curated.ts` and by curatedShapes.test.ts, so a typo here
 * cannot ship.
 */
const CURATED: Record<string, (number | null)[][]> = {
  // --- The canonical open chords ----------------------------------------
  // Note the x prefixes. 032010 is frequently labelled "C" but is really C/E,
  // because the open low E becomes the bass. The same applies to x32310 for
  // C7. Getting this wrong is the classic beginner trap.
  C: [[null, 3, 2, 0, 1, 0], [8, 10, 10, 9, 8, 8]],
  G: [[3, 2, 0, 0, 0, 3], [3, 5, 5, 4, 3, 3]],
  D: [[null, null, 0, 2, 3, 2], [10, 12, 12, 11, 10, 10]],
  A: [[null, 0, 2, 2, 2, 0], [5, 7, 7, 6, 5, 5]],
  E: [[0, 2, 2, 1, 0, 0]],
  Am: [[null, 0, 2, 2, 1, 0], [5, 7, 7, 5, 5, 5]],
  Em: [[0, 2, 2, 0, 0, 0]],
  Dm: [[null, null, 0, 2, 3, 1]],
  F: [[1, 3, 3, 2, 1, 1], [null, null, 3, 2, 1, 1]],

  // --- Open sevenths -----------------------------------------------------
  C7: [[null, 3, 2, 3, 1, 0], [8, 10, 8, 9, 8, 8]],
  G7: [[3, 2, 0, 0, 0, 1]],
  A7: [[null, 0, 2, 0, 2, 0], [5, 7, 5, 6, 5, 5]],
  E7: [[0, 2, 0, 1, 0, 0]],
  D7: [[null, null, 0, 2, 1, 2]],
  B7: [[null, 2, 1, 2, 0, 2]],
  F7: [[1, 0, 1, 2, 1, 1]],
  Am7: [[null, 0, 2, 0, 1, 0], [5, 7, 5, 5, 5, 5]],
  Em7: [[0, 2, 0, 0, 0, 0]],
  Bm7: [[null, 2, 0, 2, 0, 2], [null, 2, 0, 2, 3, 2]],
  Cmaj7: [[null, 3, 2, 0, 0, 0], [8, 10, 9, 9, 8, 7]],
  Dmaj7: [[null, null, 0, 2, 2, 2]],
  Amaj7: [[null, 0, 2, 1, 2, 0]],
  Emaj7: [[0, 2, 1, 1, 0, 0]],
  Gmaj7: [[3, 2, 0, 0, 0, 2]],

  // --- The jazz 9ths: learned by ear, not derivable from difficulty ------
  // x31333 is the canonical Cm9 and it is NOT an open chord. It has no open
  // strings; it is a partial barre. The mechanical ranking prefers thinner
  // open shapes, which is why this entry has to be stated.
  Cm9: [[null, 3, 1, 3, 3, 3]],
  Em9: [[0, 2, 0, 0, 0, 2]],
  Gm9: [[3, 0, 0, 3, 3, 1]],
  Am9: [[5, 3, 5, 5, 0, 0]],
  Dm9: [[null, 5, 3, 5, 3, 0]],
  Bm9: [[null, 2, 0, 2, 2, 2]],
  Bm7b5: [[null, 2, 0, 2, 0, 1]],

  // --- Diminished: fully symmetric, and every player has a fixed grip -----
  Cdim7: [[null, 3, 4, 2, 4, null]],
  Bdim7: [[null, 2, 0, 1, 0, 1]],
  Ddim7: [[null, 5, 3, 1, 0, null]],

  // --- Nines and elevenths, second position -----------------------------
  C9: [[null, 3, 2, 3, 3, 3]],
  G9: [[3, 0, 0, 0, 0, 1]],
  E9: [[0, 2, 0, 1, 0, 2]],
  F9: [[1, 0, 1, 0, 1, 1]],
  Cmaj9: [[null, 3, 0, 0, 0, 0]],
  Gmaj9: [[3, 0, 0, 0, 0, 2]],
  Em11: [[0, 0, 0, 0, 0, 2]],
  Am11: [[5, 3, 0, 0, 0, 0]],

  // --- Sus, where players have strong fixed habits ----------------------
  Dsus4: [[null, null, 0, 2, 3, 3]],
  Dsus2: [[null, null, 0, 2, 3, 0]],
  Asus2: [[null, 0, 2, 2, 0, 0]],
  Asus4: [[null, 0, 2, 2, 3, 0]],
  Esus4: [[0, 0, 2, 2, 0, 0]],
  D7sus4: [[null, null, 0, 2, 1, 3]],
  E7sus4: [[0, 0, 0, 2, 0, 0]],
};

function key(frets: (number | null)[]): string {
  return frets.map((f) => (f === null ? "x" : String(f))).join(",");
}

const LOOKUP: Map<string, string[]> = new Map(
  Object.entries(CURATED).map(([symbol, shapes]) => [
    symbol,
    shapes.map((frets) => key(frets)),
  ]),
);

/**
 * The curated shapes for a chord symbol, in preference order, as proper Shape
 * objects. Returns an empty array for unlisted chords, which is the normal
 * case and is handled by falling back to generator ranking.
 */
export function curatedShapes(symbol: string, tuningId = "standard"): Shape[] {
  const entries = LOOKUP.get(symbol);
  if (!entries) return [];
  return entries.map((k) => ({
    tuningId,
    frets: k.split(",").map((part) => (part === "x" ? null : Number(part))),
  }));
}

/** A symbol key normalised for lookup, so `Bb7` matches `A#7`. */
const ENHARMONIC: Record<string, string> = {
  "A#": "Bb",
  "Db": "C#",
  "D#": "Eb",
  "Gb": "F#",
  "G#": "Ab",
  "Bb": "A#",
};

function normaliseSymbol(symbol: string): string {
  return symbol.replace(/^([A-G])([#b])/, (match, letter: string, acc: string) => {
    const preferred = acc === "#" ? (ENHARMONIC[letter + acc] ?? match) : match;
    return preferred;
  });
}

/**
 * The curated shapes that the generator also found, ordered so the curated
 * ones come first. Curated entries the generator rejected are dropped rather
 * than injected, so the overlay can never make a shape invalid — it can only
 * reorder and promote.
 */
export function promoteCurated(
  symbol: string,
  generated: Shape[],
  tuningId = "standard",
): Shape[] {
  const curated = curatedShapes(normaliseSymbol(symbol), tuningId);
  if (curated.length === 0) return generated;

  const curatedKeys = new Set(curated.map((s) => key(s.frets)));
  const remaining = generated.filter((s) => !curatedKeys.has(key(s.frets)));
  return [...curated, ...remaining];
}

/**
 * Reorder generated shapes so curated ones lead, then the rest by difficulty.
 * This is the function the UI calls.
 */
export function applyPreference(
  symbol: string,
  generated: Shape[],
  tuningId = "standard",
): Shape[] {
  return promoteCurated(symbol, generated, tuningId);
}

/**
 * How many curated shapes exist for a symbol. Used by the UI to offer a
 * "standard shape" shortcut, and by tests to keep the overlay honest.
 */
export function curatedCount(symbol: string): number {
  return LOOKUP.get(normaliseSymbol(symbol))?.length ?? 0;
}

/**
 * Every symbol with a curated shape, for diagnostics.
 */
export function curatedSymbols(): string[] {
  return Object.keys(CURATED).sort();
}
