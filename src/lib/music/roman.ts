/**
 * Roman numeral analysis.
 *
 * Numerals are always computed, never stored, so transposing a progression
 * automatically re-analyses it. The hard part is chords that are not diatonic
 * to the stated key: borrowed chords, secondary dominants, and diminished
 * passing chords all need a name that a musician would actually recognise.
 */

import { type ChordSpec, Quality, QUALITY_INTERVALS, isDominant, isMinorQuality } from "./chords";
import {
  type KeySignature,
  type PitchClass,
  MAJOR_STEPS,
  MINOR_STEPS,
  degreeName,
  pc,
  prefersSharps,
} from "./notes";

export interface NumeralResult {
  /** The numeral, e.g. "I", "viio7", "V7/IV", "bVII". */
  text: string;
  /** The diatonic degree, or null if this is a tonicisation. */
  degree: number | null;
  /** True if the chord belongs to the key's own scale. */
  diatonic: boolean;
  /** Short human explanation, shown in the UI. */
  note: string;
}

/** Triad-type qualities, mapped to their numeral case and infix. */
interface TriadForm {
  /** Roman numeral base: uppercase for major-ish, lowercase for minor-ish. */
  case: "upper" | "lower";
  /** Text inserted after the numeral: "" , "o", "+", "sus2", "sus4". */
  infix: string;
}

const TRIAD_FORMS: Partial<Record<Quality, TriadForm>> = {
  maj: { case: "upper", infix: "" },
  min: { case: "lower", infix: "" },
  dim: { case: "lower", infix: "o" },
  aug: { case: "upper", infix: "+" },
  sus2: { case: "upper", infix: "sus2" },
  sus4: { case: "upper", infix: "sus4" },
  add9: { case: "upper", infix: "add9" },
  add13: { case: "upper", infix: "add13" },
};

/** Seventh qualities, which carry an explicit seventh figure. */
const SEVENTH_SUFFIX: Partial<Record<Quality, string>> = {
  dom7: "7",
  maj7: "maj7",
  min7: "7",
  min7b5: "o7",
  dim7: "o7",
  maj9: "maj9",
  min9: "7",
  dom9: "9",
  dom13: "13",
  maj13: "maj13",
  dom7sus4: "7sus4",
  dom7b9: "7b9",
  dom7sharp9: "7#9",
  dom7sharp5: "7#5",
  dom7b5: "7b5",
  min11: "m11",
};

const ROMAN_UPPER = ["I", "II", "III", "IV", "V", "VI", "VII"];
const ROMAN_LOWER = ["i", "ii", "iii", "iv", "v", "vi", "vii"];

/** Degrees borrowed from the parallel mode, keyed by semitone from the tonic. */
const BORROWED_MAJOR: Record<number, { degree: number; name: string }> = {
  1: { degree: 1, name: "bII" }, // Neapolitan
  3: { degree: 2, name: "bIII" },
  6: { degree: 4, name: "bV" }, // also read as #IV
  8: { degree: 5, name: "bVI" },
  10: { degree: 6, name: "bVII" },
};

const BORROWED_MINOR: Record<number, { degree: number; name: string }> = {
  1: { degree: 1, name: "bII" },
  4: { degree: 1, name: "II" },
  6: { degree: 4, name: "bVI" },
  9: { degree: 5, name: "VI" },
  11: { degree: 6, name: "VII" },
};

function diatonicTriadsFor(mode: "major" | "minor"): Quality[] {
  return mode === "major"
    ? ["maj", "min", "min", "maj", "maj", "min", "dim"]
    : ["min", "dim", "maj", "min", "min", "maj", "maj"];
}

/** Semitones of a scale degree, which is not the same as the degree number. */
function degreeSemitone(key: KeySignature, degree: number): number {
  const steps = key.mode === "major" ? MAJOR_STEPS : MINOR_STEPS;
  return steps[((degree % 7) + 7) % 7];
}

/** The pitch classes of the key's own scale. */
function scalePitchClasses(key: KeySignature): Set<PitchClass> {
  const steps = key.mode === "major" ? MAJOR_STEPS : MINOR_STEPS;
  return new Set(steps.map((s) => pc(key.tonic + s)));
}

/** Which quality the key's scale puts on a given degree. */
function expectedTriad(key: KeySignature, degree: number): Quality {
  const triads = diatonicTriadsFor(key.mode);
  return triads[((degree % 7) + 7) % 7];
}

/**
 * Find the scale degree a pitch class sits on in a key.
 *
 * The subtle part, and the source of a real bug: a degree is an *index into
 * the scale*, not a semitone count. Degree 4 of a major scale is 7 semitones
 * above the tonic, not 4. Walking `tonic + degree` therefore only ever matches
 * degrees 0, 2, 4 and 5, which is what made I-V-vi-IV in C come out as
 * I-bI-bI-VI.
 */
function findDegree(
  root: PitchClass,
  key: KeySignature,
): { degree: number; diatonic: boolean; borrowedName?: string } {
  for (let d = 0; d < 7; d++) {
    if (pc(key.tonic + degreeSemitone(key, d)) === pc(root)) {
      return { degree: d, diatonic: true };
    }
  }
  const borrowed = key.mode === "major" ? BORROWED_MAJOR : BORROWED_MINOR;
  const offset = pc(root - key.tonic);
  const found = borrowed[offset];
  if (found) {
    return { degree: found.degree, diatonic: false, borrowedName: found.name };
  }
  return { degree: 0, diatonic: false };
}

/**
 * Is this chord built from the key's own scale?
 * Checked by pitch-class membership rather than by root, so a borrowed IV
 * minor (iv in a major key) is correctly identified as non-diatonic.
 */
function isChordDiatonic(chord: ChordSpec, key: KeySignature): boolean {
  const scale = scalePitchClasses(key);
  const intervals = QUALITY_INTERVALS[chord.quality];
  return [0, ...intervals].every((i) => scale.has(pc(chord.root + i)));
}

/**
 * Detect a secondary dominant: a dominant chord that resolves somewhere other
 * than the tonic, so it is written as a dominant figure over that degree's
 * numeral. D7 in C is V7/V because it pushes to G, which is V.
 *
 * The root being diatonic does not disqualify it — D on degree ii becoming
 * D7 is the defining case. What disqualifies it is being *both* diatonic and
 * the plain dominant of the key, which is just V7.
 */
function findTonicisation(
  chord: ChordSpec,
  key: KeySignature,
): { targetDegree: number } | null {
  if (!isDominant(chord.quality)) return null;

  const { degree, diatonic } = findDegree(chord.root, key);
  if (diatonic) {
    // A diatonic dominant is only a secondary dominant when the key expects a
    // *minor* triad there, because that means the third has been raised to
    // make a dominant. D7 on C's ii (Dm) is V7/V.
    //
    // When the key expects a major or diminished triad, the plain reading wins
    // and the seventh is just colour. C7 on C's I is the blues I7, not V7/IV,
    // and writing it as a tonicisation would make the 12-bar form unreadable.
    const expected = expectedTriad(key, degree);
    if (expected !== "min") return null;
  }

  // The target is a fourth above the dominant's root.
  const targetRoot = pc(chord.root + 5);
  for (let d = 0; d < 7; d++) {
    if (pc(key.tonic + degreeSemitone(key, d)) === targetRoot) {
      return { targetDegree: d };
    }
  }
  return null;
}

/** Analyse one chord within a key. */
export function analyseChord(chord: ChordSpec, key: KeySignature): NumeralResult {
  const tonicisation = findTonicisation(chord, key);
  if (tonicisation) {
    const target = tonicisation.targetDegree;
    // The target numeral takes its case from the triad the key puts on that
    // degree, so V7/ii in C has a lowercase ii because C's ii is D minor.
    const targetTriad = expectedTriad(key, target);
    const targetIsMinor = targetTriad === "min" || targetTriad === "dim";
    const targetNumeral = targetIsMinor
      ? (ROMAN_LOWER[target] ?? String(target + 1))
      : (ROMAN_UPPER[target] ?? String(target + 1));
    const dominantSuffix = SEVENTH_SUFFIX[chord.quality] ?? "7";
    return {
      text: `V${dominantSuffix}/${targetNumeral}`,
      degree: null,
      diatonic: false,
      note: `secondary dominant: functions as V of ${targetNumeral}`,
    };
  }

  const { degree, diatonic: rootIsDiatonic, borrowedName } = findDegree(chord.root, key);
  const expected = expectedTriad(key, degree);
  const actual = chord.quality;
  // "Diatonic" has to mean the whole chord, not just its root. D major has a
  // diatonic root in C but an F# that is not in the key, so it is a borrowed
  // II. Checking only the root is what made D major report as diatonic.
  const diatonic = isChordDiatonic(chord, key);
  const borrowed = !diatonic;
  // The borrowed name from findDegree is authoritative when the *root* is
  // outside the scale: it is mode-aware, so a bVI in a major key and a VI in a
  // minor key are not conflated. When only the chord's colour is borrowed, the
  // degree's own numeral still applies.
  const borrowedLabel = borrowedName ?? ROMAN_UPPER[degree];
  void rootIsDiatonic;

  // Diminished chords get a circle-degree notation.
  if (actual === "dim7" || actual === "min7b5") {
    const isFullyDim = actual === "dim7";
    const numeral = borrowed ? borrowedLabel.toLowerCase() : "vii";
    return {
      text: `${numeral}${isFullyDim ? "o7" : "ø7"}`,
      degree,
      diatonic,
      note: isFullyDim
        ? "fully diminished seventh, functions as a leading-tone chord"
        : "half-diminished seventh, common as ii in minor keys",
    };
  }

  const triadForm = TRIAD_FORMS[actual];
  if (triadForm) {
    const numeral = borrowed
      ? borrowedLabel
      : triadForm.case === "upper"
        ? ROMAN_UPPER[degree]
        : ROMAN_LOWER[degree];
    const matchesKey =
      actual === expected ||
      // A borrowed chord on a diatonic root is still worth calling out.
      false;
    return {
      text: `${numeral}${triadForm.infix}`,
      degree,
      diatonic,
      note: borrowed
        ? `borrowed from the parallel ${key.mode === "major" ? "minor" : "major"}`
        : matchesKey
          ? "diatonic"
          : `borrowed colour: expected ${expected} here`,
    };
  }

  const seventh = SEVENTH_SUFFIX[actual];
  if (seventh) {
    // dim7 and min7b5 were handled above, so everything here is a
    // non-diminished seventh.
    //
    // Casing follows the chord's function, not just its third. A dominant
    // seventh is a major chord with a minor 7th, so it takes an uppercase
    // numeral: G7 in C is V7, never v7. Only the genuinely minor sevenths go
    // lowercase.
    const upper =
      actual === "maj7" ||
      actual === "maj9" ||
      actual === "maj13" ||
      isDominant(actual);
    const numeral = borrowed
      ? borrowedLabel
      : upper
        ? ROMAN_UPPER[degree]
        : ROMAN_LOWER[degree];
    return {
      text: `${numeral}${seventh}`,
      degree,
      diatonic,
      note: borrowed ? "borrowed chord" : "diatonic seventh",
    };
  }

  return {
    text: "?",
    degree: null,
    diatonic: false,
    note: "unrecognised chord quality",
  };
}

/** Analyse a whole progression, returning numerals parallel to the chords. */
export function analyseProgression(
  chords: ChordSpec[],
  key: KeySignature,
): NumeralResult[] {
  return chords.map((chord) => analyseChord(chord, key));
}

/**
 * The conventional "I-V-vi-IV" shorthand, e.g. for search and for titles.
 * Uses upper/lower case based on quality rather than diatonic membership,
 * which is how people actually write these.
 */
export function progressionFormula(chords: ChordSpec[]): string {
  if (chords.length === 0) return "";
  // Infer the key from the first chord that looks like a tonic.
  const assumed: KeySignature = {
    tonic: chords[0].root,
    letter: "C",
    mode: isMinorQuality(chords[0].quality) ? "minor" : "major",
  };
  return analyseProgression(chords, assumed)
    .map((n) => n.text)
    .join("-");
}

/**
 * A display key signature for a key, e.g. "Eb major" / "Bm".
 * `letter` is only used when the caller knows the real spelling; otherwise
 * we infer from the key's own circle-of-fifths position.
 */
export function keyLabel(key: KeySignature): string {
  return `${key.letter} ${key.mode}`;
}

/** Build a key signature from a tonic name and mode, inferring the spelling. */
export function keyFromName(name: string, mode: "major" | "minor" = "major"): KeySignature {
  const match = /^([A-Ga-g])([#b]?)(m|min)?$/.exec(name.trim());
  if (!match) return { tonic: 0, letter: "C", mode };
  const [, letter, accidental, m] = match;
  const LETTER_SEMITONES: Record<string, number> = {
    C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
  };
  let tonic = LETTER_SEMITONES[letter.toUpperCase()];
  if (accidental === "#") tonic += 1;
  if (accidental === "b") tonic -= 1;
  return {
    tonic: pc(tonic),
    letter: `${letter.toUpperCase()}${accidental}`,
    mode: m ? "minor" : mode,
  };
}

export { prefersSharps };
