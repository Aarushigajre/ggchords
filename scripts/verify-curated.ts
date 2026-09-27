/**
 * Development tool: validate the curated shape overlay and suggest
 * replacements for entries the generator rejects.
 *
 * Run with: npx tsx scripts/verify-curated.ts
 * (or via `npx vite-node scripts/verify-curated.ts`)
 *
 * The curated table is the only hand-written musical data in the project, so
 * it is the only place a typo can turn into a confidently-wrong chord shown to
 * a beginner. This script checks every entry against the generator and prints
 * verified alternatives, grouped by position, so corrections are made from
 * computed facts rather than from memory.
 */

import { parseChordSymbol, chordPitchClasses, requiredPitchClasses } from "../src/lib/music/chords";
import { generateShapes } from "../src/lib/music/shapeGenerator";
import { getTuning, shapePitchClasses, soundedMidi } from "../src/lib/music/fretboard";
import { pc, sharpName } from "../src/lib/music/notes";
import { scoreShape, describeShape } from "../src/lib/music/difficulty";
import { curatedShapes, curatedSymbols } from "../src/lib/music/curatedShapes";
import type { Shape } from "../src/lib/music/fretboard";

const TUNING = getTuning("standard");

function label(frets: (number | null)[]): string {
  return `[${frets.map((f) => (f === null ? "null" : f)).join(", ")}]`;
}

function problemWith(symbol: string, frets: (number | null)[]): string | null {
  const chord = parseChordSymbol(symbol);
  if (!chord) return "unparseable symbol";

  const shape: Shape = { tuningId: "standard", frets };
  const sounded = shapePitchClasses(shape);
  const allowed = chordPitchClasses(chord);

  for (const pcv of sounded) {
    if (!allowed.has(pcv)) {
      return `stray note ${sharpName(pcv)}`;
    }
  }
  const bass = pc(soundedMidi(shape)[0]);
  if (bass !== chord.root) {
    return `bass is ${sharpName(bass)}, not ${sharpName(chord.root)}`;
  }
  const required = new Set<number>();
  for (const tone of requiredPitchClasses(chord.quality)) {
    required.add(pc(chord.root + tone));
  }
  for (const tone of required) {
    if (!sounded.has(tone)) return `missing ${sharpName(tone)}`;
  }
  return null;
}

console.log("Validating curated shapes against the generator.\n");

let bad = 0;
const suggestions = new Map<string, string[]>();

for (const symbol of curatedSymbols()) {
  for (const shape of curatedShapes(symbol)) {
    const issue = problemWith(symbol, shape.frets);
    if (issue) {
      bad++;
      console.log(`  BAD  ${symbol.padEnd(9)} ${label(shape.frets).padEnd(30)} ${issue}`);

      // Find verified replacements: real generator output, best first, but
      // biased toward the same neck position as the bad entry.
      const chord = parseChordSymbol(symbol)!;
      const candidates = generateShapes(chord, { limit: 400 })
        .map((s) => ({ s, score: scoreShape(s).score }))
        .sort((a, b) => a.score - b.score);
      const near = candidates
        .slice(0, 400)
        .sort(
          (a, b) =>
            Math.abs(scoreShape(a.s).position - scoreShape({ tuningId: "standard", frets: shape.frets }).position) -
            Math.abs(scoreShape(b.s).position - scoreShape({ tuningId: "standard", frets: shape.frets }).position),
        )
        .slice(0, 4)
        .map(({ s }) => s);
      suggestions.set(
        `${symbol} ${label(shape.frets)}`,
        near.map((s) => `        ${label(s.frets)}  // ${describeShape(s)}`),
      );
    }
  }
}

if (suggestions.size > 0) {
  console.log("\nSuggested replacements (all generator-verified):\n");
  for (const [key, options] of suggestions) {
    console.log(`  ${key}`);
    for (const option of options) console.log(option);
    console.log();
  }
}

console.log(
  bad === 0
    ? `All ${curatedSymbols().length} curated entries are valid.`
    : `${bad} invalid curated entries. See replacements above.`,
);
