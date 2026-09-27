import { PROGRESSIONS, allGenres, progressionChords } from "@/lib/progressions/data";
import { voicingsFor } from "@/lib/music/voicing";
import {
  ProgressionLibrary,
  type LibraryEntry,
  type LibraryGenre,
} from "@/components/ProgressionLibrary";

export const metadata = {
  title: "Chord progressions — ggchords",
  description:
    "Common guitar chord progressions by genre, with shapes ranked by difficulty.",
};

/**
 * The library index.
 *
 * The shape search runs here, at build time, and only the results are shipped
 * to the browser. The genre filter is a client component operating on plain
 * data, so switching genres is instant rather than a re-render of a few
 * thousand generated fingerings.
 */
export default function ProgressionsPage() {
  const entries: LibraryEntry[] = PROGRESSIONS.map((progression) => {
    const chords = progressionChords(progression);
    return {
      id: progression.id,
      title: progression.title,
      keyName: progression.keyName,
      minor: progression.symbols[0]?.endsWith("m") ?? false,
      genre: progression.genre,
      level: progression.level,
      description: progression.description,
      chords: chords
        .map((chord, index) => {
          const set = voicingsFor(chord, {
            prefer: progression.symbols[index],
          });
          if (!set.preferred) return null;
          return {
            symbol: set.symbol,
            frets: set.options[0]?.frets ?? "",
            description: set.options[0]?.description ?? "",
            shape: set.preferred,
          };
        })
        .filter((chord): chord is NonNullable<typeof chord> => chord !== null),
    };
  });

  // Genre counts, so the chips can show how much is behind each one.
  const genres: LibraryGenre[] = allGenres().map((name) => ({
    name,
    count: entries.filter((entry) => entry.genre.includes(name)).length,
  }));

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Chord progressions
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          {PROGRESSIONS.length} progressions. Each one shows the shapes you
          would actually use, with the easiest option first. Open a progression
          to transpose it, add a capo, or hear it played.
        </p>
      </div>

      <ProgressionLibrary entries={entries} genres={genres} />
    </main>
  );
}
