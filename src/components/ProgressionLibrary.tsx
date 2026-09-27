"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChordDiagram } from "@/components/ChordDiagram";
import type { Shape } from "@/lib/music/fretboard";
import type { Genre } from "@/lib/progressions/data";

/**
 * The progression library, with working filters.
 *
 * The shape search is the expensive part, and it runs on the server at build
 * time. Everything the browser needs arrives here as plain data, so filtering
 * is a pure array operation and stays instant. Recomputing voicings per render
 * in the browser would put a noticeable stall on first paint.
 */

export interface LibraryChord {
  symbol: string;
  frets: string;
  description: string;
  shape: Shape;
}

export interface LibraryEntry {
  id: string;
  title: string;
  keyName: string;
  minor: boolean;
  genre: Genre[];
  level?: string;
  description: string;
  chords: LibraryChord[];
}

export interface LibraryGenre {
  name: string;
  count: number;
}

export function ProgressionLibrary({
  entries,
  genres,
}: {
  entries: LibraryEntry[];
  genres: LibraryGenre[];
}) {
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (activeGenre && !entry.genre.includes(activeGenre as Genre)) {
        return false;
      }
      if (!needle) return true;
      return (
        entry.title.toLowerCase().includes(needle) ||
        entry.description.toLowerCase().includes(needle) ||
        entry.genre.some((genre) => genre.toLowerCase().includes(needle)) ||
        entry.chords.some((chord) =>
          chord.symbol.toLowerCase().includes(needle),
        )
      );
    });
  }, [entries, activeGenre, query]);

  const totalChords = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.chords.length, 0),
    [entries],
  );

  return (
    <>
      {/* Controls */}
      <div className="mb-6 space-y-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, chord, or mood…"
          aria-label="Search progressions"
          className="w-full rounded-lg border border-line bg-panel px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-ink-faint focus:border-accent"
        />

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by genre">
          <FilterChip
            active={activeGenre === null}
            onClick={() => setActiveGenre(null)}
          >
            All
            <span className="ml-1.5 text-ink-faint">{entries.length}</span>
          </FilterChip>
          {genres.map((genre) => (
            <FilterChip
              key={genre.name}
              active={activeGenre === genre.name}
              onClick={() =>
                setActiveGenre(activeGenre === genre.name ? null : genre.name)
              }
            >
              {genre.name}
              <span className="ml-1.5 text-ink-faint">{genre.count}</span>
            </FilterChip>
          ))}
        </div>
      </div>

      <p className="mb-4 text-xs text-ink-faint">
        Showing {filtered.length} of {entries.length} ·{" "}
        {totalChords} chord diagrams
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-line/70 bg-panel p-8 text-center">
          <p className="text-sm text-ink-muted">
            Nothing matches{" "}
            {query && <span className="text-ink">“{query}”</span>}
            {query && activeGenre && " in "}
            {activeGenre && <span className="text-ink">{activeGenre}</span>}
            .
          </p>
          <button
            onClick={() => {
              setQuery("");
              setActiveGenre(null);
            }}
            className="mt-3 text-sm text-accent transition-opacity hover:opacity-80"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <Link
              key={entry.id}
              href={`/progressions/${entry.id}/`}
              className="group flex flex-col rounded-xl border border-line/70 bg-panel p-4 transition-colors hover:border-line-strong hover:bg-panel-raised"
            >
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-medium tracking-tight">
                  {entry.title}
                </h2>
                <span className="shrink-0 text-[11px] text-ink-faint">
                  {entry.keyName}
                  {entry.minor ? "m" : ""}
                </span>
              </div>

              <div className="mb-3 flex flex-wrap gap-1">
                {entry.genre.slice(0, 3).map((genre) => (
                  <span
                    key={genre}
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      activeGenre === genre
                        ? "bg-accent/20 text-accent"
                        : "bg-panel-raised text-ink-faint"
                    }`}
                  >
                    {genre}
                  </span>
                ))}
              </div>

              <div className="mt-auto flex gap-1.5 overflow-x-auto pb-1 scroll-slim">
                {entry.chords.map((chord, index) => (
                  <div
                    key={`${chord.symbol}-${index}`}
                    className="shrink-0"
                    title={`${chord.symbol} — ${chord.description}`}
                  >
                    <ChordDiagram shape={chord.shape} size="sm" hideNotes />
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-accent bg-accent/15 text-accent"
          : "border-line text-ink-muted hover:border-line-strong hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
