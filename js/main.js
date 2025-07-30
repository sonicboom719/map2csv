import { MapManager } from './map.js';
import { ImageUploader } from './uploader.js';
import { OverlayManager } from './overlay-simple-clean.js';
import { PinManager } from './pins.js';
import { CsvExporter } from './export.js';
import { InputHistoryManager } from './input-history.js';
import { CONFIG, ERROR_MESSAGES } from './config.js';
import { ErrorHandler } from './utils/error-handler.js';

class App {
    constructor(options = {}) {
        this.mapManager = null;
        this.imageUploader = null;
        this.overlayManager = null;
        this.pinManager = null;
        this.csvExporter = null;
        this.inputHistoryManager = null;
        
        // テスト用オプション
        this.options = {
            skipInputHistory: false,
            ...options
        };
        
        this.initialize();
    }
    
    initialize() {
        try {
            console.log('🗺️ 地図マネージャーを初期化中...');
            // 地図の初期化
            this.mapManager = new MapManager('map');
            console.log('✅ 地図マネージャー初期化完了');
        } catch (error) {
            console.error('❌ 地図マネージャー初期化失敗:', error);
            throw error;
        }
        
        try {
            console.log('📤 画像アップローダーを初期化中...');
            // 画像アップローダーの初期化
            this.imageUploader = new ImageUploader({
                uploadArea: document.getElementById('uploadArea'),
                fileInput: document.getElementById('fileInput'),
                previewImage: document.getElementById('previewImage'),
                uploadedImageDiv: document.getElementById('uploadedImage'),
                onImageLoaded: (imageData) => this.handleImageLoaded(imageData)
            });
            console.log('✅ 画像アップローダー初期化完了');
        } catch (error) {
            console.error('❌ 画像アップローダー初期化失敗:', error);
            throw error;
        }
        
        try {
            console.log('🔄 オーバーレイマネージャーを初期化中...');
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
            console.log('✅ オーバーレイマネージャー初期化完了');
        } catch (error) {
            console.error('❌ オーバーレイマネージャー初期化失敗:', error);
            throw error;
        }
        
        try {
            console.log('📍 ピンマネージャーを初期化中...');
            // ピンマネージャーの初期化
            this.pinManager = new PinManager({
                map: this.mapManager.map,
                pinSection: document.getElementById('pinSection'),
                pinList: document.getElementById('pinList'),
                pinModal: document.getElementById('pinModal'),
                pinNumberInput: document.getElementById('pinNumber'),
                pinNameInput: document.getElementById('pinName'),
                pinMemoInput: document.getElementById('pinMemo'),
                saveButton: document.getElementById('savePinInfo'),
                cancelButton: document.getElementById('cancelPinInfo'),
                inputHistoryManager: null  // 後で設定
            });
            console.log('✅ ピンマネージャー初期化完了');
        } catch (error) {
            console.error('❌ ピンマネージャー初期化失敗:', error);
            throw error;
        }
        
        try {
            console.log('📊 CSVエクスポーターを初期化中...');
            // CSVエクスポーターの初期化
            this.csvExporter = new CsvExporter({
                exportButton: document.getElementById('exportCsv'),
                pinManager: this.pinManager
            });
            console.log('✅ CSVエクスポーター初期化完了');
        } catch (error) {
            console.error('❌ CSVエクスポーター初期化失敗:', error);
            throw error;
        }
        
        // 入力履歴マネージャーの初期化
        if (!this.options.skipInputHistory) {
            try {
                console.log('📝 入力履歴マネージャーを初期化中...');
                this.inputHistoryManager = new InputHistoryManager();
                this.inputHistoryManager.setupAllFields();
                console.log('✅ 入力履歴マネージャー初期化完了');
            } catch (error) {
                console.warn('⚠️ 入力履歴マネージャー初期化失敗:', error);
                this.inputHistoryManager = null;
            }
        } else {
            console.log('⏭️ 入力履歴マネージャーの初期化をスキップ');
        }
        
        // ピンマネージャーに入力履歴マネージャーの参照を設定
        if (this.inputHistoryManager && this.pinManager) {
            this.pinManager.setInputHistoryManager(this.inputHistoryManager);
        }
        
        // オーバーレイマネージャーにピンマネージャーの参照を設定
        if (this.overlayManager && this.pinManager) {
            this.overlayManager.pinManager = this.pinManager;
        }
        
        try {
            console.log('🔍 住所検索を設定中...');
            // 住所検索の設定
            this.setupAddressSearch();
            console.log('✅ 住所検索設定完了');
        } catch (error) {
            console.error('❌ 住所検索設定失敗:', error);
            throw error;
        }
        
        try {
            console.log('📋 ペースト機能を設定中...');
            // ペースト機能の設定
            this.setupPasteHandler();
            console.log('✅ ペースト機能設定完了');
        } catch (error) {
            console.error('❌ ペースト機能設定失敗:', error);
            throw error;
        }
        
        console.log('🎉 全ての初期化が完了しました');
    }
    
    setupAddressSearch() {
        const addressInput = ErrorHandler.requireElement('addressInput');
        const searchButton = ErrorHandler.requireElement('searchAddress');
        
        const searchAddress = async () => {
            const address = addressInput.value.trim();
            if (!address) return;
            
            searchButton.disabled = true;
            searchButton.textContent = '検索中...';
            
            try {
                await ErrorHandler.handleAsyncOperation(async () => {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
                        { headers: { 'Accept-Language': 'ja' } }
                    );
                    
                    if (!response.ok) {
                        throw ErrorHandler.handleNetworkError(new Error('Fetch failed'), response);
                    }
                    
                    const data = await response.json();
                    
                    if (!data || data.length === 0) {
                        throw new Error(ERROR_MESSAGES.GEOCODING_FAILED);
                    }
                    
                    const result = data[0];
                    const lat = parseFloat(result.lat);
                    const lon = parseFloat(result.lon);
                    
                    if (isNaN(lat) || isNaN(lon)) {
                        throw new Error('Invalid coordinates received');
                    }
                    
                    this.mapManager.map.setView([lat, lon], CONFIG.MAP.DEFAULT_ZOOM + 3);
                    
                    // 一時的にマーカーを表示
                    const marker = L.marker([lat, lon]).addTo(this.mapManager.map);
                    setTimeout(() => marker.remove(), 3000);
                }, 'Address search');
                
            } catch (error) {
                ErrorHandler.logError(error, 'Address search');
                ErrorHandler.showUserError(error.message);
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
        console.log('handleImageLoaded called with:', imageData);
        // 画像が読み込まれたらオーバーレイセクションを表示
        document.getElementById('overlaySection').style.display = 'block';
        this.overlayManager.setImage(imageData);
    }
    
    // handleImageRemovedメソッドは削除（×ボタンから直接OverlayManager.deleteImage()が呼ばれる）
    
    handleOverlayApplied() {
        // オーバーレイが適用されたら右サイドバーとピンセクションを表示
        document.getElementById('rightSidebar').style.display = 'block';
        document.getElementById('pinSection').style.display = 'block';
        this.pinManager.enable();
    }
}

// デフォルトエクスポート（テスト用）
export default App;

// アプリケーションの起動
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});