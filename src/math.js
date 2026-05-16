// 純粋な数学・ヘルパー関数 / Pure math & helper functions.
// このモジュールは DOM/canvas に一切触れない — 単体テスト可能。

import { MAX_SPARKLERS, CYCLE_SECONDS, HUE_STEPS } from './config.js';

/**
 * cosine ease-in-out: 0..1 を 0..1 に滑らかにマッピング。
 * 端点 p=0 → 0, p=1 → 1。
 */
export function cosineEase(p) {
  return 0.5 - 0.5 * Math.cos(p * Math.PI);
}

/**
 * ease-out (二次): 序盤に勢いよく、終盤に減速。
 * 端点 p=0 → 0, p=1 → 1。
 */
export function easeOutQuad(p) {
  return 1 - Math.pow(1 - p, 2);
}

/**
 * 時間に応じた実質的な火種上限を計算する。
 * サイクル: 0〜40% は 100% プラトー、40〜85% で 100%→30% 下降、
 * 85〜100% で 30%→100% 復帰。最低 2 を保証。
 * @param {number} nowMs   現在時刻 (ms)
 * @param {number} startMs サイクル基準時刻 (ms)
 * @returns {number} 整数の実質上限
 */
export function computeEffectiveMax(nowMs, startMs) {
  const tSec = (nowMs - startMs) / 1000;
  const phase = ((tSec % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS / CYCLE_SECONDS; // 0..1
  let v; // 0..1 の倍率
  if (phase < 0.4) {
    v = 1.0; // 100% プラトー
  } else if (phase < 0.85) {
    // 100% → 30% へゆっくり下降 (cosine ease)
    const p = (phase - 0.4) / 0.45;
    v = 1.0 - 0.7 * cosineEase(p);
  } else {
    // 30% → 100% へ復帰 (cosine ease)
    const p = (phase - 0.85) / 0.15;
    v = 0.3 + 0.7 * cosineEase(p);
  }
  // 30%×12 ≒ 4 でも最低 2 を保証
  return Math.max(2, Math.round(MAX_SPARKLERS * v));
}

/**
 * 色相 (度) を HUE_STEPS 段階のスプライト index に丸める。
 * 負値・360超でも 0..HUE_STEPS-1 に収まる。
 */
export function hueToIndex(hue) {
  return ((Math.floor((hue / 360) * HUE_STEPS) % HUE_STEPS) + HUE_STEPS) % HUE_STEPS;
}

/**
 * 火種の成長フェーズの基準半径を計算する。
 * @param {number} age            経過フレーム
 * @param {number} growDuration   成長に要するフレーム数
 * @param {number} initialRadius  初期半径
 * @param {number} maxRadius      最大半径
 */
export function growingRadius(age, growDuration, initialRadius, maxRadius) {
  const p = Math.min(1, age / growDuration);
  const eased = easeOutQuad(p);
  return initialRadius + (maxRadius - initialRadius) * eased;
}

/**
 * 火種の縮小フェーズの基準半径を計算する。
 * 残り life に比例して maxRadius → 0。
 */
export function shrinkingRadius(life, lifeAtShrinkStart, maxRadius) {
  const shrinkP = Math.max(0, life / lifeAtShrinkStart);
  return maxRadius * shrinkP;
}

/**
 * 2つの正弦波を重ねたサイズ揺らぎ倍率 (約 0.91〜1.09)。
 */
export function wobbleFactor(age, wobbleSpeed, wobblePhase) {
  return (
    1 +
    Math.sin(age * wobbleSpeed + wobblePhase) * 0.06 +
    Math.sin(age * wobbleSpeed * 1.7 + wobblePhase * 1.3) * 0.03
  );
}

/**
 * 寿命 (秒) を 1フレームあたりの decay 値に変換する (60fps 前提)。
 */
export function lifespanToDecay(seconds) {
  return 1 / (60 * seconds);
}

/**
 * 充足率に応じた自己複製の基準確率。
 * @param {number} headroom 残り枠 (動的上限 - 現在数)
 * @param {number} ratio    充足率 (現在数 / 動的上限)
 */
export function splitChance(headroom, ratio) {
  if (headroom <= 0) return 0;
  if (ratio < 0.15) return 0.55;
  if (ratio < 0.3) return 0.35;
  if (ratio < 0.5) return 0.12;
  if (ratio < 0.8) return 0.025;
  return 0.015;
}

/**
 * 値を [min, max] にクランプする。
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * [min, max) の一様乱数。
 */
export function randRange(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * 引力 (長押し) の加速度の大きさ。対象点までの距離が radius 以内なら、
 * 中心に近いほど強く・遠いほど弱い (線形フォールオフ)。範囲外は 0。
 * @param {number} dist     対象点までの距離
 * @param {number} radius   引力の有効半径
 * @param {number} strength 中心での最大加速度
 */
export function attractAccel(dist, radius, strength) {
  if (radius <= 0 || dist >= radius) return 0;
  return strength * (1 - dist / radius);
}

/**
 * 離散バースト (長押しを離した瞬間) の放出速度。
 * 中心に近い粒子ほど速く、外周ほどゆるやかに飛ぶ。
 * @param {number} dist   バースト中心からの距離
 * @param {number} radius バーストの有効半径
 * @param {number} power  中心での最大速度
 */
export function burstSpeed(dist, radius, power) {
  if (radius <= 0) return power;
  const d = clamp(dist / radius, 0, 1);
  return power * (1 - 0.6 * d);
}
