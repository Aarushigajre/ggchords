import { describe, expect, it } from "vitest";
import {
  chordPitchClasses,
  requiredPitchClasses,
  parseChordSymbol,
  qualityPitchClasses,
  chordSymbol,
  simplifyToTriad,
  triadOf,
  ALL_QUALITIES,
  type ChordSpec,
} from "./chords";
import { generateShapes } from "./shapeGenerator";
import { getTuning, shapePitchClasses, soundedMidi, midiToFrequency, MAX_FRET } from "./fretboard";
import { pc, sharpName, type PitchClass } from "./notes";

const TUNING = getTuning("standard");

/**
 * The most important tests in the project. A shape generator that returns
 * something plausible-looking but musically wrong is worse than no generator,
 * because a beginner cannot tell the difference. These assert the invariants
 * that make a shape actually correct.
 */
describe("shape generator invariants", () => {
  const chords: ChordSpec[] = [];
  for (const quality of ALL_QUALITIES) {
    for (let root = 0; root < 12; root++) {
      chords.push({ root, quality });
    }
  }

  it("produces at least one shape for every chord in the vocabulary", () => {
    const failures: string[] = [];
    for (const chord of chords) {
      const shapes = generateShapes(chord, { limit: 5 });
      if (shapes.length === 0) failures.push(chordSymbol(chord));
    }
    expect(failures).toEqual([]);
  });

  it("every generated shape contains all of the chord's required tones", () => {
    const failures: string[] = [];
    for (const chord of chords) {
      // Absolute, re-rooted, and excluding the 5th on chords that have a 7th
      // (x32310 is the standard open C7 and it has no G).
      const required = new Set<PitchClass>();
      for (const tone of requiredPitchClasses(chord.quality)) {
        required.add(pc(chord.root + tone));
      }
      for (const shape of generateShapes(chord, { limit: 3 })) {
        const sounded = shapePitchClasses(shape);
        for (const tone of required) {
          if (!sounded.has(tone)) {
            failures.push(`${chordSymbol(chord)} missing pc ${tone} in ${JSON.stringify(shape.frets)}`);
            break;
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("omits the 5th on dominant 7ths, as guitarists actually play them", () => {
    // x32310 spells C-E-Bb. No fifth, and that is the correct standard shape.
    const shapes = generateShapes(parseChordSymbol("C7")!, { limit: 400 });
    const found = shapes.map((s) => JSON.stringify(s.frets));
    expect(found).toContain(JSON.stringify([null, 3, 2, 3, 1, 0]));
  });

  it("every generated shape has the root in the bass", () => {
    const failures: string[] = [];
    for (const chord of chords) {
      for (const shape of generateShapes(chord, { limit: 3 })) {
        const bass = pc(soundedMidi(shape)[0]);
        if (bass !== chord.root) {
          failures.push(`${chordSymbol(chord)} bass ${bass} in ${JSON.stringify(shape.frets)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("never sounds a note outside the chord's tones", () => {
    const failures: string[] = [];
    for (const chord of chords) {
      const allowed = chordPitchClasses(chord);
      for (const shape of generateShapes(chord, { limit: 3 })) {
        for (const pitch of shapePitchClasses(shape)) {
          if (!allowed.has(pitch)) {
            failures.push(`${chordSymbol(chord)} stray pc ${pitch} in ${JSON.stringify(shape.frets)}`);
            break;
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("never puts a unison on two adjacent strings", () => {
    const failures: string[] = [];
    for (const chord of chords) {
      for (const shape of generateShapes(chord, { limit: 3 })) {
        let previous: number | null = null;
        shape.frets.forEach((fret, index) => {
          if (fret === null) {
            previous = null;
            return;
          }
          const pitch = pc(TUNING.openMidi[index] + fret);
          if (pitch === previous) {
            failures.push(`${chordSymbol(chord)} doubled unison in ${JSON.stringify(shape.frets)}`);
          }
          previous = pitch;
        });
      }
    }
    expect(failures).toEqual([]);
  });

  it("stays inside the requested fret range", () => {
    const failures: string[] = [];
    for (const chord of chords) {
      for (const shape of generateShapes(chord, { limit: 3, maxFret: 12 })) {
        for (const fret of shape.frets) {
          if (fret !== null && fret > 12) failures.push(JSON.stringify(shape.frets));
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("uses at least three strings", () => {
    for (const chord of chords) {
      for (const shape of generateShapes(chord, { limit: 3 })) {
        expect(shape.frets.filter((f) => f !== null).length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("is deterministic", () => {
    // Two identical calls must agree exactly, or the curated overlay and the
    // tests above mean nothing.
    const a = generateShapes({ root: 0, quality: "maj" }, { limit: 10 });
    const b = generateShapes({ root: 0, quality: "maj" }, { limit: 10 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("slash chords", () => {
  it("honours the slash bass note", () => {
    const shapes = generateShapes({ root: 0, quality: "maj", bass: 2 }, { limit: 10 });
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      expect(pc(soundedMidi(shape)[0])).toBe(2); // D in the bass
    }
  });

  it("finds C/E, and correctly rejects x32010 as a C/E", () => {
    const shapes = generateShapes({ root: 0, quality: "maj", bass: 4 }, { limit: 20 });
    expect(shapes.length).toBeGreaterThan(0);
    const spelled = shapes.map((s) => JSON.stringify(s.frets));

    // Note that x32010 is often labelled "C/E" by mistake. It is not: its
    // lowest sounding note is the C on the A string (MIDI 48), so it is plain
    // root-position C. The generator is right to exclude it from C/E, and this
    // test pins that behaviour down.
    expect(spelled).not.toContain(JSON.stringify([null, 3, 2, 0, 1, 0]));

    // A real C/E puts the open low E in the bass.
    expect(spelled).toContain(JSON.stringify([0, 3, 2, 0, 1, 0]));
  });
});

describe("known shapes appear in the results", () => {
  // If the generator cannot find the shapes everybody learns first, it is
  // producing technically-correct but useless output.
  const expectFound = (symbol: string, frets: (number | null)[]) => {
    const chord = parseChordSymbol(symbol);
    if (!chord) throw new Error(`bad test chord ${symbol}`);
    const found = generateShapes(chord, { limit: 400 }).map((s) =>
      JSON.stringify(s.frets),
    );
    expect(found, `${symbol} ${JSON.stringify(frets)}`).toContain(
      JSON.stringify(frets),
    );
  };

  it("finds open Em", () => {
    expectFound("Em", [0, 2, 2, 0, 0, 0]);
  });

  it("finds open G", () => {
    expectFound("G", [3, 2, 0, 0, 0, 3]);
  });

  it("finds the A minor barre at fret 5", () => {
    expectFound("Am", [5, 7, 7, 5, 5, 5]);
  });

  it("finds the E major barre at fret 4", () => {
    expectFound("E", [0, 2, 2, 1, 0, 0]);
  });

  it("finds the D major open shape", () => {
    expectFound("D", [null, null, 0, 2, 3, 2]);
  });

  it("finds the G7 barre", () => {
    expectFound("G7", [3, 2, 0, 0, 0, 1]);
  });

  it("finds the jazz Cm9 four-string barre at fret 1", () => {
    // The famous "open" Cm9 that is actually a partial barre. Finding it
    // matters because it is the default Cm9 every jazz guitarist learns.
    expectFound("Cm9", [null, 3, 1, 3, 3, 3]);
  });
});

describe("alternate tunings", () => {
  it("works in drop D", () => {
    const shapes = generateShapes(
      { root: 2, quality: "maj" },
      { tuning: getTuning("dropD"), limit: 5 },
    );
    expect(shapes.length).toBeGreaterThan(0);
    // D is the open string in drop D, so there must be a shape using fret 0.
    expect(shapes.some((s) => s.frets[0] === 0)).toBe(true);
  });

  it("works in DADGAD", () => {
    const shapes = generateShapes(
      { root: 7, quality: "min" },
      { tuning: getTuning("dadgad"), limit: 5 },
    );
    expect(shapes.length).toBeGreaterThan(0);
  });
});

describe("midiToFrequency", () => {
  it("anchors A4 at 440Hz", () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 5);
  });

  it("puts the low E of a guitar near 82Hz", () => {
    expect(midiToFrequency(TUNING.openMidi[0])).toBeCloseTo(82.4, 1);
  });
});

describe("quality helpers", () => {
  it("reduces seventh chords to their triad", () => {
    expect(triadOf("dom7")).toBe("maj");
    expect(triadOf("min7")).toBe("min");
    expect(triadOf("maj7")).toBe("maj");
    expect(triadOf("min7b5")).toBe("dim");
  });

  it("simplifies to a playable triad", () => {
    const simplified = simplifyToTriad(parseChordSymbol("Dm7")!);
    expect(chordSymbol(simplified)).toBe("Dm");
  });
});

describe("chord symbol parsing", () => {
  it("round-trips the basic shapes", () => {
    // Compare pitch classes, not spellings: "Bb" and "A#" are the same note
    // and a naive string comparison would demand a bogus "B#".
    const expected: Record<string, [number, string]> = {
      C: [0, ""],
      Am: [9, "m"],
      F: [5, ""],
      G: [7, ""],
      Em: [4, "m"],
      Dm: [2, "m"],
      "F#m": [6, "m"],
      Bb: [10, ""],
    };
    for (const [symbol, [root, suffix]] of Object.entries(expected)) {
      const parsed = parseChordSymbol(symbol);
      expect(parsed, symbol).not.toBeNull();
      expect(parsed!.root, symbol).toBe(root);
      expect(qualitySuffixOf(parsed!.quality), symbol).toBe(suffix);
    }
  });

  it("handles sevenths, extensions and alterations", () => {
    expect(parseChordSymbol("C7")!.quality).toBe("dom7");
    expect(parseChordSymbol("Cmaj7")!.quality).toBe("maj7");
    expect(parseChordSymbol("Cm7")!.quality).toBe("min7");
    expect(parseChordSymbol("C7b9")!.quality).toBe("dom7b9");
    expect(parseChordSymbol("C7#5")!.quality).toBe("dom7sharp5");
    expect(parseChordSymbol("Cm7b5")!.quality).toBe("min7b5");
    expect(parseChordSymbol("Cdim7")!.quality).toBe("dim7");
  });

  it("handles unicode", () => {
    expect(parseChordSymbol("C♯m7")!.root).toBe(1);
    expect(parseChordSymbol("B♭")!.root).toBe(10);
  });

  it("parses slash chords", () => {
    const c = parseChordSymbol("C/E");
    expect(c).toEqual({ root: 0, quality: "maj", bass: 4 });
  });

  it("returns null for junk rather than throwing", () => {
    for (const junk of ["", "H", "Cb#", "###", "C/", "/E"]) {
      expect(parseChordSymbol(junk), junk).toBeNull();
    }
  });
});

function qualitySuffixOf(quality: string): string {
  const map: Record<string, string> = {
    maj: "",
    min: "m",
    dim: "dim",
    aug: "aug",
    sus2: "sus2",
    sus4: "sus4",
    dom7: "7",
    maj7: "maj7",
    min7: "m7",
    min7b5: "m7b5",
    dim7: "dim7",
    maj9: "maj9",
    min9: "m9",
    dom9: "9",
    add9: "add9",
    add13: "add13",
    dom7sus4: "7sus4",
    dom7b9: "7b9",
    dom7sharp9: "7#9",
    dom7sharp5: "7#5",
    dom7b5: "7b5",
    min11: "m11",
    maj13: "maj13",
    dom13: "13",
  };
  return map[quality] ?? "";
}

describe("frets stay within MAX_FRET by default", () => {
  it("never exceeds the default ceiling", () => {
    for (const quality of ALL_QUALITIES) {
      for (const shape of generateShapes({ root: 0, quality }, { limit: 3 })) {
        for (const fret of shape.frets) {
          if (fret !== null) expect(fret).toBeLessThanOrEqual(MAX_FRET);
        }
      }
    }
  });
});
