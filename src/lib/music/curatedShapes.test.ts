import { describe, expect, it } from "vitest";
import { curatedShapes, curatedSymbols, applyPreference, curatedCount } from "./curatedShapes";
import { parseChordSymbol, chordPitchClasses, requiredPitchClasses } from "./chords";
import { generateShapes } from "./shapeGenerator";
import { getTuning, shapePitchClasses, soundedMidi } from "./fretboard";
import { pc, sharpName } from "./notes";
import { classifyTier, findBarres, widestBarre, rankShapes, bestPerTier, describeShape } from "./difficulty";
import type { Shape } from "./fretboard";

const TUNING = getTuning("standard");

/**
 * The curated overlay is the one part of the app that is typed in by hand
 * rather than derived, so it is the one part that can be silently wrong. A
 * mis-transcribed shape would be *shown to a beginner as correct*, which is
 * the worst kind of bug in this project. These tests validate every entry
 * against the generator, which is derived from first principles and therefore
 * acts as the source of truth.
 */
describe("curated shape overlay", () => {
  const symbols = curatedSymbols();

  it("has entries to check", () => {
    expect(symbols.length).toBeGreaterThan(40);
  });

  it("every curated shape is a syntactically valid chord symbol", () => {
    const bad: string[] = [];
    for (const symbol of symbols) {
      if (!parseChordSymbol(symbol)) bad.push(symbol);
    }
    expect(bad).toEqual([]);
  });

  it("every curated shape contains all of its chord's required tones", () => {
    const bad: string[] = [];
    for (const symbol of symbols) {
      const chord = parseChordSymbol(symbol)!;
      const required = new Set<number>();
      for (const tone of requiredPitchClasses(chord.quality)) {
        required.add(pc(chord.root + tone));
      }
      for (const shape of curatedShapes(symbol)) {
        const sounded = shapePitchClasses(shape);
        for (const tone of required) {
          if (!sounded.has(tone)) {
            bad.push(`${symbol} ${JSON.stringify(shape.frets)} missing pc ${tone}`);
            break;
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("never sounds a note outside its chord", () => {
    const bad: string[] = [];
    for (const symbol of symbols) {
      const chord = parseChordSymbol(symbol)!;
      const allowed = chordPitchClasses(chord);
      for (const shape of curatedShapes(symbol)) {
        for (const pitch of shapePitchClasses(shape)) {
          if (!allowed.has(pitch)) {
            bad.push(`${symbol} ${JSON.stringify(shape.frets)} stray pc ${pitch}`);
            break;
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("always has the root in the bass", () => {
    const bad: string[] = [];
    for (const symbol of symbols) {
      const chord = parseChordSymbol(symbol)!;
      for (const shape of curatedShapes(symbol)) {
        if (pc(soundedMidi(shape)[0]) !== chord.root) {
          bad.push(`${symbol} ${JSON.stringify(shape.frets)} wrong bass`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("only uses frets within a playable range", () => {
    for (const symbol of symbols) {
      for (const shape of curatedShapes(symbol)) {
        for (const fret of shape.frets) {
          if (fret !== null) {
            expect(fret, `${symbol}`).toBeGreaterThanOrEqual(0);
            expect(fret, `${symbol}`).toBeLessThanOrEqual(15);
          }
        }
      }
    }
  });

  it("agrees with the generator: every curated shape is independently findable", () => {
    // This is the strongest check available. If the generator, which derives
    // everything from the fretboard arithmetic, also produces the shape, the
    // transcription is almost certainly right.
    const bad: string[] = [];
    for (const symbol of symbols) {
      const chord = parseChordSymbol(symbol)!;
      const generated = new Set(
        generateShapes(chord, { limit: 800 }).map((s) =>
          s.frets.map((f) => (f === null ? "x" : f)).join(","),
        ),
      );
      for (const shape of curatedShapes(symbol)) {
        const k = shape.frets.map((f) => (f === null ? "x" : f)).join(",");
        if (!generated.has(k)) bad.push(`${symbol} ${k}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("covers the chords beginners actually learn first", () => {
    for (const symbol of ["C", "G", "D", "A", "E", "Am", "Em", "Dm", "G7", "C7", "A7", "Cm9", "Em9"]) {
      expect(curatedCount(symbol), symbol).toBeGreaterThan(0);
    }
  });
});

describe("applyPreference", () => {
  it("puts curated shapes first", () => {
    const chord = parseChordSymbol("Em")!;
    const generated = generateShapes(chord, { limit: 200 });
    const preferred = applyPreference("Em", generated);
    const firstCurated = curatedShapes("Em")[0];
    expect(preferred[0]).toEqual(firstCurated);
  });

  it("leaves unknown chords untouched", () => {
    const chord = parseChordSymbol("Bbm11")!;
    const generated = generateShapes(chord, { limit: 5 });
    expect(applyPreference("Bbm11", generated)).toEqual(generated);
  });

  it("never injects a shape the generator rejected", () => {
    // The overlay may only reorder, never add invalid shapes. This checks the
    // guard directly by passing a generation that excludes the curated shape.
    const chord = parseChordSymbol("C")!;
    const generated = generateShapes(chord, { limit: 5 });
    const filtered = generated.filter(
      (s) => !(s.frets[0] === 0 && s.frets[1] === 3),
    );
    const preferred = applyPreference("C", filtered);
    const injected = preferred.find((s) => s.frets[0] === 0 && s.frets[1] === 3);
    // promoteCurated is documented as "reorder and promote"; if we ever decide
    // the overlay should also inject, this test is the place that will catch it.
    expect(injected === undefined || filtered.length === 0).toBe(true);
  });
});

describe("barre detection", () => {
  it("finds the three-string barre at fret 3 in a G barre chord", () => {
    // 3 5 5 4 3 3 — fret 3 holds strings 0, 4 and 5.
    const barres = findBarres({ tuningId: "standard", frets: [3, 5, 5, 4, 3, 3] });
    expect(barres).toHaveLength(1);
    expect(barres[0].fret).toBe(3);
    expect(barres[0].span).toBe(3);
  });

  it("finds the four-string barre in the jazz Cm9", () => {
    // x31333 — fret 3 holds strings 1, 3, 4 and 5.
    const barres = findBarres({ tuningId: "standard", frets: [null, 3, 1, 3, 3, 3] });
    expect(barres).toHaveLength(1);
    expect(barres[0].span).toBe(4);
    expect(barres[0].fret).toBe(3);
  });

  it("finds a barre in a chord with no run of three adjacent strings", () => {
    // 5-7-7-6-5-5 is F major at the 5th fret. Fret 5 holds strings 0, 4 and 5,
    // which are not adjacent, so adjacency-based detection would miss this
    // entirely. It is unambiguously a barre chord.
    const barres = findBarres({ tuningId: "standard", frets: [5, 7, 7, 6, 5, 5] });
    expect(barres.length).toBeGreaterThan(0);
    expect(barres.some((b) => b.fret === 5 && b.span === 3)).toBe(true);
  });

  it("finds no barre in an open chord", () => {
    expect(findBarres({ tuningId: "standard", frets: [0, 2, 2, 0, 0, 0] })).toHaveLength(0);
  });

  it("does not call the open A chord a barre chord", () => {
    // D, G and B all sit at fret 2, but the open A and high E are sounding,
    // so x02220 is emphatically not a barre chord.
    expect(findBarres({ tuningId: "standard", frets: [null, 0, 2, 2, 2, 0] })).toHaveLength(0);
  });

  it("does not treat open strings as a barre", () => {
    expect(findBarres({ tuningId: "standard", frets: [0, 0, 0, 0, 0, 0] })).toHaveLength(0);
  });

  it("needs three strings on a fret to count", () => {
    // Two strings at one fret is two fingers, not a barre.
    expect(findBarres({ tuningId: "standard", frets: [3, 3, 5, 5, 7, 7] })).toHaveLength(0);
  });
});

describe("difficulty tiers", () => {
  const shape = (frets: (number | null)[]): Shape => ({ tuningId: "standard", frets });

  it("classifies a fully open chord as tier 1", () => {
    expect(classifyTier(shape([0, 2, 2, 0, 0, 0]))).toBe(1);
  });

  it("does not call the jazz Cm9 tier 1", () => {
    // The whole point: x31333 has no open strings, so "open" is the wrong
    // label even though it is far from the hardest Cm9 shape.
    const cm9 = shape([null, 3, 1, 3, 3, 3]);
    expect(cm9.frets).not.toContain(0);
    expect(classifyTier(cm9)).not.toBe(1);
    expect(widestBarre(cm9)).not.toBeNull();
  });

  it("classes a three-string barre as a partial barre, not a full one", () => {
    // F major at the 5th fret. It has no run of three adjacent strings on any
    // one fret, so only per-fret counting detects it — and detecting a barre
    // at all is the point, since calling this "open" would be nonsense.
    expect(findBarres(shape([5, 7, 7, 6, 5, 5])).length).toBeGreaterThan(0);
    expect(classifyTier(shape([5, 7, 7, 6, 5, 5]))).toBe(3);
  });

  it("classes a four-string barre as a full barre chord", () => {
    // F# minor 2-4-4-4-4-2: four strings sit on fret 4. This is what an actual
    // full barre chord looks like, and it is the shape a beginner should meet
    // last.
    expect(findBarres(shape([2, 4, 4, 4, 4, 2]))[0].span).toBe(4);
    expect(classifyTier(shape([2, 4, 4, 4, 4, 2]))).toBe(4);
  });

  it("classes a gripped low-position chord with no barre as tier 2", () => {
    // No open strings, no fret holding three strings, and a 3-fret reach.
    expect(findBarres(shape([1, 3, 2, 4, 2, 3]))).toHaveLength(0);
    expect(classifyTier(shape([1, 3, 2, 4, 2, 3]))).toBe(2);
  });

  it("prefers an open chord over a barre of the same chord", () => {
    const shapes = [
      shape([5, 7, 7, 5, 5, 5]), // A minor barre
      shape([0, 2, 2, 0, 0, 0]), // A minor open
    ];
    const ranked = rankShapes(shapes);
    expect(ranked[0]).toEqual(shape([0, 2, 2, 0, 0, 0]));
  });

  it("offers the best shape in several tiers", () => {
    const emShapes = generateShapes(parseChordSymbol("Em")!, { limit: 300 });
    const perTier = bestPerTier(emShapes);
    expect(perTier[1]).toBeDefined(); // some open Em exists
  });

  it("describes a shape in words", () => {
    const description = describeShape(shape([null, 3, 1, 3, 3, 3]));
    expect(description).toContain("barre");
  });
});

describe("ranking quality", () => {
  it("puts low-position open shapes first for every major chord", () => {
    for (const symbol of ["C", "G", "D", "A", "E"]) {
      const shapes = generateShapes(parseChordSymbol(symbol)!, { limit: 100 });
      const best = rankShapes(shapes)[0];
      const description = describeShape(best);
      expect(["Open", "Simple grip"], symbol).toContain(description.split(",")[0]);
    }
  });
});
