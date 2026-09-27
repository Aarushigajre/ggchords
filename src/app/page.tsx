import Link from "next/link";
import { PROGRESSIONS, progressionChords } from "@/lib/progressions/data";
import { voicingsFor } from "@/lib/music/voicing";
import { ChordDiagram } from "@/components/ChordDiagram";

export default function Home() {
  const featured = PROGRESSIONS.slice(0, 4);

  return (
    <main className="mx-auto max-w-6xl px-5">
      {/* Hero */}
      <section className="border-b border-line/70 py-16 sm:py-24">
        <div className="max-w-2xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-accent">
            Gajre Guitar Chords
          </p>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Every chord progression,
            <br />
            in any key, with shapes
            <br />
            you can actually play.
          </h1>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-ink-muted">
            Chord shapes here are not copied from a chart. They are searched for
            on the fretboard and checked, so the fingering is right, the bass
            note is right, and the seventh is never quietly missing.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/progressions"
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              Browse progressions
            </Link>
            <Link
              href="/songs"
              className="rounded-lg border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-panel"
            >
              Public-domain songs
            </Link>
            <span className="text-xs text-ink-faint">
              <span className="text-ink-muted">gg</span>chords ={" "}
              <span className="text-ink-muted">G</span>ajre{" "}
              <span className="text-ink-muted">G</span>uitar{" "}
              <span className="text-ink-muted">C</span>hords
            </span>
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="py-14">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">
            Start here
          </h2>
          <Link
            href="/progressions"
            className="text-sm text-ink-muted transition-colors hover:text-accent"
          >
            All {PROGRESSIONS.length} →
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {featured.map((progression) => {
            const chords = progressionChords(progression);
            const voicings = chords
              .map((chord) => voicingsFor(chord, { prefer: progression.symbols[chords.indexOf(chord)] }))
              .filter((v) => v.preferred !== null);
            return (
              <Link
                key={progression.id}
                href={`/progressions/${progression.id}/`}
                className="group rounded-xl border border-line/70 bg-panel p-5 transition-colors hover:border-line-strong hover:bg-panel-raised"
              >
                <div className="mb-1 flex items-start justify-between gap-3">
                  <h3 className="font-medium tracking-tight">
                    {progression.title}
                  </h3>
                  <span className="shrink-0 text-xs text-ink-faint">
                    {progression.keyName}
                  </span>
                </div>
                <p className="mb-4 text-xs text-ink-faint">
                  {progression.genre.join(" · ")}
                </p>
                <div className="flex gap-3 overflow-x-auto pb-1 scroll-slim">
                  {voicings.slice(0, 6).map((voicing) => (
                    <div
                      key={voicing.symbol}
                      className="shrink-0 text-center"
                    >
                      <ChordDiagram shape={voicing.preferred!} size="sm" />
                      <div className="mt-1 text-[11px] text-ink-muted">
                        {voicing.symbol}
                      </div>
                    </div>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Why */}
      <section className="border-t border-line/70 py-14">
        <div className="grid gap-8 sm:grid-cols-3">
          {[
            {
              title: "Shapes are derived, not copied",
              body: "A generator walks the fretboard for every chord. It also finds chords nobody has charted, and works in tunings other people have never written down.",
            },
            {
              title: "Difficulty is explicit",
              body: "Four tiers from open to full barre, so you can ask for the easiest thing that works rather than scrolling through 400 fingerings.",
            },
            {
              title: "Honest about limits",
              body: "Four chords cannot play every song. When a progression needs chords you do not know, the app tells you which and why — instead of quietly producing something wrong.",
            },
          ].map((item) => (
            <div key={item.title}>
              <h3 className="mb-2 text-sm font-medium">{item.title}</h3>
              <p className="text-[13px] leading-relaxed text-ink-muted">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

