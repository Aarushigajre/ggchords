import { describe, expect, it } from "vitest";
import { analyseChord, analyseProgression, keyFromName, keyLabel } from "./roman";
import { parseChordSymbol, chordSymbol, type ChordSpec } from "./chords";
import type { KeySignature } from "./notes";

const C: KeySignature = { tonic: 0, letter: "C", mode: "major" };
const A_MINOR: KeySignature = { tonic: 9, letter: "A", mode: "minor" };
const EB: KeySignature = { tonic: 3, letter: "Eb", mode: "major" };

const num = (symbol: string, key: KeySignature) =>
  analyseChord(parseChordSymbol(symbol)!, key).text;

describe("diatonic triads in C major", () => {
  it("names the seven degrees", () => {
    expect(num("C", C)).toBe("I");
    expect(num("Dm", C)).toBe("ii");
    expect(num("Em", C)).toBe("iii");
    expect(num("F", C)).toBe("IV");
    expect(num("G", C)).toBe("V");
    expect(num("Am", C)).toBe("vi");
    expect(num("Bdim", C)).toBe("viio");
  });

  it("analyses the four chords correctly", () => {
    // This is the exact case that was broken: I-V-vi-IV came out as
    // I-bI-bI-VI because degrees were treated as semitone counts.
    const chords = ["C", "G", "Am", "F"].map((s) => parseChordSymbol(s)!);
    expect(analyseProgression(chords, C).map((n) => n.text)).toEqual([
      "I",
      "V",
      "vi",
      "IV",
    ]);
  });

  it("rotations give the same numerals", () => {
    const chords = ["Am", "F", "C", "G"].map((s) => parseChordSymbol(s)!);
    expect(analyseProgression(chords, C).map((n) => n.text)).toEqual([
      "vi",
      "IV",
      "I",
      "V",
    ]);
  });
});

describe("diatonic seventh chords", () => {
  it("uses upper case for major sevenths and lower for minor", () => {
    expect(num("Cmaj7", C)).toBe("Imaj7");
    expect(num("Dm7", C)).toBe("ii7");
    expect(num("Em7", C)).toBe("iii7");
    expect(num("Fmaj7", C)).toBe("IVmaj7");
    expect(num("G7", C)).toBe("V7");
    expect(num("Am7", C)).toBe("vi7");
    expect(num("Bm7b5", C)).toBe("viiø7");
  });

  it("handles the 12-bar blues", () => {
    const chords: ChordSpec[] = [
      "C7", "C7", "C7", "C7", "F7", "F7",
      "C7", "C7", "G7", "F7", "C7", "G7",
    ].map((s) => parseChordSymbol(s)!);
    expect(analyseProgression(chords, C).map((n) => n.text)).toEqual([
      "I7", "I7", "I7", "I7", "IV7", "IV7",
      "I7", "I7", "V7", "IV7", "I7", "V7",
    ]);
  });

  it("analyses ii-V-I", () => {
    const chords = ["Dm7", "G7", "Cmaj7"].map((s) => parseChordSymbol(s)!);
    expect(analyseProgression(chords, C).map((n) => n.text)).toEqual([
      "ii7",
      "V7",
      "Imaj7",
    ]);
  });
});

describe("borrowed chords", () => {
  it("names the modal-interchange degrees in a major key", () => {
    expect(num("Eb", C)).toBe("bIII");
    expect(num("Ab", C)).toBe("bVI");
    expect(num("Bb", C)).toBe("bVII");
    expect(num("Db", C)).toBe("bII");
  });

  it("names the major-mode degrees in a minor key", () => {
    // A natural minor is A B C D E F G, so C major really is III and G major
    // really is VII. These are diatonic, not borrowed. The borrowed ones are
    // the chords that need accidentals: Eb is bVI and B major is II.
    expect(num("C", A_MINOR)).toBe("III");
    expect(num("G", A_MINOR)).toBe("VII");
    expect(num("Eb", A_MINOR)).toBe("bVI");
    expect(num("B", A_MINOR)).toBe("II");
    expect(analyseChord(parseChordSymbol("C")!, A_MINOR).diatonic).toBe(true);
    expect(analyseChord(parseChordSymbol("Eb")!, A_MINOR).diatonic).toBe(false);
  });

  it("marks them as borrowed, not diatonic", () => {
    expect(analyseChord(parseChordSymbol("Bb")!, C).diatonic).toBe(false);
    expect(analyseChord(parseChordSymbol("F")!, C).diatonic).toBe(true);
  });

  it("handles the country bVII progression", () => {
    const chords = ["C", "F", "G", "Bb", "G", "F"].map((s) => parseChordSymbol(s)!);
    expect(analyseProgression(chords, C).map((n) => n.text)).toEqual([
      "I",
      "IV",
      "V",
      "bVII",
      "V",
      "IV",
    ]);
  });
});

describe("secondary dominants", () => {
  it("names D7 as V7/V in C", () => {
    // D7 resolves to G, which is V in C.
    expect(num("D7", C)).toBe("V7/V");
  });

  it("names A7 as V7/ii in C", () => {
    expect(num("A7", C)).toBe("V7/ii");
  });

  it("names E7 as V7/vi in C", () => {
    expect(num("E7", C)).toBe("V7/vi");
  });

  it("leaves a plain diatonic V7 alone", () => {
    expect(num("G7", C)).toBe("V7");
  });
});

describe("minor keys", () => {
  it("names the natural minor degrees", () => {
    expect(num("Am", A_MINOR)).toBe("i");
    expect(num("Bdim", A_MINOR)).toBe("iio");
    expect(num("C", A_MINOR)).toBe("III");
    expect(num("Dm", A_MINOR)).toBe("iv");
    expect(num("Em", A_MINOR)).toBe("v");
    expect(num("F", A_MINOR)).toBe("VI");
    expect(num("G", A_MINOR)).toBe("VII");
  });

  it("handles i-VI-III-VII", () => {
    const chords = ["Am", "F", "C", "G"].map((s) => parseChordSymbol(s)!);
    expect(analyseProgression(chords, A_MINOR).map((n) => n.text)).toEqual([
      "i",
      "VI",
      "III",
      "VII",
    ]);
  });
});

describe("key independence", () => {
  it("analyses the same chords differently in different keys", () => {
    // D is the fifth of G and the tonic of D. In C major, D *major* is a
    // borrowed II — uppercase, because the triad really is major. It is D
    // minor that is the diatonic ii.
    expect(num("D", keyFromName("G"))).toBe("V");
    expect(num("D", keyFromName("D"))).toBe("I");
    expect(num("Dm", C)).toBe("ii");
    expect(num("D", C)).toBe("II");
    expect(analyseChord(parseChordSymbol("D")!, C).diatonic).toBe(false);
    expect(num("C", keyFromName("F"))).toBe("V");
    expect(num("G", C)).toBe("V");
  });

  it("works in flat keys", () => {
    expect(num("Ebmaj", EB)).toBe("I");
    expect(num("Fm", EB)).toBe("ii");
    expect(num("Bb", EB)).toBe("V");
    expect(num("Ab", EB)).toBe("IV");
  });
});

describe("key parsing", () => {
  it("parses names with modes", () => {
    expect(keyFromName("Eb")).toEqual({ tonic: 3, letter: "Eb", mode: "major" });
    expect(keyFromName("Am")).toEqual({ tonic: 9, letter: "A", mode: "minor" });
  });

  it("labels keys readably", () => {
    expect(keyLabel(EB)).toBe("Eb major");
  });
});

describe("every chord gets a numeral", () => {
  it("never returns the unknown marker for a real chord", () => {
    const keys = [C, A_MINOR, EB, keyFromName("G"), keyFromName("D")];
    const symbols = [
      "C", "Am", "F", "G", "Em", "Dm", "Bb", "C7", "G7", "Dm7", "Cmaj7",
      "Am7", "Bdim", "Bm7b5", "Cdim7", "F#m", "D7", "A7", "E7", "G#m",
    ];
    for (const key of keys) {
      for (const symbol of symbols) {
        const result = analyseChord(parseChordSymbol(symbol)!, key);
        expect(result.text, `${symbol} in ${keyLabel(key)}`).not.toBe("?");
      }
    }
  });
});

describe("chord symbols round-trip", () => {
  it("parses and re-renders the library vocabulary", () => {
    for (const symbol of ["C", "Am", "F#m7", "Bb7", "C/E", "G7sus4", "Ebmaj7"]) {
      const chord = parseChordSymbol(symbol)!;
      expect(parseChordSymbol(chordSymbol(chord)), symbol).not.toBeNull();
    }
  });
});
