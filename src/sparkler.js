// 火種 (線香花火の本体) / Sparkler — the glowing ball that sheds sparks.
// このモジュールは DOM に触れない。画面サイズ・動的上限などの環境値は
// update() に world オブジェクトとして渡される。draw() には呼び出し側が
// ctx とスプライトを渡す。

import { MAX_SPARKS } from './config.js';
import {
  hueToIndex,
  growingRadius,
  shrinkingRadius,
  wobbleFactor,
  lifespanToDecay,
  splitChance,
  clamp,
} from './math.js';
import { Spark } from './spark.js';

export class Sparkler {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} generation     血統世代 (分裂で +1)
   * @param {?number} initialRadius  初期半径。null ならデフォルト 3。
   */
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
    this.initialRadius = initialRadius !== null ? initialRadius : 3;
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
    this.decay = lifespanToDecay(8 + Math.random() * 22);
    this.hueBase = Math.random() * 360;
    this.huePhase = Math.random() * Math.PI * 2;
    this.age = 0;
    this.generation = generation;
    this.spawnCooldown = 60 + Math.random() * 180; // フレーム (1〜4秒)
    this.lastBurst = 0;
    // ふらつき
    this.wanderAngle = Math.random() * Math.PI * 2;
  }

  /**
   * 1フレーム分の状態更新。
   * @param {Spark[]} sparks       火花配列 (生成した火花を push)
   * @param {Sparkler[]} sparklers 火種配列 (分裂した子を push)
   * @param {number} t             現在時刻 (ms)
   * @param {{W:number,H:number,effectiveMax:number}} world 環境値
   */
  update(sparks, sparklers, t, world) {
    const { W, H, effectiveMax } = world;
    this.age++;

    // 現在の動的hue: 時間と年齢でゆらぐ
    this.currentHue =
      (this.hueBase + Math.sin(t * 0.002 + this.huePhase) * 40 + this.age * 0.3 + 360) % 360;

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
      this.vx = (this.vx / sp) * maxSp;
      this.vy = (this.vy / sp) * maxSp;
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
      baseRadius = growingRadius(this.age, this.growDuration, this.initialRadius, this.maxRadius);
      if (this.age / this.growDuration >= 1) {
        this.state = 'shrinking';
        this.lifeAtShrinkStart = Math.max(0.01, this.life);
      }
    } else {
      // shrinking: 残りlifeに比例して maxRadius → 0
      baseRadius = shrinkingRadius(this.life, this.lifeAtShrinkStart, this.maxRadius);
    }
    // 揺らぎ: 2つの正弦波を重ねて自然な脈動 (約±9%)
    this.radius = baseRadius * wobbleFactor(this.age, this.wobbleSpeed, this.wobblePhase);

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
          sparks.push(new Spark(this.x, this.y, this.currentHue, intensity, 'burst'));
        }
      }
    }

    // 自己複製: 分裂するように発生
    // 火種が少ない時ほど分裂しやすい。動的上限に追従する。
    this.spawnCooldown--;
    const eMax = effectiveMax;
    const headroom = eMax - sparklers.length; // 残り枠 (動的上限基準)
    const ratio = sparklers.length / eMax; // 充足率

    // 充足率に応じて確率を段階的に上げる
    // 上限到達後でも、消滅で枠が空けば即座に分裂候補に
    const baseChance = splitChance(headroom, ratio);
    const lowCount = ratio < 0.3; // 危機モード
    // 危機時は寿命終盤でも分裂可能、クールダウンも実質無視
    // 上限を緩めて、成長中の小さな火種からも分裂可能に
    const lifeOK = lowCount
      ? this.life > 0.04 && this.life < 0.99
      : this.life > 0.08 && this.life < 0.99;
    // サイズ閾値: 半径2以上なら分裂可能 (生まれた直後から)
    const sizeOK = this.radius >= 2;
    const cooldownOK = lowCount ? true : this.spawnCooldown <= 0;

    if (
      cooldownOK &&
      headroom > 0 &&
      lifeOK &&
      sizeOK &&
      this.generation < 20 &&
      Math.random() < baseChance
    ) {
      // 分裂方向: 親の進行方向に対して垂直に左右へ
      const moveAngle = Math.atan2(this.vy, this.vx);
      const splitAngle = moveAngle + Math.PI / 2 + (Math.random() - 0.5) * 0.6;
      const offset = 28 + Math.random() * 18;
      const splitSpeed = 1.4 + Math.random() * 0.8;

      // 子の位置・速度・初期サイズ (親の現在サイズから始まる)
      const cx = this.x + Math.cos(splitAngle) * offset;
      const cy = this.y + Math.sin(splitAngle) * offset;
      // 危機時は子の世代を低くリセット (血統老化による絶滅を防ぐ)
      const childGen = lowCount ? 0 : this.generation + 1;
      const child = new Sparkler(
        clamp(cx, margin, W - margin),
        clamp(cy, margin, H - margin),
        childGen,
        this.radius, // 親の現サイズから開始
      );
      // 親の色相を継承 (わずかにシフト)
      child.hueBase = (this.hueBase + (Math.random() - 0.5) * 30 + 360) % 360;
      // 子は分裂方向へ飛び出す
      child.vx = this.vx * 0.5 + Math.cos(splitAngle) * splitSpeed;
      child.vy = this.vy * 0.5 + Math.sin(splitAngle) * splitSpeed;
      // 子の寿命と life: 少数時は長寿命・満タン気味
      if (lowCount) {
        // 危機時の子: 寿命をリセットして長め(20〜32秒)、life も高め
        child.decay = lifespanToDecay(20 + Math.random() * 12);
        child.life = clamp(0.95 + (Math.random() - 0.5) * 0.1, 0.85, 1.0);
      } else {
        // 通常時: 親から継承+揺らぎ
        child.life = clamp(this.life * 0.7 + 0.2 + (Math.random() - 0.5) * 0.4, 0.5, 1.0);
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
          sparks.push(new Spark(burstX, burstY, this.currentHue, 1.0, 'burst'));
        }
      }

      // 分裂後のクールダウン: 短めにして2回目以降も起きやすく
      this.spawnCooldown = lowCount ? 60 + Math.random() * 90 : 180 + Math.random() * 240;
    }
  }

  draw(ctx, t, sprites) {
    const { haloSprites, midSprites, coreSprite } = sprites;
    const intensity = Math.max(0, this.life);
    // 動的hueはupdateで計算済み (currentHue未設定の場合のみフォールバック)
    const hue = this.currentHue !== undefined ? this.currentHue : this.hueBase;
    const idx = hueToIndex(hue);

    // フラッシュ効果(時々強く光る)
    const flicker =
      0.85 + Math.sin(t * 0.05 + this.huePhase * 7) * 0.1 + Math.sin(t * 0.13 + this.huePhase) * 0.05;
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
