import './style.css';

(() => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  let W = 0, H = 0, DPR = 1;

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

  // チューニング定数
  const MAX_SPARKLERS = 12;
  const MAX_SPARKS = 2000;

  // 実質的な上限を時間でゆらがせる
  // サイクル: 100%キープ → ゆっくり30%へ下降 → 素早く100%へ戻る
  const CYCLE_SECONDS = 90;
  let startTime = performance.now();
  let currentEffectiveMax = MAX_SPARKLERS;

  function computeEffectiveMax(nowMs) {
    const tSec = (nowMs - startTime) / 1000;
    const phase = (tSec % CYCLE_SECONDS) / CYCLE_SECONDS; // 0..1
    let v; // 0..1 の倍率
    if (phase < 0.40) {
      // 100% プラトー
      v = 1.0;
    } else if (phase < 0.85) {
      // 100% → 30% へゆっくり下降 (cosine ease)
      const p = (phase - 0.40) / 0.45;
      const eased = 0.5 - 0.5 * Math.cos(p * Math.PI);
      v = 1.0 - 0.7 * eased;
    } else {
      // 30% → 100% へ復帰 (やや素早く、cosine ease)
      const p = (phase - 0.85) / 0.15;
      const eased = 0.5 - 0.5 * Math.cos(p * Math.PI);
      v = 0.3 + 0.7 * eased;
    }
    // 30%×10 = 3 を最低保証
    return Math.max(2, Math.round(MAX_SPARKLERS * v));
  }

  // ===== スプライトキャッシュ =====
  // 火花/火種を毎フレーム createRadialGradient するのは重いので、
  // 色相別に事前焼き込みして drawImage で描く。
  const HUE_STEPS = 18; // 20°刻み
  const SPARK_SIZE = 64;   // 火花用スプライト
  const HALO_SIZE  = 128;  // 火種ハロー用
  const MID_SIZE   = 64;   // 火種中間層用
  const CORE_SIZE  = 32;   // 火種コア用 (白なので色相不要)

  function makeSprite(size, drawFn) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    drawFn(c.getContext('2d'), size);
    return c;
  }

  const sparkSprites = [];
  const haloSprites = [];
  const midSprites = [];
  for (let i = 0; i < HUE_STEPS; i++) {
    const hue = (i / HUE_STEPS) * 360;
    // 火花: コア白 → 色 → 透明
    sparkSprites.push(makeSprite(SPARK_SIZE, (sx, s) => {
      const r = s / 2;
      const g = sx.createRadialGradient(r, r, 0, r, r, r);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, `hsla(${hue},100%,75%,0.8)`);
      g.addColorStop(1, `hsla(${hue},100%,55%,0)`);
      sx.fillStyle = g;
      sx.fillRect(0, 0, s, s);
    }));
    // 火種ハロー: 外周のふわっとした光
    haloSprites.push(makeSprite(HALO_SIZE, (sx, s) => {
      const r = s / 2;
      const g = sx.createRadialGradient(r, r, 0, r, r, r);
      g.addColorStop(0, `hsla(${hue},100%,70%,0.5)`);
      g.addColorStop(0.4, `hsla(${(hue + 30) % 360},100%,55%,0.18)`);
      g.addColorStop(1, `hsla(${hue},100%,50%,0)`);
      sx.fillStyle = g;
      sx.fillRect(0, 0, s, s);
    }));
    // 火種中間: 虹色
    midSprites.push(makeSprite(MID_SIZE, (sx, s) => {
      const r = s / 2;
      const g = sx.createRadialGradient(r, r, 0, r, r, r);
      g.addColorStop(0, `hsla(${hue},100%,90%,1)`);
      g.addColorStop(0.5, `hsla(${(hue + 60) % 360},100%,65%,0.7)`);
      g.addColorStop(1, `hsla(${(hue + 120) % 360},100%,50%,0)`);
      sx.fillStyle = g;
      sx.fillRect(0, 0, s, s);
    }));
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

  function hueToIndex(hue) {
    return ((Math.floor(hue / 360 * HUE_STEPS) % HUE_STEPS) + HUE_STEPS) % HUE_STEPS;
  }

  // 火種A
  class Sparkler {
    constructor(x, y, generation = 0, initialRadius = null) {
      this.x = x;
      this.y = y;
      // 個体ごとのランダム速度倍率 (0.3〜2.0倍)
      this.speedScale = 0.3 + Math.random() * 1.7;
      this.vx = (Math.random() - 0.5) * 0.6 * this.speedScale;
      this.vy = (Math.random() - 0.5) * 0.6 * this.speedScale - 0.05;
      // サイズ: 成長 → 縮小のライフサイクル
      this.maxRadius = 22 + Math.random() * 6; // 最大時の半径 (視覚的に約50px幅)
      // 初期サイズ: デフォルトは小さく、分裂時は親のサイズから
      this.initialRadius = (initialRadius !== null) ? initialRadius : 3;
      // 初期サイズが maxRadius 以上なら maxRadius を引き上げて必ず成長余地を作る
      if (this.initialRadius >= this.maxRadius * 0.95) {
        this.maxRadius = this.initialRadius * (1.12 + Math.random() * 0.28);
      }
      this.radius = this.initialRadius;
      this.growDuration = 60 + Math.random() * 60; // 1〜2秒で最大に
      this.state = 'growing'; // 必ず成長フェーズから開始
      this.lifeAtShrinkStart = 1.0;
      this.life = 1.0;
      // サイズに加える呼吸的な揺らぎ
      this.wobblePhase = Math.random() * Math.PI * 2;
      this.wobbleSpeed = 0.04 + Math.random() * 0.05; // 個体ごとに違うテンポ
      // 寿命: 個体差を大きく取る (8〜30秒)
      this.decay = 1 / (60 * (8 + Math.random() * 22));
      this.hueBase = Math.random() * 360;
      this.huePhase = Math.random() * Math.PI * 2;
      this.age = 0;
      this.generation = generation;
      this.spawnCooldown = 60 + Math.random() * 180; // フレーム (1〜4秒)
      this.lastBurst = 0;
      // ふらつき
      this.wanderAngle = Math.random() * Math.PI * 2;
    }

    update(sparks, sparklers, t) {
      this.age++;

      // 現在の動的hue: 時間と年齢でゆらぐ
      this.currentHue = (this.hueBase + Math.sin(t * 0.002 + this.huePhase) * 40 + this.age * 0.3 + 360) % 360;

      // ふらつき移動: 慣性 + ランダムウォーク (個体ごとの速度倍率を反映)
      this.wanderAngle += (Math.random() - 0.5) * 0.3;
      this.vx += Math.cos(this.wanderAngle) * 0.075 * this.speedScale;
      this.vy += Math.sin(this.wanderAngle) * 0.075 * this.speedScale;
      // 抵抗
      this.vx *= 0.94;
      this.vy *= 0.94;
      // 速度制限: 個体ごとにランダム、ベース速度アップ
      const sp = Math.hypot(this.vx, this.vy);
      const maxSp = (2.4 * this.life + 0.6) * this.speedScale;
      if (sp > maxSp) {
        this.vx = this.vx / sp * maxSp;
        this.vy = this.vy / sp * maxSp;
      }
      this.x += this.vx;
      this.y += this.vy;

      // 画面端でバウンス (減衰少なめ、最低反発速度を保証)
      const margin = 40;
      const minBounce = 0.6;
      if (this.x < margin) {
        this.x = margin;
        this.vx = Math.max(minBounce, Math.abs(this.vx) * 0.9);
        this.wanderAngle = Math.random() * Math.PI - Math.PI / 2; // 右向き周辺へリセット
      }
      if (this.x > W - margin) {
        this.x = W - margin;
        this.vx = -Math.max(minBounce, Math.abs(this.vx) * 0.9);
        this.wanderAngle = Math.random() * Math.PI + Math.PI / 2;
      }
      if (this.y < margin) {
        this.y = margin;
        this.vy = Math.max(minBounce, Math.abs(this.vy) * 0.9);
        this.wanderAngle = Math.random() * Math.PI;
      }
      if (this.y > H - margin) {
        this.y = H - margin;
        this.vy = -Math.max(minBounce, Math.abs(this.vy) * 0.9);
        this.wanderAngle = -Math.random() * Math.PI;
      }

      // 寿命減少 (序盤は強く、終盤に向けて減衰)
      this.life -= this.decay;

      // サイズ更新: 成長 → 縮小
      let baseRadius;
      if (this.state === 'growing') {
        const p = Math.min(1, this.age / this.growDuration);
        // ease-out で勢いよく育って減速
        const eased = 1 - Math.pow(1 - p, 2);
        baseRadius = this.initialRadius + (this.maxRadius - this.initialRadius) * eased;
        if (p >= 1) {
          this.state = 'shrinking';
          this.lifeAtShrinkStart = Math.max(0.01, this.life);
        }
      } else {
        // shrinking: 残りlifeに比例して maxRadius → 0
        const shrinkP = Math.max(0, this.life / this.lifeAtShrinkStart);
        baseRadius = this.maxRadius * shrinkP;
      }
      // 揺らぎ: 2つの正弦波を重ねて自然な脈動 (約±9%)
      const wobble = 1
        + Math.sin(this.age * this.wobbleSpeed + this.wobblePhase) * 0.06
        + Math.sin(this.age * this.wobbleSpeed * 1.7 + this.wobblePhase * 1.3) * 0.03;
      this.radius = baseRadius * wobble;

      // 火花生成 (寿命に応じて減る)
      const intensity = Math.max(0, this.life);
      const sparkCount = Math.floor(3 + intensity * 4);
      for (let i = 0; i < sparkCount; i++) {
        if (sparks.length < MAX_SPARKS) {
          sparks.push(new Spark(this.x, this.y, this.currentHue, intensity));
        }
      }

      // パチッと弾ける (確率的バースト)
      if (Math.random() < 0.045 * intensity && this.age - this.lastBurst > 18) {
        this.lastBurst = this.age;
        const burstCount = 9 + Math.floor(Math.random() * 10);
        for (let i = 0; i < burstCount; i++) {
          if (sparks.length < MAX_SPARKS) {
            sparks.push(new Spark(this.x, this.y, this.currentHue, intensity, true));
          }
        }
      }

      // 自己複製: 分裂するように発生
      // 火種が少ない時ほど分裂しやすい。動的上限に追従する。
      this.spawnCooldown--;
      const eMax = currentEffectiveMax;
      const headroom = eMax - sparklers.length; // 残り枠 (動的上限基準)
      const ratio = sparklers.length / eMax;    // 充足率

      // 充足率に応じて確率を段階的に上げる
      // 上限到達後でも、消滅で枠が空けば即座に分裂候補に
      const baseChance = headroom <= 0 ? 0
                       : ratio < 0.15  ? 0.55
                       : ratio < 0.3   ? 0.35
                       : ratio < 0.5   ? 0.12
                       : ratio < 0.8   ? 0.025
                       :                 0.015;
      const lowCount = ratio < 0.3; // 危機モード
      // 危機時は寿命終盤でも分裂可能、クールダウンも実質無視
      // 上限を緩めて、成長中の小さな火種からも分裂可能に
      const lifeOK = lowCount
        ? (this.life > 0.04 && this.life < 0.99)
        : (this.life > 0.08 && this.life < 0.99);
      // サイズ閾値: 半径2以上なら分裂可能 (生まれた直後から)
      const sizeOK = this.radius >= 2;
      const cooldownOK = lowCount ? true : (this.spawnCooldown <= 0);

      if (cooldownOK &&
          headroom > 0 &&
          lifeOK &&
          sizeOK &&
          this.generation < 20 &&
          Math.random() < baseChance) {
        // 分裂方向: 親の進行方向に対して垂直に左右へ
        const moveAngle = Math.atan2(this.vy, this.vx);
        const splitAngle = moveAngle + Math.PI / 2 + (Math.random() - 0.5) * 0.6;
        const offset = 28 + Math.random() * 18;
        const splitSpeed = 1.4 + Math.random() * 0.8;

        // 子の位置・速度・初期サイズ (親の現在サイズから始まる)
        const cx = this.x + Math.cos(splitAngle) * offset;
        const cy = this.y + Math.sin(splitAngle) * offset;
        // 危機時は子の世代を低くリセット (血統老化による絶滅を防ぐ)
        const childGen = lowCount ? 0 : (this.generation + 1);
        const child = new Sparkler(
          Math.max(margin, Math.min(W - margin, cx)),
          Math.max(margin, Math.min(H - margin, cy)),
          childGen,
          this.radius  // 親の現サイズから開始
        );
        // 親の色相を継承 (わずかにシフト)
        child.hueBase = (this.hueBase + (Math.random() - 0.5) * 30 + 360) % 360;
        // 子は分裂方向へ飛び出す
        child.vx = this.vx * 0.5 + Math.cos(splitAngle) * splitSpeed;
        child.vy = this.vy * 0.5 + Math.sin(splitAngle) * splitSpeed;
        // 子の寿命と life: 少数時は長寿命・満タン気味
        if (lowCount) {
          // 危機時の子: 寿命をリセットして長め(20〜32秒)、life も高め
          child.decay = 1 / (60 * (20 + Math.random() * 12));
          child.life = Math.max(0.85, Math.min(1.0,
            0.95 + (Math.random() - 0.5) * 0.1
          ));
        } else {
          // 通常時: 親から継承+揺らぎ
          child.life = Math.max(0.5, Math.min(1.0,
            this.life * 0.7 + 0.2 + (Math.random() - 0.5) * 0.4
          ));
        }
        sparklers.push(child);

        // 親は反対方向に弾かれる (運動量保存風)
        this.vx -= Math.cos(splitAngle) * splitSpeed * 0.6;
        this.vy -= Math.sin(splitAngle) * splitSpeed * 0.6;

        // 分裂時の派手なバースト (両方の中間点から放射)
        const burstX = (this.x + cx) / 2;
        const burstY = (this.y + cy) / 2;
        for (let i = 0; i < 20; i++) {
          if (sparks.length < MAX_SPARKS) {
            const s = new Spark(burstX, burstY, this.currentHue, 1.0, true);
            sparks.push(s);
          }
        }

        // 分裂後のクールダウン: 短めにして2回目以降も起きやすく
        this.spawnCooldown = lowCount
          ? (60 + Math.random() * 90)
          : (180 + Math.random() * 240);
      }
    }

    draw(ctx, t) {
      const intensity = Math.max(0, this.life);
      // 動的hueはupdateで計算済み (currentHue未設定の場合のみフォールバック)
      const hue = this.currentHue !== undefined ? this.currentHue : this.hueBase;
      const idx = hueToIndex(hue);

      // フラッシュ効果(時々強く光る)
      const flicker = 0.85 + Math.sin(t * 0.05 + this.huePhase * 7) * 0.1
                          + Math.sin(t * 0.13 + this.huePhase) * 0.05;
      const brightness = intensity * flicker;

      // 外周ハロー
      const haloR = this.radius * 2.5;
      ctx.globalAlpha = brightness;
      ctx.drawImage(haloSprites[idx], this.x - haloR, this.y - haloR, haloR * 2, haloR * 2);

      // 中間層: 虹色
      const midR = this.radius * 1.1;
      ctx.drawImage(midSprites[idx], this.x - midR, this.y - midR, midR * 2, midR * 2);

      // コア: 真っ白
      const coreR = this.radius * 0.45;
      ctx.drawImage(coreSprite, this.x - coreR, this.y - coreR, coreR * 2, coreR * 2);

      ctx.globalAlpha = 1;
    }

    isDead() {
      return this.life <= 0 || this.radius < 0.5;
    }
  }

  // 火花(短命粒子)
  class Spark {
    constructor(x, y, hueBase, intensity, burst = false) {
      this.x = x;
      this.y = y;
      const angle = Math.random() * Math.PI * 2;
      const speed = burst
        ? (1.5 + Math.random() * 3.5)
        : (0.3 + Math.random() * 1.5);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed - 0.3; // やや上向きバイアス
      this.life = 1.0;
      this.decay = burst
        ? (0.015 + Math.random() * 0.02)
        : (0.025 + Math.random() * 0.04);
      this.size = burst ? (1.8 + Math.random() * 2.2) : (0.9 + Math.random() * 1.8);
      this.hue = (hueBase + (Math.random() - 0.5) * 20 + 360) % 360;
      this.hueIdx = hueToIndex(this.hue);
      this.gravity = 0.025 + Math.random() * 0.02;
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

    draw(ctx) {
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

  const sparklers = [];
  const sparks = [];

  // 初期火種 (複数体で開始 → 全滅しにくい)
  sparklers.push(new Sparkler(W * 0.5, H * 0.5));
  sparklers.push(new Sparkler(W * 0.3, H * 0.6));
  sparklers.push(new Sparkler(W * 0.7, H * 0.4));

  // クリック/タップで追加 (実質上限を超えても可)
  // 超過中は自動分裂が停止するので、自然消滅で上限まで減っていく
  function addAt(x, y) {
    sparklers.push(new Sparkler(x, y));
  }
  canvas.addEventListener('pointerdown', (e) => {
    addAt(e.clientX, e.clientY);
  });

  // 描画ループ
  let lastTime = performance.now();
  function loop(now) {
    const t = now;
    lastTime = now;

    // 動的な実質上限を更新
    currentEffectiveMax = computeEffectiveMax(now);

    // 背景: 半透明黒で残像感 (alpha 高めで残像処理を早く収束)
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fillRect(0, 0, W, H);

    // 加算合成で発光感
    ctx.globalCompositeOperation = 'lighter';

    // 火花更新・描画
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.update();
      s.draw(ctx);
      if (s.isDead()) sparks.splice(i, 1);
    }
    ctx.globalAlpha = 1;

    // 火種更新・描画
    for (let i = sparklers.length - 1; i >= 0; i--) {
      const a = sparklers[i];
      a.update(sparks, sparklers, t);
      a.draw(ctx, t);
      if (a.isDead()) sparklers.splice(i, 1);
    }
    ctx.globalAlpha = 1;

    // 危機保険: 火種が2体未満になったら強制補充 (長寿命で投入)
    while (sparklers.length < 2) {
      const insurance = new Sparkler(
        W * (0.2 + Math.random() * 0.6),
        H * (0.2 + Math.random() * 0.6)
      );
      // 長寿命 (25〜40秒) で安定供給
      insurance.decay = 1 / (60 * (25 + Math.random() * 15));
      sparklers.push(insurance);
    }

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
