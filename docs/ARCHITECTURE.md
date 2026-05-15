# senko-hanabi — アーキテクチャ

線香花火（火種が枝分かれする火花を散らす様子）の Canvas アニメーション SPA。Vite 6 / vanilla JS。
`index.html`（マークアップ）→ `src/main.js`（`./style.css` を import）。

## モジュール構成（`src/`）

| ファイル | 役割 | 主な export |
| --- | --- | --- |
| `config.js` | 定数 | `MAX_SPARKLERS` `MAX_SPARKS` `CYCLE_SECONDS` `HUE_STEPS` `*_SIZE` |
| `math.js` | **純粋**な数学ヘルパ | `cosineEase` `easeOutQuad` `computeEffectiveMax` `hueToIndex` `growingRadius` `shrinkingRadius` `wobbleFactor` `lifespanToDecay` `splitChance` `clamp` `randRange` |
| `sprites.js` | スプライト生成（DOM 使用、`main.js` のみが import） | `buildSprites` |
| `spark.js` | 火花エンティティ | `class Spark` |
| `sparkler.js` | 火種エンティティ | `class Sparkler` |
| `main.js` | 薄いエントリ（canvas 取得・resize / pointerdown 配線・rAF ループ） | — |

## テスト

- `math.test.js`(38) `spark.test.js`(11) — 計 49 件（イージング端点・単調性・周期性・寿命減衰・速度バイアス）。

## 注意点

- エンティティは環境値（画面サイズ・動的な火花上限）を `update(world)` 経由で受け取る。
- 純粋モジュール（`config` / `math` / `spark` / `sparkler`）は import 時 DOM 非依存。

## コマンド

`npm run dev|test|build -w senko-hanabi`
