/**
 * Strum patterns.
 *
 * A pattern is a grid of strokes over a fixed number of steps per bar. Eighth
 * notes give eight steps, sixteenths sixteen. Each step is a downstroke, an
 * upstroke, or a rest.
 *
 * These are the handful of patterns that cover most of what gets played. The
 * grid is data rather than notation because it has to drive three things at
 * once: the visual diagram, the audio scheduler, and the tempo maths.
 */

export type StrumPatternId =
  | "folk-8ths"
  | "rock-8ths"
  | "boom-chick"
  | "shuffle"
  | "jazz-comping"
  | "metal-palm"
  | "upbeat-pop";

/** A single grid cell. */
export type Stroke = "down" | "up" | "rest";

export interface StrumPattern {
  id: StrumPatternId;
  name: string;
  /** One full bar. */
  steps: Stroke[];
  /** How many beats a bar is. Always 4 here; kept explicit for odd meters. */
  beats: number;
  /** Subdivision: 8 for eighth notes, 16 for sixteenths. */
  subdivision: 8 | 16;
  description: string;
}

/** Build an even run of strokes, e.g. down-down-down-down. */
const even = (count: number, stroke: Stroke): Stroke[] => Array(count).fill(stroke);

const D = "down" as const;
const U = "up" as const;
const R = "rest" as const;

export const STRUM_PATTERNS: Record<StrumPatternId, StrumPattern> = {
  "folk-8ths": {
    id: "folk-8ths",
    name: "Folk",
    steps: [D, D, D, D, D, D, D, D],
    beats: 4,
    subdivision: 8,
    description:
      "Even downstrokes, all the way through. The most forgiving pattern there is, and the one most campfire songs use.",
  },
  "rock-8ths": {
    id: "rock-8ths",
    name: "Rock 8ths",
    steps: [D, D, U, U, D, D, U, U],
    beats: 4,
    subdivision: 8,
    description:
      "Constant eighth notes, alternating down and up. Keep the strum hand moving even on the muted steps.",
  },
  "boom-chick": {
    id: "boom-chick",
    name: "Boom-chick",
    steps: [D, R, R, U, R, R, U, R],
    beats: 4,
    subdivision: 8,
    description:
      "A bass note on the downbeat and chords on the backbeat. Country's default, and it leaves a hole to sing into.",
  },
  shuffle: {
    id: "shuffle",
    name: "Shuffle",
    steps: [D, R, U, R, D, R, U, R],
    beats: 4,
    subdivision: 8,
    description:
      "The swung triplet feel. Notated as straight eighths, but the last of each group is played late.",
  },
  "jazz-comping": {
    id: "jazz-comping",
    name: "Jazz comping",
    steps: [R, D, R, R, R, D, R, R],
    beats: 4,
    subdivision: 8,
    description:
      "Sparse, off the beat, and deliberately uneven. Comping is about reacting, not keeping time.",
  },
  "metal-palm": {
    id: "metal-palm",
    name: "Palm muted",
    steps: [D, D, D, D, D, D, D, D],
    beats: 4,
    subdivision: 8,
    description:
      "Tight, chugging downstrokes with the palm resting on the bridge. Rhythm matters far more than which chord it is.",
  },
  "upbeat-pop": {
    id: "upbeat-pop",
    name: "Upbeat pop",
    steps: [D, D, U, R, D, D, U, R],
    beats: 4,
    subdivision: 8,
    description:
      "Eighths with a lift. The gap on beat four is what makes a progression feel like it is going somewhere.",
  },
};

/** The stroke at a given step index, wrapping around the bar. */
export function strokeAt(pattern: StrumPattern, step: number): Stroke {
  const index = ((step % pattern.steps.length) + pattern.steps.length) % pattern.steps.length;
  return pattern.steps[index];
}

/** Every step index in a pattern that actually sounds. */
export function soundingSteps(pattern: StrumPattern): number[] {
  return pattern.steps
    .map((stroke, index) => (stroke === "rest" ? -1 : index))
    .filter((index) => index >= 0);
}

/** Duration in seconds of one step, for the audio scheduler. */
export function stepDuration(tempo: number, subdivision: number): number {
  return 60 / tempo / (subdivision / 4);
}

void even;
