import { describe, expect, it } from "vitest";
import { renderPluck } from "./karplusStrong";
import { stepDuration, strokeAt, soundingSteps, STRUM_PATTERNS } from "./patterns";
import { midiToFrequency } from "@/lib/music/fretboard";

/**
 * A minimal OfflineAudioContext stand-in, so the synthesis can be tested in
 * Node. The Karplus-Strong algorithm is pure arithmetic on Float32Arrays; the
 * only part of the Web Audio API it touches is buffer creation.
 */
class FakeAudioContext {
  sampleRate = 44100;
  createBuffer(channels: number, length: number): FakeBuffer {
    return new FakeBuffer(length);
  }
}
class FakeBuffer {
  constructor(public length: number) {}
  private data = new Float32Array(this.length);
  getChannelData(): Float32Array {
    return this.data;
  }
}

const context = new FakeAudioContext() as unknown as BaseAudioContext;

/**
 * The lag, in samples, that best predicts the signal from itself.
 * This is the period of the fundamental, and it is far more reliable than
 * counting zero crossings on a waveform that still carries noise harmonics.
 */
function dominantPeriod(
  data: Float32Array,
  sampleRate: number,
  minLag: number,
  maxLag: number,
): number {
  const start = Math.floor(sampleRate * 0.1);
  const window = Math.floor(sampleRate * 0.2);
  let best = -Infinity;
  let bestLag = minLag;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < window; i++) {
      sum += data[start + i] * data[start + i + lag];
    }
    if (sum > best) {
      best = sum;
      bestLag = lag;
    }
  }
  return bestLag;
}

describe("Karplus-Strong synthesis", () => {
  it("produces a buffer of the requested length", () => {
    const buffer = renderPluck(context, 69, 1);
    expect(buffer.length).toBe(Math.floor(context.sampleRate));
  });

  it("produces the right pitch", () => {
    // Measure the period by autocorrelation, not by counting zero crossings.
    // A Karplus-Strong output has residual high-frequency content from the
    // noise excitation, so it touches zero more than twice per cycle and a
    // naive crossing count reports an octave too high. Autocorrelation finds
    // the true period.
    const midi = 69; // A4, 440Hz
    const buffer = renderPluck(context, midi, 0.6, { damping: 0.999 });
    const data = buffer.getChannelData(0);
    const period = dominantPeriod(data, context.sampleRate, 20, 400);
    const measured = context.sampleRate / period;
    expect(measured).toBeGreaterThan(midiToFrequency(midi) * 0.95);
    expect(measured).toBeLessThan(midiToFrequency(midi) * 1.05);
  });

  it("pitches higher notes higher", () => {
    const periodOf = (midi: number) => {
      const data = renderPluck(context, midi, 0.4, { damping: 0.999 }).getChannelData(0);
      return dominantPeriod(data, context.sampleRate, 10, 400);
    };
    // Higher pitch means a shorter period.
    expect(periodOf(76)).toBeLessThan(periodOf(64));
    expect(periodOf(88)).toBeLessThan(periodOf(76));
  });

  it("decays rather than sustaining forever", () => {
    const buffer = renderPluck(context, 45, 2);
    const data = buffer.getChannelData(0);
    const rms = (from: number, to: number) => {
      let sum = 0;
      for (let i = from; i < to; i++) sum += data[i] * data[i];
      return Math.sqrt(sum / (to - from));
    };
    const early = rms(0, 2000);
    const late = rms(buffer.length - 4000, buffer.length);
    expect(early).toBeGreaterThan(0);
    expect(late).toBeLessThan(early);
  });

  it("is louder when damping is higher", () => {
    const wet = renderPluck(context, 52, 1, { damping: 0.9999 });
    const dry = renderPluck(context, 52, 1, { damping: 0.99 });
    const tailRms = (buffer: AudioBuffer) => {
      const data = buffer.getChannelData(0);
      let sum = 0;
      const from = buffer.length - 4000;
      for (let i = from; i < buffer.length; i++) sum += data[i] * data[i];
      return Math.sqrt(sum / 4000);
    };
    expect(tailRms(wet)).toBeGreaterThan(tailRms(dry));
  });

  it("never produces NaN, including for very high notes", () => {
    // A MIDI note far above a guitar still has to render, not blow up.
    for (const midi of [40, 64, 88, 100]) {
      const data = renderPluck(context, midi, 0.2).getChannelData(0);
      for (let i = 0; i < data.length; i += 97) {
        expect(Number.isFinite(data[i]), `midi ${midi} at ${i}`).toBe(true);
      }
    }
  });

  it("normalises to the requested gain", () => {
    const data = renderPluck(context, 60, 0.5, { gain: 0.5 }).getChannelData(0);
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
    }
    expect(peak).toBeLessThanOrEqual(0.5 + 0.001);
  });
});

describe("step timing", () => {
  it("computes eighth-note duration", () => {
    // At 120bpm a quarter is 0.5s, so an eighth is 0.25s.
    expect(stepDuration(120, 8)).toBeCloseTo(0.25, 6);
  });

  it("computes sixteenth-note duration", () => {
    expect(stepDuration(120, 16)).toBeCloseTo(0.125, 6);
  });

  it("scales with tempo", () => {
    // A quarter note at 60bpm is a second, so an eighth is half that.
    expect(stepDuration(60, 8)).toBeCloseTo(0.5, 6);
    // At 240bpm a quarter is 0.25s, so an eighth is 0.125s.
    expect(stepDuration(240, 8)).toBeCloseTo(0.125, 6);
  });
});

describe("patterns", () => {
  it("every pattern has the right number of steps for its subdivision", () => {
    for (const pattern of Object.values(STRUM_PATTERNS)) {
      const expected = (pattern.beats * pattern.subdivision) / 4;
      expect(pattern.steps.length, pattern.id).toBe(expected);
    }
  });

  it("every pattern has at least one downstroke", () => {
    for (const pattern of Object.values(STRUM_PATTERNS)) {
      expect(pattern.steps, pattern.id).toContain("down");
    }
  });

  it("every pattern is a non-empty named description", () => {
    for (const pattern of Object.values(STRUM_PATTERNS)) {
      expect(pattern.name.length, pattern.id).toBeGreaterThan(0);
      expect(pattern.description.length, pattern.id).toBeGreaterThan(10);
    }
  });

  it("wraps around the bar", () => {
    const pattern = STRUM_PATTERNS["folk-8ths"];
    expect(strokeAt(pattern, 0)).toBe("down");
    expect(strokeAt(pattern, 8)).toBe("down");
    expect(strokeAt(pattern, -1)).toBe("down");
  });

  it("finds the sounding steps", () => {
    const folk = soundingSteps(STRUM_PATTERNS["folk-8ths"]);
    expect(folk).toHaveLength(8);
    const boomChick = soundingSteps(STRUM_PATTERNS["boom-chick"]);
    // A boom-chick rests on most steps.
    expect(boomChick.length).toBeLessThan(8);
    expect(boomChick.length).toBeGreaterThan(0);
  });
});
