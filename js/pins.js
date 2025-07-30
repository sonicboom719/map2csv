import { CONFIG } from './config.js';
import { ErrorHandler } from './utils/error-handler.js';

export class PinManager {
    constructor(options) {
        this.map = options.map;
        this.pinSection = options.pinSection;
        this.pinList = options.pinList;
        this.pinModal = options.pinModal;
        this.pinDisplayNumberInput = ErrorHandler.requireElement('pinDisplayNumber');
        this.pinNumberInput = options.pinNumberInput;
        this.pinNameInput = options.pinNameInput;
        this.pinMemoInput = options.pinMemoInput;
        this.saveButton = options.saveButton;
        this.cancelButton = options.cancelButton;
        
        this.pins = [];
        this.currentPin = null;
        this.enabled = false;
        this.pinIdCounter = 1;
        this.inputHistoryManager = options.inputHistoryManager;
        
        this.setupEventHandlers();
    }
    
    setupEventHandlers() {
        // モーダルのボタンイベント
        this.saveButton.addEventListener('click', () => {
            this.savePinInfo();
        });
        
        this.cancelButton.addEventListener('click', () => {
            this.closeModal();
        });
        
        // Escキーでモーダルを閉じる
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.pinModal.style.display !== 'none') {
                this.closeModal();
            }
        });
        
        // モーダル外クリックで閉じる
        this.pinModal.addEventListener('click', (e) => {
            if (e.target === this.pinModal) {
                this.closeModal();
            }
        });
        
        // メモ欄で改行を禁止
        this.pinMemoInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
            }
        });
        
        // プルダウンメニューに選択肢を追加
        this.initializePinNumberDropdown();
    }
    
    initializePinNumberDropdown() {
        // 設定から最大番号を取得して選択肢を追加
        for (let i = 1; i <= CONFIG.PINS.MAX_DISPLAY_NUMBER; i++) {
            const option = document.createElement('option');
            option.value = i.toString();
            option.textContent = i.toString();
            this.pinDisplayNumberInput.appendChild(option);
        }
    }
    
    enable() {
        this.enabled = true;
        
        // マウスカーソルを十字に変更
        const mapContainer = this.map.getContainer();
        mapContainer.style.cursor = 'crosshair';
        
        // 既存のイベントリスナーを削除してから設定
        this.map.off('click', this.mapClickHandler);
        
        // イベントハンドラーを保存
        this.mapClickHandler = (e) => {
            if (this.enabled) {
                this.addPin(e.latlng);
            }
        };
        
        // 地図クリックイベントを設定
        this.map.on('click', this.mapClickHandler);
    }
    
    disable() {
        this.enabled = false;
        
        // マウスカーソルを元に戻す
        const mapContainer = this.map.getContainer();
        mapContainer.style.cursor = '';
        
        // イベントリスナーを削除
        if (this.mapClickHandler) {
            this.map.off('click', this.mapClickHandler);
        }
    }
    
    addPin(latlng) {
        const pin = {
            id: this.pinIdCounter++,
            latlng: latlng,
            displayNumber: '', // 表示用番号
            number: '', // 掲示場番号
            name: '',
            memo: '',
            marker: null
        };
        
        // マーカーを作成（初期は番号なし）
        const marker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'custom-marker-with-number',
                html: '<div class="pin-marker"></div>',
                iconSize: CONFIG.UI.MARKER_SIZES.DEFAULT,
                iconAnchor: [10, 10]
            }),
            draggable: true
        }).addTo(this.map);
        
        // マーカークリックでモーダルを開く
        marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            this.openModal(pin);
        });
        
        // マウスオーバー/アウトイベント
        marker.on('mouseover', () => {
            this.highlightPinInList(pin.id, true);
        });
        
        marker.on('mouseout', () => {
            this.highlightPinInList(pin.id, false);
        });
        
        // ドラッグイベント
        marker.on('dragstart', () => {
            this.highlightPinInList(pin.id, true);
        });
        
        marker.on('dragend', (e) => {
            pin.latlng = e.target.getLatLng();
            this.highlightPinInList(pin.id, false);
            this.updatePinList();
        });
        
        pin.marker = marker;
        this.pins.push(pin);
        
        // モーダルを開いて情報入力
        this.openModal(pin);
        
        this.updatePinList();
    }
    
    openModal(pin) {
        this.currentPin = pin;
        this.pinDisplayNumberInput.value = pin.displayNumber || '';
        this.pinNumberInput.value = pin.number || '';
        this.pinNameInput.value = pin.name || '';
        this.pinMemoInput.value = pin.memo || '';
        this.pinModal.style.display = 'flex';
        
        // モーダル表示時に入力履歴を初期化
        if (this.inputHistoryManager) {
            setTimeout(() => {
                this.inputHistoryManager.initializeAllFieldsIfNeeded();
            }, 100);
        }
        
        this.pinDisplayNumberInput.focus();
    }
    
    closeModal() {
        this.pinModal.style.display = 'none';
        this.currentPin = null;
    }
    
    // 入力履歴マネージャーを設定（main.jsから呼び出される）
    setInputHistoryManager(inputHistoryManager) {
        this.inputHistoryManager = inputHistoryManager;
        console.log('✅ PinManagerに入力履歴マネージャーが設定されました');
    }
    
    savePinInfo() {
        if (!this.currentPin) return;
        
        this.currentPin.displayNumber = this.pinDisplayNumberInput.value.trim();
        this.currentPin.number = this.pinNumberInput.value.trim();
        this.currentPin.name = this.pinNameInput.value.trim();
        this.currentPin.memo = this.pinMemoInput.value.trim();
        
        // マーカーの表示を更新（表示用番号付き）
        const displayNumber = this.currentPin.displayNumber;
        const htmlContent = displayNumber ? 
            `<div class="pin-marker"><span class="pin-number-label">${displayNumber}</span></div>` : 
            '<div class="pin-marker"></div>';
            
        this.currentPin.marker.setIcon(L.divIcon({
            className: 'custom-marker-with-number',
            html: htmlContent,
            iconSize: displayNumber ? CONFIG.UI.MARKER_SIZES.WITH_NUMBER : CONFIG.UI.MARKER_SIZES.DEFAULT,
            iconAnchor: displayNumber ? [12.5, 12.5] : [10, 10]
        }));
        
        this.updatePinList();
        this.closeModal();
    }
    
    removePin(pinId) {
        const pinIndex = this.pins.findIndex(p => p.id === pinId);
        if (pinIndex === -1) return;
        
        const pin = this.pins[pinIndex];
        this.map.removeLayer(pin.marker);
        this.pins.splice(pinIndex, 1);
        
        this.updatePinList();
    }
    
    editPin(pinId) {
        const pin = this.pins.find(p => p.id === pinId);
        if (pin) {
            this.openModal(pin);
        }
    }
    
    updatePinList() {
        this.pinList.innerHTML = '';
        
        if (this.pins.length === 0) {
            this.pinList.innerHTML = '<p style="color: #999; text-align: center;">ピンがありません</p>';
            return;
        }
        
        this.pins.forEach(pin => {
            const div = document.createElement('div');
            div.className = 'pin-item';
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'pin-info';
            
            const numberDiv = document.createElement('div');
            numberDiv.className = 'pin-number';
            
            // 表示用番号があれば先頭に#付きで表示
            const displayNumberText = pin.displayNumber ? `#${pin.displayNumber} ` : '';
            const numberText = pin.number || `ピン ${pin.id}`;
            const nameText = pin.name ? ` - ${pin.name}` : '';
            numberDiv.textContent = displayNumberText + numberText + nameText;
            
            const coordsDiv = document.createElement('div');
            coordsDiv.className = 'pin-coords';
            coordsDiv.textContent = `緯度: ${pin.latlng.lat.toFixed(6)}, 経度: ${pin.latlng.lng.toFixed(6)}`;
            
            infoDiv.appendChild(numberDiv);
            infoDiv.appendChild(coordsDiv);
            
            if (pin.memo) {
                const memoDiv = document.createElement('div');
                memoDiv.className = 'pin-memo';
                memoDiv.textContent = pin.memo;
                infoDiv.appendChild(memoDiv);
            }
            
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'pin-actions';
            
            const editButton = document.createElement('button');
            editButton.textContent = '編集';
            editButton.className = 'btn-secondary';
            editButton.addEventListener('click', () => this.editPin(pin.id));
            
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '削除';
            deleteButton.className = 'btn-small';
            deleteButton.addEventListener('click', () => {
                this.removePin(pin.id);
            });
            
            actionsDiv.appendChild(editButton);
            actionsDiv.appendChild(deleteButton);
            
            div.appendChild(infoDiv);
            div.appendChild(actionsDiv);
            
            // ピンIDを要素に設定
            div.setAttribute('data-pin-id', pin.id);
            
            // ピンリストアイテムのマウスオーバー/アウトイベント
            div.addEventListener('mouseover', () => {
                this.highlightPinOnMap(pin.id, true);
            });
            
            div.addEventListener('mouseout', () => {
                this.highlightPinOnMap(pin.id, false);
            });
            
            this.pinList.appendChild(div);
        });
    }
    
    highlightPinInList(pinId, highlight) {
        const pinElement = this.pinList.querySelector(`[data-pin-id="${pinId}"]`);
        if (pinElement) {
            if (highlight) {
                pinElement.style.backgroundColor = '#ffe4b5';
                pinElement.style.transition = 'background-color 0.3s';
            } else {
                pinElement.style.backgroundColor = '';
            }
        }
    }
    
    highlightPinOnMap(pinId, highlight) {
        const pin = this.pins.find(p => p.id === pinId);
        if (pin && pin.marker) {
            const markerElement = pin.marker.getElement();
            if (markerElement) {
                const pinMarkerDiv = markerElement.querySelector('.pin-marker');
                if (pinMarkerDiv) {
                    if (highlight) {
                        pinMarkerDiv.style.backgroundColor = CONFIG.PINS.DEFAULT_COLORS.HOVER;
                        pinMarkerDiv.style.transform = 'scale(1.2)';
                        pinMarkerDiv.style.transition = 'all 0.3s';
                        pinMarkerDiv.style.zIndex = '1000';
                    } else {
                        pinMarkerDiv.style.backgroundColor = CONFIG.PINS.DEFAULT_COLORS.DEFAULT;
                        pinMarkerDiv.style.transform = 'scale(1)';
                        pinMarkerDiv.style.zIndex = '';
                    }
                }
            }
        }
    }
    
    getPins() {
        return this.pins.map(pin => ({
            latitude: pin.latlng.lat,
            longitude: pin.latlng.lng,
            number: pin.number,
            name: pin.name,
            memo: pin.memo
        }));
    }
    
    clearAllPins() {
        // 全てのマーカーを地図から削除
        this.pins.forEach(pin => {
            if (pin.marker) {
                this.map.removeLayer(pin.marker);
            }
        });
        
        // ピン配列をクリア
        this.pins = [];
        
        // UIを更新
        this.updatePinList();
        
        console.log('All pins cleared');
    }
}