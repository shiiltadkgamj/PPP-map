# ウォーターPPP・群マネ 実施/検討マップ 自動更新版

GitHub Pagesだけで公開できる静的アプリです。

## 自動更新の仕組み

- 地図上の案件データは `index.html` 内の確認済みデータを表示します。
- 最新情報欄は `data/latest-updates.json` を読み込みます。
- GitHub Actionsが6時間ごとに `scripts/update-latest.mjs` を実行し、Google News RSS検索から公開見出しとリンクを収集して、GitHub Pagesへ再デプロイします。

## 参照対象

スクリプトは次の検索軸で公開情報を収集します。

- 国土交通省等の国のHPに関する検索
- ウォーターPPP、群マネ、コンセッション、管理・更新一体マネジメント方式
- 日経新聞関連の公開検索結果
- Googleニュースで検索できる関連ニュース

日経新聞など有料媒体の記事本文は取得しません。公開されている見出し、リンク、日付、配信元のみを表示します。

## GitHub Pagesで公開する手順

1. このフォルダの中身をGitHubリポジトリのルートに配置します。
2. GitHubの `Settings > Pages` で `Source` を `GitHub Actions` にします。
3. `main` ブランチへpushします。
4. `Actions` タブで `Update data and deploy GitHub Pages` が成功すると公開されます。

公開URLは通常 `https://ユーザー名.github.io/リポジトリ名/` です。

## 注意

Google News RSSは検索結果を返す仕組みのため、すべてのニュースを完全に網羅する保証はありません。確定案件として地図に反映する場合は、国や自治体の一次資料で確認してください。
