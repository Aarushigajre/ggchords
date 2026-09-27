/**
 * Plucked-string synthesis.
 *
 * Additive sine waves sound like a test tone, not a guitar. Karplus-Strong
 * sounds like a plucked string, and it is barely more code: run a burst of
 * noise through a delay line one period long, and let it recirculate. The
 * recirculation *is* the decay, and the lowpass in the feedback path is what
 * removes the high harmonics first, exactly as a real string does.
 *
 * This matters for the app. A learner using this to practise will notice
 * immediately if the timbre is wrong, and "sounds like a guitar" is the whole
 * requirement for a practice tool.
 */

import { midiToFrequency } from "@/lib/music/fretboard";

export interface PluckOptions {
  /** 0 = no damping, 1 = immediately silent. Real strings sit around 0.996. */
  damping?: number;
  /** Picks and speakers kill the top end faster than a finger does. */
  brightness?: number;
  /** Overall level, 0-1. */
  gain?: number;
}

/**
 * Render one plucked note into an AudioBuffer.
 *
 * `sampleRate` must be the AudioContext's rate, or the pitch comes out wrong.
 */
export function renderPluck(
  context: BaseAudioContext,
  midi: number,
  durationSeconds: number,
  options: PluckOptions = {},
): AudioBuffer {
  const { damping = 0.996, brightness = 0.5, gain = 0.9 } = options;

  const frequency = midiToFrequency(midi);
  const sampleRate = context.sampleRate;
  const totalSamples = Math.max(
    1,
    Math.floor(sampleRate * Math.min(durationSeconds, 6)),
  );
  const buffer = context.createBuffer(1, totalSamples, sampleRate);
  const out = buffer.getChannelData(0);

  // The delay line is one period long. Its length, rounded to a whole sample,
  // is what fixes the pitch, so it must be at least two samples or a very high
  // note produces an empty or aliased buffer.
  const periodLength = Math.max(2, Math.round(sampleRate / frequency));
  const noiseLength = Math.min(periodLength, totalSamples);
  const delay = new Float32Array(periodLength);

  // Excitation: noise for a pick attack. A short burst of noise in the delay
  // line produces the initial "chunk" of a plucked string; a pure impulse
  // produces a click.
  for (let i = 0; i < noiseLength; i++) {
    // Lowpass the noise a little so the attack is not pure hiss.
    const white = Math.random() * 2 - 1;
    delay[i] = i === 0 ? white : delay[i - 1] * 0.5 + white * 0.5;
  }

  // One-pole lowpass in the feedback loop, modelling the string losing treble
  // as it decays. Higher brightness retains more.
  //
  // The two coefficients must sum to 1, giving the filter unity gain at DC. In
  // that case the loop gain is at most `damping` (< 1) and the note decays.
  // Scaling the filtered value by anything above 1 makes the loop unstable:
  // the buffer fills with Infinity, then NaN, and the note is silent.
  const mix = 0.15 + brightness * 0.6;

  let index = 0;
  let previous = 0;
  for (let i = 0; i < totalSamples; i++) {
    const current = delay[index];
    delay[index] = ((1 - mix) * current + mix * previous) * damping;
    previous = current;
    out[i] = current;
    index = (index + 1) % periodLength;
  }

  // Tail fade so the buffer never ends on a click, and normalise.
  const fadeLength = Math.min(totalSamples, Math.floor(sampleRate * 0.01));
  for (let i = 0; i < fadeLength; i++) {
    out[totalSamples - 1 - i] *= i / fadeLength;
  }

  let peak = 0;
  for (let i = 0; i < totalSamples; i++) {
    const magnitude = Math.abs(out[i]);
    if (magnitude > peak) peak = magnitude;
  }
  if (peak > 0) {
    const scale = gain / peak;
    for (let i = 0; i < totalSamples; i++) out[i] *= scale;
  }

  return buffer;
}

/**
 * Cached plucks, keyed by MIDI note.
 *
 * Rendering is cheap but not free, and a strummed chord replays the same six
 * notes every bar. Caching also means identical notes sound identical, which
 * they would not with fresh noise each time.
 */
export class PluckCache {
  private cache = new Map<number, AudioBuffer>();

  constructor(
    private context: BaseAudioContext,
    private options: PluckOptions = {},
  ) {}

  get(midi: number, duration = 2.5): AudioBuffer {
    const cached = this.cache.get(midi);
    if (cached) return cached;
    const buffer = renderPluck(this.context, midi, duration, this.options);
    this.cache.set(midi, buffer);
    return buffer;
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
