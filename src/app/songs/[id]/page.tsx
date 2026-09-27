import { readFileSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  buildSong,
  findSongEntry,
  songIds,
} from "@/lib/songs/songbook";
import { chordSymbol } from "@/lib/music/chords";
import { ChordDiagram } from "@/components/ChordDiagram";
import { voicingsFor } from "@/lib/music/voicing";
import { nameInKey } from "@/lib/music/notes";
import { keyName } from "@/lib/music/transpose";
import { SongPractice } from "@/components/SongPractice";
import { canShowLyrics } from "@/lib/songs/types";

/**
 * Song detail pages.
 *
 * The ChordPro files are read at build time. This is a static export with no
 * server, so reading them here rather than at request time is not a
 * convenience, it is the only option — and it is the right one, because the
 * songbook is versioned text that belongs in the repository.
 */

export function generateStaticParams() {
  return songIds().map((id) => ({ id }));
}

function loadSong(id: string) {
  const entry = findSongEntry(id);
  if (!entry) return null;
  const source = readFileSync(join(process.cwd(), entry.file), "utf8");
  return buildSong(entry, source);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const song = loadSong(id);
  if (!song) return { title: "Not found — ggchords" };
  return {
    title: `${song.title} chords and lyrics — ggchords`,
    description: song.composer ?? song.artist ?? "Traditional song",
  };
}

export default async function SongPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const song = loadSong(id);
  if (!song) notFound();

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-6">
        <Link
          href="/songs"
          className="text-xs text-ink-faint transition-colors hover:text-accent"
        >
          ← Songs
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {song.title}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {[song.artist, song.composer, song.year].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {song.genre.map((genre) => (
            <span
              key={genre}
              className="rounded bg-panel px-2 py-0.5 text-[11px] text-ink-faint"
            >
              {genre}
            </span>
          ))}
          <span className="rounded bg-panel px-2 py-0.5 text-[11px] text-accent">
            {keyName(song.key)}
          </span>
        </div>
      </div>

      {/* Reference and provenance, up top.
          Both the words and the tune are free here, not just the lyrics. That
          is the difference between this material and a modern song, where the
          chords are publishable but the words are not. */}
      <SongReference song={song} />

      {/* The song itself, first, as a plain reference. The chorded practice
          sheet is further down the page; this is for reading and singing the
          words without chord names interrupting the lines. */}
      <PlainLyrics song={song} />

      {/* Practice bar, audio, autoscroll and the interactive sheet are one
          client component, because the autoscroll has to stay in time with the
          audio and both need the shapes the sheet is displaying. */}
      <div className="mt-12 border-t border-line/70 pt-8">
        <h2 className="mb-1 text-sm font-medium">Chords and practice</h2>
        <p className="mb-6 max-w-2xl text-xs leading-relaxed text-ink-faint">
          Hover any chord below for its fingering, or hover a word to see which
          chord sounds there. Play the backing track, or turn on autoscroll to
          glide the lyrics past at a steady rate — use − and + to match it to
          the song.
        </p>

      {/* Chord summary */}
      <div className="mb-10 rounded-xl border border-line/70 bg-panel p-4">
        <h2 className="mb-3 text-sm font-medium">Chords used</h2>
        <div className="flex gap-3 overflow-x-auto pb-1 scroll-slim">
          {song.progression.map((chord, index) => {
            const set = voicingsFor(chord, {
              key: song.key,
              prefer: chordSymbol(chord, (p) => nameInKey(p, song.key)),
            });
            if (!set.preferred) return null;
            return (
              <div key={index} className="shrink-0 text-center">
                <ChordDiagram shape={set.preferred} keySignature={song.key} size="sm" />
                <div className="mt-1 text-[11px] text-ink-muted">{set.symbol}</div>
              </div>
            );
          })}
        </div>
      </div>
        <SongPractice song={song} />
      </div>
    </main>
  );
}

/**
 * The complete lyrics, with no chord names, for reference.
 *
 * This sits above the chorded sheet on purpose. A chord sheet is hard to read
 * as text: the chord names break the lines up, which is the right trade when
 * you are looking for a fingering and the wrong one when you just want to read
 * the song. So the words come first, uninterrupted, and the chords are a
 * separate view of the same text lower down.
 */
function PlainLyrics({ song }: { song: NonNullable<ReturnType<typeof loadSong>> }) {
  if (!canShowLyrics(song)) return null;

  const sections = song.sections
    .map((section) => ({
      section,
      lines: song.lines.filter((line) => line.section === section.order),
    }))
    .filter(({ lines }) => lines.some((line) => !line.empty));

  return (
    <div className="mb-10">
      <h2 className="mb-1 text-sm font-medium">The song</h2>
      <p className="mb-5 text-[11px] text-ink-faint">
        Full lyrics, no chord names. The chorded version is below.
      </p>

      <div className="space-y-6">
        {sections.map(({ section, lines }) => (
          <section key={`${section.kind}-${section.order}`}>
            {section.kind !== "unknown" && (
              <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-faint">
                {section.kind}
              </h3>
            )}
            {lines.map((line, index) =>
              line.empty ? (
                <div key={index} className="h-3" />
              ) : (
                <p
                  key={index}
                  className="text-[15px] leading-7 text-ink-muted"
                >
                  {line.text}
                </p>
              ),
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * Reference block.
 *
 * For this repertoire the whole work is free: the tune as well as the words.
 * Traditional songs are either of genuinely unknown authorship, or collected
 * from sources whose copyright has expired, so there is nothing to license.
 * Saying so plainly, with the collection named, is more useful to a visitor
 * than a bare "public domain" badge.
 */
function SongReference({ song }: { song: NonNullable<ReturnType<typeof loadSong>> }) {
  return (
    <div className="mb-8 rounded-xl border border-line/70 bg-panel">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line/70 px-4 py-3">
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[11px] text-accent">
          Public domain
        </span>
        <span className="text-[11px] text-ink-muted">
          Tune and lyrics both free to use
        </span>
        {song.year && (
          <span className="text-[11px] text-ink-faint">
            In circulation by {song.year}
          </span>
        )}
      </div>

        {/* A recording we are permitted to host, if there is one. */}
        {song.recording && (
          <div className="border-b border-line/70 px-4 py-3">
            <p className="mb-2 text-[11px] text-ink-faint">Hear it sung</p>
            <audio
              controls
              preload="none"
              src={song.recording.src}
              className="w-full"
            />
            <p className="mt-1.5 text-[11px] text-ink-faint">
              {song.recording.credit}
              {song.recording.year ? `, ${song.recording.year}` : ""} ·{" "}
              {song.recording.license}
            </p>
          </div>
        )}

        {/* Where a real performance can be heard, hosted elsewhere. */}
        {song.archiveLinks && song.archiveLinks.length > 0 && (
          <div className="px-4 py-3">
            <p className="mb-2 text-[11px] text-ink-faint">
              {song.recording ? "Other recordings" : "Hear a real performance"}
            </p>
            <ul className="space-y-1.5">
              {song.archiveLinks.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-wrap items-baseline gap-x-2"
                  >
                    <span className="text-xs text-accent group-hover:underline">
                      {link.label}
                    </span>
                    <span className="text-[11px] text-ink-faint">{link.note}</span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-line/50 pt-2.5 text-[10px] leading-relaxed text-ink-faint">
              These are links, not copies. The song is public domain, but a
              recording of it is a separate copyrighted work — in the US,
              anything recorded before 1972 stays in copyright until at least
              2067. So these play on their own sites and are not hosted here.
            </p>
          </div>
        )}
      <dl className="grid gap-x-8 gap-y-2 px-4 py-3 text-[11px] sm:grid-cols-2">
        {song.source && (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-ink-faint">Source</dt>
            <dd className="text-ink-muted">{song.source}</dd>
          </div>
        )}
        {song.composer && (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-ink-faint">Composer</dt>
            <dd className="text-ink-muted">{song.composer}</dd>
          </div>
        )}
        {song.artist && (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-ink-faint">Artist</dt>
            <dd className="text-ink-muted">{song.artist}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-ink-faint">Details</dt>
          <dd className="text-ink-muted">
            {keyName(song.key)} · {song.progression.length} chords ·{" "}
            {song.lines.filter((line) => !line.empty).length} lines
          </dd>
        </div>
      </dl>
    </div>
  );
}

export const dynamicParams = false;
