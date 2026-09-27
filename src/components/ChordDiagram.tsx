import {
  type Shape,
  getTuning,
  midiAt,
  shapePitchClasses,
} from "@/lib/music/fretboard";
import { findBarres, scoreShape, TIER_LABEL } from "@/lib/music/difficulty";
import { pc, nameInKey } from "@/lib/music/notes";
import type { KeySignature } from "@/lib/music/notes";

/**
 * The chord diagram.
 *
 * Rendered as SVG rather than drawn with divs because the important details
 * are fiddly: fret markers, barre bars, note names in the nut, and a capo bar
 * that has to sit between the nut and the first fret. SVG handles all of it
 * without a layout fight, and scales cleanly for the hover popover.
 *
 * This is a Server Component: it has no state and no interactivity of its own.
 * The hover behaviour lives in the parent.
 */

export interface ChordDiagramProps {
  shape: Shape;
  /** Large diagrams are used in the popover. */
  size?: "sm" | "md" | "lg";
  /** Key, used to spell note labels the way a musician would write them. */
  keySignature?: KeySignature;
  /** Draw a capo bar at this fret. */
  capoFret?: number;
  /** Hide the note names down the side. */
  hideNotes?: boolean;
  /** Show the difficulty tier in the corner. */
  showDifficulty?: boolean;
  className?: string;
}

const DIMS = {
  sm: { width: 74, nut: 11, left: 20, fretW: 9, gap: 3, fingerR: 3.4, topPad: 6 },
  md: { width: 96, nut: 13, left: 24, fretW: 12, gap: 4, fingerR: 4.6, topPad: 8 },
  lg: { width: 150, nut: 18, left: 34, fretW: 18, gap: 5, fingerR: 7, topPad: 12 },
} as const;

/** How many frets of neck to show. Enough for any shape we generate. */
const FRET_COUNT = 5;

export function ChordDiagram({
  shape,
  size = "md",
  keySignature,
  capoFret = 0,
  hideNotes = false,
  showDifficulty = false,
  className = "",
}: ChordDiagramProps) {
  const d = DIMS[size];
  const tuning = getTuning(shape.tuningId);

  const fretted = shape.frets.filter(
    (f): f is number => f !== null && f > 0,
  );
  const lowest = fretted.length ? Math.min(...fretted) : 1;
  const highest = fretted.length ? Math.max(...fretted) : 1;
  const topFret = lowest;

  // A capo pulls the nut up to the capo fret, so the diagram starts there.
  const displayStart = capoFret > 0 ? capoFret : 0;
  const firstFret = Math.max(1, lowest - displayStart);

  const gridWidth = d.left + 5 * (d.fretW + d.gap) + 4;
  const headerHeight = d.topPad + d.nut;
  const gridHeight = FRET_COUNT * d.fretW;
  const noteColumn = hideNotes ? 0 : 16;
  const totalWidth = gridWidth + noteColumn;
  const totalHeight = headerHeight + gridHeight + (showDifficulty ? 14 : 4);

  const stringX = (i: number) => d.left + i * (d.fretW + d.gap) + d.fretW / 2;
  const fretY = (n: number) => headerHeight + n * d.fretW;

  const barres = findBarres(shape);
  const score = scoreShape(shape);
  const sounding = shapePitchClasses(shape, tuning);

  /** Is this string muted, and if so should it read as an X or an O? */
  const markerFor = (fret: number | null, string: number) => {
    if (fret === null) return "x";
    if (fret === 0) return "o";
    return "fret";
  };

  return (
    <svg
      className={`fretboard ${className}`}
      width={totalWidth}
      height={totalHeight}
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      role="img"
      aria-label={describeShapeForScreen(shape, tuning, capoFret)}
    >
      {/* Nut. A capo takes its place, so the nut only shows with no capo. */}
      {capoFret === 0 ? (
        <rect
          x={d.left - 4}
          y={headerHeight - d.nut}
          width={5 * (d.fretW + d.gap) - d.gap + 8}
          height={d.nut}
          fill="currentColor"
          className="text-ink"
          rx={1}
        />
      ) : (
        <text
          x={d.left - 9}
          y={headerHeight - 4}
          textAnchor="end"
          className="fill-ink-faint"
          style={{ fontSize: 9 }}
        >
          capo
        </text>
      )}

      {/* Fret wires and strings. */}
      {Array.from({ length: FRET_COUNT + 1 }, (_, n) => (
        <line
          key={`fret-${n}`}
          x1={d.left - 4}
          x2={d.left + 5 * (d.fretW + d.gap) - d.gap + 4}
          y1={fretY(n)}
          y2={fretY(n)}
          stroke="currentColor"
          className="text-line-strong"
          strokeWidth={n === 0 ? 0.5 : 0.7}
        />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <line
          key={`string-${i}`}
          x1={stringX(i)}
          x2={stringX(i)}
          y1={headerHeight}
          y2={headerHeight + gridHeight}
          stroke="currentColor"
          className={
            shape.frets[i] === null ? "text-muted-string" : "text-ink-faint"
          }
          strokeWidth={0.8}
        />
      ))}

      {/* Fret numbers, only when the shape does not start at the nut. */}
      {firstFret > 1 && (
        <text
          x={d.left - 8}
          y={fretY(0) + d.fretW * 0.75}
          textAnchor="end"
          className="fill-ink-faint"
          style={{ fontSize: 9 }}
        >
          {firstFret}
        </text>
      )}

      {/* Capo bar, drawn across the neck at the capo fret. */}
      {capoFret > 0 && (
        <>
          <line
            x1={d.left - 6}
            x2={d.left + 5 * (d.fretW + d.gap) - d.gap + 6}
            y1={fretY(0) - d.nut * 0.55}
            y2={fretY(0) - d.nut * 0.55}
            stroke="var(--color-accent)"
            strokeWidth={3.5}
            strokeLinecap="round"
          />
          <text
            x={d.left + 5 * (d.fretW + d.gap) - d.gap + 9}
            y={fretY(0) - d.nut * 0.55 + 3}
            className="fill-accent"
            style={{ fontSize: 9, fontWeight: 600 }}
          >
            {capoFret}
          </text>
        </>
      )}

      {/* Barre bars, behind the finger dots so the dots read on top. */}
      {barres.map((barre) => (
        <rect
          key={`barre-${barre.fret}`}
          x={stringX(barre.from) - d.fingerR}
          y={fretY(barre.fret - firstFret + 1) - d.fingerR}
          width={stringX(barre.to) - stringX(barre.from) + d.fingerR * 2}
          height={d.fingerR * 2}
          fill="var(--color-barre)"
          rx={d.fingerR}
          opacity={0.85}
        />
      ))}

      {/* Finger dots. */}
      {shape.frets.map((fret, i) => {
        if (fret === null || fret === 0) return null;
        const barre = barres.find(
          (b) =>
            b.fret === fret && i >= b.from && i <= b.to,
        );
        if (barre) return null; // already drawn as a bar
        return (
          <circle
            key={`finger-${i}`}
            cx={stringX(i)}
            cy={fretY(fret - firstFret + 1)}
            r={d.fingerR}
            fill="var(--color-finger)"
          />
        );
      })}

      {/* Open and muted markers above the nut. */}
      {shape.frets.map((fret, i) => {
        const marker = markerFor(fret, i);
        if (marker === "fret") return null;
        if (marker === "x") {
          const s = size === "lg" ? 5 : 3.4;
          const cx = stringX(i);
          const cy = headerHeight - d.nut / 2;
          return (
            <g key={`mute-${i}`}>
              <line
                x1={cx - s}
                y1={cy - s}
                x2={cx + s}
                y2={cy + s}
                stroke="var(--color-ink-faint)"
                strokeWidth={1.2}
              />
              <line
                x1={cx + s}
                y1={cy - s}
                x2={cx - s}
                y2={cy + s}
                stroke="var(--color-ink-faint)"
                strokeWidth={1.2}
              />
            </g>
          );
        }
        return (
          <circle
            key={`open-${i}`}
            cx={stringX(i)}
            cy={headerHeight - d.nut / 2}
            r={marker === "o" ? (size === "lg" ? 3.6 : 2.5) : 0}
            fill="none"
            stroke="var(--color-ink-muted)"
            strokeWidth={1.1}
          />
        );
      })}

      {/* Note names down the side, so the diagram teaches as well as shows. */}
      {!hideNotes &&
        shape.frets.map((fret, i) => {
          if (fret === null) return null;
          const pitch = pc(midiAt(tuning, i as 0 | 1 | 2 | 3 | 4 | 5, fret));
          if (!sounding.has(pitch)) return null;
          const label = keySignature
            ? nameInKey(pitch, keySignature)
            : ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][pitch];
          return (
            <text
              key={`note-${i}`}
              x={totalWidth - 2}
              y={headerHeight + gridHeight - i * (d.fretW) - 2}
              textAnchor="end"
              className="fill-ink-faint"
              style={{ fontSize: size === "lg" ? 10 : 7.5 }}
            >
              {label}
            </text>
          );
        })}

      {showDifficulty && (
        <text
          x={d.left - 4}
          y={totalHeight - 3}
          className="fill-ink-faint"
          style={{ fontSize: 8 }}
        >
          {TIER_LABEL[score.tier]}
        </text>
      )}
    </svg>
  );
}

function describeShapeForScreen(
  shape: Shape,
  tuning: ReturnType<typeof getTuning>,
  capoFret: number,
): string {
  const frets = shape.frets
    .map((f) => (f === null ? "muted" : f === 0 ? "open" : `fret ${f}`))
    .join(", ");
  const capo = capoFret > 0 ? ` Capo on fret ${capoFret}.` : "";
  const notes = tuning.stringNames.join(" ");
  return `Chord diagram, strings from low to high (${notes}). ${frets}.${capo}`;
}
