// スプライトキャッシュ / Sprite cache.
// 火花・火種を毎フレーム createRadialGradient するのは重いので、
// 色相別に事前焼き込みして drawImage で描く。
// このモジュールは document に触れるため main.js からのみ import すること。

import { HUE_STEPS, SPARK_SIZE, HALO_SIZE, MID_SIZE, CORE_SIZE } from './config.js';

function makeSprite(size, drawFn) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  drawFn(c.getContext('2d'), size);
  return c;
}

/**
 * 色相別スプライト群と白コアスプライトを生成して返す。
 * @returns {{sparkSprites:HTMLCanvasElement[], haloSprites:HTMLCanvasElement[], midSprites:HTMLCanvasElement[], coreSprite:HTMLCanvasElement}}
 */
export function buildSprites() {
  const sparkSprites = [];
  const haloSprites = [];
  const midSprites = [];

  for (let i = 0; i < HUE_STEPS; i++) {
    const hue = (i / HUE_STEPS) * 360;

    // 火花: コア白 → 色 → 透明
    sparkSprites.push(
      makeSprite(SPARK_SIZE, (sx, s) => {
        const r = s / 2;
        const g = sx.createRadialGradient(r, r, 0, r, r, r);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.25, `hsla(${hue},100%,75%,0.8)`);
        g.addColorStop(1, `hsla(${hue},100%,55%,0)`);
        sx.fillStyle = g;
        sx.fillRect(0, 0, s, s);
      }),
    );

    // 火種ハロー: 外周のふわっとした光
    haloSprites.push(
      makeSprite(HALO_SIZE, (sx, s) => {
        const r = s / 2;
        const g = sx.createRadialGradient(r, r, 0, r, r, r);
        g.addColorStop(0, `hsla(${hue},100%,70%,0.5)`);
        g.addColorStop(0.4, `hsla(${(hue + 30) % 360},100%,55%,0.18)`);
        g.addColorStop(1, `hsla(${hue},100%,50%,0)`);
        sx.fillStyle = g;
        sx.fillRect(0, 0, s, s);
      }),
    );

    // 火種中間: 虹色
    midSprites.push(
      makeSprite(MID_SIZE, (sx, s) => {
        const r = s / 2;
        const g = sx.createRadialGradient(r, r, 0, r, r, r);
        g.addColorStop(0, `hsla(${hue},100%,90%,1)`);
        g.addColorStop(0.5, `hsla(${(hue + 60) % 360},100%,65%,0.7)`);
        g.addColorStop(1, `hsla(${(hue + 120) % 360},100%,50%,0)`);
        sx.fillStyle = g;
        sx.fillRect(0, 0, s, s);
      }),
    );
  }

  // 火種コア (白) — 色相不要なので1枚だけ
  const coreSprite = makeSprite(CORE_SIZE, (sx, s) => {
    const r = s / 2;
    const g = sx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    sx.fillStyle = g;
    sx.fillRect(0, 0, s, s);
  });

  return { sparkSprites, haloSprites, midSprites, coreSprite };
}
