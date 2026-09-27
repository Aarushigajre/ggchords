"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChordDiagram } from "@/components/ChordDiagram";
import { lineRuns } from "@/lib/songs/chordpro";
import { canShowLyrics, chordAtOffset, type Song } from "@/lib/songs/types";
import { voicingsFor } from "@/lib/music/voicing";
import { chordSymbol, parseChordSymbol } from "@/lib/music/chords";
import { nameInKey, type PitchClass } from "@/lib/music/notes";
import type { DifficultyTier } from "@/lib/music/difficulty";
import type { Shape } from "@/lib/music/fretboard";
import { soundedMidi } from "@/lib/music/fretboard";
import { STRUM_PATTERNS, type StrumPatternId } from "@/lib/strum/patterns";
import { StrumPlayer, type PlaybackState } from "@/lib/strum/engine";

/**
 * Song practice: the sheet, the audio, and the autoscroll, in one component.
 *
 * These live together deliberately. The autoscroll has to advance in time with
 * the audio, and the audio has to know which chords the sheet is showing. If
 * the controls lived in a separate component, keeping those two in step would
 * mean prop-drilling a pile of state and a pair of refs. One component, one
 * state, no synchronisation bugs.
 *
 * The performance decision that matters for hover: there is exactly ONE chord
 * diagram in the DOM, however many chords the song has. A song runs to a
 * hundred chord placements, so a diagram per chord would put a hundred SVGs on
 * the page. A single `hovered` index drives one popover instead.
 */

/** Autoscroll rate bounds, in pixels per second. */
const SPEED_MIN = 6;
const SPEED_MAX = 60;
const SPEED_STEP = 6;

const clampSpeed = (value: number) =>
  Math.max(SPEED_MIN, Math.min(SPEED_MAX, value));

export interface SongPracticeProps {
  song: Song;
  capoFret?: number;
  difficulty?: DifficultyTier | "auto";
}

interface Hovered {
  index: number;
  symbol: string;
  x: number;
  y: number;
}

export function SongPractice({
  song,
  capoFret = 0,
  difficulty = "auto",
}: SongPracticeProps) {
  const lyricsAllowed = canShowLyrics(song);

  // --- Practice state -------------------------------------------------------
  const [patternId, setPatternId] = useState<StrumPatternId>("folk-8ths");
  const [tempo, setTempo] = useState(96);
  const [playState, setPlayState] = useState<PlaybackState>("idle");
  const [autoScroll, setAutoScroll] = useState(false);
  /**
   * Autoscroll speed, in pixels per second.
   *
   * Deliberately not expressed in bars, beats or "lines per something". The
   * earlier control advanced the text one line at a time on a musical grid,
   * which was wrong twice over: it jumped rather than scrolled, and a uniform
   * rate cannot follow phrasing that is not uniform. This is a plain
   * continuous rate the user nudges until it matches the song.
   */
  const [scrollSpeed, setScrollSpeed] = useState(18);
  const [countInBars, setCountInBars] = useState(1);
  /** Where the transport is, for highlighting. -1 means nothing playing. */
  const [cursor, setCursor] = useState<{ step: number; bar: number; countingIn: boolean }>({
    step: -1,
    bar: -1,
    countingIn: false,
  });
  const [activeLine, setActiveLine] = useState(-1);
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  const playerRef = useRef<StrumPlayer | null>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const pattern = STRUM_PATTERNS[patternId];

  /**
   * A flat, indexed view of the song's chords, built once.
   *
   * Lines are rendered from the source data, but hover state needs a stable
   * identity per chord. Numbering them in a single pass means the index is a
   * property of the song rather than of render order.
   */
  const { sections, flat } = useMemo(() => {
    const all: { symbol: string }[] = [];
    const grouped = song.sections.map((section) => {
      const lines = song.lines
        .filter((line) => line.section === section.order)
        .map((line) => {
          const chords = line.chords.map((placement) => {
            const chordIndex = all.length;
            all.push({ symbol: placement.symbol });
            return { ...placement, chordIndex };
          });
          return { line, chords };
        });
      return { section, lines };
    });
    return { sections: grouped, flat: all };
  }, [song]);

  /** The chord to sound on each bar, cycling through the song. */
  const progression = useMemo(() => {
    return song.progression
      .map((chord) => {
        const symbol = chordSymbol(chord, (p: PitchClass) => nameInKey(p, song.key));
        const set = voicingsFor(chord, { key: song.key, prefer: symbol });
        const shape =
          difficulty === "auto"
            ? set.preferred
            : set.byTier[difficulty]?.shape ?? set.preferred;
        if (!shape) return null;
        return soundedMidi(shape).map((midi) => midi + capoFret);
      })
      .filter((notes): notes is number[] => notes !== null && notes.length > 0);
  }, [song.progression, song.key, difficulty, capoFret]);

  const resolveShape = (symbol: string): { shape: Shape; label: string } | null => {
    const chord = parseChordSymbol(symbol);
    if (!chord) return null;
    const set = voicingsFor(chord, { key: song.key, prefer: symbol });
    const shape =
      difficulty === "auto" ? set.preferred : set.byTier[difficulty]?.shape ?? set.preferred;
    if (!shape) return null;
    return { shape, label: chordSymbol(chord, (p: PitchClass) => nameInKey(p, song.key)) };
  };

  const showAt = (element: HTMLElement, index: number, symbol: string) => {
    const rect = element.getBoundingClientRect();
    setHovered({ index, symbol, x: rect.left + rect.width / 2, y: rect.top });
  };

  // --- Audio ---------------------------------------------------------------
  const toggleAudio = async () => {
    setAudioError(null);
    try {
      if (!playerRef.current) {
        if (progression.length === 0) {
          setAudioError("No playable chords found for this song.");
          return;
        }
        playerRef.current = new StrumPlayer({
          tempo,
          pattern,
          progression,
          gain: 0.75,
          countInBars,
          onStep: (step, bar, countingIn) => setCursor({ step, bar, countingIn }),
        });
      } else {
        playerRef.current.update({ tempo, pattern, progression, countInBars });
      }
      if (playState === "playing") {
        playerRef.current.stop();
        setPlayState("idle");
      } else {
        await playerRef.current.resume();
        playerRef.current.toggle();
        setPlayState(playerRef.current.getState());
      }
    } catch (cause) {
      setAudioError(
        cause instanceof Error ? cause.message : "Could not start audio.",
      );
      setPlayState("idle");
    }
  };

  useEffect(() => {
    return () => {
      playerRef.current?.dispose();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    playerRef.current?.update({ tempo, pattern, progression, countInBars });
  }, [tempo, pattern, progression, countInBars]);

  // Clear the highlight when the transport stops.
  useEffect(() => {
    if (playState !== "playing") {
      setCursor({ step: -1, bar: -1, countingIn: false });
    }
  }, [playState]);

  // --- Autoscroll ----------------------------------------------------------
  /**
   * Continuous autoscroll.
   *
   * A requestAnimationFrame loop nudging scrollTop by a fixed number of pixels
   * per second, rather than stepping from line to line. The text glides, which
   * is what makes it readable while playing, and it loops back to the top when
   * it reaches the end.
   *
   * The rate is computed from elapsed time on each frame, not by assuming a
   * frame lasts 16ms, so the scroll does not speed up on a 120Hz display or
   * slow down when the tab is throttled.
   */
  useEffect(() => {
    const element = scrollerRef.current;
    if (!autoScroll || !element) return;

    let frame = 0;
    let previous = performance.now();

    const step = (now: number) => {
      const seconds = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      element.scrollTop += scrollSpeed * seconds;

      // Loop rather than stop, so a practice loop never stalls unnoticed.
      const atEnd =
        element.scrollTop >= element.scrollHeight - element.clientHeight - 1;
      if (atEnd) element.scrollTop = 0;

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [autoScroll, scrollSpeed]);

  /**
   * Work out which line is currently under the middle of the pane.
   *
   * Derived from scroll position rather than from a counter, so it stays
   * correct when the user scrolls by hand, and keeps working if the autoscroll
   * rate is changed mid-song.
   */
  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;

    const update = () => {
      const paneTop = element.getBoundingClientRect().top;
      const midpoint = element.clientHeight / 2;
      let nearest = -1;
      let nearestDistance = Infinity;

      lineRefs.current.forEach((node, lineIndex) => {
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const centre = rect.top - paneTop + rect.height / 2;
        const distance = Math.abs(centre - midpoint);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = lineIndex;
        }
      });

      setActiveLine(nearest);
    };

    update();
    element.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      element.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [sections]);

  // Turning autoscroll off should drop the highlight.
  useEffect(() => {
    if (!autoScroll) setActiveLine(-1);
  }, [autoScroll]);

  const active = hovered ? resolveShape(hovered.symbol) : null;

  return (
    <div>
      {/* Practice bar */}
      <div className="sticky top-14 z-30 -mx-5 mb-8 border-y border-line/70 bg-surface/95 px-5 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {/* Transport */}
          <button
            onClick={toggleAudio}
            disabled={progression.length === 0}
            className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-accent bg-accent/15 px-3.5 text-sm font-medium text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
            title="Loop the song's chords with the strum pattern below, in time with the autoscroll"
          >
            <span aria-hidden>{playState === "playing" ? "■" : "▶"}</span>
            {playState === "playing" ? "Stop" : "Play chords"}
          </button>

          <button
            onClick={() => setAutoScroll((value) => !value)}
            aria-pressed={autoScroll}
            className={`flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3.5 text-sm font-medium transition-colors ${
              autoScroll
                ? "border-accent bg-accent/15 text-accent"
                : "border-line text-ink-muted hover:border-line-strong hover:text-ink"
            }`}
          >
            <span aria-hidden>{autoScroll ? "⏸" : "⇣"}</span>
            {autoScroll ? "Scrolling" : "Autoscroll"}
          </button>

          {/* Strum pattern */}
          <label className="flex items-center gap-2 text-xs text-ink-faint">
            <span className="whitespace-nowrap">Pattern</span>
            <select
              value={patternId}
              onChange={(event) => setPatternId(event.target.value as StrumPatternId)}
              className="rounded-md border border-line bg-panel px-2 py-1.5 text-xs text-ink outline-none focus:border-accent"
            >
              {Object.values(STRUM_PATTERNS).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>

          {/* Tempo / speed */}
          <label className="flex min-w-[190px] flex-1 items-center gap-2 text-xs text-ink-faint">
            <span className="whitespace-nowrap">Speed</span>
            <input
              type="range"
              min={40}
              max={200}
              step={1}
              value={tempo}
              onChange={(event) => setTempo(Number(event.target.value))}
              className="h-1 flex-1 accent-accent"
              aria-label="Tempo in beats per minute"
            />
            <span className="w-14 shrink-0 tabular-nums text-ink-muted">
              {tempo} bpm
            </span>
          </label>

          {/* Count-in */}
          <label className="flex items-center gap-2 text-xs text-ink-faint">
            <span className="whitespace-nowrap">Count-in</span>
            <select
              value={countInBars}
              onChange={(event) => setCountInBars(Number(event.target.value))}
              className="rounded-md border border-line bg-panel px-2 py-1.5 text-xs text-ink outline-none focus:border-accent"
            >
              <option value={0}>none</option>
              <option value={1}>1 bar</option>
              <option value={2}>2 bars</option>
            </select>
          </label>

          {/* Autoscroll speed. A plain rate, nudged by the user, because a
              fixed musical grid cannot follow phrasing that varies. */}
          <div
            className={`flex items-center gap-1.5 text-xs transition-opacity ${
              autoScroll ? "opacity-100" : "pointer-events-none opacity-40"
            }`}
            title="How fast the lyrics scroll. Nudge with the buttons until it matches the song."
          >
            <span className="whitespace-nowrap text-ink-faint">
              Scroll speed
            </span>
            <button
              onClick={() => setScrollSpeed((v) => clampSpeed(v - SPEED_STEP))}
              disabled={!autoScroll || scrollSpeed <= SPEED_MIN}
              aria-label="Slower"
              className="h-7 w-7 rounded-md border border-line bg-panel text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-30"
            >
              −
            </button>
            <span className="w-14 shrink-0 text-center tabular-nums text-ink-muted">
              {scrollSpeed < SPEED_MIN + SPEED_STEP
                ? "Slowest"
                : scrollSpeed > SPEED_MAX - SPEED_STEP
                  ? "Fastest"
                  : scrollSpeed <= SPEED_MIN + SPEED_STEP * 2
                    ? "Slow"
                    : scrollSpeed <= SPEED_MIN + SPEED_STEP * 4
                      ? "Medium"
                      : "Fast"}{" "}
              <span className="text-ink-faint">({scrollSpeed})</span>
            </span>
            <button
              onClick={() => setScrollSpeed((v) => clampSpeed(v + SPEED_STEP))}
              disabled={!autoScroll || scrollSpeed >= SPEED_MAX}
              aria-label="Faster"
              className="h-7 w-7 rounded-md border border-line bg-panel text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>

        {/* Strum grid, compact, with the live beat lit. */}
        <div className="mt-2.5 flex items-center gap-3">
          <div className="flex flex-1 gap-1">
            {pattern.steps.map((stroke, index) => {
              const live = playState === "playing" && cursor.step === index;
              return (
                <div
                  key={index}
                  className={`flex-1 rounded border py-0.5 text-center text-[10px] transition-colors ${
                    live
                      ? "border-accent bg-accent text-black"
                      : stroke === "down"
                        ? "border-accent/50 bg-accent/15 text-accent"
                        : stroke === "up"
                          ? "border-line-strong bg-panel text-ink-muted"
                          : "border-line/40 text-ink-faint/30"
                  }`}
                >
                  {stroke === "down" ? "D" : stroke === "up" ? "U" : "·"}
                </div>
              );
            })}
          </div>
          {playState === "playing" && (
            <span className="w-28 shrink-0 text-right text-[10px] tabular-nums text-ink-faint">
              {cursor.countingIn
                ? `count-in ${countInBars - cursor.bar}`
                : `bar ${cursor.bar + 1}`}
            </span>
          )}
        </div>

        {audioError ? (
          <p className="mt-2 text-xs text-red-400">{audioError}</p>
        ) : (
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">
            {playState === "playing" ? (
              <>
                Looping the song&apos;s {progression.length} chords, one per bar.
                Autoscroll and audio share the same clock, so the lyrics stay in
                time with what you hear.
              </>
            ) : (
              <>
                There is no recording here — <strong className="text-ink-muted">Play chords</strong> synthesises a
                strummed guitar part from the shapes below, one chord per bar,
                and it drives the autoscroll at the same tempo. Browsers only
                allow sound after a click, so press it to start.
              </>
            )}
          </p>
        )}
      </div>

      {!lyricsAllowed && (
        <div className="mb-6 rounded-xl border border-line-strong bg-panel p-4">
          <p className="text-sm leading-relaxed text-ink-muted">
            Lyrics for this song are withheld. Its chord progression is public
            information, but the words are still under copyright, so only the
            chords are shown.
          </p>
        </div>
      )}

      {/* The sheet */}
      <div
        ref={scrollerRef}
        className="max-h-[64vh] space-y-7 overflow-y-auto overscroll-contain pr-2 scroll-slim"
      >
        {sections.map(({ section, lines }) => {
          if (lines.length === 0) return null;
          return (
            <section key={`${section.kind}-${section.order}`}>
              {section.kind !== "unknown" && (
                <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-faint">
                  {section.kind}
                </h3>
              )}
              <div className="space-y-0.5">
                {lines.map(({ line, chords }, lineIndex) => {
                  if (line.empty) return <div key={lineIndex} className="h-3" />;

                  // Map back to the global line index so refs line up with the
                  // autoscroll's notion of position.
                  const globalIndex = song.lines.indexOf(line);
                  const isActive = activeLine === globalIndex;
                  const runs = lineRuns(line);

                  return (
                    <p
                      key={lineIndex}
                      ref={(element) => {
                        lineRefs.current[globalIndex] = element;
                      }}
                      className={`font-mono text-[15px] leading-8 transition-colors ${
                        isActive ? "text-accent" : undefined
                      }`}
                    >
                      {runs.map((run, runIndex) => {
                        if (run.kind === "chord" && run.chord) {
                          const entry = chords.find((c) => c.offset === run.chord!.offset);
                          const index = entry?.chordIndex ?? -1;
                          const isHovered = hovered?.index === index;
                          return (
                            <span
                              key={`c-${index}-${runIndex}`}
                              role="button"
                              tabIndex={0}
                              aria-label={`${run.text} chord`}
                              onMouseEnter={(e) =>
                                showAt(e.currentTarget, index, run.chord!.symbol)
                              }
                              onFocus={(e) =>
                                showAt(e.currentTarget, index, run.chord!.symbol)
                              }
                              onMouseLeave={() => setHovered(null)}
                              onBlur={() => setHovered(null)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") setHovered(null);
                              }}
                              className={`mr-2 cursor-pointer rounded px-1 font-sans text-[13px] transition-colors ${
                                isHovered
                                  ? "bg-accent text-black"
                                  : "text-accent hover:bg-accent/20"
                              }`}
                            >
                              {run.text}
                            </span>
                          );
                        }

                        if (!lyricsAllowed) return null;

                        const sounding = chordAtOffset(line, run.offset);
                        const entry = chords.find((c) => c.offset === sounding?.offset);
                        const isHovered = entry != null && hovered?.index === entry.chordIndex;

                        return (
                          <span
                            key={`t-${runIndex}`}
                            onMouseEnter={(e) => {
                              if (!entry) return;
                              showAt(e.currentTarget, entry.chordIndex, entry.symbol);
                            }}
                            onMouseLeave={() => setHovered(null)}
                            className={isHovered ? "text-accent" : undefined}
                          >
                            {run.text}
                          </span>
                        );
                      })}
                    </p>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* The one and only diagram. */}
      {hovered && active && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full"
          style={{ left: hovered.x, top: hovered.y - 8 }}
          role="tooltip"
        >
          <div className="rounded-xl border border-line-strong bg-panel-raised px-3.5 py-3 shadow-2xl shadow-black/60">
            <div className="mb-1.5 text-center text-sm font-medium">{active.label}</div>
            <div className="flex justify-center">
              <ChordDiagram
                shape={active.shape}
                keySignature={song.key}
                capoFret={capoFret}
                size="lg"
                showDifficulty
              />
            </div>
          </div>
        </div>
      )}

      <p className="mt-8 text-[11px] text-ink-faint">
        Hover any chord for its shape, or hover a word to see which chord
        sounds there. {flat.length} chords in this song.
      </p>
    </div>
  );
}
