// ポインタ操作 / Pointer interaction.
// なぞり     → 軌跡上に光の玉 (orb) を連続生成する。
// 長押し     → 押下点へ火花・火種を引き寄せる (引力モード)。
// 離す       → 引力モードだった場合、押下点を中心にパーンと離散させる。
// 短いタップ → 火種を1つ追加する。
// このモジュールは DOM に触れない。main.js が pointer イベントを配線し、
// ループから update() を毎フレーム呼ぶ。

import { Spark } from './spark.js';
import { Sparkler } from './sparkler.js';
import { MAX_SPARKS } from './config.js';
import { attractAccel, burstSpeed, clamp } from './math.js';

export const LONG_PRESS_MS = 320; // これを超える押下を「長押し」とみなす
export const TAP_MOVE_PX = 14; // この距離未満の短い押下はタップ
export const TRACE_STEP_PX = 16; // 軌跡上で光の玉を生成する間隔 (短いほど密)
export const ATTRACT_RADIUS = 440; // 引力が届く半径
export const BURST_RADIUS = 560; // バーストが届く半径

export class PointerField {
  constructor() {
    this.active = false; // 押下中か
    this.pointerId = null; // 追跡中のポインタ (マルチタッチ時は最初の1本のみ)
    this.x = 0;
    this.y = 0;
    this.startT = 0; // 押下開始時刻 (ms)
    this.moved = 0; // 押下開始からの累積移動量 (px)
    this.traceX = 0; // 最後に光の玉を生成した位置
    this.traceY = 0;
    this.hue = Math.random() * 360; // 軌跡に沿って巡回する色相
    this.pendingTap = null; // update() で消費する {x,y}
    this.pendingBurst = null; // update() で消費する {x,y,strength}
  }

  /** ポインタ押下。 */
  down(x, y, t, pointerId = null) {
    this.active = true;
    this.pointerId = pointerId;
    this.x = this.traceX = x;
    this.y = this.traceY = y;
    this.startT = t;
    this.moved = 0;
    this.hue = (this.hue + 50 + Math.random() * 120) % 360;
  }

  /** ポインタ移動。 */
  move(x, y, pointerId = null) {
    if (!this.active || pointerId !== this.pointerId) return;
    this.moved += Math.hypot(x - this.x, y - this.y);
    this.x = x;
    this.y = y;
  }

  /** ポインタ解放。長押しならバースト、短いタップなら火種追加を予約する。 */
  up(x, y, t, pointerId = null) {
    if (!this.active || pointerId !== this.pointerId) return;
    this.x = x;
    this.y = y;
    this.active = false;
    this.pointerId = null;
    const held = t - this.startT;
    if (held >= LONG_PRESS_MS) {
      const strength = clamp((held - LONG_PRESS_MS) / 900, 0, 1);
      this.pendingBurst = { x, y, strength };
    } else if (this.moved < TAP_MOVE_PX) {
      this.pendingTap = { x, y };
    }
  }

  /**
   * 1フレーム分の処理。予約済みのタップ/バーストを実行し、押下中なら
   * 軌跡生成・引力を適用する。
   * @param {Spark[]} sparks
   * @param {Sparkler[]} sparklers
   * @param {number} t 現在時刻 (ms)
   */
  update(sparks, sparklers, t) {
    if (this.pendingTap) {
      sparklers.push(new Sparkler(this.pendingTap.x, this.pendingTap.y));
      this.pendingTap = null;
    }
    if (this.pendingBurst) {
      this.burst(this.pendingBurst, sparks, sparklers);
      this.pendingBurst = null;
    }
    if (!this.active) return;

    this.emitTrace(sparks);

    const held = t - this.startT;
    if (held >= LONG_PRESS_MS) {
      const strength = clamp((held - LONG_PRESS_MS) / 900, 0, 1);
      this.attract(sparks, sparklers, strength);
    }
  }

  /** 前回位置から現在位置まで一定間隔で光の玉を生成する (なぞり)。 */
  emitTrace(sparks) {
    let dx = this.x - this.traceX;
    let dy = this.y - this.traceY;
    let dist = Math.hypot(dx, dy);
    while (dist >= TRACE_STEP_PX) {
      const k = TRACE_STEP_PX / dist;
      this.traceX += dx * k;
      this.traceY += dy * k;
      this.hue = (this.hue + 7) % 360; // 軌跡に沿って虹色に変化

      // 光の玉を密に生成 (1ステップあたり 4〜6 個)
      const orbs = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < orbs && sparks.length < MAX_SPARKS; i++) {
        sparks.push(
          new Spark(
            this.traceX + (Math.random() - 0.5) * 16,
            this.traceY + (Math.random() - 0.5) * 16,
            this.hue,
            1.0,
            'orb',
          ),
        );
      }
      // ときどき弾ける火花を散らしてきらめかせる
      if (Math.random() < 0.55) {
        const sparkle = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < sparkle && sparks.length < MAX_SPARKS; i++) {
          sparks.push(new Spark(this.traceX, this.traceY, this.hue, 1.0, 'burst'));
        }
      }

      dx = this.x - this.traceX;
      dy = this.y - this.traceY;
      dist = Math.hypot(dx, dy);
    }
  }

  /** 押下点へ向けて火花・火種を引き寄せる (渦を巻きながら集まる)。 */
  attract(sparks, sparklers, strength) {
    const accelMax = 0.35 + strength * 1.15;
    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i];
      const dx = this.x - s.x;
      const dy = this.y - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1 || dist > ATTRACT_RADIUS) continue;
      const a = attractAccel(dist, ATTRACT_RADIUS, accelMax);
      const ux = dx / dist;
      const uy = dy / dist;
      // 中心方向 + 接線方向 → 渦を巻きながら収束
      s.vx += ux * a - uy * a * 0.55;
      s.vy += uy * a + ux * a * 0.55;
      s.vx *= 0.86;
      s.vy *= 0.86;
      // 集まっている間は寿命を保ち、バーストまで玉を生き残らせる
      s.life = Math.min(1, s.life + 0.007);
    }
    for (let i = 0; i < sparklers.length; i++) {
      const a = sparklers[i];
      const dx = this.x - a.x;
      const dy = this.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1 || dist > ATTRACT_RADIUS) continue;
      const acc = attractAccel(dist, ATTRACT_RADIUS, 0.06 + strength * 0.22);
      a.vx += (dx / dist) * acc;
      a.vy += (dy / dist) * acc;
    }
  }

  /** バースト中心から放射状に火花・火種を弾き飛ばし、中心に閃光を足す。 */
  burst(b, sparks, sparklers) {
    const power = 11 + b.strength * 18;
    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i];
      const dist = Math.hypot(s.x - b.x, s.y - b.y);
      if (dist > BURST_RADIUS) continue;
      const [ux, uy] = direction(s.x - b.x, s.y - b.y, dist);
      const sp = burstSpeed(dist, BURST_RADIUS, power) * (0.7 + Math.random() * 0.7);
      s.vx = ux * sp;
      s.vy = uy * sp - 1.6; // やや上向き
      // 遠くまで飛びながら見えるように再点火・低減衰化
      s.life = Math.max(s.life, 0.78 + Math.random() * 0.22);
      s.decay = 0.009 + Math.random() * 0.013;
      s.twinkle = Math.random() * Math.PI * 2;
    }
    // 中心の閃光
    const flash = 54 + Math.floor(b.strength * 120);
    for (let i = 0; i < flash && sparks.length < MAX_SPARKS; i++) {
      sparks.push(new Spark(b.x, b.y, this.hue, 1.0, 'burst'));
    }
    // 火種も外側へ弾き飛ばす
    for (let i = 0; i < sparklers.length; i++) {
      const a = sparklers[i];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist > BURST_RADIUS) continue;
      const [ux, uy] = direction(a.x - b.x, a.y - b.y, dist);
      const sp = burstSpeed(dist, BURST_RADIUS, 5 + b.strength * 9);
      a.vx = ux * sp;
      a.vy = uy * sp - 0.8;
    }
  }
}

/** 単位方向ベクトル。距離がほぼ 0 のときはランダム方向を返す。 */
function direction(dx, dy, dist) {
  if (dist < 0.001) {
    const ang = Math.random() * Math.PI * 2;
    return [Math.cos(ang), Math.sin(ang)];
  }
  return [dx / dist, dy / dist];
}
