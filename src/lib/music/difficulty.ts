/**
 * Classifying how hard a shape is to play.
 *
 * "Open or not" turned out to be the wrong axis. The famous Cm9 that everyone
 * calls an open chord (`x31333`) has no open strings at all — it is a
 * four-string barre at fret 3, and it is far easier to play than a
 * mechanically simpler shape sitting at fret 8. What players actually want is
 * "the easiest thing that works", so we rank across four tiers and take the
 * best of each.
 */

import {
  type Shape,
  fretSpan,
  hasOpenString,
  shapeStringCount,
  topFret,
} from "./fretboard";
import { pc } from "./notes";

export type DifficultyTier = 1 | 2 | 3 | 4;

export const TIER_LABEL: Record<DifficultyTier, string> = {
  1: "Open",
  2: "Simple grip",
  3: "Partial barre",
  4: "Full barre",
};

export const TIER_DESCRIPTION: Record<DifficultyTier, string> = {
  1: "Uses open strings, no barre. Easiest to play and to hear.",
  2: "No barre and no open strings. Just a normal grip, usually low on the neck.",
  3: "Barre across some strings, or a wide reach. Common and manageable.",
  4: "Barre across five or more strings, or a long stretch up the neck.",
};

export interface BarreInfo {
  fret: number;
  /** How many strings the barre covers. */
  span: number;
  /** Index of the lowest string in the barre. */
  from: number;
  to: number;
}

/**
 * Find barres in a shape.
 *
 * A barre is a fret occupied by three or more fretted strings. Counting
 * strings per fret, rather than looking for runs of adjacent strings, is what
 * makes this work on real barre chords: 5-7-7-6-5-5 (F major at the 5th fret)
 * has no run of three adjacent strings at one fret, yet it is unmistakably a
 * barre chord, because three of its strings sit at fret 5.
 *
 * A shape containing any open string returns no barres. This is deliberate and
 * load-bearing: without it, the open A chord x02220 — where the D, G and B
 * strings all sit at fret 2 — reads as a three-string barre, which would push a
 * chord every beginner learns into the barre tier. A chord with open strings
 * ringing is not a barre chord. The point of a barre is to replace open strings
 * you cannot hold, and here they are sounding.
 */
export function findBarres(shape: Shape): BarreInfo[] {
  if (hasOpenString(shape)) return [];

  const byFret = new Map<number, number[]>();
  shape.frets.forEach((fret, string) => {
    if (fret === null || fret === 0) return;
    const list = byFret.get(fret);
    if (list) list.push(string);
    else byFret.set(fret, [string]);
  });

  const barres: BarreInfo[] = [];
  for (const [fret, strings] of byFret) {
    if (strings.length < 3) continue;
    barres.push({
      fret,
      span: strings.length,
      from: Math.min(...strings),
      to: Math.max(...strings),
    });
  }
  return barres.sort((a, b) => a.fret - b.fret);
}

/** The widest barre in the shape, or null if there is none. */
export function widestBarre(shape: Shape): BarreInfo | null {
  const barres = findBarres(shape);
  if (barres.length === 0) return null;
  return barres.reduce((widest, b) => (b.span > widest.span ? b : widest));
}

/** Which difficulty tier a shape falls into. */
export function classifyTier(shape: Shape): DifficultyTier {
  const barre = widestBarre(shape);
  const stretch = fretSpan(shape);
  const high = topFret(shape);

  if (!barre && hasOpenString(shape)) return 1;
  if (!barre && stretch <= 3) return 2;

  // A four-string barre is a full barre chord — F#m, Bm, the Cm9 voicing at
  // fret 3 — and it is the last thing a beginner should meet. A three-string
  // barre is ordinary technique, so it stays a partial barre rather than
  // becoming a different tier of chord entirely.
  if (barre && barre.span >= 4) return 4;
  if (barre && barre.span >= 3) return 3;

  // No barre but an awkward reach or a high position.
  if (stretch >= 4 || high >= 10) return 3;
  return 4;
}

export interface ShapeScore {
  /** Lower is better. */
  score: number;
  tier: DifficultyTier;
  barre: BarreInfo | null;
  stretch: number;
  position: number;
  strings: number;
}

/**
 * Score a shape for playability. This is the ranking function that decides
 * which of the many valid shapes is shown by default.
 *
 * The weights encode real playing intuition: a two-fret stretch is free, a
 * five-fret stretch is a real problem, and the 12th position is not somewhere
 * you send a beginner.
 */
export function scoreShape(shape: Shape): ShapeScore {
  const tier = classifyTier(shape);
  const barre = widestBarre(shape);
  const stretch = fretSpan(shape);
  const position = topFret(shape);
  const strings = shapeStringCount(shape);

  let score = 0;

  // Tier dominates. Everything else only breaks ties within a tier.
  score += (tier - 1) * 100;

  // Stretch: the biggest ergonomic cost, but only once it actually hurts.
  // Two frets is an ordinary reach, not a difficulty, so the penalty is free
  // up to 2 and then climbs steeply. A flat square would make the ranking
  // prefer muting the G string on an A chord (avoiding a harmless 2-fret
  // stretch) over the canonical x02220.
  if (stretch > 2) score += (stretch - 2) * (stretch - 2) * 8;

  // Position on the neck. Cheap for the first few frets, then steeply
  // expensive, because fret 9 is fine and fret 13 is a stretch.
  if (position <= 5) score += position;
  else score += 5 + (position - 5) * 6;

  // Barre cost. A four-string barre is work; a six-string barre is a workout.
  if (barre) {
    score += barre.span * 3;
    if (barre.span >= 5) score += 15;
  }

  // Prefer fuller chords. Six strings is the most complete, five is a normal
  // chord, four is sparse, three is a deliberate jazz shell voicing. The
  // weights must increase as the chord thins out, or the ranking starts
  // preferring `x320x0` over the canonical `x32010`.
  if (strings >= 6) score += 3;
  else if (strings === 5) score += 8;
  else if (strings === 4) score += 18;
  else score += 30;

  // Muting the low string is completely normal on open chords (x32010, x02020)
  // and must not cost enough to lose to a clumsier shape further up the neck.
  if (shape.frets[0] === null) score += 1;

  return { score, tier, barre, stretch, position, strings };
}

/** Sort shapes best-first. Stable for equal scores so output is deterministic. */
export function rankShapes(shapes: Shape[]): Shape[] {
  return shapes
    .map((shape, index) => ({ shape, index, score: scoreShape(shape).score }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((entry) => entry.shape);
}

/**
 * The best shape in each tier, so the UI can offer "Easiest / Simple / Any"
 * without re-running the search.
 */
export function bestPerTier(shapes: Shape[]): Partial<Record<DifficultyTier, Shape>> {
  const out: Partial<Record<DifficultyTier, Shape>> = {};
  for (const shape of rankShapes(shapes)) {
    const tier = classifyTier(shape);
    if (out[tier] === undefined) out[tier] = shape;
  }
  return out;
}

/** The single easiest shape available, or null if there are none. */
export function easiestShape(shapes: Shape[]): Shape | null {
  return rankShapes(shapes)[0] ?? null;
}

/**
 * Render a shape as a chord-diagram string, e.g. `x32010` or `-3-2-0-1-0`.
 * Handy for tests, for tooltips, and for copy-to-clipboard.
 */
export function shapeToString(shape: Shape): string {
  return shape.frets.map((f) => (f === null ? "x" : String(f))).join("");
}

/** A short human description of a shape's difficulty. */
export function describeShape(shape: Shape): string {
  const tier = classifyTier(shape);
  const barre = widestBarre(shape);
  const parts = [TIER_LABEL[tier]];
  if (barre) parts.push(`${barre.span}-string barre at fret ${barre.fret}`);
  else if (hasOpenString(shape)) parts.push("open strings");
  const stretch = fretSpan(shape);
  if (stretch > 0) parts.push(`${stretch}-fret stretch`);
  return parts.join(", ");
}
