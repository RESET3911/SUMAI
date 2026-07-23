# 🏠 SUMAI — 理想の賃貸物件探しビューア

Notion の「🏠 理想の賃貸物件探し」DB を見やすく表示する ST APPS のひとつ。

- 公開URL: https://RESET3911.github.io/SUMAI/
- データ元: Notion DB (`b010a9a252ed4b349490fb95eaabfa5b`)

## 仕組み

```
Notion DB ──(GitHub Actions / 毎朝8:15 JST + 手動)──> data.json ──> GitHub Pages
```

- `.github/workflows/deploy.yml` が push 時・毎朝 8:15 JST・手動実行時に動く
- `scripts/fetch-notion.mjs` が Notion API から全物件を取得して `data.json` を生成
- サイト本体は `index.html` のみの静的ページ（ビルド不要）

## セットアップ（初回のみ）

1. https://www.notion.so/my-integrations で内部インテグレーションを作成
2. Notion の「🏠 理想の賃貸物件探し」DB を開く → 右上「…」→「接続」→ 作成したインテグレーションを追加
3. GitHub リポジトリの Settings → Secrets and variables → Actions →
   `NOTION_TOKEN` という名前でインテグレーションのシークレットを登録
4. Actions タブから「Fetch Notion & Deploy to GitHub Pages」を手動実行

トークン未設定でもコミット済みの `data.json` でサイトは動作します（データが古いだけ）。

## 手動でデータ更新したいとき

Actions タブ → 「Fetch Notion & Deploy to GitHub Pages」→ Run workflow
