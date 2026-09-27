/**
 * Voicing selection: the seam between the theory core and the UI.
 *
 * The UI should never call the generator directly. It asks for a chord and gets
 * back a ranked set of options grouped by difficulty, already curated. Keeping
 * this in one place means the ranking rules live next to the shape they rank,
 * rather than being spread across components.
 */

import { type ChordSpec, chordSymbol, parseChordSymbol } from "./chords";
import {
  type DifficultyTier,
  bestPerTier,
  classifyTier,
  rankShapes,
  scoreShape,
} from "./difficulty";
import { generateShapes } from "./shapeGenerator";
import { applyPreference } from "./curatedShapes";
import { type Shape, getTuning } from "./fretboard";
import { pc, sharpName, type KeySignature, nameInKey } from "./notes";

export interface VoicingOption {
  shape: Shape;
  tier: DifficultyTier;
  /** Human description, e.g. "Open, 2-fret stretch". */
  description: string;
  /** Compact fret string, e.g. "x32010". */
  frets: string;
  score: number;
}

export interface VoicingSet {
  chord: ChordSpec;
  /** The chord symbol spelled in the given key. */
  symbol: string;
  /** Best shape overall, respecting the curated preference. */
  preferred: Shape | null;
  /** Every option, best first. */
  options: VoicingOption[];
  /** The best shape in each difficulty tier, for the tier selector. */
  byTier: Partial<Record<DifficultyTier, VoicingOption>>;
  /** True if no shape could be found, which should never happen but might. */
  empty: boolean;
}

function fretsCompact(shape: Shape): string {
  return shape.frets.map((f) => (f === null ? "x" : String(f))).join("");
}

function describe(shape: Shape): string {
  const score = scoreShape(shape);
  const parts: string[] = [];
  if (score.tier === 1) parts.push("Open");
  else if (score.tier === 2) parts.push("Simple grip");
  else if (score.tier === 3) parts.push("Partial barre");
  else parts.push("Full barre");
  if (score.barre) parts.push(`${score.barre.span}-string barre at fret ${score.barre.fret}`);
  if (score.stretch > 0) parts.push(`${score.stretch}-fret stretch`);
  if (shape.frets[0] === null) parts.push("low string muted");
  return parts.join(", ");
}

/**
 * All usable voicings for a chord, ranked and tiered.
 *
 * `prefer` names the chord symbol used to look up the curated overlay, which
 * must be the symbol as written in the key so that "Bb7" finds its entry.
 */
export function voicingsFor(
  chord: ChordSpec,
  options: { tuningId?: string; key?: KeySignature; prefer?: string; limit?: number } = {},
): VoicingSet {
  const tuningId = options.tuningId ?? "standard";
  const limit = options.limit ?? 120;
  const symbol = options.key
    ? chordSymbol(chord, (p) => nameInKey(p, options.key!))
    : chordSymbol(chord, sharpName);
  const prefer = options.prefer ?? symbol;

  const generated = generateShapes(chord, {
    tuning: getTuning(tuningId),
    limit,
  });
  const curatedFirst = applyPreference(prefer, generated, tuningId);
  const ranked = rankShapes(curatedFirst);

  const options_: VoicingOption[] = ranked.map((shape) => {
    const score = scoreShape(shape);
    return {
      shape,
      tier: score.tier,
      description: describe(shape),
      frets: fretsCompact(shape),
      score: score.score,
    };
  });

  return {
    chord,
    symbol,
    preferred: options_[0]?.shape ?? null,
    options: options_,
    byTier: Object.fromEntries(
      Object.entries(bestPerTier(curatedFirst)).map(([tier, shape]) => {
        const option = options_.find((o) => o.shape === shape);
        return [tier, option];
      }),
    ) as Partial<Record<DifficultyTier, VoicingOption>>,
    empty: options_.length === 0,
  };
}

/** Convenience wrapper taking a symbol, for data-driven pages. */
export function voicingsForSymbol(
  symbol: string,
  options?: Parameters<typeof voicingsFor>[1],
): VoicingSet | null {
  const chord = parseChordSymbol(symbol);
  if (!chord) return null;
  return voicingsFor(chord, { prefer: symbol, ...options });
}

/**
 * The shape to show by default, respecting an explicit tier choice.
 * Falls back to the preferred shape when the tier has no candidate.
 */
export function shapeForTier(set: VoicingSet, tier: DifficultyTier | "auto"): Shape | null {
  if (tier === "auto") return set.preferred;
  return set.byTier[tier]?.shape ?? set.preferred;
}

/** The tier a shape falls in, for display. */
export function tierOf(shape: Shape): DifficultyTier {
  return classifyTier(shape);
}

export { pc };
