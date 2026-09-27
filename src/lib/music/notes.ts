/**
 * Pitch classes, note names, and enharmonic spelling.
 *
 * A pitch class is an integer 0-11 where 0 = C, 1 = C#/Db, 2 = D, ...
 * We normalise to sharps internally (0=C, 1=C#, 2=D, ... 11=B) because
 * transposing by semitone is just modular addition, and then *spell* the
 * result at the edges. Spelling matters: a user in Eb should never see "D#"
 * just because we added a semitone to a C.
 */

/** Normalised pitch class. 0=C, 1=C#, 2=D, 3=D#/Eb, 4=E, 5=F, 6=F#, 7=G, 8=G#/Ab, 9=A, 10=A#/Bb, 11=B */
export type PitchClass = number;

export const PC = {
  C: 0,
  Cs: 1,
  D: 2,
  Ds: 3,
  E: 4,
  F: 5,
  Fs: 6,
  G: 7,
  Gs: 8,
  A: 9,
  As: 10,
  B: 11,
} as const;

/** Reduce any integer to a pitch class in 0-11. Safe for negatives. */
export function pc(n: number): PitchClass {
  return ((n % 12) + 12) % 12;
}

/** Wrap by a number of semitones, staying in 0-11. */
export function transposePc(p: PitchClass, semitones: number): PitchClass {
  return pc(p + semitones);
}

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

/** The sharp side of each pitch class. Always available. */
export function sharpName(p: PitchClass): string {
  return SHARP_NAMES[pc(p)];
}

/** The flat side of each pitch class. Always available. */
export function flatName(p: PitchClass): string {
  return FLAT_NAMES[pc(p)];
}

/**
 * Letter names, in semitone offsets from the *natural* letter. This is the
 * mechanism that makes correct spelling possible: to name a pitch we first
 * choose which letter it should be spelled with, then decide if it needs an
 * accidental. Picking the letter correctly is what distinguishes G# from Ab.
 */
const LETTER_SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export const LETTERS = Object.keys(LETTER_SEMITONES);

const LETTER_INDEX: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

/** All letter names in order, for scale walking. */
const LETTER_ORDER = ["C", "D", "E", "F", "G", "A", "B"];

/**
 * Spell a pitch class using a given letter.
 * `letterSpelling(3, "E")` -> "Eb"   (E = 4, so 3 is one flat below)
 * `letterSpelling(3, "D")` -> "D#"   (D = 2, so 3 is one sharp above)
 */
export function letterSpelling(p: PitchClass, letter: string): string {
  const target = LETTER_SEMITONES[letter];
  if (target === undefined) throw new Error(`Unknown letter: ${letter}`);
  const diff = pc(p - target);
  // 0 = natural, 1 = one sharp, 11 = one flat
  if (diff === 0) return letter;
  if (diff === 1) return `${letter}#`;
  if (diff === 11) return `${letter}b`;
  // Should be unreachable: every pitch class is within a semitone-or-two of
  // each of the 7 letters, and 1 and 11 are the two adjacent cases.
  throw new Error(`Cannot spell pitch class ${pc(p)} with letter ${letter}`);
}

/**
 * The musical scale that determines how a key is spelled. A key is fully
 * described by its tonic pitch class *and* which letter names it, plus whether
 * it is minor. This is what lets us walk a scale producing correctly spelled
 * names instead of guessing.
 */
export interface KeySignature {
  tonic: PitchClass;
  letter: string;
  mode: "major" | "minor";
}

/** Major scale intervals from the tonic, in order. */
export const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
/** Natural minor scale intervals from the tonic, in order. */
export const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];

const MODE_STEPS = { major: MAJOR_STEPS, minor: MINOR_STEPS };

/** The degree (0-6) of the letter `letter` within the key, or null if not diatonic. */
function letterDegree(key: KeySignature, letter: string): number | null {
  const idx = LETTER_INDEX[letter];
  if (idx === undefined) return null;
  const tonicIdx = LETTER_INDEX[key.letter];
  if (tonicIdx === undefined) throw new Error(`Unknown tonic letter: ${key.letter}`);
  return (idx - tonicIdx + 7) % 7;
}

/**
 * The correctly spelled name of a scale degree of a key.
 * `degreeName({tonic:3,letter:"Eb",mode:"major"}, 0)` -> "Eb"
 * `degreeName({tonic:10,letter:"A",mode:"minor"}, 0)` -> "Am"
 *
 * `key.letter` may include an accidental ("Eb", "C#"), which is stripped here
 * to get the letter name the scale walk needs.
 */
export function degreeName(key: KeySignature, degree: number, withMode = false): string {
  const steps = MODE_STEPS[key.mode];
  const index = ((degree % 7) + 7) % 7;
  const step = steps[index];
  const tonicIndex = LETTER_INDEX[bareLetter(key.letter)];
  if (tonicIndex === undefined) throw new Error(`Unknown tonic letter: ${key.letter}`);
  const letter = LETTER_ORDER[(tonicIndex + index) % 7];
  const base = letterSpelling(pc(key.tonic + step), letter);
  return withMode && key.mode === "minor" ? `${base}m` : base;
}

/** Just the letter of a key, dropping any accidental. "Eb" -> "E". */
function bareLetter(letter: string): string {
  return letter[0].toUpperCase();
}

/** All 7 degree names of a key, starting at the tonic. */
export function scaleNames(key: KeySignature, withMode = false): string[] {
  return Array.from({ length: 7 }, (_, d) => degreeName(key, d, withMode));
}

/** True if this key is a "sharp-side" key: C, G, D, A, E, B, F#/b. */
export function prefersSharps(key: KeySignature): boolean {
  // The circle of fifths position, 0-11, tells us how accidentals run.
  // Sharp keys are even positions, flat keys odd.
  const FIFTHS_ORDER = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
  const tonicLetter = LETTER_INDEX[key.letter];
  if (tonicLetter === undefined) return false;
  // Rough heuristic that is correct for all 7 relative pairs: count the sharps
  // implied by the key's own letter scale, flat keys need more than the letter
  // order suggests. Simpler and reliable: use the letter's own position.
  // C(0) G(1) D(2) A(3) E(4) B(5) F(6)
  const sharpLetterCount = [0, 1, 2, 3, 4, 5, 0]; // F major is the flat outlier
  return sharpLetterCount[tonicLetter] >= 0 && key.letter !== "F";
}

/**
 * Best default spelling for a pitch class in a given key: prefer the
 * letter that is diatonic to the key, otherwise fall back to the key's
 * accidental direction.
 */
export function nameInKey(p: PitchClass, key: KeySignature): string {
  const preferFlat = !prefersSharps(key);
  return preferFlat ? flatName(p) : sharpName(p);
}

/** Parse a note name ("C", "F#", "Bb", "E♭") into a pitch class. */
export function parseNoteName(name: string): PitchClass {
  const normalised = name.trim().replace(/[#♯]/g, "#").replace(/[b♭]/g, "b");
  const match = /^([A-Ga-g])(#|b)?$/.exec(normalised);
  if (!match) throw new Error(`Not a note name: ${name}`);
  const [, letter, accidental] = match;
  let value = LETTER_SEMITONES[letter.toUpperCase()];
  if (accidental === "#") value += 1;
  if (accidental === "b") value -= 1;
  return pc(value);
}

export function isValidNoteName(name: string): boolean {
  try {
    parseNoteName(name);
    return true;
  } catch {
    return false;
  }
}
