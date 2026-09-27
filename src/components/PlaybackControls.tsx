"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StrumPlayer, type PlaybackState } from "@/lib/strum/engine";
import type { StrumPattern } from "@/lib/strum/patterns";
import type { Shape } from "@/lib/music/fretboard";
import { soundedMidi } from "@/lib/music/fretboard";

/**
 * Transport controls for the strum player.
 *
 * The player is held in a ref rather than state, because it owns an
 * AudioContext and a timer, neither of which should trigger a re-render. Only
 * the play/pause state is React state. The context is created lazily on the
 * first play press, which is what browser autoplay policy requires.
 */

export interface PlaybackControlsProps {
  /** The shape chosen for each chord in the progression, in order. */
  shapes: (Shape | null)[];
  pattern: StrumPattern;
  tempo: number;
  /** Semitones of capo offset, so the audio matches what the capo would do. */
  capoFret?: number;
}

export function PlaybackControls({
  shapes,
  pattern,
  tempo,
  capoFret = 0,
}: PlaybackControlsProps) {
  const playerRef = useRef<StrumPlayer | null>(null);
  const [state, setState] = useState<PlaybackState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [currentBar, setCurrentBar] = useState(0);

  // Chord voices, as absolute MIDI, including the capo offset.
  //
  // Memoised, and that is load-bearing rather than tidiness. `update()` on the
  // player does stop() then start() when it is already playing, so handing it a
  // fresh array on every render restarts the loop every render — and the
  // bar-indicator interval below causes a render every bar. The result is a
  // backing track that stutters and never sustains.
  const progression = useMemo(
    () =>
      shapes
        .filter((shape): shape is Shape => shape !== null)
        .map((shape) => soundedMidi(shape).map((midi) => midi + capoFret)),
    [shapes, capoFret],
  );

  // Only update the player when the musical content actually changes.
  useEffect(() => {
    if (!playerRef.current) return;
    playerRef.current.update({ tempo, pattern, progression });
  }, [tempo, pattern, progression]);

  useEffect(() => {
    // Free the audio hardware on unmount. Without this, navigating away
    // leaves a suspended context and a live interval behind.
    return () => {
      playerRef.current?.dispose();
      playerRef.current = null;
    };
  }, []);

  // Highlight the bar currently sounding.
  useEffect(() => {
    if (state !== "playing" || progression.length === 0) return;
    const timer = setInterval(() => {
      setCurrentBar((bar) => (bar + 1) % progression.length);
    }, (60 / tempo) * pattern.beats);
    return () => clearInterval(timer);
  }, [state, tempo, pattern.beats, progression.length]);

  const toggle = async () => {
    setError(null);
    try {
      if (!playerRef.current) {
        if (progression.length === 0) {
          setError("No playable chords to play.");
          return;
        }
        playerRef.current = new StrumPlayer({
          tempo,
          pattern,
          progression,
          gain: 0.75,
        });
      }
      if (state === "playing") {
        playerRef.current.stop();
        setState("idle");
      } else {
        await playerRef.current.resume();
        playerRef.current.toggle();
        setState(playerRef.current.getState());
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not start audio. Check your browser's sound permissions.",
      );
      setState("idle");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          disabled={progression.length === 0}
          className="flex h-9 items-center gap-2 rounded-lg border border-accent bg-accent/15 px-3.5 text-sm font-medium text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden>{state === "playing" ? "■" : "▶"}</span>
          {state === "playing" ? "Stop" : "Play"}
        </button>

        <span className="text-xs text-ink-faint">{tempo} bpm</span>
      </div>

      {/* Bar indicator, so it is obvious the loop is running. */}
      {state === "playing" && progression.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {progression.map((_, index) => (
            <span
              key={index}
              className={`h-1.5 w-6 rounded-full transition-colors ${
                index === currentBar % progression.length
                  ? "bg-accent"
                  : "bg-line"
              }`}
            />
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <p className="text-[11px] leading-snug text-ink-faint">
        Synthesised in the browser — no audio files. Strummed from the shapes
        above{capoFret > 0 ? `, shifted up ${capoFret} semitones for the capo` : ""}.
      </p>
    </div>
  );
}
