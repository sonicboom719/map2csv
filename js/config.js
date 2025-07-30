// アプリケーション設定
export const CONFIG = {
    UI: {
        MAX_IMAGE_DISPLAY_SIZE: 600,
        CORNER_RESIZE_SIZE: 20,
        CLICK_TOLERANCE: 15,
        MARKER_SIZES: {
            DEFAULT: [20, 20],
            WITH_NUMBER: [25, 25],
            SELECTION_RADIUS: 12
        },
        CANVAS_MAX_SIZE: 2048
    },
    MAP: {
        DEFAULT_CENTER: [35.6812, 139.7671],
        DEFAULT_ZOOM: 13,
        MAX_ZOOM: 19,
        TILE_ATTRIBUTION: {
            OSM: '© OpenStreetMap contributors',
            GSI: '© 国土地理院'
        }
    },
    HISTORY: {
        MAX_ENTRIES: 10,
        STORAGE_PREFIX: 'map2csv_input_'
    },
    PINS: {
        MAX_DISPLAY_NUMBER: 999,
        DEFAULT_COLORS: {
            DEFAULT: '#e74c3c',
            HOVER: '#f39c12'
        }
    }
};

// エラーメッセージ
export const ERROR_MESSAGES = {
    NETWORK_ERROR: 'ネットワークエラーが発生しました',
    GEOCODING_FAILED: '住所が見つかりませんでした',
    FILE_LOAD_ERROR: 'ファイルの読み込みに失敗しました',
    INVALID_FILE_TYPE: 'サポートされていないファイル形式です'
};