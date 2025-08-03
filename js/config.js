/**
 * アプリケーション設定
 * @namespace CONFIG
 */
export const CONFIG = {
    /** ユーザーインターフェース関連の設定 */
    UI: {
        /** 画像表示の最大サイズ（ピクセル） */
        MAX_IMAGE_DISPLAY_SIZE: 600,
        /** リサイズハンドルのサイズ（ピクセル） */
        CORNER_RESIZE_SIZE: 8,
        /** クリック判定の許容範囲（ピクセル） */
        CLICK_TOLERANCE: 15,
        /** マーカーのサイズ設定 */
        MARKER_SIZES: {
            /** デフォルトマーカーサイズ [幅, 高さ] */
            DEFAULT: [18, 18],
            /** 番号付きマーカーサイズ [幅, 高さ] */
            WITH_NUMBER: [24, 24],
            /** 選択範囲の半径（ピクセル） */
            SELECTION_RADIUS: 12
        },
        /** キャンバスの最大サイズ（ピクセル） */
        CANVAS_MAX_SIZE: 2048
    },
    /** 地図関連の設定 */
    MAP: {
        /** 初期表示中心座標 [緯度, 経度] (東京駅) */
        DEFAULT_CENTER: [35.6812, 139.7671],
        /** 初期ズームレベル */
        DEFAULT_ZOOM: 13,
        /** 最大ズームレベル */
        MAX_ZOOM: 19,
        /** タイルサービスの帰属表示 */
        TILE_ATTRIBUTION: {
            /** OpenStreetMapの帰属表示 */
            OSM: '© OpenStreetMap contributors',
            /** 国土地理院の帰属表示 */
            GSI: '© 国土地理院'
        }
    },
    /** 入力履歴関連の設定 */
    HISTORY: {
        /** 履歴の最大保持数 */
        MAX_ENTRIES: 10,
        /** LocalStorageのキープレフィクス */
        STORAGE_PREFIX: 'map2csv_input_'
    },
    /** ピン関連の設定 */
    PINS: {
        /** 表示番号の最大値 */
        MAX_DISPLAY_NUMBER: 999,
        /** ピンのデフォルト色設定 */
        DEFAULT_COLORS: {
            /** 通常時のピン色 */
            DEFAULT: '#3498db',
            /** ホバー時のピン色 */
            HOVER: '#2980b9'
        }
    }
};

/**
 * アプリケーション全体で使用するエラーメッセージ
 * @namespace ERROR_MESSAGES
 */
export const ERROR_MESSAGES = {
    /** ネットワーク関連エラー */
    NETWORK_ERROR: 'ネットワークエラーが発生しました',
    /** 住所検索失敗エラー */
    GEOCODING_FAILED: '住所が見つかりませんでした',
    /** ファイル読み込みエラー */
    FILE_LOAD_ERROR: 'ファイルの読み込みに失敗しました',
    /** サポート外ファイル形式エラー */
    INVALID_FILE_TYPE: 'サポートされていないファイル形式です'
};