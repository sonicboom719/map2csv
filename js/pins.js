export class PinManager {
    constructor(options) {
        this.map = options.map;
        this.pinSection = options.pinSection;
        this.pinList = options.pinList;
        this.pinModal = options.pinModal;
        this.pinNumberInput = options.pinNumberInput;
        this.pinMemoInput = options.pinMemoInput;
        this.saveButton = options.saveButton;
        this.cancelButton = options.cancelButton;
        
        this.pins = [];
        this.currentPin = null;
        this.enabled = false;
        this.pinIdCounter = 1;
        
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
    }
    
    enable() {
        this.enabled = true;
        
        // 地図クリックイベントを設定
        this.map.on('click', (e) => {
            if (this.enabled) {
                this.addPin(e.latlng);
            }
        });
    }
    
    disable() {
        this.enabled = false;
    }
    
    addPin(latlng) {
        const pin = {
            id: this.pinIdCounter++,
            latlng: latlng,
            number: '',
            memo: '',
            marker: null
        };
        
        // マーカーを作成
        const marker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'custom-marker',
                html: `<div class="custom-marker"></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            })
        }).addTo(this.map);
        
        // マーカークリックでモーダルを開く
        marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            this.openModal(pin);
        });
        
        pin.marker = marker;
        this.pins.push(pin);
        
        // モーダルを開いて情報入力
        this.openModal(pin);
        
        this.updatePinList();
    }
    
    openModal(pin) {
        this.currentPin = pin;
        this.pinNumberInput.value = pin.number || '';
        this.pinMemoInput.value = pin.memo || '';
        this.pinModal.style.display = 'flex';
        this.pinNumberInput.focus();
    }
    
    closeModal() {
        this.pinModal.style.display = 'none';
        this.currentPin = null;
    }
    
    savePinInfo() {
        if (!this.currentPin) return;
        
        this.currentPin.number = this.pinNumberInput.value.trim();
        this.currentPin.memo = this.pinMemoInput.value.trim();
        
        // マーカーの表示を更新（常に赤●のまま）
        this.currentPin.marker.setIcon(L.divIcon({
            className: 'custom-marker',
            html: `<div class="custom-marker"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
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
            numberDiv.textContent = pin.number || `ピン ${pin.id}`;
            
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
            
            this.pinList.appendChild(div);
        });
    }
    
    getPins() {
        return this.pins.map(pin => ({
            latitude: pin.latlng.lat,
            longitude: pin.latlng.lng,
            number: pin.number,
            memo: pin.memo
        }));
    }
}