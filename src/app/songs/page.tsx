import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { SONGBOOK, buildSong } from "@/lib/songs/songbook";
import { canShowLyrics } from "@/lib/songs/types";
import { chordSymbol } from "@/lib/music/chords";
import { voicingsFor } from "@/lib/music/voicing";
import { ChordDiagram } from "@/components/ChordDiagram";
import { nameInKey } from "@/lib/music/notes";

export const metadata = {
  title: "Public-domain songs — ggchords",
  description:
    "Traditional and folk songs with chords over the lyrics. Lyrics are public domain; progressions are free for any song.",
};

export default function SongsPage() {
  const songs = SONGBOOK.map((entry) => {
    const source = readFileSync(join(process.cwd(), entry.file), "utf8");
    return buildSong(entry, source);
  });

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Songs</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Traditional and folk songs with chords printed over the lyrics. Hover
          any chord for its shape, or hover a word to see which chord sounds
          there.
        </p>
      </div>

      <div className="mb-10 rounded-xl border border-line/70 bg-panel p-5">
        <h2 className="mb-2 text-sm font-medium">Where the sound comes from</h2>
        <p className="text-[13px] leading-relaxed text-ink-muted">
          There are no recordings on this site. Pressing{" "}
          <strong className="text-ink">Play chords</strong> synthesises a strummed
          guitar part in the browser, from the chord shapes on the page, using a
          Karplus-Strong plucked-string model. That means the audio always
          matches the shape and capo you have chosen, and it works in tunings
          nobody has recorded.
        </p>

        <h2 className="mb-2 mt-5 text-sm font-medium">Why only public domain?</h2>
        <p className="text-[13px] leading-relaxed text-ink-muted">
          Chord progressions are not copyrightable — harmony is a fact or a
          method, not an expression, so the chords to any song can be published
          freely. Lyrics are a protected literary work, and the melody with
          them. So this songbook is limited to traditional and folk material
          where the <em>whole work</em> has entered the public domain: the words
          and the tune both, from collections old enough to be out of copyright.
          A modern song can be listed here by progression, but its words cannot
          be shown.
        </p>
      </div>

      <div className="space-y-3">
        {songs.map((song) => (
          <Link
            key={song.id}
            href={`/songs/${song.id}/`}
            className="group block rounded-xl border border-line/70 bg-panel p-5 transition-colors hover:border-line-strong hover:bg-panel-raised"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-medium tracking-tight">
                {song.title}
              </h2>
              <span className="text-[11px] text-ink-faint">
                {[song.artist, song.composer, song.year]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>

            <div className="mt-1 mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-faint">
              {song.genre.slice(0, 3).map((genre) => (
                <span key={genre}>{genre}</span>
              ))}
              {canShowLyrics(song) ? (
                <span className="text-accent">
                  Public domain — tune and lyrics
                </span>
              ) : (
                <span>Chords only</span>
              )}
              {song.source && (
                <span className="w-full text-ink-faint/80">{song.source}</span>
              )}
            </div>

            <div className="flex gap-3 overflow-x-auto pb-1 scroll-slim">
              {song.progression.map((chord, index) => {
                const set = voicingsFor(chord, {
                  key: song.key,
                  prefer: chordSymbol(chord, (p) => nameInKey(p, song.key)),
                });
                if (!set.preferred) return null;
                return (
                  <div
                    key={index}
                    className="shrink-0 text-center"
                    title={set.options[0]?.description}
                  >
                    <ChordDiagram
                      shape={set.preferred}
                      keySignature={song.key}
                      size="sm"
                      hideNotes
                    />
                    <div className="mt-1 text-[11px] text-ink-muted">
                      {set.symbol}
                    </div>
                  </div>
                );
              })}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
