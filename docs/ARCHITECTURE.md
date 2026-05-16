# senko-hanabi — アーキテクチャ

線香花火（火種が枝分かれする火花を散らす様子）の Canvas アニメーション SPA。Vite 6 / vanilla JS。
`index.html`（マークアップ）→ `src/main.js`（`./style.css` を import）。

## モジュール構成（`src/`）

| ファイル | 役割 | 主な export |
| --- | --- | --- |
| `config.js` | 定数 | `MAX_SPARKLERS` `MAX_SPARKS` `CYCLE_SECONDS` `HUE_STEPS` `*_SIZE` |
| `math.js` | **純粋**な数学ヘルパ | `cosineEase` `easeOutQuad` `computeEffectiveMax` `hueToIndex` `growingRadius` `shrinkingRadius` `wobbleFactor` `lifespanToDecay` `splitChance` `clamp` `randRange` `attractAccel` `burstSpeed` |
| `sprites.js` | スプライト生成（DOM 使用、`main.js` のみが import） | `buildSprites` |
| `spark.js` | 火花エンティティ（`kind`: `normal`/`burst`/`orb`） | `class Spark` |
| `sparkler.js` | 火種エンティティ | `class Sparkler` |
| `pointer.js` | ポインタ操作（なぞり=光の玉生成 / 長押し=引力 / 離す=離散バースト / タップ=火種追加）。DOM 非依存 | `class PointerField` |
| `main.js` | 薄いエントリ（canvas 取得・resize / pointer イベント配線・rAF ループ） | — |

## テスト

- `math.test.js`(47) `spark.test.js`(12) — 計 59 件（イージング端点・単調性・周期性・寿命減衰・速度バイアス・引力フォールオフ・バースト速度）。

## 注意点

- エンティティは環境値（画面サイズ・動的な火花上限）を `update(world)` 経由で受け取る。
- 純粋モジュール（`config` / `math` / `spark` / `sparkler` / `pointer`）は import 時 DOM 非依存。`pointer.js` の `PointerField` は DOM イベントを `down`/`move`/`up` で受け取り、ループから `update()` で火花・火種配列へ反映する。
- `Spark` の `kind`: `orb` はなぞり用の光の玉（ゆっくり漂い・長寿命・大きめ）。引力・バーストは火花/火種の速度を直接操作する。

## コマンド

`npm install`（初回）/ `npm run dev` / `npm test` / `npm run build` / `npm run format`
