/**
 * ChordPro parser.
 *
 * Songs are authored as plain text in the ChordPro format, which is the
 * standard notation for chord sheets:
 *
 *     {title: Stag-O-Lee}
 *     {key: D}
 *     [A]My [D]name is [A]Sam [D]Covington
 *
 * The reason for a text format rather than a database is diffability. A song
 * is a text file, so corrections, re-keys and new arrangements are reviewable
 * changes rather than migrations.
 *
 * The important output detail: each chord records the character offset in the
 * *stripped* lyric line where it begins. That offset is what the hover
 * interaction needs — both to know which chord sits over a given word, and
 * where to anchor the diagram popover.
 */

import {
  type ChordPlacement,
  type SectionKind,
  type SongLine,
  type SongSection,
} from "./types";
import { type ChordSpec, parseChordSymbol } from "@/lib/music/chords";
import { keyFromName } from "@/lib/music/roman";
import type { KeySignature } from "@/lib/music/notes";

/** Metadata gathered from {directives}. */
export interface ChordProMetadata {
  title?: string;
  subtitle?: string;
  artist?: string;
  composer?: string;
  key?: string;
  tempo?: string;
  time?: string;
  lyricsRights?: string;
  source?: string;
  genre?: string[];
  year?: string;
  comment?: string;
}

export interface ParseResult {
  metadata: ChordProMetadata;
  sections: SongSection[];
  lines: SongLine[];
  /** Chords that could not be parsed, so the caller can report them. */
  badChords: string[];
}

const DIRECTIVE_RE = /^\{([^:}]+):\s*(.*?)\}\s*$/;
/**
 * Section directives carry no value, so they have no colon:
 * `{start_of_verse}` rather than `{start_of_verse: ...}`. They need their own
 * pattern, because the directive regex above requires a colon and would
 * silently let every `{start_of_verse}` through as a lyric line.
 */
const SECTION_RE = /^\{(start|end)_of_([a-z]+)\}\s*$/i;
const INLINE_CHORD_RE = /\[([^\]]+)\]/g;

const SECTION_DIRECTIVES: Record<string, SectionKind> = {
  start_of_verse: "verse",
  start_of_chorus: "chorus",
  start_of_bridge: "bridge",
  start_of_intro: "intro",
  start_of_outro: "outro",
  start_of_refrain: "refrain",
  start_of_instrumental: "instrumental",
};

/**
 * Parse one line into plain text plus chord placements.
 *
 * Chords are stripped from the text and recorded against the offset they
 * preceded, so `[C]Some [G]body` becomes text "Some body" with C at 0 and G
 * at 5 — the index of "body".
 */
export function parseLine(
  input: string,
  section: number,
): { line: SongLine; badChords: string[] } {
  const badChords: string[] = [];
  const placements: ChordPlacement[] = [];
  let text = "";
  let lastIndex = 0;

  INLINE_CHORD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_CHORD_RE.exec(input)) !== null) {
    // Everything between the previous chord and this one is lyric text.
    const between = input.slice(lastIndex, match.index);
    text += between;
    lastIndex = match.index + match[0].length;

    const symbol = match[1].trim();
    const chord: ChordSpec | null = parseChordSymbol(symbol);
    if (chord) {
      placements.push({ offset: text.length, chord, symbol });
    } else if (symbol.length > 0) {
      // Keep the text intact and report the problem rather than dropping the
      // chord silently, so a typo in the source is visible.
      badChords.push(symbol);
    }
  }
  text += input.slice(lastIndex);

  // Normalise the tail only. Replacing the trailing newline with nothing keeps
  // every earlier offset valid; the offsets recorded above point into the text
  // as it stands, so nothing earlier needs shifting.
  const trimmedEnd = text.replace(/\s+$/, "");
  const hadContent = trimmedEnd.length > 0;

  // Whitespace *between* chords on a chord-only line ("| C | G | Am |") ends up
  // in the text and then gets trimmed away, which would leave the later offsets
  // pointing past the end of the line. Clamping keeps every offset addressable,
  // which is what the hover lookup depends on.
  for (const placement of placements) {
    if (placement.offset > trimmedEnd.length) {
      placement.offset = trimmedEnd.length;
    }
  }

  return {
    line: {
      section,
      text: trimmedEnd,
      chords: placements,
      empty: !hadContent,
    },
    badChords,
  };
}

/**
 * Parse a whole ChordPro document.
 *
 * Section tracking is deliberately simple: a `{start_of_*}` directive opens a
 * section and everything until the next one belongs to it. Blank lines are
 * kept, because they are the verse breaks players read by.
 */
export function parseChordPro(source: string): ParseResult {
  const metadata: ChordProMetadata = {};
  const lines: SongLine[] = [];
  const sections: SongSection[] = [];
  const badChords: string[] = [];

  // No section is created until one is actually needed. A document that opens
  // with {start_of_verse} should have its verse at section 0, not at section 1
  // behind a phantom unnamed section.
  let currentSection = 0;
  // `end_of_x` closes a section; it does not open one. A line appearing while
  // no section is open gets a lazily-created gap section, so nothing is
  // attributed to a section that has already ended.
  let sectionOpen = false;

  const openSection = (kind: SectionKind) => {
    currentSection = sections.length;
    sections.push({ kind, order: currentSection });
    sectionOpen = true;
  };
  const gapSection = () => {
    if (sectionOpen) return;
    openSection("unknown");
  };

  for (const rawLine of source.split("\n")) {
    const trimmed = rawLine.trim();

    // Section boundaries are checked first, since they carry no value.
    const sectionDirective = SECTION_RE.exec(trimmed);
    if (sectionDirective) {
      const [, edge, name] = sectionDirective;
      if (edge.toLowerCase() === "start") {
        openSection(
          SECTION_DIRECTIVES[`start_of_${name.toLowerCase()}`] ?? "unknown",
        );
      } else {
        sectionOpen = false;
      }
      continue;
    }

    const directive = DIRECTIVE_RE.exec(trimmed);
    if (directive) {
      const name = directive[1].trim().toLowerCase();
      const value = directive[2].trim();

      switch (name) {
        case "title":
          metadata.title = value;
          break;
        case "subtitle":
          metadata.subtitle = value;
          break;
        case "artist":
          metadata.artist = value;
          break;
        case "composer":
          metadata.composer = value;
          break;
        case "key":
          metadata.key = value;
          break;
        case "tempo":
          metadata.tempo = value;
          break;
        case "time":
          metadata.time = value;
          break;
        case "comment":
          metadata.comment = value;
          break;
        case "source":
          metadata.source = value;
          break;
        case "year":
          metadata.year = value;
          break;
        case "lyrics_rights":
        case "lyricsrights":
          metadata.lyricsRights = value;
          break;
        case "genre": {
          metadata.genre = value
            .split(/[,;]/)
            .map((g) => g.trim())
            .filter(Boolean);
          break;
        }
        default:
          // Unknown directives are ignored rather than fatal, so a songbook
          // written for a richer tool still imports.
          break;
      }
      continue;
    }

    // A bare comment line.
    if (rawLine.trimStart().startsWith("#")) continue;

    gapSection();
    const { line, badChords: bad } = parseLine(rawLine, currentSection);
    lines.push(line);
    badChords.push(...bad);
  }

  return { metadata, sections, lines, badChords };
}

/** The key a document declares, defaulting to C major. */
export function keyOf(result: ParseResult): KeySignature {
  return result.metadata.key
    ? keyFromName(result.metadata.key)
    : { tonic: 0, letter: "C", mode: "major" };
}

/** Every distinct chord in a parsed document, in first-appearance order. */
export function distinctChords(lines: SongLine[]): ChordSpec[] {
  const seen = new Set<string>();
  const out: ChordSpec[] = [];
  for (const line of lines) {
    for (const placement of line.chords) {
      const { root, quality, bass } = placement.chord;
      const key = `${root}:${quality}:${bass ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(placement.chord);
    }
  }
  return out;
}

/**
 * Split a line's text into runs, so a renderer can interleave lyric text with
 * chord markers at the right character offsets.
 */
export interface TextRun {
  kind: "text" | "chord";
  /** Character offset in the line's text. For a chord, where it sits. */
  offset: number;
  text: string;
  chord?: ChordPlacement;
}

/**
 * Turn a line into an ordered list of runs.
 *
 * The renderer walks this and emits a chord marker before the word it belongs
 * to, which is what puts the chord in the right visual place without needing
 * to measure text.
 */
export function lineRuns(line: SongLine): TextRun[] {
  const runs: TextRun[] = [];
  const chords = [...line.chords].sort((a, b) => a.offset - b.offset);

  let cursor = 0;
  chords.forEach((placement, index) => {
    if (placement.offset > cursor) {
      runs.push({
        kind: "text",
        offset: cursor,
        text: line.text.slice(cursor, placement.offset),
      });
    }
    runs.push({ kind: "chord", offset: placement.offset, text: placement.symbol, chord: placement });
    cursor = placement.offset;
    void index;
  });

  if (cursor < line.text.length) {
    runs.push({ kind: "text", offset: cursor, text: line.text.slice(cursor) });
  }
  return runs;
}
