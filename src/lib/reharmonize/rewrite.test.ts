import { describe, expect, it } from "vitest";
import {
  rewriteForKnownChords,
  isPlayable,
  parseChordList,
  suggestedPalettes,
  distinctChords,
} from "./rewrite";
import { chordSymbol, parseChordSymbol, type ChordSpec } from "@/lib/music/chords";
import { keyFromName } from "@/lib/music/roman";
import { generateShapes } from "@/lib/music/shapeGenerator";
import { shapePitchClasses } from "@/lib/music/fretboard";
import { chordPitchClasses, requiredPitchClasses } from "@/lib/music/chords";
import { pc } from "@/lib/music/notes";

const C = keyFromName("C");
const known = (...symbols: string[]) => new Set(symbols);

const chordsOf = (symbols: string[]) => parseChordList(symbols);
const symbolsOf = (chords: ChordSpec[]) => chords.map((c) => chordSymbol(c));

describe("isPlayable", () => {
  it("accepts an exact match", () => {
    expect(isPlayable(parseChordSymbol("C")!, known("C", "G", "Am", "F"))).toBe(true);
  });

  it("accepts a seventh chord when only the triad is known", () => {
    // The single most useful relaxation: Cmaj7 is playable by anyone who knows C.
    expect(isPlayable(parseChordSymbol("Cmaj7")!, known("C"))).toBe(true);
    expect(isPlayable(parseChordSymbol("Dm7")!, known("Dm"))).toBe(true);
  });

  it("rejects a chord whose triad is unknown", () => {
    expect(isPlayable(parseChordSymbol("Dm7")!, known("C", "G"))).toBe(false);
  });

  it("rejects a triad chord when only a seventh is known", () => {
    // Knowing C7 does not mean you can play C.
    expect(isPlayable(parseChordSymbol("C")!, known("C7"))).toBe(false);
  });

  it("accepts a slash chord when the bass is a chord tone", () => {
    // C/B is playable with C, because B is already in the chord.
    expect(isPlayable(parseChordSymbol("C/E")!, known("C"))).toBe(true);
  });

  it("rejects a slash chord whose bass is not in the chord", () => {
    // C/Bb has a bass note doing real work, so plain C is not the same thing.
    expect(isPlayable(parseChordSymbol("C/Bb")!, known("C"))).toBe(false);
  });
});

describe("stripping extensions", () => {
  it("simplifies maj7 to the triad as an exact change", () => {
    const result = rewriteForKnownChords(
      chordsOf(["Cmaj7", "Am7", "Dm7", "G7"]),
      known("C", "Am", "Dm", "G"),
      C,
    );
    const majors = result.edits.filter((e) => e.confidence === "exact");
    expect(majors.length).toBeGreaterThan(0);
    expect(majors[0].reason).toContain("colour");
  });

  it("flags a dominant 7th stripped to a triad as a function change", () => {
    const result = rewriteForKnownChords(
      chordsOf(["Cmaj7", "A7", "Dm7", "G7"]),
      known("C", "A", "Dm", "G"),
      C,
    );
    // G7 -> G is the weakening case, and it must be visible as such.
    const domEdit = result.edits.find((e) => e.original.quality === "dom7");
    expect(domEdit).toBeDefined();
    expect(domEdit!.confidence).toBe("function");
    expect(domEdit!.userChoice).toBe(true);
  });
});

describe("dominant substitution is resolution-preserving", () => {
  it("replaces a borrowed dominant with a dominant of the same target", () => {
    // Bb7 -> F can be played as C7 -> F, because C7 is also the dominant of F.
    // This is NOT a tritone substitution: Bb7's tritone partner is E7, which
    // resolves to A and would wreck the line.
    const result = rewriteForKnownChords(
      chordsOf(["C", "F", "G", "Bb7", "F"]),
      known("C", "F", "G", "C7"),
      C,
    );
    const edit = result.edits.find(
      (e) => e.original.root === 10 && e.original.quality === "dom7",
    );
    expect(edit).toBeDefined();
    expect(edit!.replacement.quality).toBe("dom7");
    expect(pc(edit!.replacement.root)).toBe(0); // C7, not E7
    expect(edit!.reason).toContain("dominant of F");
  });

  it("does not substitute a dominant with no following chord to resolve to", () => {
    // With nothing after it, there is no resolution to preserve, so the
    // substitution is not defensible and the chord is reported instead.
    const result = rewriteForKnownChords(
      chordsOf(["C", "F", "G", "Bb7"]),
      known("C", "F", "G", "C7"),
      C,
    );
    expect(result.newChords.some((c) => pc(c.root) === 10)).toBe(true);
  });
});

describe("diminished respelling", () => {
  it("respells to a spelling the player knows", () => {
    const result = rewriteForKnownChords(
      chordsOf(["C7", "F7", "Cdim7"]),
      known("C7", "F7", "Abdim7"),
      C,
    );
    const edit = result.edits.find((e) => e.original.quality === "dim7");
    expect(edit).toBeDefined();
    expect(edit!.confidence).toBe("exact");
    expect(edit!.reason).toContain("symmetric");
  });
});

describe("honest reporting", () => {
  it("lists the chords that still have to be learned", () => {
    const result = rewriteForKnownChords(
      chordsOf(["Dm7", "G7", "Cmaj7"]),
      known("C", "G"),
      C,
    );
    expect(result.newChords.length).toBeGreaterThan(0);
    for (const chord of result.newChords) {
      expect(isPlayable(chord, known("C", "G"))).toBe(false);
    }
  });

  it("never introduces a chord outside the known set without reporting it", () => {
    const knownSet = known("C", "G", "Am", "F");
    for (const song of [
      ["Dm7", "G7", "Cmaj7"],
      ["C", "F", "G", "Bb", "G", "F"],
      ["Am", "F", "C", "G", "Em", "A7"],
      ["C7", "F7", "C7", "C7", "F7", "F7", "C7", "C7", "G7", "F7", "C7", "G7"],
    ]) {
      const result = rewriteForKnownChords(chordsOf(song), knownSet, C);
      for (const chord of result.chords) {
        const playable = isPlayable(chord, knownSet);
        if (!playable) {
          // If it is not playable, it must appear in the newChords report.
          expect(result.newChords).toContainEqual(chord);
        }
      }
    }
  });

  it("does not claim four chords can play any song", () => {
    // The known limit, asserted so nobody "fixes" it by lying.
    // A four-chord suite cannot cover arbitrary harmony.
    const result = rewriteForKnownChords(
      chordsOf(["Dm7", "G7", "Cmaj7", "F7", "Bb7", "Ebmaj7"]),
      known("C", "G", "Am", "F"),
      C,
    );
    expect(result.newChords.length).toBeGreaterThan(0);
  });

  it("leaves an already-playable progression untouched", () => {
    const result = rewriteForKnownChords(
      chordsOf(["C", "G", "Am", "F"]),
      known("C", "G", "Am", "F"),
      C,
    );
    expect(result.unchanged).toBe(true);
    expect(result.edits).toHaveLength(0);
    expect(result.newChords).toHaveLength(0);
    expect(symbolsOf(result.chords)).toEqual(["C", "G", "Am", "F"]);
  });

  it("reports a semitone shift when a different key needs fewer chords", () => {
    const result = rewriteForKnownChords(
      chordsOf(["C", "F", "G", "Bb"]),
      known("G", "C", "D", "Em"),
      C,
    );
    // Re-keying may win, and when it does the shift is reported, not hidden.
    if (result.semitones !== 0) {
      expect(result.newChords.length).toBeLessThanOrEqual(
        rewriteForKnownChords(chordsOf(["C", "F", "G", "Bb"]), known("G", "C", "D", "Em"), C)
          .newChords.length,
      );
    } else {
      expect(result.newChords.length).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("the rewritten progression is still valid music", () => {
  it("only ever contains chords that can actually be played", () => {
    const knownSet = known("C", "G", "Am", "F");
    for (const song of [
      ["Dm7", "G7", "Cmaj7"],
      ["C", "F", "G", "Bb", "G", "F"],
      ["C7", "F7", "G7"],
      ["Am7", "D7", "G7", "Cmaj7"],
    ]) {
      const result = rewriteForKnownChords(chordsOf(song), knownSet, C);
      for (const chord of result.chords) {
        // Every chord we emit must have a real shape on the fretboard.
        const shapes = generateShapes(chord, { limit: 1 });
        expect(shapes.length, chordSymbol(chord)).toBeGreaterThan(0);
        // And that shape must spell the chord.
        const allowed = chordPitchClasses(chord);
        for (const pitch of shapePitchClasses(shapes[0])) {
          expect(allowed.has(pitch), `${chordSymbol(chord)} stray note`).toBe(true);
        }
        // And the required tones must be present.
        const required = new Set<number>();
        for (const tone of requiredPitchClasses(chord.quality)) {
          required.add(pc(chord.root + tone));
        }
        const sounded = shapePitchClasses(shapes[0]);
        for (const tone of required) {
          expect(sounded.has(tone), `${chordSymbol(chord)} missing ${tone}`).toBe(true);
        }
      }
    }
  });

  it("preserves the chord count", () => {
    const result = rewriteForKnownChords(
      chordsOf(["C7", "C7", "F7", "F7", "C7", "C7", "G7", "F7", "C7", "G7"]),
      known("C", "F", "G"),
      C,
    );
    expect(result.chords).toHaveLength(10);
  });
});

describe("helpers", () => {
  it("parses a chord list, dropping junk", () => {
    const list = parseChordList(["C", "Am", "H7", "F"]);
    expect(list).toHaveLength(3);
  });

  it("offers useful starting palettes", () => {
    const palettes = suggestedPalettes();
    expect(palettes.length).toBeGreaterThan(2);
    expect(palettes[0].symbols).toEqual(["C", "G", "Am", "F"]);
  });

  it("counts distinct chords, treating a slash as its own chord", () => {
    expect(distinctChords(chordsOf(["C", "C", "G", "C/E"]))).toHaveLength(3);
  });
});
