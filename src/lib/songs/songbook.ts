/**
 * The songbook.
 *
 * Public-domain material only. The rights field is not decorative: the lyrics
 * renderer refuses to display anything that is not `public-domain`, so a
 * careless addition here cannot publish protected words.
 *
 * Sources are traditional and folk repertoire whose authorship is either
 * genuinely unknown or long out of copyright. Where a specific collection or
 * arranger is known it is recorded, because "traditional" is a claim that
 * deserves a citation.
 */

import {
  type LyricsRights,
  type Song,
  type SongSection,
  type SongLine,
} from "./types";
import type { ArchiveLink, SongRecording } from "./types";

/**
 * Build archive search links for a song title.
 *
 * These are deliberately *search* URLs, not permalinks to individual items.
 * A permalink has to be verified, and an unverified one either 404s or — worse
 * — lands the listener on a different song with a similar title. A search into
 * a public archive is always correct, and the Internet Archive's search API is
 * stable enough to rely on.
 */
function archiveLinks(title: string, extra: ArchiveLink[] = []): ArchiveLink[] {
  const query = encodeURIComponent(title);
  return [
    {
      label: "Internet Archive",
      source: "Internet Archive",
      url: `https://archive.org/search?query=${query}&sin=TXT`,
      note: "Thousands of 78rpm and field recordings, most pre-1972. Search for the song title.",
    },
    {
      label: "Library of Congress",
      source: "Library of Congress",
      url: `https://www.loc.gov/audio/?q=${query}&fa=partof:archive+of+folk+song`,
      note: "The Archive of American Folk Song, 1933–1942. The closest thing to a canonical recording for traditional material.",
    },
    ...extra,
  ];
}
import { distinctChords, keyOf, parseChordPro } from "./chordpro";
import { parseChordSymbol } from "@/lib/music/chords";

export interface SongSource {
  /** Path to the .chopro file, relative to the repo root. */
  file: string;
  /** Who to credit. */
  source?: string;
  rights: LyricsRights;
  genre?: string[];
  year?: number;
  composer?: string;
  /**
   * A recording the site owner made, which they hold the rights to. Drop the
   * file in public/audio/ and point `src` at it.
   */
  recording?: Song["recording"];
  /** External archives where a real performance can be heard. */
  archiveLinks?: Song["archiveLinks"];
}

export interface SongEntry extends SongSource {
  /**
   * Fallback title, used when the ChordPro file has no {title:} directive.
   * The file is authoritative; this exists so a catalogue entry is still
   * meaningful if the directive is ever dropped.
   */
  title?: string;
  id: string;
}

/**
 * The catalogue.
 *
 * Each entry points at a text file rather than inlining the lyrics, so the
 * content is diffable and a correction is a readable change.
 */
export const SONGBOOK: SongEntry[] = [
  {
    id: "shangri-la",
    file: "data/songs/shangri-la.chopro",
    source: "Traditional. Collected by Frank Harford (1907).",
    rights: "public-domain",
    genre: ["Traditional", "Folk"],
    year: 1907,
    // No recording slot yet. Drop an MP3 in public/audio/ and point
    // `recording.src` at it to have one appear here.
    archiveLinks: archiveLinks("Shangri-La"),
  },
  {
    id: "scarborough-fair",
    file: "data/songs/scarborough-fair.chopro",
    source: "Traditional English ballad. Roud Folk Song Index no. 12.",
    rights: "public-domain",
    genre: ["Traditional", "Folk", "Ballad"],
    archiveLinks: archiveLinks("Scarborough Fair", [
      {
        label: "The Elfin Knight",
        source: "Roud Folksong Index",
        url: "https://www.vwml.org/collections/Roud",
        note: "Scarborough Fair is a variant of Child ballad no. 2, The Elfin Knight. The Roud index cross-references the two.",
      },
    ]),
  },
  {
    id: "shady-grove",
    file: "data/songs/shady-grove.chopro",
    source: "Traditional Appalachian song. Melody first published 1915.",
    rights: "public-domain",
    genre: ["Traditional", "Folk", "Appalachian"],
    archiveLinks: archiveLinks("Shady Grove", [
      {
        label: "Song background",
        source: "Roud Folk Song Index no. 4456",
        url: "https://en.wikipedia.org/wiki/Shady_Grove_(song)",
        note: "The Dorian melody, related to the older ballad Matty Groves. Useful for hearing the tune the chords sit under.",
      },
    ]),
  },
];

/** Parse a ChordPro document into a Song. */
export function buildSong(entry: SongEntry, source: string): Song {
  const parsed = parseChordPro(source);
  const title = parsed.metadata.title ?? entry.title ?? entry.id;

  return {
    id: entry.id,
    title,
    artist: parsed.metadata.artist,
    year: entry.year ?? (parsed.metadata.year ? Number(parsed.metadata.year) : undefined),
    composer: entry.composer ?? parsed.metadata.composer,
    key: keyOf(parsed),
    progression: distinctChords(parsed.lines),
    sections: parsed.sections,
    lines: parsed.lines,
    genre: entry.genre ?? parsed.metadata.genre ?? ["Traditional"],
    rights: (parsed.metadata.lyricsRights as LyricsRights) ?? entry.rights,
    source: entry.source ?? parsed.metadata.source,
    notes: parsed.metadata.comment,
    recording: entry.recording,
    archiveLinks: entry.archiveLinks,
  };
}

export type { ArchiveLink, SongRecording };

/** Ids for static generation. */
export function songIds(): string[] {
  return SONGBOOK.map((song) => song.id);
}

export function findSongEntry(id: string): SongEntry | undefined {
  return SONGBOOK.find((song) => song.id === id);
}

export type { Song, SongLine, SongSection, LyricsRights };
export { parseChordSymbol };
