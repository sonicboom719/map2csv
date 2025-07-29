export class MapManager {
    constructor(mapId) {
        this.map = null;
        this.initializeMap(mapId);
    }
    
    initializeMap(mapId) {
        // 東京駅を中心に初期化
        this.map = L.map(mapId).setView([35.6812, 139.7671], 13);
        
        // OpenStreetMapタイルレイヤーを追加
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);
        
        // 地図のリサイズ対応
        setTimeout(() => {
            this.map.invalidateSize();
        }, 100);
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