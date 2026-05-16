import { describe, it, expect } from 'vitest';
import { PointerField, LONG_PRESS_MS, BURST_RADIUS } from './pointer.js';
import { Spark } from './spark.js';

describe('PointerField — タップ', () => {
  it('短い押下 (ほぼ静止) は update() で火種を1つ追加する', () => {
    const p = new PointerField();
    const sparklers = [];
    p.down(50, 50, 0, 1);
    p.up(50, 50, 100, 1); // 100ms < LONG_PRESS, 移動なし
    p.update([], sparklers, 200);
    expect(sparklers.length).toBe(1);
  });

  it('大きく動いた短い押下はタップにならない', () => {
    const p = new PointerField();
    const sparklers = [];
    p.down(50, 50, 0, 1);
    p.move(200, 50, 1);
    p.up(200, 50, 100, 1);
    p.update([], sparklers, 200);
    expect(sparklers.length).toBe(0);
  });
});

describe('PointerField — なぞり', () => {
  it('ドラッグ中は軌跡上に光の玉を生成する', () => {
    const p = new PointerField();
    const sparks = [];
    p.down(0, 0, 0, 1);
    p.move(300, 0, 1);
    p.update(sparks, [], 50); // 50ms < LONG_PRESS → 引力は発動しない
    expect(sparks.length).toBeGreaterThan(0);
  });

  it('押下点から動かなければ光の玉は生成されない', () => {
    const p = new PointerField();
    const sparks = [];
    p.down(0, 0, 0, 1);
    p.update(sparks, [], 50);
    expect(sparks.length).toBe(0);
  });
});

describe('PointerField — 長押し → 離散バースト', () => {
  it('長押し後の解放で近くの火花が中心と反対へ弾かれる', () => {
    const p = new PointerField();
    const s = new Spark(160, 100, 0, 1); // 中心(100,100)の右側
    s.vx = 0;
    s.vy = 0;
    p.down(100, 100, 0, 1);
    p.up(100, 100, LONG_PRESS_MS + 500, 1);
    p.update([s], [], 0);
    expect(s.vx).toBeGreaterThan(0); // 右 (中心と反対) へ
  });

  it('長押しの解放で中心に閃光の火花が追加される', () => {
    const p = new PointerField();
    const sparks = [];
    p.down(100, 100, 0, 1);
    p.up(100, 100, LONG_PRESS_MS + 500, 1);
    p.update(sparks, [], 0);
    expect(sparks.length).toBeGreaterThan(0);
  });

  it('バースト範囲外の火花は弾かれない', () => {
    const p = new PointerField();
    const far = new Spark(100 + BURST_RADIUS + 50, 100, 0, 1);
    far.vx = 0;
    far.vy = 0;
    p.down(100, 100, 0, 1);
    p.up(100, 100, LONG_PRESS_MS + 500, 1);
    p.update([far], [], 0);
    expect(far.vx).toBe(0);
  });
});

describe('PointerField — 長押し引力', () => {
  it('長押し中は近くの火花を押下点へ引き寄せる', () => {
    const p = new PointerField();
    const s = new Spark(40, 100, 0, 1); // 中心(100,100)の左側
    s.vx = 0;
    s.vy = 0;
    p.down(100, 100, 0, 1);
    p.update([s], [], LONG_PRESS_MS + 100); // 押下継続中
    expect(s.vx).toBeGreaterThan(0); // 右 (中心方向) へ
  });
});

describe('PointerField — マルチタッチ', () => {
  it('追跡中でない別ポインタの move/up は無視する', () => {
    const p = new PointerField();
    p.down(50, 50, 0, 1);
    p.move(300, 50, 2); // 別ポインタ
    p.up(300, 50, 100, 2); // 別ポインタ
    expect(p.active).toBe(true); // ポインタ1 はまだ押下中
  });
});
