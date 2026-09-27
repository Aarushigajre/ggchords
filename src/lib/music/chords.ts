/**
 * Chord qualities as interval sets.
 *
 * A quality is nothing but a list of semitone offsets from the root. Storing
 * it this way means adding a new chord type is one line in a table, and every
 * downstream consumer (shape generation, numeral analysis, audio, reharmonization)
 * works for free.
 */

import { type PitchClass, pc, sharpName } from "./notes";
import type { Shape } from "./fretboard";

export type Quality =
  | "maj"
  | "min"
  | "dim"
  | "aug"
  | "sus2"
  | "sus4"
  | "dom7"
  | "maj7"
  | "min7"
  | "min7b5"
  | "dim7"
  | "maj9"
  | "min9"
  | "dom9"
  | "add9"
  | "add13"
  | "dom7sus4"
  | "dom7b9"
  | "dom7sharp9"
  | "dom7sharp5"
  | "dom7b5"
  | "min11"
  | "maj13"
  | "dom13";

/** Suffix used when writing the chord symbol. Empty for plain triads. */
export const QUALITY_SUFFIX: Record<Quality, string> = {
  maj: "",
  min: "m",
  dim: "dim",
  aug: "aug",
  sus2: "sus2",
  sus4: "sus4",
  dom7: "7",
  maj7: "maj7",
  min7: "m7",
  min7b5: "m7b5",
  dim7: "dim7",
  maj9: "maj9",
  min9: "m9",
  dom9: "9",
  add9: "add9",
  add13: "add13",
  dom7sus4: "7sus4",
  dom7b9: "7b9",
  dom7sharp9: "7#9",
  dom7sharp5: "7#5",
  dom7b5: "7b5",
  min11: "m11",
  maj13: "maj13",
  dom13: "13",
};

export const QUALITY_LABEL: Record<Quality, string> = {
  maj: "major",
  min: "minor",
  dim: "diminished",
  aug: "augmented",
  sus2: "sus2",
  sus4: "sus4",
  dom7: "dominant 7th",
  maj7: "major 7th",
  min7: "minor 7th",
  min7b5: "half-diminished",
  dim7: "diminished 7th",
  maj9: "major 9th",
  min9: "minor 9th",
  dom9: "dominant 9th",
  add9: "add 9",
  add13: "add 13",
  dom7sus4: "7sus4",
  dom7b9: "7b9",
  dom7sharp9: "7#9",
  dom7sharp5: "7#5",
  dom7b5: "7b5",
  min11: "m11",
  maj13: "major 13th",
  dom13: "dominant 13th",
};

/** Intervals from the root, in semitones, excluding the root itself. */
export const QUALITY_INTERVALS: Record<Quality, number[]> = {
  maj: [4, 7],
  min: [3, 7],
  dim: [3, 6],
  aug: [4, 8],
  sus2: [2, 7],
  sus4: [5, 7],
  dom7: [4, 7, 10],
  maj7: [4, 7, 11],
  min7: [3, 7, 10],
  min7b5: [3, 6, 10],
  dim7: [3, 6, 9],
  maj9: [4, 7, 11, 14],
  min9: [3, 7, 10, 14],
  dom9: [4, 7, 10, 14],
  add9: [4, 7, 14],
  add13: [4, 7, 21],
  dom7sus4: [5, 7, 10],
  dom7b9: [4, 7, 10, 13],
  dom7sharp9: [4, 7, 10, 15],
  dom7sharp5: [4, 8, 10],
  dom7b5: [4, 6, 10],
  min11: [3, 7, 10, 14, 17],
  maj13: [4, 7, 11, 14],
  dom13: [4, 7, 10, 14],
};

/** Chord tones (including the root) as pitch classes, relative to root 0. */
export function qualityPitchClasses(quality: Quality): Set<PitchClass> {
  return new Set([0, ...QUALITY_INTERVALS[quality]].map(pc));
}

/**
 * The tones a shape must actually contain.
 *
 * Once a chord has a seventh, the fifth is optional. This is not a
 * simplification, it is how these chords are played: x32310 is the standard
 * open C7 and it spells C-E-Bb with no G at all, because the 5th is the note
 * that makes a chord sound thin when it doubles the root. Requiring the 5th
 * would exclude the shape every beginner is taught.
 *
 * For triads, where there is nothing else to imply the harmony, the 5th is
 * required.
 */
export function requiredPitchClasses(quality: Quality): Set<PitchClass> {
  const intervals = QUALITY_INTERVALS[quality];
  const hasSeventh =
    intervals.includes(9) || intervals.includes(10) || intervals.includes(11);
  const out = new Set<PitchClass>([0]);
  for (const interval of intervals) {
    // 7 is the perfect 5th, 6 the diminished 5th. Both are droppable once a
    // 7th is present.
    if (hasSeventh && (interval === 7 || interval === 6)) continue;
    out.add(pc(interval));
  }
  return out;
}

/** How many notes this quality nominally contains, root included. */
export function qualityNoteCount(quality: Quality): number {
  return QUALITY_INTERVALS[quality].length + 1;
}

/**
 * A chord: a root pitch class, a quality, and optionally a bass note.
 * The bass is what makes `C/E` different from `C`, and the shape generator
 * treats it as a hard constraint.
 */
export interface ChordSpec {
  root: PitchClass;
  quality: Quality;
  /** Slash-chord bass. Defaults to the root. */
  bass?: PitchClass;
}

/** The set of pitch classes a chord can use, ignoring the bass requirement. */
export function chordPitchClasses(chord: ChordSpec): Set<PitchClass> {
  const out = new Set<PitchClass>([chord.root]);
  for (const interval of QUALITY_INTERVALS[chord.quality]) {
    out.add(pc(chord.root + interval));
  }
  return out;
}

/** The required bass pitch class, i.e. the slash note if present. */
export function bassPitchClass(chord: ChordSpec): PitchClass {
  return chord.bass ?? chord.root;
}

/** Is this a dominant-functioning quality (wants to resolve down a fifth)? */
export function isDominant(quality: Quality): boolean {
  return (
    quality === "dom7" ||
    quality === "dom9" ||
    quality === "dom13" ||
    quality === "dom7sus4" ||
    quality === "dom7b9" ||
    quality === "dom7sharp9" ||
    quality === "dom7sharp5" ||
    quality === "dom7b5"
  );
}

export function isMinorQuality(quality: Quality): boolean {
  return (
    quality === "min" ||
    quality === "min7" ||
    quality === "min9" ||
    quality === "min11" ||
    quality === "min7b5"
  );
}

/**
 * Strip a chord quality down to its plain triad. This is the single most
 * useful operation for a beginner: `Dm7` and `Dm` and `D` all reduce to a
 * D minor triad, and a beginner can play the simplest one.
 */
export function simplifyToTriad(chord: ChordSpec): ChordSpec {
  return { root: chord.root, quality: triadOf(chord.quality), bass: chord.bass };
}

/** The triad implied by a chord quality. */
export function triadOf(quality: Quality): Quality {
  const intervals = QUALITY_INTERVALS[quality];
  if (intervals.includes(11)) return "maj"; // has a major 7th
  if (intervals.includes(3)) {
    return intervals.includes(6) ? "dim" : "min";
  }
  if (intervals.includes(6)) return "dim";
  if (intervals.includes(8)) return "aug";
  return "maj";
}

/** Write a chord symbol, e.g. `C`, `Am`, `F#m7b5`, `C/E`. */
export function chordSymbol(
  chord: ChordSpec,
  spelling: (p: PitchClass) => string = sharpName,
): string {
  const suffix = QUALITY_SUFFIX[chord.quality];
  const root = spelling(chord.root);
  if (chord.bass !== undefined && chord.bass !== chord.root) {
    return `${root}${suffix}/${spelling(chord.bass)}`;
  }
  return `${root}${suffix}`;
}

/**
 * Parse a chord symbol like `C`, `Am`, `F#m7b5`, `Bb7`, `C/E`, `G7sus4`.
 * Returns null rather than throwing, because this runs on live user input
 * in an editable field and must never blow up a render.
 */
export function parseChordSymbol(symbol: string): ChordSpec | null {
  const raw = symbol.trim();
  if (!raw) return null;

  // Slash bass first, so the main symbol is clean.
  const slashIndex = raw.indexOf("/");
  let main = raw;
  let bassPart: string | null = null;
  if (slashIndex > 0) {
    main = raw.slice(0, slashIndex);
    bassPart = raw.slice(slashIndex + 1);
  }

  const match = /^([A-Ga-g])([#b♯♭]?)(.*)$/.exec(main);
  if (!match) return null;
  const [, letter, accidental, rest] = match;

  const LETTER_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let root = LETTER_SEMITONES[letter.toUpperCase()];
  if (accidental === "#" || accidental === "♯") root += 1;
  if (accidental === "b" || accidental === "♭") root -= 1;
  root = pc(root);

  const quality = parseQualitySuffix(rest ?? "");
  if (!quality) return null;

  let bass: PitchClass | undefined;
  if (bassPart !== null) {
    // An empty or malformed bass ("C/", "C/Z") makes the whole symbol invalid.
    // `bassPart` can be "" which is falsy, so check for null explicitly.
    const bassMatch = /^([A-Ga-g])([#b♯♭]?)$/.exec(bassPart.trim());
    if (!bassMatch) return null;
    const [, bassLetter, bassAccidental] = bassMatch;
    let value = LETTER_SEMITONES[bassLetter.toUpperCase()];
    if (bassAccidental === "#" || bassAccidental === "♯") value += 1;
    if (bassAccidental === "b" || bassAccidental === "♭") value -= 1;
    bass = pc(value);
  }

  return { root, quality, bass };
}

/**
 * Map an arbitrary quality suffix to a Quality. Handles the common written
 * forms including the unicode accidentals people paste in.
 */
export function parseQualitySuffix(suffix: string): Quality | null {
  const s = suffix.trim().replace(/♯/g, "#").replace(/♭/g, "b").replace(/°/g, "dim");
  if (s === "" || s === "maj" || s === "M") return "maj";
  if (s === "m" || s === "min" || s === "-" || s === "mi") return "min";
  if (s === "dim" || s === "o") return "dim";
  if (s === "dim7" || s === "o7") return "dim7";
  if (s === "m7b5" || s === "min7b5" || s === "-7b5" || s === "ø" || s === "ø7")
    return "min7b5";
  if (s === "aug" || s === "+") return "aug";
  if (s === "sus2") return "sus2";
  if (s === "sus" || s === "sus4") return "sus4";
  if (s === "7sus4" || s === "7sus") return "dom7sus4";
  if (s === "7sus2") return "dom7"; // closest available
  if (s === "maj7" || s === "M7" || s === "Δ" || s === "Δ7") return "maj7";
  if (s === "m7" || s === "min7" || s === "-7") return "min7";
  if (s === "m9" || s === "min9" || s === "-9") return "min9";
  if (s === "m11" || s === "min11") return "min11";
  if (s === "6" || s === "maj6") return "maj";
  if (s === "m6") return "min";
  if (s === "69") return "add9";
  if (s === "9") return "dom9";
  if (s === "maj9" || s === "M9" || s === "Δ9") return "maj9";
  if (s === "13") return "dom13";
  if (s === "maj13" || s === "M13") return "maj13";
  if (s === "add9") return "add9";
  if (s === "add13" || s === "add6") return "add13";
  if (s === "7b9") return "dom7b9";
  if (s === "7#9") return "dom7sharp9";
  if (s === "7#5" || s === "7+5") return "dom7sharp5";
  if (s === "7b5") return "dom7b5";
  if (s === "7") return "dom7";
  return null;
}

/** All qualities, for UI pickers. */
export const ALL_QUALITIES = Object.keys(QUALITY_SUFFIX) as Quality[];

/** Chord shape carrying both the spec and the frets, for convenience. */
export interface Voicing {
  chord: ChordSpec;
  shape: Shape;
}
