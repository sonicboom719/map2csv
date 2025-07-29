export class OverlayManager {
    constructor(options) {
        this.map = options.map;
        this.imageCanvas = options.imageCanvas;
        this.overlaySection = options.overlaySection;
        this.imagePointsDiv = options.imagePointsDiv;
        this.mapPointsDiv = options.mapPointsDiv;
        this.applyButton = options.applyButton;
        this.resetButton = options.resetButton;
        this.onOverlayApplied = options.onOverlayApplied;
        
        this.imageData = null;
        this.imagePoints = [];
        this.mapPoints = [];
        this.mapMarkers = [];
        this.overlayLayer = null;
        this.isSelectingImagePoints = false;
        this.ctx = null;
        
        this.setupEventHandlers();
    }
    
    setupEventHandlers() {
        this.applyButton.addEventListener('click', () => {
            this.applyTransform();
        });
        
        this.resetButton.addEventListener('click', () => {
            this.resetPoints();
        });
        
        // 画像キャンバスのクリックイベント
        this.imageCanvas.addEventListener('click', (e) => {
            if (this.isSelectingImagePoints && this.imagePoints.length < 4) {
                this.addImagePoint(e);
            }
        });
        
        // 地図のクリックイベント
        this.map.on('click', (e) => {
            if (!this.isSelectingImagePoints && this.mapPoints.length < 4 && this.imagePoints.length === 4) {
                this.addMapPoint(e);
            }
        });
    }
    
    setImage(imageData) {
        this.imageData = imageData;
        this.resetPoints();
        this.startImagePointSelection();
    }
    
    startImagePointSelection() {
        this.isSelectingImagePoints = true;
        
        // 画像をキャンバスに描画
        const img = new Image();
        img.onload = () => {
            // キャンバスのサイズを設定（最大800px）
            const maxSize = 800;
            let width = img.width;
            let height = img.height;
            
            if (width > maxSize || height > maxSize) {
                const ratio = Math.min(maxSize / width, maxSize / height);
                width *= ratio;
                height *= ratio;
            }
            
            this.imageCanvas.width = width;
            this.imageCanvas.height = height;
            this.imageCanvas.style.display = 'block';
            
            this.ctx = this.imageCanvas.getContext('2d');
            this.ctx.drawImage(img, 0, 0, width, height);
            
            // 画像とキャンバスのサイズ比を保存
            this.imageScale = {
                x: width / img.width,
                y: height / img.height
            };
            
            // 元の画像サイズも保存
            this.originalImageSize = {
                width: img.width,
                height: img.height
            };
        };
        img.src = this.imageData.url;
    }
    
    addImagePoint(event) {
        const rect = this.imageCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        this.imagePoints.push({ x, y });
        
        // ポイントを描画
        this.ctx.fillStyle = '#e74c3c';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 8, 0, 2 * Math.PI);
        this.ctx.fill();
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(this.imagePoints.length.toString(), x, y);
        
        this.updatePointsDisplay();
        
        if (this.imagePoints.length === 4) {
            this.isSelectingImagePoints = false;
            this.imageCanvas.style.display = 'none';
            this.updateInstructions();
        }
    }
    
    addMapPoint(event) {
        const latlng = event.latlng;
        this.mapPoints.push(latlng);
        
        // マーカーを追加
        const marker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'selection-marker',
                html: `<div style="background-color: #e74c3c; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${this.mapPoints.length}</div>`,
                iconSize: [24, 24]
            })
        }).addTo(this.map);
        
        this.mapMarkers.push(marker);
        this.updatePointsDisplay();
        
        if (this.mapPoints.length === 4) {
            this.applyButton.disabled = false;
        }
    }
    
    updatePointsDisplay() {
        // 画像ポイントの表示更新
        this.imagePointsDiv.innerHTML = '';
        this.imagePoints.forEach((point, index) => {
            const div = document.createElement('div');
            div.className = 'point-item';
            div.innerHTML = `<span class="point-number" style="background-color: #e74c3c;">${index + 1}</span> 選択済み`;
            this.imagePointsDiv.appendChild(div);
        });
        
        if (this.imagePoints.length < 4) {
            const div = document.createElement('div');
            div.className = 'point-item';
            div.style.color = '#999';
            div.textContent = `あと${4 - this.imagePoints.length}点選択してください`;
            this.imagePointsDiv.appendChild(div);
        }
        
        // 地図ポイントの表示更新
        this.mapPointsDiv.innerHTML = '';
        this.mapPoints.forEach((point, index) => {
            const div = document.createElement('div');
            div.className = 'point-item';
            div.innerHTML = `<span class="point-number" style="background-color: #e74c3c;">${index + 1}</span> 選択済み`;
            this.mapPointsDiv.appendChild(div);
        });
        
        if (this.mapPoints.length < 4) {
            const div = document.createElement('div');
            div.className = 'point-item';
            div.style.color = '#999';
            div.textContent = `あと${4 - this.mapPoints.length}点選択してください`;
            this.mapPointsDiv.appendChild(div);
        }
    }
    
    updateInstructions() {
        const info = this.overlaySection.querySelector('.info');
        if (this.imagePoints.length === 4 && this.mapPoints.length === 0) {
            info.textContent = '次に、地図上で対応する4点を同じ順番でクリックしてください（重要：同じ順番で！）';
            info.style.backgroundColor = '#fff3cd';
            info.style.color = '#856404';
        }
    }
    
    applyTransform() {
        if (this.imagePoints.length !== 4 || this.mapPoints.length !== 4) {
            return;
        }
        
        // 既存のオーバーレイを削除
        if (this.overlayLayer) {
            this.map.removeLayer(this.overlayLayer);
        }
        
        // 選択マーカーを削除
        this.mapMarkers.forEach(marker => marker.remove());
        this.mapMarkers = [];
        
        // 地図ポイントをLatLng配列に変換
        const corners = this.mapPoints.map(p => L.latLng(p.lat, p.lng));
        
        console.log('Applying overlay with corners:', corners);
        
        // 通常のImageOverlayを作成（境界ボックスを使用）
        const lats = corners.map(c => c.lat);
        const lngs = corners.map(c => c.lng);
        const bounds = L.latLngBounds(
            [Math.min(...lats), Math.min(...lngs)],
            [Math.max(...lats), Math.max(...lngs)]
        );
        
        this.overlayLayer = L.imageOverlay(this.imageData.url, bounds, {
            opacity: 0.7,
            interactive: false
        }).addTo(this.map);
        
        // Leaflet.DistortableImageが利用可能かチェック
        if (typeof L.DistortableImageOverlay !== 'undefined') {
            try {
                // 既存のオーバーレイを削除
                this.map.removeLayer(this.overlayLayer);
                
                // DistortableImageOverlayを作成
                this.overlayLayer = L.distortableImageOverlay(this.imageData.url, {
                    corners: corners,
                    mode: 'lock',
                    suppressToolbar: true,
                    opacity: 0.7
                }).addTo(this.map);
                
                console.log('DistortableImageOverlay created successfully');
            } catch (error) {
                console.error('Failed to create DistortableImageOverlay:', error);
                // エラーの場合は通常のImageOverlayを再作成
                this.overlayLayer = L.imageOverlay(this.imageData.url, bounds, {
                    opacity: 0.7,
                    interactive: false
                }).addTo(this.map);
            }
        }
        
        // 完了通知
        if (this.onOverlayApplied) {
            this.onOverlayApplied();
        }
        
        // UIの更新
        this.applyButton.disabled = true;
        this.applyButton.textContent = '位置合わせ完了';
        
        // 説明を更新
        const info = this.overlaySection.querySelector('.info');
        info.textContent = '位置合わせが完了しました。地図を移動・ズームして確認してください。';
        info.style.backgroundColor = '#d4edda';
        info.style.color = '#155724';
    }
    
    resetPoints() {
        this.imagePoints = [];
        this.mapPoints = [];
        
        // マーカーを削除
        this.mapMarkers.forEach(marker => marker.remove());
        this.mapMarkers = [];
        
        // キャンバスをクリア
        if (this.ctx && this.imageData) {
            const img = new Image();
            img.onload = () => {
                this.ctx.clearRect(0, 0, this.imageCanvas.width, this.imageCanvas.height);
                this.ctx.drawImage(img, 0, 0, this.imageCanvas.width, this.imageCanvas.height);
            };
            img.src = this.imageData.url;
        }
        
        this.updatePointsDisplay();
        this.applyButton.disabled = true;
        this.applyButton.textContent = '位置合わせを実行';
        
        // 説明を元に戻す
        const info = this.overlaySection.querySelector('.info');
        info.textContent = '画像と地図で対応する4点を選択してください';
        info.style.backgroundColor = '#e3f2fd';
        info.style.color = '#1976d2';
        
        // 画像選択を再開
        if (this.imageData) {
            this.startImagePointSelection();
        }
    }
}