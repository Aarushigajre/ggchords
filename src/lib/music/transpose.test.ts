import { describe, expect, it } from "vitest";
import {
  transposeChord,
  transposeProgression,
  transposeKey,
  semitonesBetween,
  shortestDistance,
  shapeStillSpellsChord,
  allKeys,
  keyName,
  fretsToCompact,
  voicingMidi,
} from "./transpose";
import { parseChordSymbol, chordSymbol } from "./chords";
import { sharpName } from "./notes";
import type { KeySignature } from "./notes";
import {
  shapeKeyFor,
  soundingKey,
  soundedChord,
  describeCapo,
  capoMidi,
} from "./capo";
import { generateShapes } from "./shapeGenerator";

const C: KeySignature = { tonic: 0, letter: "C", mode: "major" };

describe("transposeChord", () => {
  it("moves the root and keeps the quality", () => {
    const c = parseChordSymbol("C")!;
    const d = transposeChord(c, 2);
    expect(d.quality).toBe("maj");
    expect(sharpName(d.root)).toBe("D");
  });

  it("transposes a slash chord's bass too", () => {
    const c = parseChordSymbol("C/E")!;
    const d = transposeChord(c, 2);
    expect(sharpName(d.root!)).toBe("D");
    expect(sharpName(d.bass!)).toBe("F#");
  });

  it("keeps the I-V-vi-IV shape intact", () => {
    const progression = ["C", "G", "Am", "F"].map(
      (s) => parseChordSymbol(s)!,
    );
    const up = transposeProgression(progression, 2);
    expect(up.map((c) => sharpName(c.root))).toEqual(["D", "A", "B", "G"]);
    expect(up.map((c) => c.quality)).toEqual(["maj", "maj", "min", "maj"]);
  });
});

describe("transposeKey", () => {
  const Eb: KeySignature = { tonic: 3, letter: "Eb", mode: "major" };
  const Bb: KeySignature = { tonic: 10, letter: "Bb", mode: "major" };

  it("spells a semitone up correctly rather than using sharps", () => {
    // Eb up a semitone is E major, not D# major.
    expect(transposeKey(Eb, 1).letter).toBe("E");
    expect(transposeKey(Eb, 2).letter).toBe("F");
  });

  it("goes down a semitone from Eb to D", () => {
    expect(transposeKey(Eb, -1).letter).toBe("D");
  });

  it("walks the circle correctly from C", () => {
    expect(transposeKey(C, 2).letter).toBe("D");
    expect(transposeKey(C, 7).letter).toBe("G");
    expect(transposeKey(C, 9).letter).toBe("A");
    expect(transposeKey(C, 5).letter).toBe("F");
    expect(transposeKey(C, 11).letter).toBe("B");
    expect(transposeKey(C, 1).letter).toBe("C#");
  });

  it("stays on the flat side when the source key is flat", () => {
    expect(transposeKey(Bb, 2).letter).toBe("C");
    expect(transposeKey(Bb, 3).letter).toBe("Db");
  });

  it("returns to the same key after a full octave", () => {
    expect(transposeKey(Eb, 12).letter).toBe("Eb");
  });

  it("is reversible", () => {
    for (const key of allKeys()) {
      const there = transposeKey(key, 5);
      const back = transposeKey(there, -5);
      expect(back.letter, `${key.letter} -> ${there.letter}`).toBe(key.letter);
    }
  });

  it("keeps letter and tonic consistent", () => {
    for (const key of allKeys()) {
      for (const step of [0, 1, 5, 7, -3]) {
        const moved = transposeKey(key, step);
        const expected = (key.tonic + step + 120) % 12;
        expect(moved.tonic, `${key.letter} ${step >= 0 ? "+" : ""}${step}`).toBe(expected);
      }
    }
  });
});

describe("semitone arithmetic", () => {
  it("measures forward", () => {
    expect(semitonesBetween(0, 5)).toBe(5);
    expect(semitonesBetween(5, 0)).toBe(7);
  });

  it("takes the shorter way round", () => {
    expect(shortestDistance(0, 11)).toBe(-1);
    expect(shortestDistance(0, 7)).toBe(-5);
    expect(shortestDistance(0, 6)).toBe(6);
  });
});

describe("transposed shapes keep their fret numbers", () => {
  it("holds the shape fixed and re-roots the chord", () => {
    const c = parseChordSymbol("C")!;
    const shapes = generateShapes(c, { limit: 50 });
    const shape = shapes[0];
    const d = transposeChord(c, 2);
    // A transposed C shape is a D shape only because the root moved, not
    // because the fingers moved.
    expect(shapeStillSpellsChord(shape, d)).toBe(false);
    expect(shapeStillSpellsChord(shape, c)).toBe(true);
  });

  it("moves sounding pitches by the transposed amount for playback", () => {
    const shape = { tuningId: "standard", frets: [3, 2, 0, 0, 0, 3] as (number | null)[] };
    const plain = voicingMidi(shape, 0);
    const up = voicingMidi(shape, 2);
    expect(up).toEqual(plain.map((m) => m + 2));
  });
});

describe("capo", () => {
  it("a capo shortens every string", () => {
    const openC = { tuningId: "standard", frets: [null, 3, 2, 0, 1, 0] as (number | null)[] };
    // Capo 3 turns an open C into an Eb. Every sounding note goes up 3.
    const plain = voicingMidi(openC, 0);
    const capped = capoMidi(openC, 3);
    expect(capped).toEqual(plain.map((m) => m + 3));
  });

  it("an Am shape with a capo on 2 is a Bm", () => {
    const d = describeCapo(parseChordSymbol("Am")!, 2, C, sharpName);
    expect(d.shapeLabel).toBe("Am");
    expect(d.soundedLabel).toBe("Bm");
    expect(d.sentence).toContain("capo on fret 2");
  });

  it("a C shape with a capo on 3 sounds as Eb", () => {
    const d = describeCapo(parseChordSymbol("C")!, 3, C, sharpName);
    expect(d.shapeLabel).toBe("C");
    expect(d.soundedLabel).toBe("D#"); // sharp spelling, since key is C major
  });

  it("names both the shape and the sounding chord", () => {
    const d = describeCapo(parseChordSymbol("G")!, 2, C, sharpName);
    // G shape + capo 2 sounds as A.
    expect(d.shapeLabel).toBe("G");
    expect(d.soundedLabel).toBe("A");
  });

  it("reports one name when there is no capo", () => {
    const d = describeCapo(parseChordSymbol("C")!, 0, C, sharpName);
    expect(d.shapeLabel).toBe("C");
    expect(d.soundedLabel).toBe("C");
    expect(d.sentence).toBe("C");
  });

  it("shapeKeyFor and soundingKey are inverses", () => {
    for (const capo of [0, 1, 2, 3, 5, 7]) {
      const shapeKey = shapeKeyFor(C, capo);
      const back = soundingKey(shapeKey, capo);
      expect(back.tonic, `capo ${capo}`).toBe(C.tonic);
    }
  });

  it("to sound in D with a capo on 2, play C shapes", () => {
    const d: KeySignature = { tonic: 2, letter: "D", mode: "major" };
    const shapeKey = shapeKeyFor(d, 2);
    expect(shapeKey.letter).toBe("C");

    // And a C shape with the capo on 2 does sound as D.
    const cShape = parseChordSymbol("C")!;
    const sounded = soundedChord(cShape, 2, d);
    expect(sharpName(sounded.root)).toBe("D");
  });
});

describe("key helpers", () => {
  it("lists twelve distinct keys", () => {
    const keys = allKeys("major");
    expect(keys).toHaveLength(12);
    expect(new Set(keys.map((k) => k.tonic)).size).toBe(12);
  });

  it("names keys readably, keeping the intended spelling", () => {
    expect(keyName({ tonic: 3, letter: "Eb", mode: "major" })).toBe("Eb major");
    expect(keyName({ tonic: 0, letter: "C", mode: "major" })).toBe("C major");
  });

  it("formats fret strings", () => {
    const shape = { tuningId: "standard", frets: [null, 3, 2, 0, 1, 0] as (number | null)[] };
    expect(fretsToCompact(shape)).toBe("x32010");
  });
});

describe("chord symbols round-trip through transposition", () => {
  it("keeps suffix spelling", () => {
    for (const symbol of ["C", "Am", "F#m7", "G7", "Bbmaj7"]) {
      const chord = parseChordSymbol(symbol)!;
      const up = transposeChord(chord, 3);
      const down = transposeChord(up, -3);
      expect(chordSymbol(down), symbol).toBe(chordSymbol(chord));
    }
  });
});
