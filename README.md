# ggchords

**Gajre Guitar Chords** — work out any chord progression in any key, with
shapes you can actually play.

A static site. No server, no database, no API. Deployed on Vercel.

---

## What makes it different

Most chord sites copy fingerings out of a chart. These are **computed**.

A shape generator walks the fretboard for every chord and returns only
combinations that genuinely spell the chord: root in the bass, every required
tone present, no unison on adjacent strings, nothing outside the chord. It is
property-tested against all 288 chords in the vocabulary — 24 qualities across
12 roots — and works in tunings nobody has written down.

On top of that sits a small **curated overlay**: a handful of voicings per
common chord, used only to break ties toward the shapes guitarists actually
learn. It is the sole piece of hand-typed musical data in the project, and it is
validated against the generator so a typo cannot ship.

### Three things the UI is careful about

**Difficulty is explicit, not assumed.** Four tiers, from open to full barre,
with the best shape in each. A beginner asks for the easiest thing that works
rather than scrolling through four hundred fingerings. The canonical Cm9
(`x31333`) is listed explicitly because the mechanical ranking prefers thinner
shapes nobody plays.

**The capo never lies about what it does.** A capo does not change the chord you
play, it changes what that chord *sounds as*. So the shape you play and what the
audience hears are always shown as two separate names, with the fret between
them.

**Roman numerals are computed, never stored,** so transposing re-analyses the
progression. Non-diatonic chords are handled properly: borrowed degrees,
secondary dominants, mode interchange.

## Songs

Traditional and folk repertoire, authored as **ChordPro** — the standard plain
text chord-sheet format, so a song is a diffable file rather than a database
row. Open one and you get the plain lyrics for reading, and the same lyrics with
chords for playing, where hovering any chord shows its fingering and hovering a
word shows what sounds over it.

There is an autoscroll for practice, a strum pattern picker, and synthesised
audio. **No audio files ship.** Sound is generated in the browser with a
Karplus-Strong plucked-string model, so the backing track always matches the
shape and capo you have selected.

### On copyright

Chord progressions are **not copyrightable** — harmony is a fact or a method,
not an expression. Lyrics and melody both are.

The songbook is therefore limited to material where the **whole work** has
entered the public domain: the words *and* the tune, from collections old
enough to be out of copyright. The rights field on each song is enforced in the
type system, and the lyrics renderer physically refuses to display anything that
is not `public-domain`.

A recording is a **separate** copyrighted work even when the song is free. In
the US, anything recorded before 1972 does not enter the public domain before
2067. So third-party recordings are linked to, never hosted; `public/audio/` is
for recordings the site's own owner made.

## Stack

| | |
|---|---|
| Framework | Next.js 16, App Router, TypeScript |
| Output | `output: 'export'` — pure static |
| Styling | Tailwind CSS v4 |
| State | React `useState`/`useMemo` — no global store, one workspace per page |
| Audio | Web Audio API, Karplus-Strong |
| Tests | Vitest |

187 tests, all of them on the pure logic layer. The music theory is where the
risk lives, so that is where the tests are.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest
npm run build      # static export to out/
```

## Working on the shapes

The curated overlay is the only hand-written musical data, so it has its own
checker. After editing it:

```bash
npx vite-node scripts/verify-curated.ts
```

It validates every entry against the generator and prints verified replacements
for anything wrong, so corrections are made from computed facts rather than from
memory. This matters: an early draft of that table contained 41 invalid
fingerings, including `032010` labelled as a plain C when it is really C/E.

## Layout

```
src/lib/music/        notes, fretboard, chord qualities, shape generator,
                      difficulty, curated overlay, numerals, transpose, capo
src/lib/songs/        ChordPro parser, rights model, songbook
src/lib/strum/        patterns, Karplus-Strong, scheduler
src/lib/reharmonize/  play this with the chords you know
src/lib/progressions/ the abstract progression library
data/songs/*.chopro   the songbook
scripts/              verification tooling
```

## Known gaps

- Reharmonisation has a tested engine but no interface.
- Three songs. Each new one is a `.chopro` file plus a catalogue entry.
- No recordings, deliberately. See *On copyright* above.
