"use client";

import { useMemo, useState } from "react";
import { ChordDiagram } from "@/components/ChordDiagram";
import { voicingsFor, type VoicingSet } from "@/lib/music/voicing";
import { TIER_DESCRIPTION, TIER_LABEL, type DifficultyTier } from "@/lib/music/difficulty";
import { allKeys, keyName, transposeKey } from "@/lib/music/transpose";
import { shapeKeyFor, soundingKey } from "@/lib/music/capo";
import { parseChordSymbol, chordSymbol } from "@/lib/music/chords";
import { nameInKey, type KeySignature, type PitchClass } from "@/lib/music/notes";
import { STRUM_PATTERNS } from "@/lib/strum/patterns";
import { PlaybackControls } from "@/components/PlaybackControls";
import { analyseProgression, keyFromName } from "@/lib/music/roman";

/**
 * The progression workspace.
 *
 * One client component owning transpose, capo, voicing choice and strum
 * pattern. Keeping that state local rather than in a global store is
 * deliberate: there is exactly one workspace on screen, and a global store
 * would mean the home page and the library index share state they have no
 * business sharing.
 *
 * Transposition holds the fret numbers and moves the root, so the shapes the
 * user picked survive a key change. The capo does the opposite: it changes what
 * the shape *sounds* as, which is why the two are kept distinct in the UI
 * rather than merged into one "key" control.
 */

export interface WorkspaceProps {
  title: string;
  keyNameOriginal: string;
  symbols: string[];
  description: string;
  use?: string;
  level?: string;
  genre: string[];
  aliases?: string[];
  strumPatternId: string;
  suggestedTempo: number;
  meter: number;
}

type TierChoice = DifficultyTier | "auto";

export function ProgressionWorkspace(props: WorkspaceProps) {
  // Parse the real key rather than assuming C. Hardcoding tonic 0 made every
  // progression analyse in C major, so a minor-key song came out as VI-V-IV-II.
  const baseKey: KeySignature = useMemo(
    () => keyFromName(props.keyNameOriginal),
    [props.keyNameOriginal],
  );

  const [semitones, setSemitones] = useState(0);
  const [capoFret, setCapoFret] = useState(0);
  const [tierChoice, setTierChoice] = useState<TierChoice>("auto");
  const [patternId, setPatternId] = useState(props.strumPatternId);
  const [tempo, setTempo] = useState(props.suggestedTempo);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  // The key the music is in, after the user's transpose.
  const targetKey = useMemo(
    () => transposeKey(baseKey, semitones),
    [baseKey, semitones],
  );
  // The key whose shapes we play, after the capo is applied.
  const shapeKey = useMemo(
    () => shapeKeyFor(targetKey, capoFret),
    [targetKey, capoFret],
  );
  // What the capo actually produces, for the "sounds as" line.
  const soundsAs = useMemo(
    () => soundingKey(shapeKey, capoFret),
    [shapeKey, capoFret],
  );

  const chords = useMemo(
    () => props.symbols.map((s) => parseChordSymbol(s)).filter((c) => c !== null),
    [props.symbols],
  );

  // Spell chord names the way the current key would write them, so a song in
  // Eb shows "Bbmaj7" rather than "A#maj7".
  const spelling = useMemo(
    () => (p: PitchClass) => nameInKey(p, targetKey),
    [targetKey],
  );

  /** Apply transpose to the chord list, honouring any live edits. */
  const displaySymbols = useMemo(() => {
    return props.symbols.map((symbol, index) => {
      if (index === editIndex) return draft;
      return symbol;
    });
  }, [props.symbols, editIndex, draft]);

  const voicings: (VoicingSet | null)[] = useMemo(
    () =>
      displaySymbols.map((symbol) => {
        const chord = parseChordSymbol(symbol);
        if (!chord) return null;
        return voicingsFor(chord, { key: shapeKey, prefer: symbol });
      }),
    [displaySymbols, shapeKey],
  );

  const numerals = useMemo(
    () => analyseProgression(chords, targetKey),
    [chords, targetKey],
  );

  const pattern = STRUM_PATTERNS[patternId as keyof typeof STRUM_PATTERNS] ?? STRUM_PATTERNS["folk-8ths"];

  const chooseShape = (set: VoicingSet | null) => {
    if (!set) return null;
    if (tierChoice === "auto") return set.preferred;
    return set.byTier[tierChoice]?.shape ?? set.preferred;
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
          <a href="/progressions" className="hover:text-accent">
            Progressions
          </a>
          <span>/</span>
          <span>{props.genre.slice(0, 2).join(" · ")}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {props.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          {props.description}
        </p>
        {props.use && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-faint">
            <span className="text-ink-muted">Good for: </span>
            {props.use}
          </p>
        )}
        {props.aliases && props.aliases.length > 0 && (
          <p className="mt-3 text-xs text-ink-faint">
            Also searched as: {props.aliases.join(", ")}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="mb-8 grid gap-3 rounded-xl border border-line/70 bg-panel p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Control label="Key" hint={`${keyName(targetKey)} · sounds as ${keyName(soundsAs)}`}>
          <div className="flex items-center gap-1.5">
            <Stepper
              onClick={() => setSemitones((s) => s - 1)}
              label="Down a semitone"
            >
              −
            </Stepper>
            <select
              value={semitones}
              onChange={(e) => setSemitones(Number(e.target.value))}
              className="flex-1 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm"
              aria-label="Transpose by semitones"
            >
              {Array.from({ length: 25 }, (_, i) => i - 12).map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? "original" : `${n > 0 ? "+" : ""}${n} semitone${Math.abs(n) > 1 ? "s" : ""}`}
                </option>
              ))}
            </select>
            <Stepper
              onClick={() => setSemitones((s) => s + 1)}
              label="Up a semitone"
            >
              +
            </Stepper>
          </div>
        </Control>

        <Control
          label="Capo"
          hint={
            capoFret === 0
              ? "no capo"
              : `play ${keyName(shapeKey)} shapes`
          }
        >
          <div className="flex gap-1">
            {Array.from({ length: 8 }, (_, i) => (
              <button
                key={i}
                onClick={() => setCapoFret(i)}
                className={`h-8 flex-1 rounded-md border text-xs transition-colors ${
                  capoFret === i
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-line bg-panel-raised text-ink-muted hover:border-line-strong"
                }`}
                aria-pressed={capoFret === i}
              >
                {i}
              </button>
            ))}
          </div>
        </Control>

        <Control label="Difficulty" hint={TIER_DESCRIPTION[tierChoice === "auto" ? 1 : tierChoice]}>
          <div className="flex gap-1">
            {(["auto", 1, 2, 3, 4] as TierChoice[]).map((tier) => (
              <button
                key={String(tier)}
                onClick={() => setTierChoice(tier)}
                className={`h-8 flex-1 rounded-md border text-xs transition-colors ${
                  tierChoice === tier
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-line bg-panel-raised text-ink-muted hover:border-line-strong"
                }`}
                aria-pressed={tierChoice === tier}
                title={tier === "auto" ? "Easiest available" : TIER_DESCRIPTION[tier]}
              >
                {tier === "auto" ? "Easy" : TIER_LABEL[tier].split(" ")[0]}
              </button>
            ))}
          </div>
        </Control>

        <Control label="Strum pattern" hint={`${tempo} bpm · ${pattern.subdivision}ths`}>
          <select
            value={patternId}
            onChange={(e) => setPatternId(e.target.value)}
            className="w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm"
          >
            {Object.values(STRUM_PATTERNS).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="range"
            min={50}
            max={200}
            value={tempo}
            onChange={(e) => setTempo(Number(e.target.value))}
            className="mt-2 w-full accent-accent"
            aria-label="Tempo"
          />
        </Control>
      </div>

      {/* Strum grid + playback */}
      <div className="mb-8 rounded-xl border border-line/70 bg-panel p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">{pattern.name}</h2>
          <span className="text-xs text-ink-faint">{pattern.description}</span>
        </div>
        <div className="mb-4 flex gap-1.5">
          {pattern.steps.map((stroke, index) => (
            <div key={index} className="flex-1 text-center">
              <div
                className={`mx-auto flex h-9 items-center justify-center rounded-md border text-xs ${
                  stroke === "down"
                    ? "border-accent/50 bg-accent/15 text-accent"
                    : stroke === "up"
                      ? "border-line-strong bg-panel-raised text-ink"
                      : "border-line/50 bg-transparent text-ink-faint/40"
                }`}
              >
                {stroke === "down" ? "D" : stroke === "up" ? "U" : "·"}
              </div>
              <div className="mt-1 text-[10px] text-ink-faint">{index + 1}</div>
            </div>
          ))}
        </div>

        <PlaybackControls
          shapes={voicings.map((set) => chooseShape(set))}
          pattern={pattern}
          tempo={tempo}
          capoFret={capoFret}
        />
      </div>

      {/* Chords */}
      <h2 className="mb-3 text-sm font-medium">Shapes</h2>
      <div className="flex gap-3 overflow-x-auto pb-4 scroll-slim">
        {voicings.map((set, index) => {
          if (!set) {
            return (
              <div
                key={index}
                className="w-40 shrink-0 rounded-xl border border-line/70 bg-panel p-4"
              >
                <div className="text-sm text-ink-faint">unrecognised chord</div>
                <code className="mt-1 block text-xs text-ink-muted">
                  {displaySymbols[index]}
                </code>
              </div>
            );
          }
          const shape = chooseShape(set);
          const option = set.options.find((o) => o.shape === shape);
          const numeral = numerals[index];

          return (
            <div
              key={index}
              className="w-40 shrink-0 rounded-xl border border-line/70 bg-panel p-4 text-center"
            >
              <div className="mb-1 text-sm font-medium">
                {index === editIndex ? (
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => setEditIndex(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") setEditIndex(null);
                    }}
                    autoFocus
                    className="w-full rounded border border-accent bg-panel-raised px-1.5 py-0.5 text-center text-sm"
                    aria-label="Edit chord"
                  />
                ) : (
                  <button
                    onClick={() => {
                      setEditIndex(index);
                      setDraft(displaySymbols[index]);
                    }}
                    className="w-full rounded transition-colors hover:text-accent"
                    title="Click to edit this chord"
                  >
                    {chordSymbol(set.chord, spelling)}
                  </button>
                )}
              </div>
              {numeral && (
                <div className="text-[11px] text-ink-faint">{numeral.text}</div>
              )}

              <div className="my-2 flex justify-center">
                {shape ? (
                  <ChordDiagram
                    shape={shape}
                    keySignature={targetKey}
                    capoFret={capoFret}
                    size="md"
                    showDifficulty
                  />
                ) : (
                  <div className="h-24 w-20" />
                )}
              </div>

              {option && (
                <div className="text-[10px] leading-tight text-ink-faint">
                  {option.frets}
                  <br />
                  {option.description}
                </div>
              )}

              {set.options.length > 1 && (
                <details className="mt-2 text-left">
                  <summary className="cursor-pointer text-[10px] text-ink-faint hover:text-accent">
                    {set.options.length} other shapes
                  </summary>
                  <div className="mt-1.5 flex gap-1.5 overflow-x-auto scroll-slim">
                    {set.options.slice(0, 12).map((other) => (
                      <div key={other.frets} className="shrink-0" title={other.description}>
                        <ChordDiagram shape={other.shape} size="sm" hideNotes />
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>

      {/* Capo explainer */}
      {capoFret > 0 && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
          <h2 className="mb-1 text-sm font-medium text-accent">
            Capo on fret {capoFret}
          </h2>
          <p className="text-[13px] leading-relaxed text-ink-muted">
            You are playing <strong className="text-ink">{keyName(shapeKey)}</strong>{" "}
            shapes, and it sounds as{" "}
            <strong className="text-ink">{keyName(soundsAs)}</strong>. A capo
            does not change the chord you play, it changes what that chord
            sounds as — which is why the two names are kept separate here.
          </p>
        </div>
      )}

      {/* Key picker */}
      <details className="mt-6 rounded-xl border border-line/70 bg-panel p-4">
        <summary className="cursor-pointer text-sm text-ink-muted">
          Jump to a key directly
        </summary>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {allKeys(baseKey.mode).map((key) => {
            const delta =
              (key.tonic - baseKey.tonic + 12) % 12;
            const isCurrent = key.letter === targetKey.letter;
            return (
              <button
                key={key.letter}
                onClick={() => setSemitones(delta)}
                className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                  isCurrent
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-line bg-panel-raised text-ink-muted hover:border-line-strong"
                }`}
              >
                {key.letter} {key.mode === "minor" ? "m" : ""}
              </button>
            );
          })}
        </div>
      </details>
    </div>
  );
}

function Control({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        {hint && <span className="truncate text-[10px] text-ink-faint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Stepper({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="h-8 w-8 shrink-0 rounded-md border border-line bg-panel-raised text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
    >
      {children}
    </button>
  );
}
