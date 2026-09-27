/**
 * Transposition.
 *
 * The key insight, and the reason this is simpler than it looks: a shape
 * transposes *exactly* by holding its fret numbers and changing the root. The
 * same position on the neck, different notes. So transposing is not a search,
 * it is arithmetic — and any voicing the user has chosen survives transposition
 * unchanged, which is what makes the capo and transpose controls compose.
 *
 * What does change is spelling. Transposing Eb major up a semitone must give E
 * major, not D# major, so names are re-derived from the new key rather than
 * shifted blindly. Getting this wrong is the single most common way a chord
 * app embarrasses itself.
 */

import { type ChordSpec, chordSymbol, chordPitchClasses } from "./chords";
import { type Shape, type Tuning, getTuning, midiAt, soundedMidi } from "./fretboard";
import {
  type KeySignature,
  type PitchClass,
  nameInKey,
  pc,
  prefersSharps,
  sharpName,
  transposePc,
} from "./notes";

// Re-exported for convenience: callers transposing a whole progression want
// chord symbols with correct key spelling, not sharp-normalised ones.
export { chordSymbol };

const LETTER_SEMITONES: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

function letterTonic(letter: string): PitchClass {
  return pc(
    LETTER_SEMITONES[letter[0]] +
      (letter.length > 1 ? (letter[1] === "#" ? 1 : -1) : 0),
  );
}

/**
 * Keys in circle-of-fifths order, so that consecutive entries are a fifth (or
 * a fourth, going down) apart. The tonic of sharp entry i is 7i mod 12; of flat
 * entry i it is 5i mod 12.
 *
 * The last four flat entries would be Fb, Bbb, Ebb and Dbb in strict theory.
 * They are spelled E, A, D and G in practice, because nobody writes Dbb major.
 */
const SHARP_KEYS = ["C", "G", "D", "A", "E", "B", "F#", "C#", "G#", "D#", "A#", "F"];
const FLAT_KEYS = ["C", "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb", "E", "A", "D", "G"];

/** Semitones per index step: a fifth up on the sharp side, a fourth on the flat. */
const SHARP_STEP = 7;
const FLAT_STEP = 5;

/** Modular inverse of the step, so we can go from semitones to index steps. */
const SHARP_STEP_INV = 7; // 7 * 7 = 49 = 1 (mod 12)
const FLAT_STEP_INV = 5; // 5 * 5 = 25 = 1 (mod 12)

/** Index of a key within its own sharp or flat list. */
function keyIndex(key: KeySignature): number {
  const useFlats = key.letter.includes("b");
  const list = useFlats ? FLAT_KEYS : SHARP_KEYS;
  const exact = list.indexOf(key.letter);
  if (exact >= 0) return exact;
  for (let i = 0; i < list.length; i++) {
    if (letterTonic(list[i]) === key.tonic) return i;
  }
  return 0;
}

/** Move a chord up or down by a number of semitones, preserving quality. */
export function transposeChord(chord: ChordSpec, semitones: number): ChordSpec {
  const out: ChordSpec = {
    root: transposePc(chord.root, semitones),
    quality: chord.quality,
  };
  if (chord.bass !== undefined && chord.bass !== chord.root) {
    out.bass = transposePc(chord.bass, semitones);
  }
  return out;
}

/** Transpose a whole progression. */
export function transposeProgression(
  chords: ChordSpec[],
  semitones: number,
): ChordSpec[] {
  return chords.map((chord) => transposeChord(chord, semitones));
}

/**
 * A key a given number of semitones away, spelled the way a musician would
 * write it.
 *
 * Eb major up a semitone is E major, not D# major. Eb up two is F major. Going
 * the other way, Eb down a semitone is D major.
 *
 * The index step per semitone is the inverse of the list's own step, because
 * the lists advance by fifths, not by semitones.
 */
export function transposeKey(key: KeySignature, semitones: number): KeySignature {
  const useFlats = key.letter.includes("b");
  const list = useFlats ? FLAT_KEYS : SHARP_KEYS;
  const step = useFlats ? FLAT_STEP_INV : SHARP_STEP_INV;
  const next = ((keyIndex(key) + semitones * step) % 12 + 12) % 12;
  const letter = list[next];
  return { tonic: letterTonic(letter), letter, mode: key.mode };
}

/** Semitones from one key tonic to another. */
export function semitonesBetween(from: PitchClass, to: PitchClass): number {
  return (to - from + 12) % 12;
}

/** Semitones needed to get from one key to another by the shorter route. */
export function shortestDistance(from: PitchClass, to: PitchClass): number {
  const up = semitonesBetween(from, to);
  return up > 6 ? up - 12 : up;
}

/**
 * Transpose a shape by re-rooting it.
 *
 * The fret numbers are untouched, which is the entire point: the physical hand
 * position does not change, only the notes under the fingers. So a shape is
 * returned unchanged and the caller supplies the new root separately.
 */
export function transposeShape(shape: Shape, _semitones: number): Shape {
  return { tuningId: shape.tuningId, frets: [...shape.frets] };
}

/**
 * Verify that a shape still spells its chord after transposition.
 *
 * Because fret numbers are held fixed, the *interval pattern* is preserved but
 * the absolute notes are not — the shape only remains correct if the target key
 * happens to put the same pitch classes under those frets. This is the check
 * that catches a transposed voicing which has quietly stopped being the chord.
 */
export function shapeStillSpellsChord(
  shape: Shape,
  chord: ChordSpec,
  tuning: Tuning = getTuning(shape.tuningId),
): boolean {
  const allowed = chordPitchClasses(chord);
  for (const midi of soundedMidi(shape, tuning)) {
    if (!allowed.has(pc(midi))) return false;
  }
  const bass = pc(soundedMidi(shape, tuning)[0]);
  return bass === (chord.bass ?? chord.root);
}

/** A note-name function appropriate to a key, for chord symbols and labels. */
export function spellingFor(key: KeySignature): (p: PitchClass) => string {
  return (p: PitchClass) => nameInKey(p, key);
}

/** All keys for a transpose picker, in circle-of-fifths order. */
export function allKeys(mode: "major" | "minor" = "major"): KeySignature[] {
  const major = mode === "major";
  const sharp = major
    ? ["C", "G", "D", "A", "E", "B", "F#", "C#", "G#", "D#", "A#", "F"]
    : ["E", "B", "F#", "C#", "G#", "D#", "A#", "F", "C", "G", "D", "A"];
  const flat = major
    ? ["C", "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb", "E", "A", "D", "G"]
    : ["A", "D", "G", "C", "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb", "B"];
  const list = major ? sharp : flat;

  // Return in tonic order, which is what a dropdown wants, not fifths order.
  return Array.from({ length: 12 }, (_, tonic) => {
    const letter = list.find((l) => letterTonic(l) === pc(tonic)) ?? "C";
    return { tonic: pc(tonic), letter, mode };
  });
}

/**
 * A readable key name, e.g. "Eb major".
 *
 * Uses the key's own letter rather than deriving a name from the tonic,
 * because the letter is what records the intended spelling. Deriving would
 * turn Eb into D#.
 */
export function keyName(key: KeySignature): string {
  const letter = key.letter || nameInKey(key.tonic, key);
  return `${letter} ${key.mode}`;
}

/** The sounding MIDI notes of a shape, optionally shifted for playback. */
export function voicingMidi(shape: Shape, semitones = 0, tuning?: Tuning): number[] {
  return soundedMidi(shape, tuning ?? getTuning(shape.tuningId)).map(
    (midi) => midi + semitones,
  );
}

/**
 * The pitch class each string sounds, in string order, with null for muted
 * strings. This is what the diagram draws as fret labels.
 */
export function stringPitchClasses(
  shape: Shape,
  tuning: Tuning = getTuning(shape.tuningId),
): (PitchClass | null)[] {
  return shape.frets.map((fret, i) =>
    fret === null ? null : pc(midiAt(tuning, i as 0 | 1 | 2 | 3 | 4 | 5, fret)),
  );
}

/** Human-readable fret list, e.g. "x 3 2 0 1 0". */
export function fretsToString(shape: Shape): string {
  return shape.frets.map((f) => (f === null ? "x" : String(f))).join(" ");
}

/** A compact fret string with a middot for muteds, e.g. "x32010". */
export function fretsToCompact(shape: Shape): string {
  return shape.frets.map((f) => (f === null ? "x" : String(f))).join("");
}

export { prefersSharps, sharpName, nameInKey };
