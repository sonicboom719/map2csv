import { MapManager } from './map.js';
import { ImageUploader } from './uploader.js';
import { OverlayManager } from './overlay-simple-clean.js';
import { PinManager } from './pins.js';
import { CsvExporter } from './export.js';

class App {
    constructor() {
        this.mapManager = null;
        this.imageUploader = null;
        this.overlayManager = null;
        this.pinManager = null;
        this.csvExporter = null;
        
        this.initialize();
    }
    
    initialize() {
        // 地図の初期化
        this.mapManager = new MapManager('map');
        
        // 画像アップローダーの初期化
        this.imageUploader = new ImageUploader({
            uploadArea: document.getElementById('uploadArea'),
            fileInput: document.getElementById('fileInput'),
            previewImage: document.getElementById('previewImage'),
            uploadedImageDiv: document.getElementById('uploadedImage'),
            removeButton: document.getElementById('removeImage'),
            onImageLoaded: (imageData) => this.handleImageLoaded(imageData)
        });
        
        // オーバーレイマネージャーの初期化
        this.overlayManager = new OverlayManager({
            map: this.mapManager.map,
            imageCanvas: document.getElementById('imageCanvas'),
            overlaySection: document.getElementById('overlaySection'),
            imagePointsDiv: document.getElementById('imagePoints'),
            mapPointsDiv: document.getElementById('mapPoints'),
            applyButton: document.getElementById('applyTransform'),
            resetButton: document.getElementById('resetPoints'),
            onOverlayApplied: () => this.handleOverlayApplied()
        });
        
        // ピンマネージャーの初期化
        this.pinManager = new PinManager({
            map: this.mapManager.map,
            pinSection: document.getElementById('pinSection'),
            pinList: document.getElementById('pinList'),
            pinModal: document.getElementById('pinModal'),
            pinNumberInput: document.getElementById('pinNumber'),
            pinMemoInput: document.getElementById('pinMemo'),
            saveButton: document.getElementById('savePinInfo'),
            cancelButton: document.getElementById('cancelPinInfo')
        });
        
        // CSVエクスポーターの初期化
        this.csvExporter = new CsvExporter({
            exportButton: document.getElementById('exportCsv'),
            pinManager: this.pinManager
        });
        
        // 住所検索の設定
        this.setupAddressSearch();
        
        // ペースト機能の設定
        this.setupPasteHandler();
    }
    
    setupAddressSearch() {
        const addressInput = document.getElementById('addressInput');
        const searchButton = document.getElementById('searchAddress');
        
        const searchAddress = async () => {
            const address = addressInput.value.trim();
            if (!address) return;
            
            searchButton.disabled = true;
            searchButton.textContent = '検索中...';
            
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
                    { headers: { 'Accept-Language': 'ja' } }
                );
                
                const data = await response.json();
                
                if (data && data.length > 0) {
                    const result = data[0];
                    const lat = parseFloat(result.lat);
                    const lon = parseFloat(result.lon);
                    
                    this.mapManager.map.setView([lat, lon], 16);
                    
                    // 一時的にマーカーを表示
                    const marker = L.marker([lat, lon]).addTo(this.mapManager.map);
                    setTimeout(() => marker.remove(), 3000);
                } else {
                    alert('住所が見つかりませんでした。別の住所を試してください。');
                }
            } catch (error) {
                console.error('ジオコーディングエラー:', error);
                alert('住所の検索中にエラーが発生しました。');
            } finally {
                searchButton.disabled = false;
                searchButton.textContent = '地図を移動';
            }
        };
        
        searchButton.addEventListener('click', searchAddress);
        addressInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchAddress();
        });
    }
    
    setupPasteHandler() {
        document.addEventListener('paste', (e) => {
            const items = e.clipboardData.items;
            
            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const blob = item.getAsFile();
                    this.imageUploader.handlePastedImage(blob);
                    break;
                }
            }
        });
    }
    
    handleImageLoaded(imageData) {
        // 画像が読み込まれたらオーバーレイセクションを表示
        document.getElementById('overlaySection').style.display = 'block';
        this.overlayManager.setImage(imageData);
    }
    
    handleOverlayApplied() {
        // オーバーレイが適用されたらピンセクションを表示
        document.getElementById('pinSection').style.display = 'block';
        this.pinManager.enable();
    }
}

// アプリケーションの起動
document.addEventListener('DOMContentLoaded', () => {
    new App();
});