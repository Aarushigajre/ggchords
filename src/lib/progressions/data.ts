/**
 * The abstract-progression library.
 *
 * This is deliberately separate from `Song`. A progression is harmony with no
 * words attached: a title, a genre, a key, roman numerals, and a suggested
 * strum pattern. Nothing here carries lyrics, so none of the rights machinery
 * in `songs/types.ts` applies.
 *
 * Chords are written as symbols and parsed, never as interval data. A typo in
 * the data becomes a visibly unparseable chord rather than a silent error, and
 * the same symbols appear in the UI so the data stays readable.
 */

import { type ChordSpec, parseChordSymbol } from "@/lib/music/chords";
import type { KeySignature } from "@/lib/music/notes";
import { keyFromName } from "@/lib/music/roman";
import type { StrumPatternId } from "@/lib/strum/patterns";

export type Genre =
  | "Pop"
  | "Rock"
  | "Blues"
  | "Country"
  | "Jazz"
  | "Folk"
  | "Soul"
  | "Metal"
  | "Classical";

export interface Progression {
  id: string;
  title: string;
  /** Alternate names people search for, e.g. "the four chords". */
  aliases?: string[];
  genre: Genre[];
  /** Chord symbols in order, e.g. ["C", "G", "Am", "F"]. */
  symbols: string[];
  /** Key the symbols are written in. */
  keyName: string;
  /** Beats per bar, for the playback grid. */
  meter: number;
  /** Chords per bar, used to lay the progression on the strum grid. */
  chordsPerBar: number;
  strumPattern: StrumPatternId;
  /** Suggested tempo in BPM. */
  tempo: number;
  description: string;
  /** What this progression is good for, in plain language. */
  use?: string;
  /** Difficulty hint for the reader. */
  level?: "beginner" | "intermediate" | "advanced";
}

/**
 * The library.
 *
 * Keys are mostly C major and A minor because that is where the canonical
 * shapes live, which is what makes these the easiest progressions to actually
 * play rather than merely to read.
 */
export const PROGRESSIONS: Progression[] = [
  {
    id: "one-five-six-four",
    title: "I–V–vi–IV",
    aliases: ["the four chords", "1-5-6-4", "three chords and a fourth"],
    genre: ["Pop", "Rock", "Folk"],
    symbols: ["C", "G", "Am", "F"],
    keyName: "C",
    meter: 4,
    chordsPerBar: 1,
    strumPattern: "folk-8ths",
    tempo: 96,
    description:
      "The most widespread progression in Western popular music. Descending, emotionally unresolved, and it never quite settles.",
    use: "Singing. Because it loops so smoothly it suits nearly any melody, which is why it turns up everywhere.",
    level: "beginner",
  },
  {
    id: "six-four-one-five",
    title: "vi–IV–I–V",
    aliases: ["1-6-4-5", "vi-IV-I-V"],
    genre: ["Pop", "Soul", "Folk"],
    symbols: ["Am", "F", "C", "G"],
    keyName: "C",
    meter: 4,
    chordsPerBar: 1,
    strumPattern: "folk-8ths",
    tempo: 84,
    description:
      "The same four chords as I–V–vi–IV, rotated to begin on the relative minor. Starting on vi puts the listener in a darker place.",
    use: "Verses that want to sit slightly unresolved before the chorus lifts.",
    level: "beginner",
  },
  {
    id: "one-six-four-five",
    title: "I–vi–IV–V",
    aliases: ["1-6-4-5", "50s progression"],
    genre: ["Pop", "Rock", "Soul"],
    symbols: ["C", "Am", "F", "G"],
    keyName: "C",
    meter: 4,
    chordsPerBar: 1,
    strumPattern: "rock-8ths",
    tempo: 140,
    description:
      "The doo-wop and 1950s rock-and-roll progression. The V–I at the end is a strong, obvious cadence.",
    use: "Upbeat material with a clear beginning and end to each phrase.",
    level: "beginner",
  },
  {
    id: "three-six-four-five",
    title: "I–iii–IV–V",
    aliases: ["1-3-4-5", "50s minor"],
    genre: ["Pop", "Rock", "Soul"],
    symbols: ["C", "Em", "F", "G"],
    keyName: "C",
    meter: 4,
    chordsPerBar: 1,
    strumPattern: "rock-8ths",
    tempo: 132,
    description:
      "I–vi–IV–V with the vi raised to a major III. The brighter sound is what gives mid-century pop its bounce.",
    use: "Anything that wants to sound sunny and retro.",
    level: "beginner",
  },
  {
    id: "five-six-four-one",
    title: "I–V–vi–IV with a I",
    aliases: ["canon", "pachelbel", "royal progression"],
    genre: ["Pop", "Rock", "Folk", "Classical"],
    symbols: ["C", "G", "Am", "F", "C", "F", "G", "C"],
    keyName: "C",
    meter: 4,
    chordsPerBar: 1,
    strumPattern: "folk-8ths",
    tempo: 72,
    description:
      "The descending bass of Pachelbel's Canon, in eight chords. Famously the subject of the 1983 film score.",
    use: "Ballads, and anywhere a descending bass line should be audible.",
    level: "beginner",
  },
  {
    id: "one-four-one-five",
    title: "I–IV–I–V",
    aliases: ["1-4-1-5", "country-plain"],
    genre: ["Country", "Folk", "Blues"],
    symbols: ["C", "F", "C", "G"],
    keyName: "C",
    meter: 4,
    chordsPerBar: 1,
    strumPattern: "boom-chick",
    tempo: 118,
    description:
      "The plainest progression in country music. Two chords, alternating, with a strong V to close each phrase.",
    use: "Anything with a walking bass underneath. Very forgiving of a new player.",
    level: "beginner",
  },
  {
    id: "twelve-bar-blues",
    title: "12-bar blues",
    aliases: ["blues", "twelve bar"],
    genre: ["Blues"],
    symbols: ["C7", "C7", "C7", "C7", "F7", "F7", "C7", "C7", "G7", "F7", "C7", "G7"],
    keyName: "C",
    meter: 4,
    chordsPerBar: 1,
    strumPattern: "shuffle",
    tempo: 92,
    description:
      "Three four-bar phrases over a I–IV–V harmony. Public domain in the truest sense: this structure is centuries old.",
    use: "Improvisation. The form is a container, and the blues scale over it is the first language worth learning.",
    level: "beginner",
  },
  {
    id: "eight-bar-blues",
    title: "8-bar blues",
    aliases: ["jazz-blues"],
    genre: ["Blues", "Jazz"],
    symbols: ["C7", "C7", "F7", "F7", "C7", "C7", "G7", "G7"],
    keyName: "C",
    meter: 4,
    chordsPerBar: 1,
    strumPattern: "jazz-comping",
    tempo: 120,
    description:
      "A jazz reading of the blues, built on II–V–I rather than I–IV–V. Two chords of tension, one of home.",
    use: "Jazz comping, where the underlying harmony is a II–V–I in four different keys.",
    level: "intermediate",
  },
  {
    id: "six-two-five",
    title: "1–6–2–5",
    aliases: ["1-6-2-5", "country-swing"],
    genre: ["Country", "Folk"],
    symbols: ["G", "E", "C", "D"],
    keyName: "G",
    meter: 4,
    chordsPerBar: 1,
    strumPattern: "boom-chick",
    tempo: 126,
    description:
      "Country's signature turnaround. The I–vi–ii–V is a descending-fifths sequence, which is why it never quite arrives.",
    use: "Fast country, western swing, and anything that wants to keep moving.",
    level: "beginner",
  },
  {
    id: "one-six-two-five",
    title: "I–vi–ii–V",
    aliases: ["1-6-2-5", "turnaround"],
    genre: ["Jazz", "Soul", "Pop"],
    symbols: ["Cmaj7", "Am7", "Dm7", "G7"],
    keyName: "C",
    meter: 4,
    chordsPerBar: 1,
    strumPattern: "jazz-comping",
    tempo: 96,
    description:
      "The jazz turnaround, in seventh chords. The G7 is a dominant that leans hard toward C, setting up the return.",
    use: "The last four bars before a chorus, and a way into the II–V–I language.",
    level: "intermediate",
  },
  {
    id: "ii-v-i",
    title: "ii–V–I",
    aliases: ["2-5-1", "jazz cadence"],
    genre: ["Jazz"],
    symbols: ["Dm7", "G7", "Cmaj7"],
    keyName: "C",
    meter: 4,
    chordsPerBar: 2,
    strumPattern: "jazz-comping",
    tempo: 100,
    description:
      "The defining harmonic motion in Western harmony. Two seconds of tension and resolution, repeated.",
    use: "Learning to hear resolution. Worth playing in twelve keys before anything else.",
    level: "intermediate",
  },
  {
    id: "ii-v-i-flavoured",
    title: "Pop ii–V–I",
    aliases: ["jazz-pop", "7-1"],
    genre: ["Pop", "Jazz", "Soul"],
    symbols: ["Cmaj7", "A7", "Dm7", "G7"],
    keyName: "C",
    meter: 4,
    chordsPerBar: 1,
    strumPattern: "jazz-comping",
    tempo: 100,
    description:
      "I–V–vi–IV with the chords a jazz arranger would use. Nothing exotic, just seventh chords doing the same work.",
    use: "Pop arrangements that want to sound sophisticated without changing the song's shape.",
    level: "intermediate",
  },
  {
    id: "one-six-three-seven",
    title: "i–VI–III–VII",
    aliases: ["1-6-3-7", "minor-epic"],
    genre: ["Rock", "Metal", "Pop"],
    symbols: ["Am", "F", "C", "G"],
    keyName: "Am",
    meter: 4,
    chordsPerBar: 1,
    strumPattern: "rock-8ths",
    tempo: 120,
    description:
      "The minor-key counterpart to I–V–vi–IV, borrowing the upper chords of the parallel major. The sound of a fist raised at the sky.",
    use: "Anthems. The ♭VI and ♭VII are what make it read as epic rather than merely sad.",
    level: "beginner",
  },
  {
    id: "one-seven-six-five",
    title: "i–VII–VI–V",
    aliases: ["1-7-6-5", "andalusian"],
    genre: ["Folk", "Metal", "Rock"],
    symbols: ["Am", "G", "F", "E"],
    keyName: "Am",
    meter: 4,
    chordsPerBar: 1,
    strumPattern: "metal-palm",
    tempo: 108,
    description:
      "Descending stepwise all the way down, ending on a dominant that never resolves. Common in Spanish flamenco and modern metal alike.",
    use: "Anything needing forward motion without arrival.",
    level: "beginner",
  },
  {
    id: "one-seven-six",
    title: "i–VII–VI",
    aliases: ["1-7-6", "dorian"],
    genre: ["Folk", "Blues"],
    symbols: ["Am", "G", "F"],
    keyName: "Am",
    meter: 4,
    chordsPerBar: 1,
    strumPattern: "folk-8ths",
    tempo: 112,
    description:
      "Three chords, no leading tone, no resolution. Because there is no G♯ anywhere, A minor here sounds like D Dorian.",
    use: "Modal playing, Celtic reels, and anything that should feel open rather than resolved.",
    level: "beginner",
  },
  {
    id: "flat-seven-country",
    title: "I–IV–V–♭VII–V–IV",
    aliases: ["1-4-5-b7", "country-bVII"],
    genre: ["Country", "Folk", "Rock"],
    symbols: ["C", "F", "G", "Bb", "G", "F"],
    keyName: "C",
    meter: 4,
    chordsPerBar: 1,
    strumPattern: "boom-chick",
    tempo: 124,
    description:
      "Country with the ♭VII borrowed in. The B♭ sits a step below the tonic and pulls the ear back toward the C.",
    use: "Western swing, and a cheap way to make four chords sound like a song.",
    level: "intermediate",
  },
  {
    id: "one-four-five",
    title: "I–IV–V",
    aliases: ["1-4-5", "three chords"],
    genre: ["Rock", "Blues", "Folk", "Country"],
    symbols: ["C", "F", "G"],
    keyName: "C",
    meter: 4,
    chordsPerBar: 1,
    strumPattern: "rock-8ths",
    tempo: 128,
    description:
      "As few chords as a song can have and still be a song. Every rock band that has ever existed knows these three.",
    use: "Riffs, and learning to hear the difference between I, IV and V.",
    level: "beginner",
  },
  {
    id: "one-four-five-upbeat",
    title: "I–IV–V (upbeat strum)",
    aliases: ["1-4-5-strum"],
    genre: ["Pop", "Rock"],
    symbols: ["C", "F", "G"],
    keyName: "C",
    meter: 4,
    chordsPerBar: 1,
    strumPattern: "upbeat-pop",
    tempo: 120,
    description:
      "The same three chords as the entry above, but strummed with a lifted upstroke. Often the difference between a song sounding flat and sounding alive.",
    use: "Anything with a chorus. The accent is the arrangement.",
    level: "beginner",
  },
];

/** Parse a progression's symbols into chord specs, dropping anything invalid. */
export function progressionChords(progression: Progression): ChordSpec[] {
  return progression.symbols
    .map((symbol) => parseChordSymbol(symbol))
    .filter((chord): chord is ChordSpec => chord !== null);
}

/** The key a progression is written in. */
export function progressionKey(progression: Progression): KeySignature {
  return keyFromName(progression.keyName, progression.symbols[0]?.endsWith("m") ? "minor" : "major");
}

/** Look up a progression by id. */
export function findProgression(id: string): Progression | undefined {
  return PROGRESSIONS.find((progression) => progression.id === id);
}

/** All distinct genres, for the filter UI. */
export function allGenres(): Genre[] {
  const seen = new Set<Genre>();
  for (const progression of PROGRESSIONS) {
    for (const genre of progression.genre) seen.add(genre);
  }
  return [...seen].sort();
}

/** Ids for static generation of the detail pages. */
export function progressionIds(): string[] {
  return PROGRESSIONS.map((progression) => progression.id);
}
