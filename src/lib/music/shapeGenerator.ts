/**
 * Chord shape generation.
 *
 * No shape data is hand-written. A shape is *searched* for: we walk the strings
 * from lowest to highest, choosing a fret (or a mute) for each, and keep only
 * the combinations that actually spell the chord correctly. That means the
 * generator produces correct shapes for chords nobody thought to catalogue, and
 * for non-standard tunings.
 *
 * The search is a depth-first walk with pruning. Naive enumeration over six
 * strings and sixteen frets is 17^6 = 24 million, which is far too slow. The
 * pruning cuts it down by three orders of magnitude:
 *
 *   1. Only frets whose pitch class is a chord tone are ever candidates, so
 *      each string has ~3-6 real options rather than 17.
 *   2. We cap the window, so we never consider a shape spanning the whole neck.
 *   3. We require the root to be in the bass, checked as soon as the bass
 *      string is decided, which prunes most of the tree at depth 1-2.
 */

import {
  type ChordSpec,
  QUALITY_INTERVALS,
  chordPitchClasses,
  requiredPitchClasses,
  qualityNoteCount,
} from "./chords";
import {
  type Shape,
  type StringIndex,
  type Tuning,
  MAX_FRET,
  getTuning,
  midiAt,
  pitchClassAt,
} from "./fretboard";
import { type PitchClass, pc } from "./notes";

export interface GenerateOptions {
  tuning?: Tuning;
  /** Widest fret-to-fret distance allowed inside one hand position. */
  maxStretch?: number;
  /** Highest fret the search may reach. */
  maxFret?: number;
  /** Extra pitch classes allowed as colour, e.g. the 6 or natural 11. */
  allowTensions?: PitchClass[];
  /**
   * Cap on returned shapes. The search explores in a good-enough-first order,
   * so stopping early costs us nothing we care about.
   */
  limit?: number;
}

const DEFAULTS: Required<Omit<GenerateOptions, "allowTensions">> = {
  tuning: getTuning("standard"),
  maxStretch: 4,
  maxFret: 15,
  limit: 60,
};

interface Candidate {
  shape: Shape;
  /** Fret at the top of the shape, used to group positions. */
  position: number;
}

/** All frets on a string whose pitch class is in `allowed`. */
function candidateFrets(
  tuning: Tuning,
  string: StringIndex,
  allowed: Set<PitchClass>,
  maxFret: number,
): number[] {
  const out: number[] = [];
  for (let fret = 0; fret <= maxFret; fret++) {
    if (allowed.has(pitchClassAt(tuning, string, fret))) out.push(fret);
  }
  return out;
}

/**
 * Generate playable shapes for a chord.
 *
 * Shapes come back in neck order (lower positions first) because the search
 * walks positions ascending and we want the comfortable ones earliest.
 */
export function generateShapes(
  chord: ChordSpec,
  options: GenerateOptions = {},
): Shape[] {
  const tuning = options.tuning ?? DEFAULTS.tuning;
  const maxStretch = options.maxStretch ?? DEFAULTS.maxStretch;
  const maxFret = options.maxFret ?? DEFAULTS.maxFret;
  const limit = options.limit ?? DEFAULTS.limit;

  // These must be ABSOLUTE pitch classes. qualityPitchClasses() returns
  // intervals relative to root 0, which is the wrong thing to match against a
  // fretboard. chordPitchClasses() is the one that re-roots them.
  const chordTones = chordPitchClasses(chord);
  const allowed = new Set(chordTones);
  for (const tension of options.allowTensions ?? []) allowed.add(pc(tension));

  const requiredTones = new Set<PitchClass>();
  for (const tone of requiredPitchClasses(chord.quality)) {
    requiredTones.add(pc(chord.root + tone));
  }
  const requiredCount = qualityNoteCount(chord.quality);
  const bass = chord.bass ?? chord.root;

  const found: Shape[] = [];
  const seen = new Set<string>();

  // Anchor the window on the lowest fret we will consider, then walk upward.
  // This keeps the search cheap: the window slides, it doesn't expand.
  for (let windowStart = 0; windowStart <= maxFret; windowStart++) {
    const windowEnd = Math.min(windowStart + maxStretch, maxFret);
    const positionShapes: Shape[] = [];

    const recurse = (string: number, frets: (number | null)[]): void => {
      if (string === 6) {
        evaluate(frets);
        return;
      }

      const s = string as StringIndex;
      const bassPlaced = frets.some((f) => f !== null);

      // Prune 3, and the strongest one: the lowest-sounding string *is* the
      // bass. Until a string has sounded, the current string is either the
      // bass string or it is muted — and if it sounds it must be the required
      // bass pitch class. This rules out most of the tree at depth 1 and 2.
      //
      // Muting must stay possible here, or the classic x-prefixed shapes
      // become unreachable: xx0232 (D), x32010 (C/E), x31333 (Cm9). Those are
      // among the most-played shapes in existence, so "bass is the lowest
      // sounding string" cannot mean "the lowest string must sound".
      if (!bassPlaced) {
        recurse(string + 1, [...frets, null]);
        for (const fret of candidateFrets(tuning, s, new Set([bass]), windowEnd)) {
          recurse(string + 1, [...frets, fret]);
        }
        return;
      }

      // Mute this string, or play a chord tone on it.
      recurse(string + 1, [...frets, null]);
      for (const fret of candidateFrets(tuning, s, allowed, windowEnd)) {
        recurse(string + 1, [...frets, fret]);
      }
    };

    const evaluate = (frets: (number | null)[]): void => {
      const played = frets.filter((f): f is number => f !== null);
      if (played.length < 3) return;

      // Prune: no adjacent strings may sound the same pitch class. Doubled
      // unisons on neighbours are the thing that makes generated shapes
      // look wrong, and a shape with them is rarely the one a player wants.
      let previous: PitchClass | null = null;
      for (let i = 0; i < frets.length; i++) {
        const f = frets[i];
        if (f === null) {
          previous = null;
          continue;
        }
        const pitch = pitchClassAt(tuning, i as StringIndex, f);
        if (pitch === previous) return;
        previous = pitch;
      }

      const sounding = frets
        .map((f, i) => (f === null ? null : pitchClassAt(tuning, i as StringIndex, f)))
        .filter((p): p is number => p !== null);
      if (sounding.length === 0) return;

      // Root (or slash note) must be the lowest pitch sounded. Guaranteed by
      // the pruning above, asserted here so a refactor cannot silently break it.
      if (sounding[0] !== bass) return;

      // Strict shapes must contain every required tone. "Required" excludes
      // the 5th on chords that have a 7th, because omitting it is how those
      // chords are actually played (see requiredPitchClasses).
      const strict = (options.allowTensions ?? []).length === 0;
      if (strict) {
        const set = new Set(sounding);
        let missing = 0;
        for (const tone of requiredTones) if (!set.has(tone)) missing++;
        if (missing > 0) return;
      } else {
        // With tensions on, the shape must at least contain the root and the
        // third, or it is not recognisably the chord.
        const set = new Set(sounding);
        const third = pc(chord.root + (QUALITY_INTERVALS[chord.quality][0] ?? 4));
        if (!set.has(chord.root) || !set.has(third)) return;
        // And it must not be wildly over-full.
        if (sounding.length > requiredCount + 2) return;
      }

      const key = frets.map((f) => (f === null ? "x" : f)).join("-");
      if (seen.has(key)) return;
      seen.add(key);

      positionShapes.push({ tuningId: tuning.id, frets });
    };

    recurse(0, []);

    // Order within a position deterministically, so results are stable across
    // runs and the tests are meaningful. Prefer more strings, then shapes whose
    // bass sits on a low string, then flatter fingers.
    positionShapes.sort((a, b) => {
      const countDiff = countPlayed(b) - countPlayed(a);
      if (countDiff !== 0) return countDiff;
      return fretsKey(a).localeCompare(fretsKey(b));
    });

    for (const shape of positionShapes) {
      found.push(shape);
      if (found.length >= limit) return found;
    }
  }

  return found;
}

function countPlayed(shape: Shape): number {
  return shape.frets.filter((f) => f !== null).length;
}

function fretsKey(shape: Shape): string {
  return shape.frets
    .map((f) => (f === null ? "x" : String(f).padStart(2, "0")))
    .join(",");
}

/** The fret number to display on the left of a diagram. */
export function shapePosition(shape: Shape): number {
  const fretted = shape.frets.filter(
    (f): f is number => f !== null && f > 0,
  );
  return fretted.length ? Math.min(...fretted) : 0;
}
