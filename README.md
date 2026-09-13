# 💡 Hiramek (ヒラメック) — Chat-linked Mind Map PWA

> **ひらめきを構造化する、次世代思考マインドマップ。**  
> ChatGPT・Notion・Obsidianとシームレスに連動し、思考を広げ、深め、大枠で束ねる Progressive Web App（PWA）。

[![PWA Ready](https://img.shields.io/badge/PWA-Ready-blue.svg)](./manifest.webmanifest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Gemini 3.6 Flash](https://img.shields.io/badge/AI-Gemini%203.6%20Flash-orange.svg)](https://ai.google.dev/)
[![GitHub](https://img.shields.io/badge/GitHub-raio700800--hash%2Fhiramek-green.svg)](https://github.com/raio700800-hash/hiramek)

---

## 🌟 主な機能と特徴

### 1. 📥 思考データの読み込み (多機能インポート)
ChatGPTの壁打ちログ、Notionのトグルリスト、ObsidianのMarkdownノートから一瞬でマインドマップを展開：
- **📝 箇条書き・Markdownインポート**: タブやスペースのインデントを自動計算し、親子ツリーとして展開。`- [ ]` タスクや `#タグ` も自動認識。
- **📊 Mermaid (mindmap) インポート**: Mermaidコードを貼り付けるだけで正確な思考マップを復元。
- **✨ AI自動変換（長文・会議ログ）**: まとまっていない文章やChatGPTの対話ログをそのまま貼り付けるだけで、Geminiが論点を抽出してツリー化。
- **💾 完全復元 JSON**: 以前保存したHiramekのデータを100%完全復元。
- **選べる取り込み方式**: 「🌱 新しいマップとして開く」または「➕ 選択中のノードに追加」をワンタップ選択可能。

### 2. 📤 思考データの書き出し (多機能エクスポート)
マインドマップで整理した思考を、AIやノートアプリへシームレスに橋渡し：
- **🤖 AI Context用 Markdown**: ChatGPTやGeminiに「この前提で考えて」と渡せる指示プロンプト付き形式。採用ステータスや決定理由を網羅。
- **📊 Mermaidコード**: ObsidianやNotionに貼り付けるとグラフィカルな図になるコードブロックを出力。
- **📝 Notion / Obsidian用 Markdown**: トグルリストや階層アウトラインとして読める議事録形式。
- **💾 完全復元 JSON**: バックアップ用JSONファイルをワンクリックダウンロード。
- **柔軟な絞り込み**: 「採用ノードのみ」「詳細メモを含める」のチェックボックスで目的に合わせたカスタマイズ。

### 3. 🖼️ Miroライクな大枠フレーム機能
- **ノードグループ（中分類）とフレーム（大枠）の分離**:
  ノードごとのカラータグ（アイデア、タスク等）を保ったまま、大枠のプロジェクト単位・フェーズ単位でフレームを作成。
- **連動ドラッグ移動**:
  フレームのヘッダーを掴んでドラッグするだけで、枠内のノード群がスルスルと一体となって移動。
- **四隅ドラッグリサイズ ＆ 自動フィット**:
  四隅のリサイズハンドルで枠サイズを自由調整。ワンクリックで「📐 枠内ノードに合わせて自動サイズ調整」も可能。
- **衝突回避（Tidy）整列**:
  「🧹 整理」ボタンを押すと、フレーム同士が絶対に重ならないよう安全マージン（80px）を空けて自動整列。

### 4. ☀️/🌙 2大ビジュアルテーマ（ホワイトボード ＆ 目に優しい黒板）
- **☀️ ホワイトボードモード（白板）**:
  すっきりと清潔感のあるホワイト基調。日中の作業やプレゼン・共有に最適。
- **🌙 目に優しい黒板モード（黒板）**:
  学校の黒板のような深緑（`#11261b`）背景に、チョーク粉ドット（`#204632`）。チョーク調のやさしい淡色文字・枠線と黄色チョーク接続線で、長時間の思考でも目が疲れない癒やしの質感。

### 5. 📐 3大マインドマップ展開スタイル
- **🌟 中央放射型 (radial-tree)**: ルートノードを中心に、左右均等バランスで放射状に広がる本格マインドマップ。
- **🌲 水平ツリー (horizontal-tree)**: ルートから右側に向かって整然と展開する階層ツリー。
- **🎨 自由配置 (freeform)**: 自動整列を行わず、ホワイトボードのように自由にノードを配置できるモード。

### 6. ⚡ 8大AI思考コマンド & Google Gemini 3.6 Flash
ノードを選択してワンタップで、多角的な思考アシストを発動：
- **🌱 広げる (Expand)**: 周辺の新しい切り口・アイデアを幅広く提案。
- **🔍 深掘る (Deepen)**: 具体的な実現方法や技術課題を分析。
- **🔄 別視点 (Alternative)**: あえて反対の立場や逆転の発想を提案。
- **📋 タスク化 (Taskify)**: 今日からできる行動ステップ（TODO）へ分解。
- **💡 具体例 (Example)**: 抽象的な概念を分かりやすい身近な実例で解説。
- **❓ なぜ？ (Why)**: 本質的な理由・背景・動機を深掘り。
- **⚖️ メリット/デメリット (Pros/Cons)**: 長所・短所を比較検証。
- **📝 要約 (Summarize)**: これまでの議論や子ノード群をコンパクトに総括。
- **Gemini 3.6 Flash 搭載**: スピード・知能・コストパフォーマンスに最も優れた最新モデルを標準採用。

### 7. 📱 PWA (Progressive Web App) 完全対応
- Service Worker（Cache Storage）により、オフライン環境でも100%動作。
- ホーム画面に追加でデスクトップ/スマホのネイティブアプリ化。

---

## 🚀 起動方法

### ローカルでの起動
本アプリは純粋なモダンWeb標準技術（HTML5, CSS3, Vanilla JavaScript ES6+）で構築されており、ビルド不要で即座に動作します。

```bash
cd mindmap-app
# Python 3 の簡易サーバーで起動
python3 -m http.server 8080
```

ブラウザで `http://localhost:8080` を開きます。

---

## 🛠️ 技術スタック
- **Frontend**: Vanilla JavaScript (ES6+), HTML5 Canvas / SVG, Tailwind CSS (CDN)
- **Architecture**: 状態管理とイベント駆動（State-Observerパターン）、AABB幾何衝突判定
- **AI Engine**: Google Gemini API (`gemini-3.6-flash`) & 内蔵シミュレーションフォールバック
- **PWA**: Service Worker (`sw.js`), Web App Manifest (`manifest.webmanifest`)
- **Quality Assurance**: Colocos Factory OS（Code_Cop 静的検査、Judge 100点満点総合評価合格）

---

## 📄 ライセンス
MIT License

