// 火花 (短命粒子) / Spark — a short-lived particle.
// このモジュールは DOM に触れない。draw() には呼び出し側が ctx と
// スプライト配列を渡すため、import 時点では純粋。

import { hueToIndex } from './math.js';

export class Spark {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} hueBase   親の色相 (度)
   * @param {number} intensity 親の発光強度 0..1
   * @param {'normal'|'burst'|'orb'} kind 種別。burst=弾ける火花, orb=なぞり用の光の玉
   */
  constructor(x, y, hueBase, intensity, kind = 'normal') {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    let speed, decay, size, gravity, rise;
    if (kind === 'burst') {
      speed = 1.5 + Math.random() * 3.5;
      decay = 0.015 + Math.random() * 0.02;
      size = 1.8 + Math.random() * 2.2;
      gravity = 0.025 + Math.random() * 0.02;
      rise = 0.3;
    } else if (kind === 'orb') {
      // なぞり用の光の玉: ゆっくり漂い、長く残り、大きめに光る
      speed = 0.1 + Math.random() * 0.5;
      decay = 0.004 + Math.random() * 0.006;
      size = 2.2 + Math.random() * 2.2;
      gravity = 0.002 + Math.random() * 0.004;
      rise = 0.15;
    } else {
      speed = 0.3 + Math.random() * 1.5;
      decay = 0.025 + Math.random() * 0.04;
      size = 0.9 + Math.random() * 1.8;
      gravity = 0.025 + Math.random() * 0.02;
      rise = 0.3;
    }
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - rise; // やや上向きバイアス
    this.life = 1.0;
    this.decay = decay;
    this.size = size;
    this.hue = (hueBase + (Math.random() - 0.5) * 20 + 360) % 360;
    this.hueIdx = hueToIndex(this.hue);
    this.gravity = gravity;
    this.brightness = intensity;
    this.twinkle = Math.random() * Math.PI * 2;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.vx *= 0.98;
    this.vy *= 0.98;
    this.life -= this.decay;
    this.twinkle += 0.4;
  }

  draw(ctx, sparkSprites) {
    if (this.life <= 0) return;
    // 瞬き
    const tw = 0.6 + Math.abs(Math.sin(this.twinkle)) * 0.4;
    const alpha = this.life * this.brightness * tw;
    if (alpha < 0.01) return;
    const r = this.size * (0.8 + this.life * 0.4) * 4;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sparkSprites[this.hueIdx], this.x - r, this.y - r, r * 2, r * 2);
  }

  isDead() {
    return this.life <= 0;
  }
}
