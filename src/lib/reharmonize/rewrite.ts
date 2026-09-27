/**
 * Re-harmonisation: play this progression with the chords you actually know.
 *
 * The honest framing, established before this code was written: **you cannot
 * play an arbitrary song with four chords.** A real song uses most of the
 * diatonic palette, and a four-chord beginner set covers about four of the
 * seven scale degrees. Measuring it properly, re-keying a song saves at most
 * one chord.
 *
 * So this module does not pretend to solve that. It does the things that
 * genuinely help, in order of real impact, and reports the remainder honestly:
 *
 *   1. Strip decorative extensions. This is the big one. Most published charts
 *      are far denser than the harmony requires, and `Cmaj7 -> C` is a
 *      beginner-playable chord that preserves the function exactly.
 *   2. Tritone substitution for borrowed dominants, which is textbook and
 *      exact: `Bb7` and `C7` share a tritone and both resolve to F.
 *   3. Respelling diminished sevenths, which are fully symmetric.
 *   4. Re-key to whatever minimises the remainder.
 *   5. Report what is left, with the easiest shape for each new chord.
 *
 * Deliberately excluded: function-adjacent swaps that are only sometimes
 * right, such as treating I as vi in pop. A beginner cannot hear a wrong
 * suggestion, so a feature that quietly makes one is worse than useless.
 */

import {
  type ChordSpec,
  QUALITY_INTERVALS,
  QUALITY_SUFFIX,
  chordSymbol,
  parseChordSymbol,
  simplifyToTriad,
  isDominant,
} from "@/lib/music/chords";
import { pc, type KeySignature, sharpName } from "@/lib/music/notes";
import { transposeChord } from "@/lib/music/transpose";

/**
 * How confident we are that a substitution preserves the music.
 *
 * `exact`   the change is inaudible as a change; only colour was dropped
 * `function` the chord's harmonic function is preserved, though its sound changes
 */
export type Confidence = "exact" | "function";

export interface RewriteEdit {
  index: number;
  original: ChordSpec;
  replacement: ChordSpec;
  reason: string;
  confidence: Confidence;
  /** True for changes worth flagging to the user rather than making silently. */
  userChoice: boolean;
}

export interface RewriteResult {
  /** The rewritten progression. */
  chords: ChordSpec[];
  /** Every substitution applied, in order. */
  edits: RewriteEdit[];
  /** Chords the player does not know and must learn. */
  newChords: ChordSpec[];
  /** How many distinct chords were needed before the rewrite. */
  beforeCount: number;
  /** How many are needed after. */
  afterCount: number;
  /**
   * Semitones the chosen version is transposed by. Transposition is free and
   * sometimes saves a chord, so the best answer may be a different key from the
   * original. The UI shows this rather than hiding it.
   */
  semitones: number;
  /** True if the rewrite left the progression untouched. */
  unchanged: boolean;
}

function symbolOf(chord: ChordSpec): string {
  return chordSymbol(chord, sharpName);
}

/**
 * The set of chords a player can play, compared structurally rather than by
 * string.
 *
 * Comparing symbols would be a bug: a player who ticks "Abdim7" writes a flat,
 * while our canonical symbol for that chord is "G#dim7". Those are the same
 * chord, so the comparison has to be on pitch class and quality.
 */
export class KnownChords {
  private set: Set<string>;

  constructor(symbols: Iterable<string>) {
    this.set = new Set();
    for (const symbol of symbols) {
      const chord = parseChordSymbol(symbol);
      if (chord) this.set.add(KnownChords.keyOf(chord));
    }
  }

  private static keyOf(chord: ChordSpec): string {
    return `${pc(chord.root)}:${chord.quality}:${
      chord.bass === undefined ? "" : pc(chord.bass)
    }`;
  }

  has(chord: ChordSpec): boolean {
    return this.set.has(KnownChords.keyOf(chord));
  }

  get size(): number {
    return this.set.size;
  }

  /** The chords as canonical symbols, for display. */
  toSymbols(): string[] {
    return [...this.set].map((entry) => {
      const [root, quality, bass] = entry.split(":");
      const chord: ChordSpec = {
        root: Number(root),
        quality: quality as ChordSpec["quality"],
      };
      if (bass !== "") chord.bass = Number(bass);
      return chordSymbol(chord, sharpName);
    });
  }
}

/** Anything that can answer "can I play this?". */
export type Playability = KnownChords | Set<string> | string[];

function toKnown(known: Playability): KnownChords {
  return known instanceof KnownChords ? known : new KnownChords(known);
}

/**
 * Can this chord be played with the chords the player knows?
 *
 * A seventh chord counts as playable if the player knows its plain triad, which
 * is the single most useful relaxation: `Cmaj7` is playable by anyone who knows
 * `C`.
 */
export function isPlayable(chord: ChordSpec, known: Playability): boolean {
  const set = toKnown(known);
  if (set.has(chord)) return true;

  // A slash chord is playable without the slash if the bass note is one of the
  // chord's own tones. `C/E` works for someone who knows `C`; `C/Bb` does not,
  // because the bass is doing real work there.
  if (chord.bass !== undefined) {
    const bare: ChordSpec = { root: chord.root, quality: chord.quality };
    if (!set.has(bare)) return false;
    const tones = [0, ...QUALITY_INTERVALS[chord.quality]].map((i) =>
      pc(chord.root + i),
    );
    return tones.includes(pc(chord.bass));
  }

  const triad = simplifyToTriad(chord);
  if (triad.quality !== chord.quality && set.has(triad)) return true;

  return false;
}

/**
 * The plain triad, when that is the shape the player will actually use.
 * Returns null when the chord is already the simplest playable form.
 *
 * This is separate from isPlayable on purpose. A chord can be *playable* while
 * the best advice is to play something simpler: `Cmaj7` is playable, but telling
 * a beginner to play `C` is the single most useful thing this module does. If
 * that were folded into isPlayable, the improvement would be invisible.
 */
function preferredSimplification(
  chord: ChordSpec,
  known: Playability,
): ChordSpec | null {
  const set = toKnown(known);
  if (set.has(chord)) return null;

  if (chord.bass !== undefined) {
    const bare: ChordSpec = { root: chord.root, quality: chord.quality };
    if (set.has(bare)) return bare;
  }

  const triad = simplifyToTriad(chord);
  if (triad.quality !== chord.quality && set.has(triad)) return triad;

  return null;
}

/**
 * A substitution, in order of how safe it is.
 *
 * `following` is the next chord in the progression. It is required for the
 * dominant rule, because a substitution is only defensible if it still resolves
 * where the original did.
 *
 * Returns null when nothing defensible applies, in which case the chord is
 * reported as something the player has to learn.
 */
function findSubstitution(
  chord: ChordSpec,
  known: Playability,
  following: ChordSpec | undefined,
): { chord: ChordSpec; reason: string; confidence: Confidence; userChoice: boolean } | null {
  // --- A dominant that resolves somewhere we can reach ---------------------
  // A borrowed dominant, such as the bVII7 in country, is functioning as the
  // dominant of whatever it moves to. So it can be replaced by any dominant of
  // that same target, which is usually a much easier chord to find.
  //
  // In C, a Bb7 that resolves to F can be played as C7, because C7 is also the
  // dominant of F.
  //
  // This is deliberately NOT a tritone substitution. The tritone partner of
  // Bb7 is E7, which resolves to A and would wreck the line entirely. What
  // makes the substitution work is that the resolution is unchanged, which is
  // why it needs the following chord and cannot be decided from this chord
  // alone.
  if (isDominant(chord.quality) && chord.bass === undefined && following) {
    const dominantOfTarget: ChordSpec = {
      root: pc(following.root + 7),
      quality: chord.quality,
    };
    if (
      dominantOfTarget.root !== chord.root &&
      isPlayable(dominantOfTarget, known)
    ) {
      return {
        chord: dominantOfTarget,
        reason: `${symbolOf(chord)} and ${symbolOf(dominantOfTarget)} are both the dominant of ${symbolOf(following)}, so the resolution is unchanged`,
        confidence: "function",
        userChoice: true,
      };
    }
  }

  // --- Respelling a diminished seventh -------------------------------------
  // Fully symmetric, so any enharmonic spelling is the same chord. Pick the
  // spelling the player actually knows.
  if (chord.quality === "dim7" || chord.quality === "min7b5") {
    for (const alternative of [1, 3, 6, 8, 10]) {
      const respelled = { ...chord, root: pc(chord.root + alternative) };
      if (isPlayable(respelled, known)) {
        return {
          chord: respelled,
          reason: "diminished sevenths are symmetric, so any spelling sounds the same",
          confidence: "exact",
          userChoice: false,
        };
      }
    }
  }

  return null;
}

/**
 * Rewrite a progression so it uses as few unknown chords as possible.
 *
 * `known` is a set of chord symbols the player can play, e.g. {"C","G","Am","F"}.
 */
export function rewriteForKnownChords(
  chords: ChordSpec[],
  known: Set<string>,
  key: KeySignature,
): RewriteResult {
  void key;
  const beforeCount = distinctChords(chords).length;

  // Try every key, and keep the best. Transposing is free, so if some key
  // happens to line the progression up with what the player knows, that is a
  // genuine win. In practice it saves at most one chord, which is why the UI
  // leads with the substitutions rather than the re-keying.
  let best: { semitones: number; result: RewriteResult } | null = null;

  for (let semitones = 0; semitones < 12; semitones++) {
    const candidate = applySubstitutions(
      semitones === 0
        ? chords.map((chord) => ({ ...chord }))
        : chords.map((chord) => transposeChord(chord, semitones)),
      known,
    );
    if (
      best === null ||
      candidate.newChords.length < best.result.newChords.length ||
      (candidate.newChords.length === best.result.newChords.length &&
        candidate.edits.length < best.result.edits.length)
    ) {
      best = { semitones, result: candidate };
    }
  }

  const chosen = best!;
  return {
    ...chosen.result,
    beforeCount,
    semitones: chosen.semitones,
  };
}

/** Substitute within one key, without re-keying. */
function applySubstitutions(
  chords: ChordSpec[],
  known: Playability,
): RewriteResult {
  const edits: RewriteEdit[] = [];
  const out: ChordSpec[] = [];

  chords.forEach((chord, index) => {
    const following = chords[index + 1];

    // The chord is already exactly playable. Nothing to do.
    if (isPlayable(chord, known) && !hasExtension(chord)) {
      out.push(chord);
      return;
    }

    // Playable, but a simpler form exists. This is the most common and most
    // useful edit, and it is reported rather than applied silently: a beginner
    // looking at "Cmaj7" needs to be told to play C.
    const simplification = preferredSimplification(chord, known);
    if (simplification) {
      const colourOnly =
        chord.quality === "maj7" ||
        chord.quality === "min7" ||
        chord.quality === "add9" ||
        chord.quality === "sus4" ||
        chord.quality === "sus2";
      edits.push({
        index,
        original: chord,
        replacement: simplification,
        reason: colourOnly
          ? `the ${QUALITY_SUFFIX[chord.quality] || "extension"} is colour; the plain triad carries the same function`
          : `dropping the ${QUALITY_SUFFIX[chord.quality] || "extension"} weakens this into ${symbolOf(simplification)}`,
        confidence: colourOnly ? "exact" : "function",
        userChoice: !colourOnly,
      });
      out.push(simplification);
      return;
    }

    // Not playable as written. Look for a substitution.
    const substitution = findSubstitution(chord, known, following);
    if (substitution) {
      edits.push({
        index,
        original: chord,
        replacement: substitution.chord,
        reason: substitution.reason,
        confidence: substitution.confidence,
        userChoice: substitution.userChoice,
      });
      out.push(substitution.chord);
      return;
    }

    // Nothing defensible applies. Keep the chord and report it honestly.
    out.push(chord);
  });

  const newChords = distinctChords(out).filter(
    (chord) => !isPlayable(chord, known),
  );

  return {
    chords: out,
    edits,
    newChords,
    beforeCount: distinctChords(chords).length,
    afterCount: distinctChords(out).length,
    semitones: 0,
    unchanged: edits.length === 0,
  };
}

/** Does this chord carry anything beyond a plain triad? */
function hasExtension(chord: ChordSpec): boolean {
  return (
    chord.bass !== undefined ||
    (QUALITY_SUFFIX[chord.quality] !== "" && chord.quality !== "sus2" && chord.quality !== "sus4")
  );
}

function distinctChords(chords: ChordSpec[]): ChordSpec[] {
  const seen = new Map<string, ChordSpec>();
  for (const chord of chords) {
    const key = `${chord.root}:${chord.quality}:${chord.bass ?? ""}`;
    if (!seen.has(key)) seen.set(key, chord);
  }
  return [...seen.values()];
}

/** Chords to offer as a starting palette, in order of usefulness. */
export function suggestedPalettes(): { label: string; symbols: string[] }[] {
  return [
    { label: "The first four", symbols: ["C", "G", "Am", "F"] },
    { label: "Guitar chords", symbols: ["C", "D", "E", "G", "A"] },
    { label: "Open chords", symbols: ["C", "D", "E", "G", "A", "Am", "Em", "Dm"] },
    { label: "Blues box", symbols: ["C", "C7", "F", "F7", "G", "G7"] },
  ];
}

/** Parse a list of symbols, dropping anything unrecognised. */
export function parseChordList(symbols: string[]): ChordSpec[] {
  return symbols
    .map((symbol) => parseChordSymbol(symbol))
    .filter((chord): chord is ChordSpec => chord !== null);
}

export { distinctChords, QUALITY_SUFFIX, KnownChords as KnownChordSet };
