# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

クライアント完結型の地図オーバーレイ＆ピン打ちWebアプリケーション。PDF/画像をGoogleマップやOpenStreetMap上に半透明オーバーレイとして表示し、ピンを配置してCSV出力できる静的サイト。

## 主要技術スタック

- **地図描画**: Leaflet.js（推奨）またはGoogle Maps JavaScript API
- **ジオコーディング**: Nominatim API（無料）またはGoogle Geocoding API
- **画像変形**: Leaflet.DistortableImageプラグイン
- **CSV生成**: PapaParse
- **PDF処理**: PDF.js（PDFを画像に変換）

## プロジェクト構造

```
pinmap_overlay/
├── index.html          # メインHTML
├── js/
│   ├── main.js         # アプリケーションのエントリーポイント
│   ├── map.js          # 地図表示・操作
│   ├── overlay.js      # 画像オーバーレイ・射影変換
│   ├── pins.js         # ピン管理
│   └── export.js       # CSV出力
├── css/
│   └── style.css       # スタイルシート
└── lib/                # 外部ライブラリ（CDN使用推奨）
```

## 開発コマンド

```bash
# 開発サーバー起動（Python）
python -m http.server 8000

# 開発サーバー起動（Node.js）
npx http-server -p 8000

# ファイル監視（開発中）
# 静的サイトのため、ブラウザのリロードで変更を確認
```

## 主要機能の実装ポイント

### 1. 画像アップロード（ペースト対応）
- File APIとClipboard APIを使用
- ペーストイベントで`event.clipboardData.items`から画像データを取得
- PDFはPDF.jsで最初のページを画像化

### 2. ジオコーディング
- Nominatim APIの使用時はレート制限に注意（1秒1リクエスト）
- CORS対応のため、必要に応じてプロキシ不要のAPIを選択

### 3. 射影変換（4点指定）
- Leaflet.DistortableImageの`_corners`オプションを使用
- または手動でCanvas APIで射影変換行列を計算

### 4. ピンデータ管理
- JavaScriptの配列でメモリ内管理
- LocalStorageへの保存は任意（ページリロード対応）

### 5. CSV出力
- PapaParseの`unparse`メソッドを使用
- BlobとdownloadリンクでCSVファイルをダウンロード

## 重要な制約事項

- **完全クライアントサイド**: サーバーやDBへの依存なし
- **プライバシー重視**: 画像・ピンデータはサーバーに送信しない
- **静的ホスティング対応**: GitHub Pages等で動作可能な構成
- **CORS制限**: 外部APIはCORS対応のものを選択

## デバッグ・テスト

```javascript
// ブラウザコンソールでのデバッグ
console.log('Pins data:', window.pinsData);
console.log('Overlay corners:', window.overlayLayer._corners);
```

## セキュリティ考慮事項

- APIキーを使用する場合は、リファラー制限を設定
- ユーザーアップロード画像のサニタイズ（XSS対策）
- CSVエクスポート時の特殊文字エスケープ