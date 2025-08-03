import { MapManager } from './map.js';
import { ImageUploader } from './uploader.js';
import { OverlayManager } from './overlay-manager.js';
import { PinManager } from './pins.js';
import { CsvExporter } from './export.js';
import { InputHistoryManager } from './input-history.js';
import { CONFIG, ERROR_MESSAGES } from './config.js';
import { ErrorHandler } from './utils/error-handler.js';

/**
 * 地図→CSV化支援ツールのメインアプリケーションクラス
 * 
 * 各マネージャークラスを統合し、アプリケーション全体の初期化と
 * コンポーネント間の連携を管理します。
 * 
 * @class App
 */
class App {
    /**
     * アプリケーションを初期化します
     * 
     * @param {Object} options - 初期化オプション
     * @param {boolean} [options.skipInputHistory=false] - 入力履歴機能をスキップするか
     */
    constructor(options = {}) {
        /** @type {MapManager|null} 地図管理インスタンス */
        this.mapManager = null;
        /** @type {ImageUploader|null} 画像アップロード管理インスタンス */
        this.imageUploader = null;
        /** @type {OverlayManager|null} オーバーレイ管理インスタンス */
        this.overlayManager = null;
        /** @type {PinManager|null} ピン管理インスタンス */
        this.pinManager = null;
        /** @type {CsvExporter|null} CSV出力管理インスタンス */
        this.csvExporter = null;
        /** @type {InputHistoryManager|null} 入力履歴管理インスタンス */
        this.inputHistoryManager = null;
        
        /** @type {Object} 初期化オプション */
        this.options = {
            skipInputHistory: false,
            ...options
        };
        
        this.initialize();
    }
    
    /**
     * 全てのマネージャーを初期化し、コンポーネント間の連携を設定します
     * @private
     */
    initialize() {
        try {
            this.mapManager = new MapManager('map');
        } catch (error) {
            console.error('地図マネージャー初期化失敗:', error);
            throw error;
        }
        
        try {
            this.imageUploader = new ImageUploader({
                uploadArea: document.getElementById('uploadArea'),
                fileInput: document.getElementById('fileInput'),
                previewImage: document.getElementById('previewImage'),
                uploadedImageDiv: document.getElementById('uploadedImage'),
                onImageLoaded: (imageData) => this.handleImageLoaded(imageData)
            });
        } catch (error) {
            console.error('画像アップローダー初期化失敗:', error);
            throw error;
        }
        
        try {
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
        } catch (error) {
            console.error('オーバーレイマネージャー初期化失敗:', error);
            throw error;
        }
        
        try {
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
                inputHistoryManager: null
            });
        } catch (error) {
            console.error('ピンマネージャー初期化失敗:', error);
            throw error;
        }
        
        try {
            this.csvExporter = new CsvExporter({
                exportButton: document.getElementById('exportCsv'),
                pinManager: this.pinManager
            });
        } catch (error) {
            console.error('CSVエクスポーター初期化失敗:', error);
            throw error;
        }
        
        if (!this.options.skipInputHistory) {
            try {
                this.inputHistoryManager = new InputHistoryManager();
                this.inputHistoryManager.setupAllFields();
            } catch (error) {
                console.warn('入力履歴マネージャー初期化失敗:', error);
                this.inputHistoryManager = null;
            }
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
            this.setupAddressSearch();
        } catch (error) {
            console.error('住所検索設定失敗:', error);
            throw error;
        }
        
        try {
            this.setupPasteHandler();
        } catch (error) {
            console.error('ペースト機能設定失敗:', error);
            throw error;
        }
        
        try {
            this.setupLeftSidebarToggle();
        } catch (error) {
            console.error('左サイドバートグル設定失敗:', error);
            throw error;
        }
        
        try {
            this.setupRightSidebarToggle();
        } catch (error) {
            console.error('右サイドバートグル設定失敗:', error);
            throw error;
        }
        
        // 初期化完了後にマップコントロールの位置を設定
        setTimeout(() => {
            this.updateMapControlsPosition();
        }, 100);
    }
    
    setupAddressSearch() {
        const addressInput = ErrorHandler.requireElement('addressInput');
        
        const searchAddress = async () => {
            const address = addressInput.value.trim();
            if (!address) return;
            
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
            }
        };
        
        addressInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchAddress();
            }
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
    
    /**
     * 画像が読み込まれた際の処理
     * オーバーレイセクションを表示し、画像データを設定します
     * 
     * @param {Object} imageData - 読み込まれた画像データ
     * @param {string} imageData.url - 画像のData URL
     * @param {number} imageData.width - 画像の幅
     * @param {number} imageData.height - 画像の高さ
     */
    handleImageLoaded(imageData) {
        console.log('handleImageLoaded called with:', imageData);
        // 画像が読み込まれたらオーバーレイセクションを表示
        document.getElementById('overlaySection').style.display = 'block';
        this.overlayManager.setImage(imageData);
    }
    
    // handleImageRemovedメソッドは削除（×ボタンから直接OverlayManager.deleteImage()が呼ばれる）
    
    /**
     * オーバーレイが適用された際の処理
     * ピンマネージャーを有効化し、右サイドバーを表示します
     */
    handleOverlayApplied() {
        // オーバーレイが適用されたら右サイドバーを表示可能にして、ピンセクションを表示
        this.showRightSidebar();
        document.getElementById('pinSection').style.display = 'block';
        this.pinManager.enable();
    }
    
    /**
     * 左サイドバーのトグル機能を設定します
     */
    setupLeftSidebarToggle() {
        const toggleButton = ErrorHandler.requireElement('leftSidebarToggle');
        const leftSidebar = ErrorHandler.requireElement('sidebar');
        
        let isOpen = true; // 初期状態は表示
        
        toggleButton.addEventListener('click', () => {
            if (isOpen) {
                this.hideLeftSidebar();
            } else {
                this.showLeftSidebar();
            }
            isOpen = !isOpen;
            
            // ボタンの状態を更新
            toggleButton.classList.toggle('open', isOpen);
            toggleButton.title = isOpen ? 'アップロード・設定パネルを閉じる' : 'アップロード・設定パネルを開く';
        });
    }
    
    /**
     * 右サイドバーのトグル機能を設定します
     */
    setupRightSidebarToggle() {
        const toggleButton = ErrorHandler.requireElement('rightSidebarToggle');
        const rightSidebar = ErrorHandler.requireElement('rightSidebar');
        
        let isOpen = false; // 初期状態は閉じている
        
        toggleButton.addEventListener('click', () => {
            if (isOpen) {
                this.hideRightSidebar();
            } else {
                this.showRightSidebar();
            }
            isOpen = !isOpen;
            
            // ボタンの状態を更新
            toggleButton.classList.toggle('open', isOpen);
            toggleButton.title = isOpen ? 'ピン管理パネルを閉じる' : 'ピン管理パネルを開く';
            
            // オーバーレイマネージャーに状態変更を通知
            if (this.overlayManager) {
                this.overlayManager.onRightSidebarToggle();
            }
        });
    }
    
    /**
     * 左サイドバーを表示します
     */
    showLeftSidebar() {
        const leftSidebar = ErrorHandler.requireElement('sidebar');
        const toggleButton = ErrorHandler.requireElement('leftSidebarToggle');
        
        leftSidebar.classList.remove('hidden');
        toggleButton.classList.add('open');
        toggleButton.title = 'アップロード・設定パネルを閉じる';
        
        // マップコントロールの位置を更新
        this.updateMapControlsPosition();
    }
    
    /**
     * 左サイドバーを非表示にします
     */
    hideLeftSidebar() {
        const leftSidebar = ErrorHandler.requireElement('sidebar');
        const toggleButton = ErrorHandler.requireElement('leftSidebarToggle');
        
        leftSidebar.classList.add('hidden');
        toggleButton.classList.remove('open');
        toggleButton.title = 'アップロード・設定パネルを開く';
        
        // マップコントロールの位置を更新
        this.updateMapControlsPosition();
    }
    
    /**
     * 右サイドバーを表示します
     */
    showRightSidebar() {
        const rightSidebar = ErrorHandler.requireElement('rightSidebar');
        const toggleButton = ErrorHandler.requireElement('rightSidebarToggle');
        
        rightSidebar.classList.add('visible');
        toggleButton.classList.add('open');
        toggleButton.title = 'ピン管理パネルを閉じる';
        
        // オーバーレイマネージャーに状態変更を通知
        if (this.overlayManager) {
            this.overlayManager.onRightSidebarToggle();
        }
    }
    
    /**
     * 右サイドバーを非表示にします
     */
    hideRightSidebar() {
        const rightSidebar = ErrorHandler.requireElement('rightSidebar');
        const toggleButton = ErrorHandler.requireElement('rightSidebarToggle');
        
        rightSidebar.classList.remove('visible');
        toggleButton.classList.remove('open');
        toggleButton.title = 'ピン管理パネルを開く';
        
        // オーバーレイマネージャーに状態変更を通知
        if (this.overlayManager) {
            this.overlayManager.onRightSidebarToggle();
        }
    }
    
    /**
     * ズームコントロールとマップタイル選択パネルの位置を左サイドバーの状態に応じて更新します
     */
    updateMapControlsPosition() {
        // 地図が初期化されていない場合は何もしない
        if (!this.mapManager || !this.mapManager.map) {
            return;
        }
        
        const leftSidebar = ErrorHandler.requireElement('sidebar');
        const isLeftSidebarVisible = !leftSidebar.classList.contains('hidden');
        
        // ズームコントロール要素を取得
        const zoomControl = document.querySelector('.leaflet-control-zoom');
        if (zoomControl) {
            if (isLeftSidebarVisible) {
                // 左サイドバー表示時: サイドバーの右側
                zoomControl.classList.remove('sidebar-hidden');
            } else {
                // 左サイドバー非表示時: トグルボタンの右側
                zoomControl.classList.add('sidebar-hidden');
            }
        }
        
        // マップタイル選択パネルの位置も更新
        const tileSelector = document.querySelector('.map-tile-selector');
        if (tileSelector) {
            if (isLeftSidebarVisible) {
                // 左サイドバー表示時: サイドバーの右側
                tileSelector.classList.remove('sidebar-hidden');
            } else {
                // 左サイドバー非表示時: トグルボタンの右側
                tileSelector.classList.add('sidebar-hidden');
            }
        }
    }
}

// デフォルトエクスポート（テスト用）
export default App;

// アプリケーションの起動
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});