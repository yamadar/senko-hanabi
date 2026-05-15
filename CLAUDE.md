# CLAUDE.md

線香花火の Canvas アニメーション SPA。Vite 6 + Vitest 3 のスタンドアロン SPA リポジトリ。

## 作業前に docs/ を読む

`docs/ARCHITECTURE.md` にモジュール構成・主な export・純粋/非純粋の別・テスト配置・注意点がまとまっている。**ソースを調査・改修する前に必ず読むこと。** 大きなソースを全読せず作業位置を特定できる。

- docs と実コードが食い違う場合は実コードが正。docs を更新する。
- 構成（モジュールの追加 / 削除 / 責務変更、エクスポートの変更）を変えたら、同じコミットで `docs/ARCHITECTURE.md` も更新する。

## 規約

- HTML（`index.html`）/ CSS（`src/style.css`）/ JS（`src/*.js`）を分離。CSS は `main.js` から import。
- 純粋ロジックはモジュールへ分離し Vitest でテストする。DOM / canvas に触れるコードは import 時に副作用を持たせず `main.js` と描画モジュールに隔離する。
- `main.js` は薄いエントリ（DOM 取得・配線・ループのみ）に保つ。

## コマンド

`npm install`（初回）/ `npm run dev` / `npm test` / `npm run build` / `npm run format`
