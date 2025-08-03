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
        
        // ピン表示タイプのプルダウン
        this.pinDisplayTypeSelect = ErrorHandler.requireElement('pinDisplayType');
        
        // 自動連番チェックボックス
        this.autoNumberingCheckbox = ErrorHandler.requireElement('autoNumberingCheckbox');
        
        // 次の自動連番番号
        this.nextAutoNumber = 1;
        
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
        
        // ピン表示タイプ変更時の処理
        this.pinDisplayTypeSelect.addEventListener('change', () => {
            this.updateAllPinMarkers();
        });
    }
    
    initializePinNumberDropdown() {
        // 既存のオプションをクリア
        this.pinDisplayNumberInput.innerHTML = '';
        
        // デフォルトオプションを追加
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '選択してください(省略可)';
        this.pinDisplayNumberInput.appendChild(defaultOption);
        
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
        this.map.off('mousedown', this.mapMouseDownHandler);
        this.map.off('mouseup', this.mapMouseUpHandler);
        this.map.off('dblclick', this.mapDblClickHandler);
        this.map.off('dragstart', this.mapDragStartHandler);
        this.map.off('dragend', this.mapDragEndHandler);
        
        // 長押し用のタイマー
        let longPressTimer = null;
        let mouseDownLatLng = null;
        
        // ダブルクリック検出用
        let clickTimer = null;
        let isDoubleClick = false;
        
        // ドラッグ検出用
        let isMapDragging = false;
        
        // マウスダウンイベントハンドラー
        this.mapMouseDownHandler = (e) => {
            if (this.enabled && !isMapDragging) {
                mouseDownLatLng = e.latlng;
                longPressTimer = setTimeout(() => {
                    // 長押し時：ドラッグしていない場合のみピンを追加して編集画面を開く
                    if (!isMapDragging) {
                        const pin = this.addPin(mouseDownLatLng, true); // 第2引数でモーダルを開くかどうか指定
                    }
                }, 500); // 500ms長押し
            }
        };
        
        // マウスアップイベントハンドラー
        this.mapMouseUpHandler = (e) => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        };
        
        // クリックイベントハンドラー（通常クリック時）
        this.mapClickHandler = (e) => {
            if (!this.enabled || longPressTimer !== null || isDoubleClick || isMapDragging) {
                return;
            }
            
            // 既にクリックタイマーが動いている場合はダブルクリックと判定
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
                isDoubleClick = true;
                // ダブルクリックフラグを少し後にリセット
                setTimeout(() => {
                    isDoubleClick = false;
                }, 500);
                return;
            }
            
            // シングルクリックの処理を遅延させてダブルクリックを検出
            clickTimer = setTimeout(() => {
                clickTimer = null;
                if (!isDoubleClick && this.enabled && longPressTimer === null && !isMapDragging) {
                    // シングルクリック確定：ドラッグしていない場合のみピンを追加するが編集画面は開かない
                    this.addPin(e.latlng, false);
                }
            }, 250); // 250ms待機
        };
        
        // ダブルクリックイベントハンドラー（ピン配置を防ぐ）
        this.mapDblClickHandler = (e) => {
            // ダブルクリックフラグを設定
            isDoubleClick = true;
            
            // クリックタイマーをクリア
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }
            
            // フラグを少し後にリセット
            setTimeout(() => {
                isDoubleClick = false;
            }, 500);
        };
        
        // 地図ドラッグ開始イベントハンドラー
        this.mapDragStartHandler = (e) => {
            isMapDragging = true;
            // ドラッグ開始時に長押しタイマーをクリア
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        };
        
        // 地図ドラッグ終了イベントハンドラー
        this.mapDragEndHandler = (e) => {
            // ドラッグ終了を少し遅延してリセット（クリックイベントとの競合を避ける）
            setTimeout(() => {
                isMapDragging = false;
            }, 100);
        };
        
        // イベントリスナーを設定
        this.map.on('mousedown', this.mapMouseDownHandler);
        this.map.on('mouseup', this.mapMouseUpHandler);
        this.map.on('click', this.mapClickHandler);
        this.map.on('dblclick', this.mapDblClickHandler);
        this.map.on('dragstart', this.mapDragStartHandler);
        this.map.on('dragend', this.mapDragEndHandler);
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
        if (this.mapMouseDownHandler) {
            this.map.off('mousedown', this.mapMouseDownHandler);
        }
        if (this.mapMouseUpHandler) {
            this.map.off('mouseup', this.mapMouseUpHandler);
        }
        if (this.mapDblClickHandler) {
            this.map.off('dblclick', this.mapDblClickHandler);
        }
        if (this.mapDragStartHandler) {
            this.map.off('dragstart', this.mapDragStartHandler);
        }
        if (this.mapDragEndHandler) {
            this.map.off('dragend', this.mapDragEndHandler);
        }
    }
    
    addPin(latlng, openModal = false) {
        const pin = {
            id: this.pinIdCounter++,
            latlng: latlng,
            displayNumber: '', // 表示用番号
            number: '', // 掲示場番号
            name: '',
            memo: '',
            marker: null
        };
        
        // 自動連番が有効な場合、ピン番号を自動設定
        if (this.autoNumberingCheckbox.checked) {
            pin.displayNumber = this.nextAutoNumber.toString();
            this.nextAutoNumber++;
        }
        
        // マーカーを作成（自動連番がある場合は番号付き）
        const displayNumber = this.getMarkerDisplayNumber(pin);
        const htmlContent = displayNumber ? 
            `<div class="pin-marker"><span class="pin-number-label">${displayNumber}</span></div>` : 
            '<div class="pin-marker"></div>';
        
        const marker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'custom-marker-with-number',
                html: htmlContent,
                iconSize: displayNumber ? CONFIG.UI.MARKER_SIZES.WITH_NUMBER : CONFIG.UI.MARKER_SIZES.DEFAULT,
                iconAnchor: displayNumber ? [12.5, 12.5] : [10, 10]
            }),
            draggable: true
        }).addTo(this.map);
        
        // 既存ピンのイベント用変数
        let isDragging = false;
        let markerMouseDownTimer = null;
        
        // マーカーのマウスダウン（長押し検出用）
        marker.on('mousedown', (e) => {
            L.DomEvent.stopPropagation(e);
            isDragging = false;
            
            // 長押しタイマーを開始
            markerMouseDownTimer = setTimeout(() => {
                if (!isDragging) {
                    // ドラッグしていない場合のみ編集画面を開く
                    this.openModal(pin);
                }
            }, 500); // 500ms長押し
        });
        
        // マーカーのマウスアップ
        marker.on('mouseup', (e) => {
            L.DomEvent.stopPropagation(e);
            if (markerMouseDownTimer) {
                clearTimeout(markerMouseDownTimer);
                markerMouseDownTimer = null;
            }
        });
        
        // 既存ピンはクリックで編集画面を開く（ドラッグしていない場合）
        marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            if (!isDragging) {
                this.openModal(pin);
            }
            isDragging = false;
        });
        
        // マウスオーバー/アウトイベント
        marker.on('mouseover', () => {
            this.highlightPinInList(pin.id, true);
            this.highlightPinOnMap(pin.id, true);
        });
        
        marker.on('mouseout', () => {
            // マウスアウト時にも長押しタイマーをクリア
            if (markerMouseDownTimer) {
                clearTimeout(markerMouseDownTimer);
                markerMouseDownTimer = null;
            }
            this.highlightPinInList(pin.id, false);
            this.highlightPinOnMap(pin.id, false);
        });
        
        // ドラッグイベント
        marker.on('dragstart', () => {
            isDragging = true;
            // ドラッグ開始時に長押しタイマーをクリア
            if (markerMouseDownTimer) {
                clearTimeout(markerMouseDownTimer);
                markerMouseDownTimer = null;
            }
            this.highlightPinInList(pin.id, true);
        });
        
        marker.on('dragend', (e) => {
            pin.latlng = e.target.getLatLng();
            this.highlightPinInList(pin.id, false);
            this.updatePinList();
        });
        
        pin.marker = marker;
        this.pins.push(pin);
        
        // openModalがtrueの場合のみモーダルを開く（長押し時）
        if (openModal) {
            this.openModal(pin);
        }
        
        this.updatePinList();
        
        return pin;
    }
    
    openModal(pin) {
        this.currentPin = pin;
        
        // 自動連番が有効かどうかで表示を変更
        if (this.autoNumberingCheckbox.checked) {
            // プルダウンを無効化して「自動付与」を表示
            this.pinDisplayNumberInput.innerHTML = '<option value="auto">自動付与 (' + pin.displayNumber + ')</option>';
            this.pinDisplayNumberInput.value = 'auto';
            this.pinDisplayNumberInput.disabled = true;
            this.pinDisplayNumberInput.style.backgroundColor = '#f0f0f0';
            this.pinDisplayNumberInput.style.color = '#666';
        } else {
            // 通常のプルダウンに戻す
            this.pinDisplayNumberInput.disabled = false;
            this.pinDisplayNumberInput.style.backgroundColor = '';
            this.pinDisplayNumberInput.style.color = '';
            // 元のオプションを復元
            this.initializePinNumberDropdown();
            this.pinDisplayNumberInput.value = pin.displayNumber || '';
        }
        
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
        
        // 自動連番が設定されている場合はフォーカスを掲示場番号に
        if (this.autoNumberingCheckbox.checked) {
            this.pinNumberInput.focus();
        } else {
            this.pinDisplayNumberInput.focus();
        }
    }
    
    closeModal() {
        this.pinModal.style.display = 'none';
        this.currentPin = null;
    }
    
    // 入力履歴マネージャーを設定（main.jsから呼び出される）
    setInputHistoryManager(inputHistoryManager) {
        this.inputHistoryManager = inputHistoryManager;
    }
    
    savePinInfo() {
        if (!this.currentPin) return;
        
        // 自動連番が有効な場合は、表示用番号は変更しない（元の値を保持）
        if (!this.autoNumberingCheckbox.checked && this.pinDisplayNumberInput.value !== 'auto') {
            this.currentPin.displayNumber = this.pinDisplayNumberInput.value.trim();
        }
        // 自動連番の場合、displayNumberは既に設定済みなので変更しない
        
        this.currentPin.number = this.pinNumberInput.value.trim();
        this.currentPin.name = this.pinNameInput.value.trim();
        this.currentPin.memo = this.pinMemoInput.value.trim();
        
        // マーカーの表示を更新
        this.updatePinMarker(this.currentPin);
        
        this.updatePinList();
        this.closeModal();
    }
    
    removePin(pinId) {
        const pinIndex = this.pins.findIndex(p => p.id === pinId);
        if (pinIndex === -1) return;
        
        const pin = this.pins[pinIndex];
        this.map.removeLayer(pin.marker);
        this.pins.splice(pinIndex, 1);
        
        // 自動連番が有効で、削除したピンが連番を持っていた場合は再連番
        if (this.autoNumberingCheckbox.checked && pin.displayNumber) {
            this.recalculateAutoNumbers();
        }
        
        this.updatePinList();
    }
    
    // 自動連番を再計算（削除時の番号詰め）
    recalculateAutoNumbers() {
        let number = 1;
        this.pins.forEach(pin => {
            if (pin.displayNumber) {
                pin.displayNumber = number.toString();
                number++;
                // マーカーも更新
                this.updatePinMarker(pin);
            }
        });
        // 次の番号を更新
        this.nextAutoNumber = number;
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
            const nameText = pin.name ? ` : ${pin.name}` : '';
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
                this.highlightPinInList(pin.id, true);
            });
            
            div.addEventListener('mouseout', () => {
                this.highlightPinOnMap(pin.id, false);
                this.highlightPinInList(pin.id, false);
            });
            
            this.pinList.appendChild(div);
        });
    }
    
    highlightPinInList(pinId, highlight) {
        const pinElement = this.pinList.querySelector(`[data-pin-id="${pinId}"]`);
        if (pinElement) {
            if (highlight) {
                pinElement.style.backgroundColor = '#ffe4b5';
                pinElement.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
                pinElement.style.transition = 'all 0.3s ease';
            } else {
                pinElement.style.backgroundColor = '';
                pinElement.style.boxShadow = '';
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
    
    // マーカーの表示番号を取得
    getMarkerDisplayNumber(pin) {
        const displayType = this.pinDisplayTypeSelect.value;
        if (displayType === 'displayNumber') {
            return pin.displayNumber;
        } else {
            return pin.number;
        }
    }
    
    // 個別のピンマーカーを更新
    updatePinMarker(pin) {
        const displayNumber = this.getMarkerDisplayNumber(pin);
        const htmlContent = displayNumber ? 
            `<div class="pin-marker"><span class="pin-number-label">${displayNumber}</span></div>` : 
            '<div class="pin-marker"></div>';
            
        pin.marker.setIcon(L.divIcon({
            className: 'custom-marker-with-number',
            html: htmlContent,
            iconSize: displayNumber ? CONFIG.UI.MARKER_SIZES.WITH_NUMBER : CONFIG.UI.MARKER_SIZES.DEFAULT,
            iconAnchor: displayNumber ? [12.5, 12.5] : [10, 10]
        }));
    }
    
    // 全てのピンマーカーを更新
    updateAllPinMarkers() {
        this.pins.forEach(pin => {
            this.updatePinMarker(pin);
        });
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
        
        // 自動連番カウンターをリセット
        this.nextAutoNumber = 1;
        
        // UIを更新
        this.updatePinList();
        
        console.log('All pins cleared');
    }
    
    // ピンの表示/非表示を切り替え
    hidePins() {
        this.pins.forEach(pin => {
            if (pin.marker) {
                this.map.removeLayer(pin.marker);
            }
        });
        console.log('All pins hidden');
    }
    
    showPins() {
        this.pins.forEach(pin => {
            if (pin.marker) {
                pin.marker.addTo(this.map);
            }
        });
        console.log('All pins shown');
    }
}