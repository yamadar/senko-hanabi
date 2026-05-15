import { describe, it, expect } from 'vitest';
import {
  cosineEase,
  easeOutQuad,
  computeEffectiveMax,
  hueToIndex,
  growingRadius,
  shrinkingRadius,
  wobbleFactor,
  lifespanToDecay,
  splitChance,
  clamp,
  randRange,
} from './math.js';
import { MAX_SPARKLERS, CYCLE_SECONDS, HUE_STEPS } from './config.js';

describe('cosineEase', () => {
  it('maps endpoints exactly', () => {
    expect(cosineEase(0)).toBeCloseTo(0);
    expect(cosineEase(1)).toBeCloseTo(1);
  });

  it('is 0.5 at the midpoint', () => {
    expect(cosineEase(0.5)).toBeCloseTo(0.5);
  });

  it('is monotonically increasing on [0,1]', () => {
    let prev = -Infinity;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const v = cosineEase(Math.min(1, p));
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('stays within [0,1]', () => {
    for (let p = 0; p <= 1; p += 0.1) {
      const v = cosineEase(p);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('easeOutQuad', () => {
  it('maps endpoints exactly', () => {
    expect(easeOutQuad(0)).toBeCloseTo(0);
    expect(easeOutQuad(1)).toBeCloseTo(1);
  });

  it('is ahead of linear (front-loaded)', () => {
    // ease-out: 序盤に勢いよく → 中盤で linear より大きい
    expect(easeOutQuad(0.5)).toBeGreaterThan(0.5);
  });

  it('is monotonically increasing', () => {
    let prev = -Infinity;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const v = easeOutQuad(Math.min(1, p));
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('computeEffectiveMax', () => {
  it('returns MAX_SPARKLERS during the 0-40% plateau', () => {
    // phase 0 → 100%
    expect(computeEffectiveMax(0, 0)).toBe(MAX_SPARKLERS);
    // phase ~0.2 (still plateau)
    const t = 0.2 * CYCLE_SECONDS * 1000;
    expect(computeEffectiveMax(t, 0)).toBe(MAX_SPARKLERS);
  });

  it('never returns below the guaranteed minimum of 2', () => {
    for (let phase = 0; phase < 1; phase += 0.02) {
      const t = phase * CYCLE_SECONDS * 1000;
      expect(computeEffectiveMax(t, 0)).toBeGreaterThanOrEqual(2);
    }
  });

  it('never exceeds MAX_SPARKLERS', () => {
    for (let phase = 0; phase < 1; phase += 0.02) {
      const t = phase * CYCLE_SECONDS * 1000;
      expect(computeEffectiveMax(t, 0)).toBeLessThanOrEqual(MAX_SPARKLERS);
    }
  });

  it('reaches its lowest value near the end of the descent (~85%)', () => {
    const t = 0.85 * CYCLE_SECONDS * 1000;
    const low = computeEffectiveMax(t, 0);
    // 30% of 12 = 3.6 → rounds to 4
    expect(low).toBe(Math.round(MAX_SPARKLERS * 0.3));
    expect(low).toBeLessThan(MAX_SPARKLERS);
  });

  it('descends monotonically through the 40-85% phase', () => {
    let prev = Infinity;
    for (let phase = 0.4; phase <= 0.85; phase += 0.05) {
      const v = computeEffectiveMax(phase * CYCLE_SECONDS * 1000, 0);
      expect(v).toBeLessThanOrEqual(prev);
      prev = v;
    }
  });

  it('is periodic over CYCLE_SECONDS', () => {
    const a = computeEffectiveMax(12_345, 0);
    const b = computeEffectiveMax(12_345 + CYCLE_SECONDS * 1000, 0);
    expect(a).toBe(b);
  });

  it('handles nowMs before startMs without going below the floor', () => {
    expect(computeEffectiveMax(-5000, 0)).toBeGreaterThanOrEqual(2);
  });
});

describe('hueToIndex', () => {
  it('returns an integer index within [0, HUE_STEPS)', () => {
    for (let h = -720; h <= 720; h += 13) {
      const idx = hueToIndex(h);
      expect(Number.isInteger(idx)).toBe(true);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(HUE_STEPS);
    }
  });

  it('maps hue 0 to index 0', () => {
    expect(hueToIndex(0)).toBe(0);
  });

  it('wraps 360 back to index 0', () => {
    expect(hueToIndex(360)).toBe(hueToIndex(0));
  });

  it('handles negative hues by wrapping', () => {
    expect(hueToIndex(-20)).toBe(hueToIndex(340));
  });
});

describe('growingRadius', () => {
  it('equals initialRadius at age 0', () => {
    expect(growingRadius(0, 100, 3, 25)).toBeCloseTo(3);
  });

  it('equals maxRadius once grown', () => {
    expect(growingRadius(100, 100, 3, 25)).toBeCloseTo(25);
  });

  it('clamps beyond growDuration to maxRadius', () => {
    expect(growingRadius(500, 100, 3, 25)).toBeCloseTo(25);
  });

  it('stays between initial and max while growing', () => {
    for (let age = 0; age <= 100; age += 10) {
      const r = growingRadius(age, 100, 3, 25);
      expect(r).toBeGreaterThanOrEqual(3 - 1e-9);
      expect(r).toBeLessThanOrEqual(25 + 1e-9);
    }
  });
});

describe('shrinkingRadius', () => {
  it('returns maxRadius when life equals lifeAtShrinkStart', () => {
    expect(shrinkingRadius(0.8, 0.8, 25)).toBeCloseTo(25);
  });

  it('returns 0 when life is 0', () => {
    expect(shrinkingRadius(0, 0.8, 25)).toBeCloseTo(0);
  });

  it('decreases as life decreases', () => {
    const hi = shrinkingRadius(0.6, 0.8, 25);
    const lo = shrinkingRadius(0.2, 0.8, 25);
    expect(lo).toBeLessThan(hi);
  });

  it('never goes negative for negative life', () => {
    expect(shrinkingRadius(-0.3, 0.8, 25)).toBe(0);
  });
});

describe('wobbleFactor', () => {
  it('stays within roughly +/-9% of 1', () => {
    for (let age = 0; age < 2000; age += 7) {
      const w = wobbleFactor(age, 0.06, 1.2);
      expect(w).toBeGreaterThan(0.9);
      expect(w).toBeLessThan(1.1);
    }
  });
});

describe('lifespanToDecay', () => {
  it('produces a decay that depletes life to ~0 over the given seconds at 60fps', () => {
    const seconds = 10;
    const decay = lifespanToDecay(seconds);
    const frames = seconds * 60;
    expect(decay * frames).toBeCloseTo(1);
  });

  it('longer lifespans give smaller decay', () => {
    expect(lifespanToDecay(30)).toBeLessThan(lifespanToDecay(8));
  });

  it('always produces a positive decay', () => {
    expect(lifespanToDecay(8)).toBeGreaterThan(0);
  });
});

describe('splitChance', () => {
  it('returns 0 when there is no headroom', () => {
    expect(splitChance(0, 0.1)).toBe(0);
    expect(splitChance(-3, 0.1)).toBe(0);
  });

  it('gives the highest probability when nearly empty', () => {
    expect(splitChance(10, 0.05)).toBe(0.55);
  });

  it('gives the lowest non-zero probability when nearly full', () => {
    expect(splitChance(1, 0.95)).toBe(0.015);
  });

  it('is non-increasing as the fill ratio rises', () => {
    let prev = Infinity;
    for (let ratio = 0; ratio < 1; ratio += 0.05) {
      const c = splitChance(5, ratio);
      expect(c).toBeLessThanOrEqual(prev);
      prev = c;
    }
  });
});

describe('clamp', () => {
  it('passes through values within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to the lower bound', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it('clamps to the upper bound', () => {
    expect(clamp(42, 0, 10)).toBe(10);
  });
});

describe('randRange', () => {
  it('always returns a value within [min, max)', () => {
    for (let i = 0; i < 500; i++) {
      const v = randRange(5, 9);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(9);
    }
  });
});
