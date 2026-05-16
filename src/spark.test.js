import { describe, it, expect } from 'vitest';
import { Spark } from './spark.js';
import { HUE_STEPS } from './config.js';

describe('Spark constructor', () => {
  it('starts at full life', () => {
    const s = new Spark(10, 20, 180, 0.8);
    expect(s.life).toBe(1.0);
  });

  it('keeps hueIdx within sprite-array bounds', () => {
    for (let i = 0; i < 200; i++) {
      const s = new Spark(0, 0, Math.random() * 360, 1);
      expect(s.hueIdx).toBeGreaterThanOrEqual(0);
      expect(s.hueIdx).toBeLessThan(HUE_STEPS);
    }
  });

  it('gives burst sparks a longer reach (larger size) than ambient sparks', () => {
    // burst size range 1.8..4.0, ambient 0.9..2.7 — averages should separate clearly
    let burstSum = 0;
    let ambientSum = 0;
    const n = 400;
    for (let i = 0; i < n; i++) {
      burstSum += new Spark(0, 0, 0, 1, 'burst').size;
      ambientSum += new Spark(0, 0, 0, 1, 'normal').size;
    }
    expect(burstSum / n).toBeGreaterThan(ambientSum / n);
  });

  it('gives orb sparks a much longer life (smaller decay) than ambient sparks', () => {
    // orb decay 0.004..0.010, ambient 0.025..0.065 — orbs linger far longer
    let orbSum = 0;
    let ambientSum = 0;
    const n = 400;
    for (let i = 0; i < n; i++) {
      orbSum += new Spark(0, 0, 0, 1, 'orb').decay;
      ambientSum += new Spark(0, 0, 0, 1, 'normal').decay;
    }
    expect(orbSum / n).toBeLessThan(ambientSum / n);
  });

  it('carries the parent intensity as brightness', () => {
    const s = new Spark(0, 0, 0, 0.42);
    expect(s.brightness).toBe(0.42);
  });

  it('initial velocity has a slight upward bias', () => {
    // vy = sin(angle)*speed - 0.3 → mean over many samples should be negative
    let vySum = 0;
    const n = 1000;
    for (let i = 0; i < n; i++) vySum += new Spark(0, 0, 0, 1).vy;
    expect(vySum / n).toBeLessThan(0);
  });
});

describe('Spark.update', () => {
  it('decreases life every frame', () => {
    const s = new Spark(0, 0, 0, 1);
    const before = s.life;
    s.update();
    expect(s.life).toBeLessThan(before);
  });

  it('moves the particle by its velocity', () => {
    const s = new Spark(100, 100, 0, 1);
    const vx = s.vx;
    s.update();
    expect(s.x).toBeCloseTo(100 + vx);
  });

  it('applies gravity so vy increases over time', () => {
    const s = new Spark(0, 0, 0, 1);
    const vy0 = s.vy;
    s.update();
    // vy gets +gravity then *0.98 damping; gravity (~0.025-0.045) dominates damping here
    expect(s.vy).toBeGreaterThan(vy0 * 0.98);
  });

  it('eventually dies after enough frames', () => {
    const s = new Spark(0, 0, 0, 1);
    for (let i = 0; i < 100 && !s.isDead(); i++) s.update();
    expect(s.isDead()).toBe(true);
  });
});

describe('Spark.isDead', () => {
  it('is alive at full life', () => {
    expect(new Spark(0, 0, 0, 1).isDead()).toBe(false);
  });

  it('is dead once life reaches 0', () => {
    const s = new Spark(0, 0, 0, 1);
    s.life = 0;
    expect(s.isDead()).toBe(true);
  });
});
