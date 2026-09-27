/**
 * The fretboard as a mathematical object.
 *
 * Nothing in the app stores chord shapes as hand-written data. A shape is
 * derived from a tuning, so tunings are described here as open-string MIDI
 * numbers and every question ("what note is this?") reduces to arithmetic.
 */

import { type PitchClass, pc } from "./notes";

/** String index 0 = low E (thickest), 5 = high E (thinnest). */
export type StringIndex = 0 | 1 | 2 | 3 | 4 | 5;

export interface Tuning {
  id: string;
  name: string;
  /** Open-string MIDI numbers, low string first. */
  openMidi: [number, number, number, number, number, number];
  /** Display names, low string first. */
  stringNames: [string, string, string, string, string, string];
}

export const STANDARD_TUNING: Tuning = {
  id: "standard",
  name: "Standard",
  openMidi: [40, 45, 50, 55, 59, 64], // E2 A2 D3 G3 B3 E4
  stringNames: ["E", "A", "D", "G", "B", "e"],
};

export const TUNINGS: Record<string, Tuning> = {
  standard: STANDARD_TUNING,
  dropD: {
    id: "dropD",
    name: "Drop D",
    openMidi: [38, 45, 50, 55, 59, 64], // D2 A2 D3 G3 B3 E4
    stringNames: ["D", "A", "D", "G", "B", "e"],
  },
  dadgad: {
    id: "dadgad",
    name: "DADGAD",
    openMidi: [38, 45, 50, 55, 57, 62], // D2 A2 D3 G3 A3 D4
    stringNames: ["D", "A", "D", "G", "A", "d"],
  },
  openG: {
    id: "openG",
    name: "Open G",
    openMidi: [38, 43, 50, 55, 59, 62], // D2 G2 D3 G3 B3 D4
    stringNames: ["D", "G", "D", "G", "B", "d"],
  },
  openD: {
    id: "openD",
    name: "Open D",
    openMidi: [38, 45, 50, 54, 57, 62], // D2 A2 D3 F3 A3 D4
    stringNames: ["D", "A", "D", "F", "A", "d"],
  },
};

export function getTuning(id: string): Tuning {
  return TUNINGS[id] ?? STANDARD_TUNING;
}

/** The highest fret we are willing to consider. Beyond this nobody plays. */
export const MAX_FRET = 15;

/** MIDI note number for a string at a given fret. Frets above the nut. */
export function midiAt(tuning: Tuning, string: StringIndex, fret: number): number {
  return tuning.openMidi[string] + fret;
}

/** Pitch class of a string at a fret. */
export function pitchClassAt(
  tuning: Tuning,
  string: StringIndex,
  fret: number,
): PitchClass {
  return pc(midiAt(tuning, string, fret));
}

/** Equal-temperament frequency in Hz for a MIDI note number. */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * The fret at or below `frets` whose pitch class is `target`, or null.
 * Used to find a comfortable place on the neck for a given note.
 */
export function fretsForPitchClass(
  tuning: Tuning,
  string: StringIndex,
  target: PitchClass,
  maxFret = MAX_FRET,
): number[] {
  const out: number[] = [];
  const open = pc(tuning.openMidi[string]);
  for (let fret = 0; fret <= maxFret; fret++) {
    if (pc(open + fret) === pc(target)) out.push(fret);
  }
  return out;
}

/** A single string's worth of a chord shape. */
export interface StringShape {
  /** Fret number, or null for a muted (x) string. */
  fret: number | null;
  /** MIDI pitch actually sounded, or null when muted. */
  midi: number | null;
}

/**
 * A playable chord shape.
 *
 * `frets` is parallel to the tuning's strings, low first. A `null` fret means
 * the string is muted, and it is the only way a string is ever silent — we
 * never infer muting.
 */
export interface Shape {
  tuningId: string;
  frets: (number | null)[];
}

export function shapeStringCount(shape: Shape): number {
  return shape.frets.filter((f) => f !== null).length;
}

/** The lowest-pitched string that actually sounds. */
export function bassString(shape: Shape): number | null {
  for (let i = 0; i < shape.frets.length; i++) {
    if (shape.frets[i] !== null) return i;
  }
  return null;
}

/** Every sounding MIDI note, low to high. */
export function soundedMidi(
  shape: Shape,
  tuning: Tuning = getTuning(shape.tuningId),
): number[] {
  const out: number[] = [];
  for (let i = 0; i < shape.frets.length; i++) {
    const fret = shape.frets[i];
    if (fret === null) continue;
    out.push(midiAt(tuning, i as StringIndex, fret));
  }
  return out;
}

/** The distinct pitch classes a shape sounds. */
export function shapePitchClasses(
  shape: Shape,
  tuning: Tuning = getTuning(shape.tuningId),
): Set<PitchClass> {
  return new Set(soundedMidi(shape, tuning).map(pc));
}

/** Lowest and highest sounding fret, ignoring mutes and open strings. */
export function fretSpan(shape: Shape): number {
  const fretted = shape.frets.filter(
    (f): f is number => f !== null && f > 0,
  );
  if (fretted.length === 0) return 0;
  return Math.max(...fretted) - Math.min(...fretted);
}

/** Highest sounding fret that is not an open string. */
export function topFret(shape: Shape): number {
  const fretted = shape.frets.filter(
    (f): f is number => f !== null && f > 0,
  );
  return fretted.length ? Math.max(...fretted) : 0;
}

/** True if any string is played open. */
export function hasOpenString(shape: Shape): boolean {
  return shape.frets.some((f) => f === 0);
}

/** True if the shape uses no open strings at all. */
export function isAllGripped(shape: Shape): boolean {
  return shape.frets.every((f) => f !== null && f > 0);
}
