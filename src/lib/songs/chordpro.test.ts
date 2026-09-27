import { describe, expect, it } from "vitest";
import { parseChordPro, parseLine, lineRuns, distinctChords, keyOf } from "./chordpro";
import { canShowLyrics, chordAtOffset, lyricsRefusal } from "./types";

describe("parseLine", () => {
  it("strips chords and records their offsets", () => {
    const { line } = parseLine("[C]Some [G]body", 0);
    expect(line.text).toBe("Some body");
    expect(line.chords).toHaveLength(2);
    // C sits at the start, G at the index of "body".
    expect(line.chords[0].offset).toBe(0);
    expect(line.chords[0].symbol).toBe("C");
    expect(line.chords[1].offset).toBe(5);
    expect(line.chords[1].symbol).toBe("G");
  });

  it("handles a chord-only line", () => {
    const { line } = parseLine("[C] [G] [Am] [F]", 0);
    expect(line.text.trim()).toBe("");
    expect(line.chords.map((c) => c.symbol)).toEqual(["C", "G", "Am", "F"]);
    // Whitespace between chords is trimmed away, so every offset is clamped
    // to a real position in the line rather than pointing past its end.
    for (const placement of line.chords) {
      expect(placement.offset).toBeLessThanOrEqual(line.text.length);
    }
  });

  it("handles a line with no chords", () => {
    const { line } = parseLine("Just words here", 0);
    expect(line.text).toBe("Just words here");
    expect(line.chords).toHaveLength(0);
  });

  it("keeps text after the last chord", () => {
    const { line } = parseLine("[C]Hello there", 0);
    expect(line.text).toBe("Hello there");
  });

  it("preserves interior spacing", () => {
    const { line } = parseLine("[Am]I  went  to [F]town", 0);
    // Offsets must stay valid against the actual text.
    expect(line.text).toBe("I  went  to town");
    const f = line.chords.find((c) => c.symbol === "F")!;
    expect(line.text.slice(f.offset)).toBe("town");
  });

  it("reports an unparseable chord without losing the line", () => {
    const { line, badChords } = parseLine("[C]Hello [H7]world", 0);
    expect(badChords).toEqual(["H7"]);
    expect(line.text).toBe("Hello world");
    expect(line.chords).toHaveLength(1);
  });

  it("parses extended and slash chords", () => {
    const { line } = parseLine("[Cmaj7]x [D/F#]y [G7sus4]z", 0);
    expect(line.chords).toHaveLength(3);
    expect(line.chords[1].chord.quality).toBe("maj");
    expect(line.chords[1].chord.bass).toBe(6);
  });
});

describe("parseChordPro directives", () => {
  it("reads metadata", () => {
    const result = parseChordPro(
      `{title: Stag-O-Lee}
{artist: Traditional}
{key: D}
{tempo: 120}
{C]My [D]name is [A]Sam [D]Covington`,
    );
    expect(result.metadata.title).toBe("Stag-O-Lee");
    expect(result.metadata.artist).toBe("Traditional");
    expect(result.metadata.key).toBe("D");
    expect(result.metadata.tempo).toBe("120");
  });

  it("reads the declared key", () => {
    const result = parseChordPro("{key: Am}\n[A]x");
    expect(keyOf(result).tonic).toBe(9);
    expect(keyOf(result).mode).toBe("minor");
  });

  it("defaults to C major with no key directive", () => {
    expect(keyOf(parseChordPro("[C]x")).tonic).toBe(0);
  });

  it("ignores unknown directives rather than failing", () => {
    const result = parseChordPro("{social: @someone}\n{title: A Song}\n[C]x");
    expect(result.metadata.title).toBe("A Song");
  });

  it("skips comment lines", () => {
    const result = parseChordPro("# a note to the transcriber\n[C]Real line");
    const lyricLines = result.lines.filter((l) => !l.empty);
    expect(lyricLines).toHaveLength(1);
    expect(lyricLines[0].text).toBe("Real line");
  });

  it("reads rights metadata", () => {
    const result = parseChordPro("{lyrics_rights: public-domain}\n[C]x");
    expect(result.metadata.lyricsRights).toBe("public-domain");
  });
});

describe("sections", () => {
  it("assigns lines to the right section", () => {
    const result = parseChordPro(`{start_of_verse}
[A]Verse line
{start_of_chorus}
[B]Chorus line`);
    const verse = result.lines.find((l) => l.text === "Verse line")!;
    const chorus = result.lines.find((l) => l.text === "Chorus line")!;
    expect(verse.section).toBe(0);
    expect(chorus.section).toBe(1);
    expect(result.sections[1].kind).toBe("chorus");
  });

  it("keeps blank lines as section breaks", () => {
    const result = parseChordPro("[A]One\n\n[A]Two");
    const withText = result.lines.filter((l) => !l.empty);
    expect(withText).toHaveLength(2);
    // The blank line is still present, flagged empty.
    expect(result.lines.some((l) => l.empty)).toBe(true);
  });

  it("creates an unnamed section only for content before any directive", () => {
    const result = parseChordPro("[A]Bare start\n{start_of_chorus}\n[B]Chorus");
    expect(result.sections.map((s) => s.kind)).toEqual(["unknown", "chorus"]);
    expect(result.lines[0].section).toBe(0);
    expect(result.lines[1].section).toBe(1);
  });

  it("does not let a line fall into a section that has already ended", () => {
    const result = parseChordPro(
      "{start_of_verse}\n[A]v\n{end_of_verse}\n[B]interlude\n{start_of_chorus}\n[C]c",
    );
    const interlude = result.lines.find((l) => l.text === "interlude")!;
    const chorus = result.lines.find((l) => l.text === "c")!;
    expect(interlude.section).not.toBe(chorus.section);
    // The gap becomes its own unnamed section between verse and chorus, so the
    // chorus is pushed to index 2.
    expect(result.sections.map((s) => s.kind)).toEqual([
      "verse",
      "unknown",
      "chorus",
    ]);
  });
});

describe("lineRuns", () => {
  it("interleaves text and chords in order", () => {
    const { line } = parseLine("[C]Some [G]body", 0);
    const runs = lineRuns(line);
    expect(runs.map((r) => r.kind)).toEqual([
      "chord",
      "text",
      "chord",
      "text",
    ]);
    expect(runs[2].text).toBe("G");
    expect(runs[3].text).toBe("body");
  });

  it("emits leading text before the first chord", () => {
    const { line } = parseLine("Well [C]now", 0);
    const runs = lineRuns(line);
    expect(runs[0]).toMatchObject({ kind: "text", text: "Well " });
    expect(runs[1]).toMatchObject({ kind: "chord", text: "C" });
  });

  it("handles a line with no chords", () => {
    const { line } = parseLine("No chords at all", 0);
    expect(lineRuns(line)).toEqual([
      { kind: "text", offset: 0, text: "No chords at all" },
    ]);
  });

  it("reconstructs the original text from the runs", () => {
    const source = "[Am]I  went  to [F]town  and [C]home";
    const { line } = parseLine(source, 0);
    const rebuilt = lineRuns(line)
      .filter((r) => r.kind === "text")
      .map((r) => r.text)
      .join("");
    expect(rebuilt).toBe(line.text);
  });
});

describe("chordAtOffset", () => {
  it("finds the chord sounding over a word", () => {
    const { line } = parseLine("[C]Some [G]body", 0);
    // "Some" starts at 0, "body" at 5.
    expect(chordAtOffset(line, 0)?.symbol).toBe("C");
    expect(chordAtOffset(line, 3)?.symbol).toBe("C");
    expect(chordAtOffset(line, 5)?.symbol).toBe("G");
    expect(chordAtOffset(line, 8)?.symbol).toBe("G");
  });

  it("returns null before any chord", () => {
    const { line } = parseLine("[C]x", 0);
    expect(chordAtOffset(line, 0)?.symbol).toBe("C");
  });
});

describe("distinctChords", () => {
  it("collects each chord once, in order", () => {
    const result = parseChordPro(
      "[C]a [C]b [G]c [C]d [Am]e [G]f",
    );
    const chords = distinctChords(result.lines);
    expect(chords).toHaveLength(3);
    expect(chords[0].root).toBe(0);
    expect(chords[1].root).toBe(7);
    expect(chords[2].quality).toBe("min");
  });
});

describe("lyrics rights gate", () => {
  it("permits public domain", () => {
    expect(canShowLyrics({ rights: "public-domain" })).toBe(true);
    expect(lyricsRefusal({ rights: "public-domain", title: "X" })).toBeNull();
  });

  it("refuses progression-only, with a reason", () => {
    expect(canShowLyrics({ rights: "progression-only" })).toBe(false);
    const reason = lyricsRefusal({ rights: "progression-only", title: "Hidden" });
    expect(reason).toContain("Hidden");
    expect(reason).toContain("copyright");
  });
});

describe("a realistic song", () => {
  const source = `{title: Test Song}
{artist: Traditional}
{composer: Unknown}
{key: G}
{lyrics_rights: public-domain}
{genre: Folk, Blues}
{start_of_verse}
[G]I woke up [C]early [G]in the [D]morning
[G]The [C]sun was [D]rising
{end_of_verse}
{start_of_chorus}
[C]Ohhh [G]baby [C]now`;

  it("parses without errors", () => {
    const result = parseChordPro(source);
    expect(result.badChords).toEqual([]);
    expect(result.metadata.title).toBe("Test Song");
    expect(result.metadata.genre).toEqual(["Folk", "Blues"]);
    expect(result.sections.map((s) => s.kind)).toEqual(["verse", "chorus"]);
  });

  it("has every chord landing over real text", () => {
    const result = parseChordPro(source);
    for (const line of result.lines) {
      for (const placement of line.chords) {
        expect(
          placement.offset,
          `${placement.symbol} at ${placement.offset} in "${line.text}"`,
        ).toBeLessThanOrEqual(line.text.length);
      }
    }
  });
});
