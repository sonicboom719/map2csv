export class MapManager {
    constructor(mapId) {
        this.map = null;
        this.currentTileLayer = null;
        this.tileLayers = {};
        this.initializeMap(mapId);
        this.setupTileSelector();
    }
    
    initializeMap(mapId) {
        // 東京駅を中心に初期化
        this.map = L.map(mapId).setView([35.6812, 139.7671], 13);
        
        // 各地図タイルレイヤーを定義
        this.tileLayers = {
            'osm': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }),
            'gsi-standard': L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
                attribution: '© 国土地理院',
                maxZoom: 18
            }),
            'gsi-pale': L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
                attribution: '© 国土地理院',
                maxZoom: 18
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
        // 現在のタイルレイヤーを削除
        if (this.currentTileLayer) {
            this.map.removeLayer(this.currentTileLayer);
        }
        
        // 新しいタイルレイヤーを追加
        this.currentTileLayer = this.tileLayers[tileType];
        this.currentTileLayer.addTo(this.map);
    }
    
    setView(coordinates, zoom) {
        this.map.setView(coordinates, zoom);
    }
    
    getCenter() {
        return this.map.getCenter();
    }
    
    getZoom() {
        return this.map.getZoom();
    }
}