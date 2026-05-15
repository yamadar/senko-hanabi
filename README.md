# Senko Hanabi

線香花火のような光の散りを描く Canvas アニメーション SPA。

## 起動

```bash
npm install        # リポジトリルートで一度だけ
npm run dev -w senko-hanabi
```

`http://localhost:5185/` が自動で開きます。

## ビルド

```bash
npm run build -w senko-hanabi
```

## 構成

```
senko-hanabi/
├── index.html      # マークアップのみ
├── vite.config.js
├── package.json
└── src/
    ├── main.js     # ロジック（style.css を import）
    └── style.css   # スタイル
```
