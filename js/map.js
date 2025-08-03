export class MapManager {
    constructor(mapId) {
        this.map = null;
        this.currentTileLayer = null;
        this.tileLayers = {};
        this.initializeMap(mapId);
        this.setupTileSelector();
    }
    
    initializeMap(mapId) {
        // 東京駅を中心に初期化（パフォーマンス最適化）
        this.map = L.map(mapId, {
            center: [35.6812, 139.7671],
            zoom: 13,
            preferCanvas: true,      // Canvas描画を優先（軽量化）
            maxBoundsViscosity: 0.5, // バウンズの粘性設定
            wheelPxPerZoomLevel: 120, // ホイールズーム感度調整
            zoomSnap: 0.25,          // ズームのスナップ間隔
            zoomDelta: 0.5,          // ズームボタンでの変化量
            bounceAtZoomLimits: false // ズーム限界でのバウンス無効
        });
        
        // 各地図タイルレイヤーを定義（パフォーマンス最適化オプション追加）
        this.tileLayers = {
            'osm': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19,
                keepBuffer: 2,       // タイルバッファを増やす
                updateWhenIdle: false, // ズーム/パン中も更新
                updateWhenZooming: true, // ズーム中も更新
                minZoom: 5,         // 最小ズームレベル
                errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
            }),
            'gsi-standard': L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
                attribution: '© 国土地理院',
                maxZoom: 18,
                keepBuffer: 2,
                updateWhenIdle: false,
                updateWhenZooming: true,
                minZoom: 5,
                errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
            }),
            'gsi-pale': L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
                attribution: '© 国土地理院',
                maxZoom: 18,
                keepBuffer: 2,
                updateWhenIdle: false,
                updateWhenZooming: true,
                minZoom: 5,
                errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
            })
        };
        
        // デフォルトでOpenStreetMapを表示
        this.currentTileLayer = this.tileLayers['osm'];
        this.currentTileLayer.addTo(this.map);
        
        // 地図のリサイズ対応
        setTimeout(() => {
            this.map.invalidateSize();
        }, 100);
    }
    
    setupTileSelector() {
        // ラジオボタンのイベントリスナーを設定
        const radioButtons = document.querySelectorAll('input[name="mapTile"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.changeTileLayer(e.target.value);
                }
            });
        });
    }
    
    changeTileLayer(tileType) {
        // 同じタイルレイヤーの場合は何もしない
        if (this.currentTileLayer === this.tileLayers[tileType]) {
            return;
        }
        
        // 現在のタイルレイヤーを削除
        if (this.currentTileLayer) {
            this.map.removeLayer(this.currentTileLayer);
        }
        
        // 新しいタイルレイヤーを追加
        this.currentTileLayer = this.tileLayers[tileType];
        this.currentTileLayer.addTo(this.map);
        
        // タイル読み込み完了まで少し待ってからリフレッシュ
        setTimeout(() => {
            this.map.invalidateSize();
        }, 100);
    }
    
    setView(coordinates, zoom) {
        this.map.setView(coordinates, zoom);
    }
    
    /**
     * マップのパフォーマンスを向上させるための最適化メソッド
     */
    optimizePerformance() {
        // タイルキャッシュの最適化
        Object.values(this.tileLayers).forEach(layer => {
            if (layer._tiles) {
                // 古いタイルを削除
                const now = Date.now();
                Object.keys(layer._tiles).forEach(key => {
                    const tile = layer._tiles[key];
                    if (tile.loaded && now - tile.loadTime > 300000) { // 5分以上古いタイルを削除
                        delete layer._tiles[key];
                    }
                });
            }
        });
        
        // マップの再描画を強制
        this.map.invalidateSize();
        
        // 現在のタイルレイヤーを再読み込み
        if (this.currentTileLayer) {
            this.currentTileLayer.redraw();
        }
    }
    
    /**
     * メモリとパフォーマンス最適化のためのクリーンアップ
     */
    cleanup() {
        // 使用されていないタイルレイヤーのクリーンアップ
        Object.values(this.tileLayers).forEach(layer => {
            if (layer !== this.currentTileLayer && layer._tiles) {
                layer._tiles = {};
            }
        });
    }
    
    getCenter() {
        return this.map.getCenter();
    }
    
    getZoom() {
        return this.map.getZoom();
    }
}