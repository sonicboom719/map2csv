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
        this.imagePoints = [];  // 画像上の2つの交差点
        this.mapPoints = [];    // 地図上の2つの交差点
        this.mapMarkers = [];
        this.overlayLayer = null;
        this.isSelectingImagePoints = true;
        this.ctx = null;
        
        // ドラッグ&リサイズ管理
        try {
            this.dragResize = new DragResizeManager();
            console.log('DragResizeManager created successfully');
        } catch (error) {
            console.error('Error creating DragResizeManager:', error);
            this.dragResize = null;
        }
        this.canvasContainer = null;
        
        this.setupEventHandlers();
        this.createControlPanel();
    }
    
    createControlPanel() {
        const controlDiv = document.createElement('div');
        controlDiv.id = 'overlayControls';
        controlDiv.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            z-index: 1000;
            display: none;
            min-width: 220px;
        `;
        
        controlDiv.innerHTML = `
            <div style="margin-bottom: 15px; font-weight: bold; font-size: 16px; color: #2c3e50;">🎛️ 画像調整</div>
            
            <div style="margin-bottom: 10px;">
                <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" id="imageVisibleToggle" checked style="margin-right: 8px;">
                    <span style="font-size: 14px;">画像を表示</span>
                </label>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; font-size: 14px; margin-bottom: 5px;">透明度:</label>
                <input type="range" id="imageOpacity" min="0.1" max="1" step="0.1" value="0.6" style="width: 100%;">
            </div>
            
            <button id="showOriginalBtn" style="width: 100%; padding: 8px; font-size: 13px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 8px;">
                元画像を拡大表示
            </button>
        `;
        
        document.querySelector('.map-container').appendChild(controlDiv);
        
        // イベントリスナーを追加
        document.getElementById('imageVisibleToggle').addEventListener('change', (e) => {
            this.toggleImageVisibility(e.target.checked);
        });
        
        document.getElementById('imageOpacity').addEventListener('input', (e) => {
            this.setImageOpacity(parseFloat(e.target.value));
        });
        
        document.getElementById('showOriginalBtn').addEventListener('click', () => {
            this.showOriginalImage();
        });
    }
    
    setupEventHandlers() {
        this.applyButton.addEventListener('click', () => {
            this.applyTransform();
        });
        
        this.resetButton.addEventListener('click', () => {
            this.resetPoints();
        });
        
        // 画像キャンバスのクリックイベントは makeCanvasDraggable で設定
        
        // 地図のクリックイベント
        this.map.on('click', (e) => {
            if (!this.isSelectingImagePoints && this.mapPoints.length < 2) {
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
        
        console.log('Image selection started with data:', this.imageData);
        
        // 画像をキャンバスに描画
        const img = new Image();
        img.onload = () => {
            console.log('Image loaded:', img.width, 'x', img.height);
            
            const maxSize = 400;
            let width = img.width;
            let height = img.height;
            
            if (width > maxSize || height > maxSize) {
                const ratio = Math.min(maxSize / width, maxSize / height);
                width *= ratio;
                height *= ratio;
            }
            
            console.log('Canvas size:', width, 'x', height);
            
            // キャンバスの基本設定
            this.imageCanvas.width = width;
            this.imageCanvas.height = height;
            this.imageCanvas.style.display = 'block';
            this.imageCanvas.style.border = '2px solid #e74c3c';
            this.imageCanvas.style.borderRadius = '4px';
            this.imageCanvas.style.cursor = 'crosshair';
            
            // 描画コンテキスト取得と描画
            this.ctx = this.imageCanvas.getContext('2d');
            this.ctx.clearRect(0, 0, width, height);
            this.ctx.drawImage(img, 0, 0, width, height);
            
            console.log('Canvas drawn successfully');
            
            // スケール保存
            this.imageScale = {
                x: width / img.width,
                y: height / img.height
            };
            
            // ドラッグ&リサイズ機能を追加
            this.makeCanvasDraggable();
            
            // リサイズ時のコールバック設定
            if (this.dragResize && this.dragResize.callbacks) {
                this.dragResize.callbacks.onResize = (newWidth, newHeight) => {
                    console.log('Resize callback:', newWidth, 'x', newHeight);
                    // スケール更新
                    if (this.imageData) {
                        this.imageScale = {
                            x: newWidth / this.imageData.width,
                            y: newHeight / this.imageData.height
                        };
                    }
                    // 再描画
                    this.redrawCanvas();
                };
            }
            
            this.showImageSelectionGuide();
        };
        
        img.onerror = (e) => {
            console.error('Image load error:', e);
            alert('画像の読み込みに失敗しました。');
        };
        
        img.src = this.imageData.url;
        console.log('Loading image from:', this.imageData.url.substring(0, 50) + '...');
    }
    
    makeCanvasDraggable() {
        console.log('Making canvas draggable...');
        
        // 既存コンテナを清理
        const existing = document.getElementById('imageCanvasContainer');
        if (existing) {
            console.log('Removing existing container');
            existing.remove();
        }
        
        try {
            // メインコンテナ作成
            console.log('Creating draggable container with dragResize:', this.dragResize);
            
            this.canvasContainer = this.dragResize.createDraggableContainer({
                canvas: this.imageCanvas,
                onUndo: () => {
                    console.log('Undo button clicked');
                    this.undoLastPoint();
                },
                onClose: () => {
                    console.log('Close button clicked');
                    this.showReopenButton();
                }
            });
            
            console.log('Draggable container created:', this.canvasContainer);
            
            // キャンバスのクリックイベントを再設定
            this.imageCanvas.addEventListener('click', (e) => {
                console.log('Canvas clicked, isResizing:', this.dragResize.isResizing, 'isSelectingImagePoints:', this.isSelectingImagePoints, 'imagePoints.length:', this.imagePoints.length);
                
                if (!this.dragResize.isResizing && this.isSelectingImagePoints && this.imagePoints.length < 2) {
                    this.addImagePoint(e);
                }
            });
            
            console.log('Canvas click event added');
            
        } catch (error) {
            console.error('Error creating draggable container:', error);
            // フォールバック: 簡単な表示
            this.imageCanvas.style.position = 'fixed';
            this.imageCanvas.style.top = '100px';
            this.imageCanvas.style.left = '50%';
            this.imageCanvas.style.transform = 'translateX(-50%)';
            this.imageCanvas.style.zIndex = '2000';
            this.imageCanvas.style.boxShadow = '0 8px 25px rgba(0,0,0,0.3)';
        }
    }
    
    
    
    redrawCanvas() {
        const img = new Image();
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.imageCanvas.width, this.imageCanvas.height);
            this.ctx.drawImage(img, 0, 0, this.imageCanvas.width, this.imageCanvas.height);
            
            // 選択済みの点を再描画
            const colors = ['#e74c3c', '#3498db'];
            this.imagePoints.forEach((point, index) => {
                // スケールに応じて点の位置を調整
                const scaledX = point.x;
                const scaledY = point.y;
                
                this.ctx.fillStyle = colors[index];
                this.ctx.beginPath();
                this.ctx.arc(scaledX, scaledY, 8, 0, 2 * Math.PI);
                this.ctx.fill();
                
                this.ctx.fillStyle = 'white';
                this.ctx.font = 'bold 12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText((index + 1).toString(), scaledX, scaledY);
            });
        };
        img.src = this.imageData.url;
    }
    
    undoLastPoint() {
        if (this.imagePoints.length > 0 && this.isSelectingImagePoints) {
            this.imagePoints.pop();
            this.redrawCanvas();
            this.updatePointsDisplay();
            this.updateUndoButton();
            this.showImageSelectionGuide();
        } else if (this.mapPoints.length > 0 && !this.isSelectingImagePoints) {
            this.mapPoints.pop();
            if (this.mapMarkers.length > 0) {
                const marker = this.mapMarkers.pop();
                marker.remove();
            }
            this.updatePointsDisplay();
            this.updateUndoButton();
            
            if (this.mapPoints.length === 0 && this.imagePoints.length === 2) {
                this.startMapPointSelection();
            }
        }
    }
    
    updateUndoButton() {
        const hasPoints = this.imagePoints.length > 0 || this.mapPoints.length > 0;
        
        // 新しいドラッグコンテナのボタンを更新
        if (this.dragResize) {
            this.dragResize.updateUndoButton(hasPoints);
        }
        
        // 旧いIDのボタンもチェック（後方互換性）
        const oldUndoBtn = document.getElementById('undoBtn');
        if (oldUndoBtn) {
            oldUndoBtn.disabled = !hasPoints;
            oldUndoBtn.style.opacity = hasPoints ? '1' : '0.5';
        }
    }
    
    showReopenButton() {
        const reopenBtn = document.createElement('button');
        reopenBtn.innerHTML = '📷 画像を再表示';
        reopenBtn.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            background: #e74c3c;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            cursor: pointer;
            z-index: 1500;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;
        
        reopenBtn.addEventListener('click', () => {
            this.canvasContainer.style.display = 'block';
            document.body.removeChild(reopenBtn);
        });
        
        document.body.appendChild(reopenBtn);
    }
    
    showImageSelectionGuide() {
        const info = this.overlaySection.querySelector('.info');
        const pointNumber = this.imagePoints.length + 1;
        
        info.innerHTML = `
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #e74c3c;">
                📍 画像上で交差点を選択 (${this.imagePoints.length}/2)
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <div style="font-size: 16px; font-weight: bold; color: #e67e22; margin-bottom: 8px;">
                    ${pointNumber === 1 ? '1番目' : '2番目'}の交差点をクリック
                </div>
                <div style="font-size: 14px; color: #856404;">
                    画像で道路が十字に交わる明確な交差点をクリック
                </div>
            </div>
            
            <div style="background: #e3f2fd; padding: 12px; border-radius: 4px; font-size: 13px;">
                💡 <strong>操作ヒント:</strong><br>
                • <strong>Shift+ドラッグ</strong>: 画像を移動<br>
                • <strong>4隅の青い丸</strong>: ドラッグでサイズ変更<br>
                • <strong>↶戻る</strong>: 直前の選択を取消
            </div>
        `;
    }
    
    addImagePoint(event) {
        const rect = this.imageCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        this.imagePoints.push({ x, y });
        
        // ポイントを描画
        const colors = ['#e74c3c', '#3498db'];
        this.ctx.fillStyle = colors[this.imagePoints.length - 1];
        this.ctx.beginPath();
        this.ctx.arc(x, y, 8, 0, 2 * Math.PI);
        this.ctx.fill();
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(this.imagePoints.length.toString(), x, y);
        
        this.updatePointsDisplay();
        this.updateUndoButton();
        
        if (this.imagePoints.length === 2) {
            this.isSelectingImagePoints = false;
            this.startMapPointSelection();
        } else {
            this.showImageSelectionGuide();
        }
    }
    
    startMapPointSelection() {
        const info = this.overlaySection.querySelector('.info');
        const pointNumber = this.mapPoints.length + 1;
        
        info.innerHTML = `
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #3498db;">
                🗺️ 地図上で対応する交差点を選択 (${this.mapPoints.length}/2)
            </div>
            
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <div style="font-size: 16px; font-weight: bold; color: #1976d2; margin-bottom: 8px;">
                    画像の${pointNumber}番の交差点に対応する地図上の交差点をクリック
                </div>
            </div>
        `;
    }
    
    addMapPoint(event) {
        const latlng = event.latlng;
        this.mapPoints.push(latlng);
        
        const colors = ['#e74c3c', '#3498db'];
        const marker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'intersection-marker',
                html: `<div style="background-color: ${colors[this.mapPoints.length - 1]}; color: white; padding: 8px 15px; border-radius: 20px; font-size: 14px; font-weight: bold;">🚦 ${this.mapPoints.length}番目の交差点</div>`,
                iconSize: [140, 40]
            })
        }).addTo(this.map);
        
        this.mapMarkers.push(marker);
        this.updatePointsDisplay();
        this.updateUndoButton();
        
        if (this.mapPoints.length === 2) {
            this.applyButton.disabled = false;
            const info = this.overlaySection.querySelector('.info');
            info.innerHTML = `
                <div style="font-size: 18px; font-weight: bold; color: #28a745;">
                    ✅ 準備完了！
                </div>
                <div style="font-size: 14px; margin-top: 10px;">
                    「位置合わせを実行」をクリックしてください
                </div>
            `;
        } else {
            this.startMapPointSelection();
        }
    }
    
    updatePointsDisplay() {
        // 画像ポイントの表示
        this.imagePointsDiv.innerHTML = '';
        const imageColors = ['#e74c3c', '#3498db'];
        
        for (let i = 0; i < 2; i++) {
            const div = document.createElement('div');
            div.className = 'point-item';
            if (i < this.imagePoints.length) {
                div.innerHTML = `<span class="point-number" style="background-color: ${imageColors[i]};">✓</span> ${i + 1}番目の交差点`;
            } else {
                div.style.color = '#999';
                div.innerHTML = `<span class="point-number" style="background-color: #ccc;">${i + 1}</span> 未選択`;
            }
            this.imagePointsDiv.appendChild(div);
        }
        
        // 地図ポイントの表示
        this.mapPointsDiv.innerHTML = '';
        
        for (let i = 0; i < 2; i++) {
            const div = document.createElement('div');
            div.className = 'point-item';
            if (i < this.mapPoints.length) {
                div.innerHTML = `<span class="point-number" style="background-color: ${imageColors[i]};">✓</span> 対応する${i + 1}番目`;
            } else {
                div.style.color = '#999';
                div.innerHTML = `<span class="point-number" style="background-color: #ccc;">${i + 1}</span> 未選択`;
            }
            this.mapPointsDiv.appendChild(div);
        }
    }
    
    applyTransform() {
        if (this.imagePoints.length !== 2 || this.mapPoints.length !== 2) {
            return;
        }
        
        // コントロールパネルを表示
        document.getElementById('overlayControls').style.display = 'block';
        
        // 既存のオーバーレイを削除
        if (this.overlayLayer) {
            this.map.removeLayer(this.overlayLayer);
        }
        
        // 選択マーカーを削除
        this.mapMarkers.forEach(marker => marker.remove());
        this.mapMarkers = [];
        
        // 2点間の位置関係から画像を配置
        this.calculateAndApplyTransform();
        
        // 完了通知
        if (this.onOverlayApplied) {
            this.onOverlayApplied();
        }
        
        // UIの更新
        this.applyButton.disabled = true;
        this.applyButton.textContent = '配置完了';
        
        const info = this.overlaySection.querySelector('.info');
        info.innerHTML = `
            <div style="font-size: 18px; font-weight: bold; color: #28a745;">
                🎉 画像の配置が完了しました！
            </div>
            <div style="font-size: 14px; margin-top: 10px;">
                地図上をクリックしてピンを配置できます
            </div>
        `;
    }
    
    calculateAndApplyTransform() {
        // 簡易的な実装：2点から境界を推定
        const img1 = this.imagePoints[0];
        const img2 = this.imagePoints[1];
        const map1 = this.mapPoints[0];
        const map2 = this.mapPoints[1];
        
        // 画像上の2点間のベクトル
        const imgDx = img2.x - img1.x;
        const imgDy = img2.y - img1.y;
        
        // 地図上の2点間の距離
        const mapDistance = map1.distanceTo(map2);
        const imgDistance = Math.sqrt(imgDx * imgDx + imgDy * imgDy);
        
        // スケール計算
        const scale = mapDistance / (imgDistance / this.imageScale.x);
        
        // 画像の推定サイズ（メートル）
        const imgWidthInMeters = this.imageData.width * scale;
        const imgHeightInMeters = this.imageData.height * scale;
        
        // 中心点を計算
        const centerLat = (map1.lat + map2.lat) / 2;
        const centerLng = (map1.lng + map2.lng) / 2;
        
        // 緯度経度への変換
        const latPerMeter = 1 / 111320;
        const lngPerMeter = 1 / (111320 * Math.cos(centerLat * Math.PI / 180));
        
        const bounds = L.latLngBounds(
            [centerLat - imgHeightInMeters * latPerMeter / 2, centerLng - imgWidthInMeters * lngPerMeter / 2],
            [centerLat + imgHeightInMeters * latPerMeter / 2, centerLng + imgWidthInMeters * lngPerMeter / 2]
        );
        
        // 画像オーバーレイを作成
        this.overlayLayer = L.imageOverlay(this.imageData.url, bounds, {
            opacity: 0.6,
            interactive: false
        }).addTo(this.map);
        
        // 地図をフィット
        this.map.fitBounds(bounds, { padding: [50, 50] });
    }
    
    toggleImageVisibility(visible) {
        if (this.overlayLayer) {
            this.overlayLayer.setOpacity(visible ? parseFloat(document.getElementById('imageOpacity').value) : 0);
        }
    }
    
    setImageOpacity(opacity) {
        if (this.overlayLayer && document.getElementById('imageVisibleToggle').checked) {
            this.overlayLayer.setOpacity(opacity);
        }
    }
    
    showOriginalImage() {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        `;
        
        const img = document.createElement('img');
        img.src = this.imageData.url;
        img.style.cssText = `
            max-width: 95%;
            max-height: 95%;
            border-radius: 8px;
        `;
        
        modal.appendChild(img);
        modal.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        document.body.appendChild(modal);
    }
    
    resetPoints() {
        this.imagePoints = [];
        this.mapPoints = [];
        
        // マーカーを削除
        this.mapMarkers.forEach(marker => marker.remove());
        this.mapMarkers = [];
        
        // オーバーレイを削除
        if (this.overlayLayer) {
            this.map.removeLayer(this.overlayLayer);
            this.overlayLayer = null;
        }
        
        // コントロールパネルを非表示
        document.getElementById('overlayControls').style.display = 'none';
        
        this.updatePointsDisplay();
        this.updateUndoButton();
        this.applyButton.disabled = true;
        this.applyButton.textContent = '位置合わせを実行';
        
        // 選択を再開
        if (this.imageData) {
            this.startImagePointSelection();
        }
    }
}

// ドラッグ&リサイズ機能管理クラス
class DragResizeManager {
    constructor() {
        this.isDragging = false;
        this.isResizing = false;
        this.currentHandle = null;
        this.startX = 0;
        this.startY = 0;
        this.startLeft = 0;
        this.startTop = 0;
        this.startWidth = 0;
        this.startHeight = 0;
        this.container = null;
        this.canvas = null;
        this.callbacks = {};
    }
    
    createDraggableContainer(options) {
        const { canvas, onUndo, onClose } = options;
        this.canvas = canvas;
        this.callbacks = { onUndo, onClose };
        
        // メインコンテナ
        this.container = document.createElement('div');
        this.container.id = 'imageCanvasContainer';
        this.container.style.cssText = `
            position: fixed;
            left: 50%;
            top: 120px;
            transform: translateX(-50%);
            z-index: 2500;
            background: white;
            border-radius: 12px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.4);
            overflow: visible;
            border: 2px solid #e74c3c;
        `;
        
        // タイトルバー
        const titleBar = document.createElement('div');
        titleBar.className = 'drag-title-bar';
        titleBar.style.cssText = `
            background: #e74c3c;
            color: white;
            padding: 15px 20px;
            font-size: 14px;
            font-weight: bold;
            cursor: move;
            user-select: none;
            border-radius: 10px 10px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background 0.2s ease;
        `;
        
        titleBar.innerHTML = `
            <span>📷 この赤いバーをドラッグして移動・4隅の青い丸でリサイズ</span>
            <div style="display: flex; gap: 8px;">
                <button class="undo-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: background 0.2s ease;" disabled>↶ 戻る</button>
                <button class="close-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 16px; cursor: pointer; padding: 6px 10px; border-radius: 6px; transition: background 0.2s ease;">×</button>
            </div>
        `;
        
        // コンテンツエリア
        const contentArea = document.createElement('div');
        contentArea.className = 'drag-content-area';
        contentArea.style.cssText = `
            position: relative;
            padding: 20px;
            background: white;
            border-radius: 0 0 10px 10px;
        `;
        
        // DOM構築
        contentArea.appendChild(canvas);
        this.container.appendChild(titleBar);
        this.container.appendChild(contentArea);
        document.body.appendChild(this.container);
        
        // キャンバススタイル調整
        canvas.style.display = 'block';
        canvas.style.cursor = 'crosshair';
        canvas.style.borderRadius = '6px';
        
        // リサイズハンドル追加
        this.addResizeHandles(contentArea);
        
        // イベント設定
        this.setupDragEvents(titleBar);
        this.setupButtonEvents(titleBar);
        
        return this.container;
    }
    
    addResizeHandles(contentArea) {
        const handles = [
            { pos: 'nw', cursor: 'nw-resize', top: -12, left: -12 },
            { pos: 'ne', cursor: 'ne-resize', top: -12, right: -12 },
            { pos: 'se', cursor: 'se-resize', bottom: -12, right: -12 },
            { pos: 'sw', cursor: 'sw-resize', bottom: -12, left: -12 }
        ];
        
        handles.forEach(handleInfo => {
            const handle = document.createElement('div');
            handle.className = `resize-handle resize-${handleInfo.pos}`;
            handle.dataset.position = handleInfo.pos;
            
            handle.style.cssText = `
                position: absolute;
                width: 24px;
                height: 24px;
                background: #3498db;
                border: 4px solid white;
                border-radius: 50%;
                cursor: ${handleInfo.cursor};
                z-index: 20;
                box-shadow: 0 6px 15px rgba(0,0,0,0.3);
                opacity: 1;
                transition: all 0.2s ease;
                ${handleInfo.top !== undefined ? `top: ${handleInfo.top}px;` : ''}
                ${handleInfo.bottom !== undefined ? `bottom: ${handleInfo.bottom}px;` : ''}
                ${handleInfo.left !== undefined ? `left: ${handleInfo.left}px;` : ''}
                ${handleInfo.right !== undefined ? `right: ${handleInfo.right}px;` : ''}
            `;
            
            // ホバーエフェクト
            handle.addEventListener('mouseenter', () => {
                handle.style.transform = 'scale(1.2)';
                handle.style.background = '#2980b9';
            });
            
            handle.addEventListener('mouseleave', () => {
                if (!this.isResizing) {
                    handle.style.transform = 'scale(1)';
                    handle.style.background = '#3498db';
                }
            });
            
            // リサイズイベント
            handle.addEventListener('mousedown', (e) => {
                this.startResize(e, handleInfo.pos, handle);
            });
            
            contentArea.appendChild(handle);
        });
    }
    
    setupDragEvents(titleBar) {
        titleBar.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            
            this.isDragging = true;
            this.startX = e.clientX;
            this.startY = e.clientY;
            
            const rect = this.container.getBoundingClientRect();
            this.startLeft = rect.left;
            this.startTop = rect.top;
            
            titleBar.style.cursor = 'grabbing';
            titleBar.style.background = '#c0392b';
            document.body.style.userSelect = 'none';
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.doDrag(e);
            } else if (this.isResizing) {
                this.doResize(e);
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.stopDrag(titleBar);
            } else if (this.isResizing) {
                this.stopResize();
            }
        });
    }
    
    setupButtonEvents(titleBar) {
        const undoBtn = titleBar.querySelector('.undo-btn');
        const closeBtn = titleBar.querySelector('.close-btn');
        
        undoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.callbacks.onUndo) this.callbacks.onUndo();
        });
        
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.container.style.display = 'none';
            if (this.callbacks.onClose) this.callbacks.onClose();
        });
        
        // ホバーエフェクト
        [undoBtn, closeBtn].forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'rgba(255,255,255,0.3)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'rgba(255,255,255,0.2)';
            });
        });
    }
    
    doDrag(e) {
        const deltaX = e.clientX - this.startX;
        const deltaY = e.clientY - this.startY;
        
        this.container.style.left = (this.startLeft + deltaX) + 'px';
        this.container.style.top = (this.startTop + deltaY) + 'px';
        this.container.style.transform = 'none';
    }
    
    stopDrag(titleBar) {
        this.isDragging = false;
        titleBar.style.cursor = 'move';
        titleBar.style.background = '#e74c3c';
        document.body.style.userSelect = '';
    }
    
    startResize(e, position, handle) {
        this.isResizing = true;
        this.currentHandle = position;
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.startWidth = this.canvas.width;
        this.startHeight = this.canvas.height;
        
        handle.style.transform = 'scale(1.3)';
        handle.style.background = '#2980b9';
        document.body.style.userSelect = 'none';
        
        e.preventDefault();
        e.stopPropagation();
    }
    
    doResize(e) {
        const deltaX = e.clientX - this.startX;
        const deltaY = e.clientY - this.startY;
        
        let newWidth = this.startWidth;
        let newHeight = this.startHeight;
        
        switch(this.currentHandle) {
            case 'se':
                newWidth = this.startWidth + deltaX;
                newHeight = this.startHeight + deltaY;
                break;
            case 'sw':
                newWidth = this.startWidth - deltaX;
                newHeight = this.startHeight + deltaY;
                break;
            case 'ne':
                newWidth = this.startWidth + deltaX;
                newHeight = this.startHeight - deltaY;
                break;
            case 'nw':
                newWidth = this.startWidth - deltaX;
                newHeight = this.startHeight - deltaY;
                break;
        }
        
        // サイズ制限
        newWidth = Math.max(250, Math.min(900, newWidth));
        newHeight = Math.max(150, Math.min(700, newHeight));
        
        // キャンバスサイズ更新
        this.canvas.width = newWidth;
        this.canvas.height = newHeight;
        
        // リサイズイベントを発火
        if (this.callbacks.onResize) {
            this.callbacks.onResize(newWidth, newHeight);
        }
    }
    
    stopResize() {
        if (this.isResizing) {
            this.isResizing = false;
            this.currentHandle = null;
            document.body.style.userSelect = '';
            
            // ハンドルをリセット
            const handles = this.container.querySelectorAll('.resize-handle');
            handles.forEach(handle => {
                handle.style.transform = 'scale(1)';
                handle.style.background = '#3498db';
            });
        }
    }
    
    updateUndoButton(enabled) {
        const undoBtn = this.container?.querySelector('.undo-btn');
        if (undoBtn) {
            undoBtn.disabled = !enabled;
            undoBtn.style.opacity = enabled ? '1' : '0.5';
        }
    }
}