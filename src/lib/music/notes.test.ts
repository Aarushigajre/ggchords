import { describe, expect, it } from "vitest";
import {
  degreeName,
  flatName,
  isValidNoteName,
  letterSpelling,
  parseNoteName,
  pc,
  prefersSharps,
  scaleNames,
  sharpName,
} from "./notes";

describe("pc", () => {
  it("wraps above 11", () => {
    expect(pc(12)).toBe(0);
    expect(pc(13)).toBe(1);
    expect(pc(24)).toBe(0);
  });

  it("wraps below 0", () => {
    expect(pc(-1)).toBe(11);
    expect(pc(-12)).toBe(0);
    expect(pc(-13)).toBe(11);
  });
});

describe("note names", () => {
  it("gives sharps and flats for the black keys", () => {
    expect(sharpName(1)).toBe("C#");
    expect(flatName(1)).toBe("Db");
    expect(sharpName(3)).toBe("D#");
    expect(flatName(3)).toBe("Eb");
    expect(sharpName(10)).toBe("A#");
    expect(flatName(10)).toBe("Bb");
  });
});

describe("letterSpelling", () => {
  it("returns the bare letter for a natural", () => {
    expect(letterSpelling(0, "C")).toBe("C");
    expect(letterSpelling(4, "E")).toBe("E");
  });

  it("adds an accidental in the right direction", () => {
    expect(letterSpelling(3, "D")).toBe("D#");
    expect(letterSpelling(3, "E")).toBe("Eb");
    expect(letterSpelling(8, "G")).toBe("G#");
    expect(letterSpelling(8, "A")).toBe("Ab");
  });
});

describe("parseNoteName", () => {
  it("round-trips both spellings", () => {
    for (const name of ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"]) {
      expect(isValidNoteName(name)).toBe(true);
    }
    expect(parseNoteName("C#")).toBe(parseNoteName("Db"));
    expect(parseNoteName("Eb")).toBe(parseNoteName("D#"));
  });

  it("accepts unicode accidentals", () => {
    expect(parseNoteName("C♯")).toBe(1);
    expect(parseNoteName("E♭")).toBe(3);
  });

  it("rejects nonsense", () => {
    expect(isValidNoteName("H")).toBe(false);
    expect(isValidNoteName("Cb#")).toBe(false);
    expect(isValidNoteName("")).toBe(false);
  });
});

describe("degreeName", () => {
  it("spells the C major scale", () => {
    const c = { tonic: 0, letter: "C", mode: "major" as const };
    expect(scaleNames(c)).toEqual(["C", "D", "E", "F", "G", "A", "B"]);
  });

  it("spells the G major scale with an F#", () => {
    const g = { tonic: 7, letter: "G", mode: "major" as const };
    expect(scaleNames(g)).toEqual(["G", "A", "B", "C", "D", "E", "F#"]);
  });

  it("spells the F major scale with a Bb", () => {
    const f = { tonic: 5, letter: "F", mode: "major" as const };
    expect(scaleNames(f)).toEqual(["F", "G", "A", "Bb", "C", "D", "E"]);
  });

  it("spells the Eb major scale correctly", () => {
    const eb = { tonic: 3, letter: "E", mode: "major" as const };
    expect(scaleNames(eb)).toEqual(["Eb", "F", "G", "Ab", "Bb", "C", "D"]);
  });

  it("spells the D major scale with F# and C#", () => {
    const d = { tonic: 2, letter: "D", mode: "major" as const };
    expect(scaleNames(d)).toEqual(["D", "E", "F#", "G", "A", "B", "C#"]);
  });

  it("spells the B major scale with all the sharps", () => {
    const b = { tonic: 11, letter: "B", mode: "major" as const };
    expect(scaleNames(b)).toEqual(["B", "C#", "D#", "E", "F#", "G#", "A#"]);
  });

  it("spells A minor as a natural minor scale", () => {
    const am = { tonic: 9, letter: "A", mode: "minor" as const };
    expect(scaleNames(am)).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
  });

  it("can append the minor marker", () => {
    const am = { tonic: 9, letter: "A", mode: "minor" as const };
    expect(degreeName(am, 0, true)).toBe("Am");
    expect(degreeName(am, 0, false)).toBe("A");
  });

  it("never produces a double accidental", () => {
    // Every key, every degree: the spelling must always be single-accidental
    // or natural. A double sharp here means the letter walk is broken.
    for (const letter of ["C", "D", "E", "F", "G", "A", "B"]) {
      for (const mode of ["major", "minor"] as const) {
        const key = { tonic: pc(parseNoteName(letter)), letter, mode };
        for (const name of scaleNames(key)) {
          expect(name).toMatch(/^[A-G](#|b)?$/);
        }
      }
    }
  });
});

describe("prefersSharps", () => {
  it("puts F major on the flat side", () => {
    expect(prefersSharps({ tonic: 5, letter: "F", mode: "major" })).toBe(false);
  });

  it("puts G major on the sharp side", () => {
    expect(prefersSharps({ tonic: 7, letter: "G", mode: "major" })).toBe(true);
  });
});
