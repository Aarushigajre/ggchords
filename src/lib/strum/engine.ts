/**
 * Strum playback.
 *
 * The scheduling is the part that matters. Using setTimeout or setInterval to
 * fire notes gives you a performance that audibly drifts and stutters, because
 * both are throttled and neither is sample-accurate. The fix is the standard
 * "two clocks" approach: a coarse timer wakes up frequently, and every wake-up
 * schedules any notes that fall inside the next short window directly on the
 * audio clock. Timers then only ever *schedule*; the audio hardware decides
 * exactly when each note sounds.
 */

import { type StrumPattern, type Stroke, stepDuration } from "./patterns";
import { PluckCache } from "./karplusStrong";

export interface PlaybackOptions {
  tempo: number;
  pattern: StrumPattern;
  /** MIDI notes for each chord in the progression, low string first. */
  progression: number[][];
  /** How many bars before looping. Defaults to the progression length. */
  bars?: number;
  /** Seconds between strummed strings, which is what makes it sound strummed. */
  strumSpread?: number;
  gain?: number;
  /**
   * Bars of count-in clicks before the chords start. A count-in is what a
   * recording would otherwise give you: you know where the downbeat is
   * before the first chord lands.
   */
  countInBars?: number;
  /** Click volume, 0 to mute the click while keeping the chords. */
  clickGain?: number;
  /**
   * Called as the transport moves, so the UI can highlight the current beat.
   * `step` is the position within the bar's pattern; `bar` counts from 0.
   */
  onStep?: (step: number, bar: number, countingIn: boolean) => void;
}

export type PlaybackState = "idle" | "playing";

/** How far ahead of the audio clock we schedule. */
const LOOKAHEAD_MS = 25;
/** How far into the future that window reaches. */
const SCHEDULE_AHEAD = 0.12;

/**
 * Plays a progression with a strum pattern, looping.
 *
 * One instance owns one AudioContext. Creating a context per play press is
 * both wasteful and, on some browsers, blocked by autoplay policy.
 */
export class StrumPlayer {
  private context: AudioContext | null = null;
  private cache: PluckCache | null = null;
  private master: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private bar = 0;
  private state: PlaybackState = "idle";
  private options: PlaybackOptions;
  private totalBars: number;
  /** Bars of count-in still to play. Zero once the chords are underway. */
  private countInRemaining = 0;
  private reportedStep = -1;
  private reportedBar = -1;

  constructor(options: PlaybackOptions) {
    this.options = options;
    this.totalBars = options.bars ?? Math.max(1, options.progression.length);
  }

  /** Must be called from a user gesture, or the context starts suspended. */
  async resume(): Promise<void> {
    const context = this.ensureContext();
    if (context.state === "suspended") await context.resume();
  }

  private ensureContext(): AudioContext {
    if (this.context) return this.context;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) throw new Error("Web Audio is not available in this browser");
    this.context = new Ctor();
    this.cache = new PluckCache(this.context, { gain: 1 });
    this.master = this.context.createGain();
    this.master.gain.value = this.options.gain ?? 0.8;
    this.master.connect(this.context.destination);
    return this.context;
  }

  update(options: Partial<PlaybackOptions>): void {
    const wasPlaying = this.state === "playing";
    if (wasPlaying) this.stop();
    this.options = { ...this.options, ...options };
    this.totalBars = this.options.bars ?? Math.max(1, this.options.progression.length);
    if (wasPlaying) this.start();
  }

  start(): void {
    const context = this.ensureContext();
    void this.resume();
    if (this.state === "playing") return;

    this.state = "playing";
    this.step = 0;
    this.bar = 0;
    this.countInRemaining = this.options.countInBars ?? 0;
    this.reportedStep = -1;
    this.reportedBar = -1;
    // Start slightly in the future so the first note is not late.
    this.nextNoteTime = context.currentTime + 0.06;
    this.timer = setInterval(() => this.tick(), LOOKAHEAD_MS);
    this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state = "idle";
    this.step = 0;
    this.bar = 0;
    this.countInRemaining = 0;
    this.reportedStep = -1;
    this.reportedBar = -1;
  }

  /** True while the count-in clicks are still sounding. */
  isCountingIn(): boolean {
    return this.countInRemaining > 0;
  }

  toggle(): void {
    if (this.state === "playing") this.stop();
    else this.start();
  }

  getState(): PlaybackState {
    return this.state;
  }

  /** Called on a timer; schedules everything in the next window. */
  private tick(): void {
    const context = this.context;
    if (!context || this.state !== "playing") return;

    while (this.nextNoteTime < context.currentTime + SCHEDULE_AHEAD) {
      this.scheduleStep(this.nextNoteTime);
      this.reportStep();
      this.advance();
    }
  }

  /**
   * Tell the UI where the transport is.
   *
   * Only reported when it actually changes, because a callback firing on every
   * scheduled step would cause a React render several times a bar for no reason.
   */
  private reportStep(): void {
    const { onStep } = this.options;
    if (!onStep) return;
    if (this.step === this.reportedStep && this.bar === this.reportedBar) return;
    this.reportedStep = this.step;
    this.reportedBar = this.bar;
    onStep(this.step, this.bar, this.countInRemaining > 0);
  }

  private scheduleStep(time: number): void {
    const context = this.context;
    const master = this.master;
    const cache = this.cache;
    if (!context || !master || !cache) return;

    const { pattern, progression } = this.options;

    // During the count-in there are no chords, only clicks on the downbeats.
    // A click on every subdivision would be a metronome, not a count-in.
    if (this.countInRemaining > 0) {
      if (this.step === 0) {
        renderClick(context, time, true, this.options.clickGain ?? 0.5);
      }
      return;
    }

    const stroke: Stroke = pattern.steps[this.step % pattern.steps.length];
    if (stroke === "rest") return;

    const chordIndex = this.bar % progression.length;
    const notes = progression[chordIndex];
    if (!notes || notes.length === 0) return;

    // A downstroke sweeps low to high, an upstroke high to low. This is most
    // of what makes a strum sound like a strum rather than a chord.
    const ordered = stroke === "down" ? [...notes] : [...notes].reverse();

    // Upstrokes are quieter, and a downstroke lands a touch harder.
    const strokeGain = stroke === "down" ? 1 : 0.72;
    const spread = this.options.strumSpread ?? 0.009;

    ordered.forEach((midi, index) => {
      const source = context.createBufferSource();
      source.buffer = cache.get(midi);
      const gain = context.createGain();
      gain.gain.value = strokeGain;
      source.connect(gain);
      gain.connect(master);
      source.start(time + index * spread);
    });
  }

  private advance(): void {
    const context = this.context;
    if (!context) return;
    const { pattern, tempo } = this.options;
    this.nextNoteTime += stepDuration(tempo, pattern.subdivision);
    this.step += 1;
    if (this.step % pattern.steps.length === 0) {
      this.step = 0;
      // A bar boundary is where the count-in is consumed.
      if (this.countInRemaining > 0) this.countInRemaining -= 1;
      this.bar += 1;
      if (this.bar >= this.totalBars) this.bar = 0;
    }
  }

  /** Release the audio hardware. Call on unmount. */
  dispose(): void {
    this.stop();
    if (this.context) {
      void this.context.close();
      this.context = null;
    }
    this.cache?.clear();
    this.cache = null;
    this.master = null;
  }
}

/**
 * A simple click for a metronome, built as a short noise burst rather than a
 * sampled asset so the app ships with no audio files at all.
 */
export function renderClick(
  context: BaseAudioContext,
  time: number,
  accent: boolean,
  gain = 0.4,
): { stop: () => void } {
  const sampleRate = context.sampleRate;
  const length = Math.floor(sampleRate * 0.03);
  const buffer = context.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const decay = 1 - i / length;
    data[i] = (Math.random() * 2 - 1) * decay * decay;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  const gainNode = context.createGain();
  gainNode.gain.value = accent ? gain : gain * 0.5;
  source.connect(gainNode);
  gainNode.connect(context.destination);
  source.start(time);
  return { stop: () => source.stop() };
}
