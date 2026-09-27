/**
 * Song types and, critically, the rights model.
 *
 * Chord progressions are not copyrightable: harmony is a fact or a method, not
 * an expression, and only melody, lyrics and distinctive voice leading are
 * protected. Lyrics, on the other hand, are a fully protected literary work.
 *
 * That asymmetry is why this project only carries public-domain songs. The
 * `LyricsRights` field below is the enforcement point: the lyrics renderer
 * checks it and refuses to display anything that is not `public-domain`.
 * Encoding the boundary in the type system, rather than in a comment, means a
 * careless import cannot ship copyrighted lyrics.
 */

import type { ChordSpec } from "@/lib/music/chords";
import type { KeySignature } from "@/lib/music/notes";

/**
 * What we are permitted to display for a given song.
 *
 * `public-domain` — the whole work: words and tune. Traditional and folk
 *   material is either of unknown authorship, or collected from sources whose
 *   copyright has expired (the 1907 Frank Harford collection, for instance), so
 *   there is nothing left to license. This is why the songbook can be used
 *   freely rather than merely cited.
 * `progression-only` — the chord progression only, never lyrics. Reserved for
 *   material we may analyse but not reproduce the words of. A modern song sits
 *   here: the harmony is publishable, the words are not.
 */
export type LyricsRights = "public-domain" | "progression-only";

export type SectionKind =
  | "verse"
  | "chorus"
  | "bridge"
  | "intro"
  | "outro"
  | "refrain"
  | "instrumental"
  | "unknown";

export interface SongSection {
  kind: SectionKind;
  /** Display label, e.g. "Verse 2". */
  label?: string;
  /** Index of this section in the song, for prev/next navigation. */
  order: number;
}

/**
 * A chord placed at a character offset within a line of lyrics.
 *
 * `offset` is the index into the line's plain text where this chord begins.
 * It is what drives the hover interaction: hovering a word highlights the
 * chord sounding there, and hovering a chord shows its diagram.
 */
export interface ChordPlacement {
  offset: number;
  chord: ChordSpec;
  /** The symbol as written, for display. */
  symbol: string;
}

/** A single line of lyrics with its chords. */
export interface SongLine {
  /** Section this line belongs to. */
  section: number;
  /** The lyric text, with chord markers removed. */
  text: string;
  /** Chords positioned within `text`. */
  chords: ChordPlacement[];
  /** True for a blank or instrumental line, which still shows chords. */
  empty?: boolean;
}

/** A song, as parsed from ChordPro. */
export interface Song {
  id: string;
  title: string;
  artist?: string;
  /** Year of first publication, where known. Used to show provenance. */
  year?: number;
  /** Traditional/folk repertoire, or by a named author. */
  composer?: string;
  key: KeySignature;
  /** Distinct chord symbols, in first-appearance order, for the summary. */
  progression: ChordSpec[];
  sections: SongSection[];
  lines: SongLine[];
  genre: string[];
  /**
   * What we are allowed to show. The lyrics renderer will not display lyrics
   * unless this is exactly "public-domain".
   */
  rights: LyricsRights;
  /**
   * Where the text and tune came from, for the credits. "Traditional" is a
   * claim that deserves a citation, so this names the collection where one is
   * known rather than saying nothing.
   */
  source?: string;
  notes?: string;
  /**
   * A recording of the song, if one is available.
   *
   * Almost always absent, and that is a rights position rather than an
   * oversight. The composition being public domain does not make a recording of
   * it free: a sound recording is a separate copyrighted work, and for
   * anything made before 1972 in the US it does not enter the public domain
   * before 2067. So third-party recordings are linked to, never hosted.
   *
   * This slot is for recordings the site's own owner made, which they hold the
   * rights to. See `public/audio/README.md`.
   */
  recording?: SongRecording;
  /**
   * Places where a real recording can be heard, hosted elsewhere. These are
   * search links into public archives rather than permalinks to specific
   * items, because a permalink to an item we have not verified is worse than
   * useless: it 404s, or worse, points at the wrong song.
   */
  archiveLinks?: ArchiveLink[];
}

/** A recording we are permitted to host. */
export interface SongRecording {
  /** Path under /public, e.g. "audio/shangri-la.mp3". */
  src: string;
  /** Who performed it. */
  credit: string;
  /**
   * A short statement of rights, e.g. "Recorded by the site owner, released
   * under CC BY 4.0". Required: a recording without a stated licence is
   * exactly the ambiguity this project exists to avoid.
   */
  license: string;
  /** Optional year. */
  year?: number;
}

/** An external place a recording can be heard. */
export interface ArchiveLink {
  label: string;
  /** Where it lives, e.g. "Internet Archive". */
  source: string;
  url: string;
  /** What you will find there, in plain words. */
  note: string;
}

/** Can we display the lyrics of this song? */
export function canShowLyrics(song: Pick<Song, "rights">): boolean {
  return song.rights === "public-domain";
}

/**
 * A refusal that carries a reason, so the UI can explain rather than just
 * silently showing nothing.
 */
export function lyricsRefusal(song: Pick<Song, "rights" | "title">): string | null {
  if (canShowLyrics(song)) return null;
  return `Lyrics for "${song.title}" are withheld. This song's progression is public information, but its words are still under copyright, so only the chords are shown.`;
}

/** Flatten a song's lines into the distinct chords it uses. */
export function songProgression(song: Song): ChordSpec[] {
  const seen = new Map<string, ChordSpec>();
  for (const line of song.lines) {
    for (const placement of line.chords) {
      const key = `${placement.chord.root}:${placement.chord.quality}:${placement.chord.bass ?? ""}`;
      if (!seen.has(key)) seen.set(key, placement.chord);
    }
  }
  return [...seen.values()];
}

/** Every chord that sounds at a given character offset in a line. */
export function chordsAtOffset(line: SongLine, offset: number): ChordPlacement[] {
  return line.chords.filter(
    (placement) =>
      placement.offset <= offset &&
      (placement === line.chords[line.chords.length - 1] ||
        (line.chords[line.chords.indexOf(placement) + 1]?.offset ?? Infinity) > offset),
  );
}

/**
 * The chord sounding at a character offset, i.e. the most recent chord at or
 * before that point. This is the "what do I play over this word" lookup.
 */
export function chordAtOffset(line: SongLine, offset: number): ChordPlacement | null {
  let current: ChordPlacement | null = null;
  for (const placement of line.chords) {
    if (placement.offset > offset) break;
    current = placement;
  }
  return current;
}
