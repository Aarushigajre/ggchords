/**
 * Capo support.
 *
 * The rule that trips everyone up: a capo does not change the chord you play,
 * it changes what that chord *sounds as*. With a capo on fret 3, the open C
 * shape sounds as Eb. So to sound in a target key, you play the shape of a key
 * a capo-fret lower.
 *
 * The consequence for the UI is that a capo chord has two names, and conflating
 * them is how capo chord charts mislead people. We always keep both: the shape
 * you actually play, and what the audience hears.
 */

import { type ChordSpec, chordSymbol } from "./chords";
import { type Shape, type Tuning, getTuning, soundedMidi } from "./fretboard";
import { type KeySignature, type PitchClass, nameInKey } from "./notes";
import { transposeChord, transposeKey } from "./transpose";

export interface CapoState {
  /** Fret the capo is clamped to. 0 means no capo. */
  fret: number;
  /** Key the music is *sounding* in, before the capo was added. */
  targetKey: KeySignature;
}

export const MAX_CAPO_FRET = 7;

/**
 * The key whose shape you must play to sound in `targetKey` with this capo.
 *
 * To sound in D with a capo on 2, you play C shapes. That is
 * transposeKey(D, -2), not "D's tonic minus two" — the letter has to move too,
 * or we end up describing a key as "D" while it holds C's tonic.
 */
export function shapeKeyFor(
  targetKey: KeySignature,
  capoFret: number,
): KeySignature {
  return transposeKey(targetKey, -capoFret);
}

/**
 * The key the capo is actually producing, given the key whose shape is being
 * played. The inverse of shapeKeyFor.
 */
export function soundingKey(
  shapeKey: KeySignature,
  capoFret: number,
): KeySignature {
  return transposeKey(shapeKey, capoFret);
}

/**
 * The chord symbol as it sounds, given the shape chord and the capo position.
 * With a capo at 2, an Am shape is a Bm chord.
 */
export function soundedChord(
  shapeChord: ChordSpec,
  capoFret: number,
  key: KeySignature,
): ChordSpec {
  if (capoFret === 0) return shapeChord;
  const transposed = transposeChord(shapeChord, capoFret);
  return { ...transposed };
}

/**
 * A full description of a capo'd chord for display: both names, the capo
 * position, and enough text for a screen reader.
 */
export interface CapoDescription {
  capoFret: number;
  /** The chord symbol to print on the diagram, e.g. "Am". */
  shapeLabel: string;
  /** What the audience hears, e.g. "Bm". Equal to shapeLabel with no capo. */
  soundedLabel: string;
  /** Human sentence for tooltips and assistive text. */
  sentence: string;
  /** The shape's own key, i.e. what to call the shape. */
  shapeKey: KeySignature;
  /** The key everything sounds in. */
  soundingKeySignature: KeySignature;
}

export function describeCapo(
  shapeChord: ChordSpec,
  capoFret: number,
  targetKey: KeySignature,
  spelling: (p: PitchClass) => string,
): CapoDescription {
  const shapeKey = shapeKeyFor(targetKey, capoFret);
  const sounded = soundingKey(shapeKey, capoFret);
  const soundedChordSpec = soundedChord(shapeChord, capoFret, targetKey);
  const shapeLabel = chordSymbol(shapeChord, spelling);
  const soundedLabel = chordSymbol(soundedChordSpec, spelling);

  if (capoFret === 0) {
    return {
      capoFret: 0,
      shapeLabel,
      soundedLabel,
      sentence: shapeLabel,
      shapeKey,
      soundingKeySignature: sounded,
    };
  }

  return {
    capoFret,
    shapeLabel,
    soundedLabel,
    sentence: `Play ${shapeLabel} with the capo on fret ${capoFret}; it sounds as ${soundedLabel}.`,
    shapeKey,
    soundingKeySignature: sounded,
  };
}

/**
 * The absolute pitch each string sounds once the capo is applied. The capo
 * shortens every string, so a shape at capo N sounds N semitones higher.
 */
export function capoMidi(
  shape: Shape,
  capoFret: number,
  tuning: Tuning = getTuning(shape.tuningId),
): number[] {
  return soundedMidi(shape, tuning).map((midi) => midi + capoFret);
}

/**
 * Which capo frets can play a given key, ranked so the most likely answer
 * comes first. A player in open D tuning looking for key of D wants fret 0;
 * a player in standard tuning looking for D wants a capo on 2 with G shapes.
 */
export function capoOptions(targetKey: KeySignature): number[] {
  return Array.from({ length: MAX_CAPO_FRET + 1 }, (_, fret) => fret);
}

/**
 * Given a capo position and the shape actually being played, the key it
 * sounds in. Useful for validating a user's manual choice.
 */
export function keyFromShapeAndCapo(
  shapeKey: KeySignature,
  capoFret: number,
): KeySignature {
  return soundingKey(shapeKey, capoFret);
}

/** Convenience: a spelling function for the sounding key. */
export function soundingSpelling(
  targetKey: KeySignature,
  capoFret: number,
): (p: PitchClass) => string {
  return (p: PitchClass) => nameInKey(p, targetKey);
}
