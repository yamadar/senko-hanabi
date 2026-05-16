// 線香花火 — エントリポイント / Entry point.
// canvas の取得、リサイズ配線、アニメーションループの駆動のみを担当する。
// ロジックは config.js / math.js / sprites.js / spark.js / sparkler.js / pointer.js に分離。

import './style.css';
import { lifespanToDecay, computeEffectiveMax } from './math.js';
import { buildSprites } from './sprites.js';
import { Sparkler } from './sparkler.js';
import { PointerField } from './pointer.js';

(() => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  let W = 0,
    H = 0,
    DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // 色相別スプライトを事前焼き込み
  const sprites = buildSprites();

  // 実質的な上限を時間でゆらがせる
  const startTime = performance.now();
  let currentEffectiveMax = computeEffectiveMax(startTime, startTime);

  const sparklers = [];
  const sparks = [];

  // 初期火種 (複数体で開始 → 全滅しにくい)
  sparklers.push(new Sparkler(W * 0.5, H * 0.5));
  sparklers.push(new Sparkler(W * 0.3, H * 0.6));
  sparklers.push(new Sparkler(W * 0.7, H * 0.4));

  // ポインタ操作: なぞり→光の玉, 長押し→引力, 離す→離散バースト, タップ→火種追加
  // (タップでの火種追加は実質上限を超えても可。超過中は自動分裂が停止する)
  const pointer = new PointerField();
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    pointer.down(e.clientX, e.clientY, performance.now(), e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    pointer.move(e.clientX, e.clientY, e.pointerId);
  });
  function endPointer(e) {
    pointer.up(e.clientX, e.clientY, performance.now(), e.pointerId);
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  // 描画ループ
  function loop(now) {
    const t = now;

    // 動的な実質上限を更新
    currentEffectiveMax = computeEffectiveMax(now, startTime);

    // 背景: 半透明黒で残像感 (alpha 高めで残像処理を早く収束)
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fillRect(0, 0, W, H);

    // 加算合成で発光感
    ctx.globalCompositeOperation = 'lighter';

    // ポインタ操作: 光の玉生成・引力・離散バーストを反映
    pointer.update(sparks, sparklers, t);

    // 火花更新・描画
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.update();
      s.draw(ctx, sprites.sparkSprites);
      if (s.isDead()) sparks.splice(i, 1);
    }
    ctx.globalAlpha = 1;

    // 火種更新・描画
    const world = { W, H, effectiveMax: currentEffectiveMax };
    for (let i = sparklers.length - 1; i >= 0; i--) {
      const a = sparklers[i];
      a.update(sparks, sparklers, t, world);
      a.draw(ctx, t, sprites);
      if (a.isDead()) sparklers.splice(i, 1);
    }
    ctx.globalAlpha = 1;

    // 危機保険: 火種が2体未満になったら強制補充 (長寿命で投入)
    while (sparklers.length < 2) {
      const insurance = new Sparkler(
        W * (0.2 + Math.random() * 0.6),
        H * (0.2 + Math.random() * 0.6),
      );
      // 長寿命 (25〜40秒) で安定供給
      insurance.decay = lifespanToDecay(25 + Math.random() * 15);
      sparklers.push(insurance);
    }

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
