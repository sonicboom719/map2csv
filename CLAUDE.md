# 地図→CSV化支援ツール 内部技術仕様

## アーキテクチャ概要

本アプリケーションはES6モジュールベースのクライアントサイドWebアプリケーションです。各機能が独立したクラスとして実装され、main.jsで統合されています。

## クラス構成とモジュール

### 1. main.js - アプリケーションコントローラー
**役割**: 全体の制御と各モジュール間の連携
**主要メソッド**:
- `initialize()`: 各マネージャーの初期化
- `handleImageLoaded()`: 画像読み込み完了時の処理
- `handleOverlayApplied()`: オーバーレイ適用完了時の処理

### 2. map.js - MapManager
**役割**: Leaflet.js地図の初期化と管理
**技術詳細**:
- OpenStreetMapタイルレイヤー使用
- 初期表示: 東京駅周辺 (35.6812, 139.7671)
- ズームレベル: 16

### 3. uploader.js - ImageUploader
**役割**: 画像/PDFファイルのアップロードと前処理
**対応形式**: image/*, application/pdf
**技術詳細**:
- ドラッグ&ドロップ対応
- クリップボード貼り付け対応 (Ctrl+V)
- PDF.js 3.11.174を使用したPDF→Canvas変換
- 画像データはData URLとして保持

### 4. overlay-simple-clean.js - OverlayManager
**役割**: 画像オーバーレイと2点位置合わせの管理

#### 重要な技術実装

**座標系変換**:
```javascript
// 画像座標 → 地図座標の線形変換
const scaleX = mapVector.lng / imageVector.x;
const scaleY = mapVector.lat / imageVector.y;
const transformPoint = (imageX, imageY) => {
    const relX = imageX - imagePoint1.x;
    const relY = imageY - imagePoint1.y;
    return [
        mapPoint1.lat + (relY * scaleY),
        mapPoint1.lng + (relX * scaleX)
    ];
};
```

**回転補正**:
- 画像とマップの2点間ベクトルから回転角度を計算
- 5度未満の回転は無視（標準ImageOverlay使用）
- 5度以上の回転はCanvas事前回転処理

**回転計算の修正履歴**:
```javascript
// 修正前（問題あり）: 緯度経度をそのまま使用
const imageAngle = Math.atan2(imageVector.y, imageVector.x);
const mapAngle = Math.atan2(mapVector.lat, mapVector.lng); // NG

// 修正後（正しい）: ピクセル座標での角度計算
const mapPixel1 = this.map.latLngToContainerPoint(mapPoint1);
const mapPixel2 = this.map.latLngToContainerPoint(mapPoint2);
const mapPixelVector = { x: mapPixel2.x - mapPixel1.x, y: mapPixel2.y - mapPixel1.y };
const mapAngle = Math.atan2(mapPixelVector.y, mapPixelVector.x); // OK
```

**イベント管理**:
- オーバーレイ適用後にmapClickHandlerを削除してPinManagerとの競合を回避
- finishApplyOverlay()でイベントリスナー削除とUI更新の順序制御

### 5. simple-drag-resize.js - SimpleDragResizeWindow
**役割**: 青い画像選択ウィンドウの管理
**技術詳細**:
- ドラッグ&リサイズ可能なモーダルウィンドウ
- 点選択後はドラッグで位置調整可能（削除不可）
- Canvas描画による画像表示

### 6. pins.js - PinManager
**役割**: ポスター掲示場ピンの配置、管理、UI連携

#### データ構造
```javascript
const pin = {
    id: this.pinIdCounter++,           // 内部ID
    latlng: latlng,                    // Leaflet LatLng
    displayNumber: '',                 // 表示用番号（マップ上に表示）
    number: '',                        // 掲示場番号（CSV出力用）
    name: '',                          // 掲示場名称
    memo: '',                          // 掲示情報メモ（改行不可）
    marker: null                       // Leafletマーカーオブジェクト
};
```

#### インタラクティブ機能
**マップ ↔ リスト連携**:
```javascript
// マーカーイベント
marker.on('mouseover', () => this.highlightPinInList(pin.id, true));
marker.on('mouseout', () => this.highlightPinInList(pin.id, false));

// リストアイテムイベント
div.addEventListener('mouseover', () => this.highlightPinOnMap(pin.id, true));
div.addEventListener('mouseout', () => this.highlightPinOnMap(pin.id, false));
```

**マーカーサイズ制御**:
- 番号なし: 20×20px
- 番号あり: 25×25px（修正済み、元は30×30px）

### 7. export.js - CsvExporter
**役割**: CSVデータの生成とダウンロード
**技術詳細**:
- PapaParseライブラリ使用
- UTF-8（BOMなし）、引用符なし形式
- ファイル名: `{city}_normalized_yyyymmddhhmmss.csv`

## 重要な修正履歴

### 1. 座標系の統一 (2024年)
**問題**: 画像座標（Y軸下向き）と地図座標（Y軸上向き）の混在
**解決**: 全ての変換で一貫した座標系を使用

### 2. 回転角度計算の修正
**問題**: 緯度経度の度数とピクセル座標の混在による回転角度の誤計算
**解決**: 地図座標をピクセル座標に変換してから角度計算

### 3. 非同期処理の修正
**問題**: オーバーレイの非同期作成中にピンマネージャーが有効化される
**解決**: finishApplyOverlay()メソッドでPromise完了後にコールバック実行

### 4. イベントリスナー競合の解決
**問題**: OverlayManagerとPinManagerのmapClickイベント競合
**解決**: オーバーレイ適用時にOverlayManagerのイベントリスナーを削除

## CSS設計

### レスポンシブレイアウト
```css
.container {
    display: flex;
    height: 100vh;
}
.sidebar { width: 350px; }          /* 左サイドバー */
.map-container { flex: 1; }         /* 中央地図エリア */
.right-sidebar { width: 350px; }    /* 右サイドバー */
```

### カスタムマーカースタイル
```css
.pin-marker {
    background-color: #e74c3c;      /* 通常時: 赤 */
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
}
/* ホバー時: highlightPinOnMap()でJSから #f39c12 (オレンジ) に変更 */
```

## API依存関係

### 外部API
1. **Nominatim API** (OpenStreetMap)
   - エンドポイント: `https://nominatim.openstreetmap.org/search`
   - 用途: 住所検索で地図を掲示場エリアに移動
   - レート制限: あり（適切な間隔での使用推奨）

### CDN依存ライブラリ
1. **Leaflet.js 1.9.4**: 地図表示とマーカー管理
2. **PDF.js 3.11.174**: PDF→Canvas変換
3. **PapaParser 5.4.1**: CSV生成

## パフォーマンス考慮事項

### 画像処理
- 大きなPDFファイルのCanvas変換は時間がかかる
- 回転処理時は一時的にメモリ使用量が増加
- Data URLによる画像保持（メモリ効率は中程度）

### イベント処理
- マウスイベントは適切にデバウンスされている
- ドラッグ操作中のパフォーマンスを考慮したイベント最適化

### メモリ管理
- 画像ウィンドウのclose()でCanvas要素も適切に削除
- マーカー削除時のLeafletイベントリスナー自動クリーンアップ

## セキュリティ考慮事項

### クライアントサイド制約
- 全ての処理がクライアントサイドで完結
- サーバーへのデータ送信なし
- ローカルストレージ使用なし（リロード時データ消失）

### 入力検証
- ピン番号: 数字のみ許可、先頭0自動削除（掲示場識別用）
- メモ: 改行文字自動削除（掲示情報の補足）
- ファイルアップロード: MIMEタイプ検証

## CSV結合ツール (concat_csv.html)

### 概要
複数の正規化CSVファイルを結合し、統一されたフォーマットで出力するツール。メインツールで生成された複数のCSVファイルを効率的にマージできます。

### アーキテクチャ

#### 8. concat-csv.js - ConcatCsv
**役割**: CSV結合、ソート、エクスポート機能の提供

**データ構造**（8列対応）:
```javascript
const csvRow = {
    prefecture: '東京都',        // 都道府県
    city: '渋谷区',             // 市区町村
    number: 'A-1',              // 掲示場番号
    address: '渋谷区神南',       // 住所
    name: '場所名',             // 掲示場名称
    lat: '35.6812',             // 緯度
    long: '139.7671',           // 経度
    note: '備考情報'            // 備考
};
```

**主要メソッド**:
- `addFile(file)`: CSVファイルの追加とパース
- `setSortType(type)`: ソートタイプの設定（'none', 'string', 'numeric'）
- `compareAddress(a, b)`: addressの条件付き比較
- `exportToCsv()`: 結合データのCSV出力
- `generatePreviewTable()`: プレビューHTML生成

#### ソート機能の詳細実装

**2段組ソート**:
1. **第1キー**: addressの条件付きソート
   - 「*区」で終わる場合: 「*区」部分をキーとして使用
   - それ以外の場合: address全体をキーとして使用
2. **第2キー**: numberのソート（文字列または数値）

```javascript
compareAddress(addressA, addressB) {
    // 個別に「*区」パターンを判定
    const kuMatchA = addressA.match(/(.*区)/);
    const sortKeyA = kuMatchA ? kuMatchA[1] : addressA;
    
    const kuMatchB = addressB.match(/(.*区)/);
    const sortKeyB = kuMatchB ? kuMatchB[1] : addressB;
    
    return sortKeyA.localeCompare(sortKeyB);
}
```

**数値ソートアルゴリズム**:
```javascript
extractNumbers(str) {
    const matches = str.match(/\d+/g);
    return matches ? matches.map(n => parseInt(n, 10)) : [];
}
```

#### UI仕様

**レイアウト**: 1:2の2カラム構成
- **左カラム**: ファイルアップロード（ドラッグ&ドロップ対応）
- **右カラム**: ソート設定、プレビュー、エクスポート

**プレビュー機能**:
- 全8列の表示（prefecture, city, number, address, name, lat, long, note）
- 件数表示（「3. プレビュー (123件)」形式）
- 横スクロール対応（`overflow: auto`, `white-space: nowrap`）
- 最大高さ40vh制限

**エクスポート機能**:
- city列からの市区町村名自動検出
- ファイル名形式: `{cityName}_normalized.csv`
- UTF-8エンコーディング

### 技術仕様

**必須カラム検証**:
- `number`, `name`, `lat`, `long`の4列が必須
- 不足している行は自動的にスキップ

**データ変換**:
```javascript
// 入力CSV（lat/long） → 出力CSV（latitude/longitude）
const mergedRow = {
    prefecture: row.prefecture || '',
    city: row.city || '',
    number: row.number || '',
    address: row.address || '',
    name: row.name || '',
    latitude: row.lat || '',      // lat → latitude
    longitude: row.long || '',    // long → longitude
    note: row.note || ''
};
```

**依存ライブラリ**:
- PapaParser 5.4.1: CSV解析とエクスポート

### テスト仕様

**テストファイル**: `tests/concat-csv-test.html`
- 基本機能テスト（8列データ構造、必須カラム）
- マージ機能テスト（複数ファイル、市区町村名検出）
- ソート機能テスト（address+number 2段組ソート）
- addressソート詳細テスト（「*区」混在データ）
- CSVエクスポートテスト（8列ヘッダー確認）
- プレビュー機能テスト（HTML生成、ヘッダー確認）

## 今後の拡張ポイント

1. **データ永続化**: LocalStorageまたはIndexedDBによる掲示場情報の保存
2. **バッチ処理**: 複数掲示場の一括編集・削除
3. **エクスポート形式**: GeoJSON、KML形式での掲示場データ出力
4. **画像形式**: WebP、HEIC対応による掲示場マップの多様化
5. **オフライン対応**: Service Workerによる掲示場管理のオフライン機能
6. **CSV結合拡張**: フィルタリング機能、重複除去オプション

## 開発・デバッグ情報

### デバッグログ
開発時にコンソールログが追加される箇所：
- オーバーレイ処理: `console.log()` で変換パラメータを出力
- イベント競合: 一時的にイベント発火状況を確認
- 座標変換: 2点一致検証の誤差計算

### 既知の制限事項
1. Internet Explorer未対応（ES6モジュール使用）
2. 地図タイルの読み込みにネットワーク接続必須
3. 大容量PDFファイル（50MB以上）では処理が重い場合あり