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
        this.isDragging = false;
        
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
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; font-size: 14px; margin-bottom: 5px;">回転:</label>
                <input type="range" id="imageRotation" min="-45" max="45" step="1" value="0" style="width: 100%;">
                <div style="font-size: 12px; color: #666; text-align: center;">
                    <span id="rotationValue">0°</span>
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; font-size: 14px; margin-bottom: 5px;">サイズ:</label>
                <input type="range" id="imageScale" min="0.5" max="2" step="0.1" value="1" style="width: 100%;">
                <div style="font-size: 12px; color: #666; text-align: center;">
                    <span id="scaleValue">100%</span>
                </div>
            </div>
            
            <button id="showOriginalBtn" style="width: 100%; padding: 8px; font-size: 13px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 8px;">
                元画像を拡大表示
            </button>
            
            <button id="resetAdjustments" style="width: 100%; padding: 8px; font-size: 13px; background: #95a5a6; color: white; border: none; border-radius: 4px; cursor: pointer;">
                調整をリセット
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
        
        document.getElementById('imageRotation').addEventListener('input', (e) => {
            const rotation = parseInt(e.target.value);
            document.getElementById('rotationValue').textContent = rotation + '°';
            this.rotateImage(rotation);
        });
        
        document.getElementById('imageScale').addEventListener('input', (e) => {
            const scale = parseFloat(e.target.value);
            document.getElementById('scaleValue').textContent = Math.round(scale * 100) + '%';
            this.scaleImage(scale);
        });
        
        document.getElementById('showOriginalBtn').addEventListener('click', () => {
            this.showOriginalImage();
        });
        
        document.getElementById('resetAdjustments').addEventListener('click', () => {
            this.resetAdjustments();
        });
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
            if (this.isSelectingImagePoints && this.imagePoints.length < 2) {
                this.addImagePoint(e);
            }
        });
        
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
        
        // 画像をキャンバスに描画
        const img = new Image();
        img.onload = () => {
            const maxSize = 400;
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
            this.imageCanvas.style.border = '2px solid #e74c3c';
            this.imageCanvas.style.borderRadius = '4px';
            this.imageCanvas.style.cursor = 'crosshair';
            
            // ドラッグ可能にする
            this.makeCanvasDraggable();
            
            this.ctx = this.imageCanvas.getContext('2d');
            this.ctx.drawImage(img, 0, 0, width, height);
            
            this.imageScale = {
                x: width / img.width,
                y: height / img.height
            };
            
            this.showImageSelectionGuide();
        };
        img.src = this.imageData.url;
    }
    
    makeCanvasDraggable() {
        let isDragging = false;
        let isResizing = false;
        let resizeHandle = null;
        let dragOffset = { x: 0, y: 0 };
        let originalSize = { width: 0, height: 0 };
        
        // キャンバスコンテナを作成
        const canvasContainer = document.createElement('div');
        canvasContainer.id = 'imageCanvasContainer';
        canvasContainer.style.cssText = `
            position: fixed;
            top: 100px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 2000;
            display: inline-block;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            border-radius: 4px;
            user-select: none;
        `;
        
        // ドラッグヘッダーを追加
        const dragHeader = document.createElement('div');
        dragHeader.style.cssText = `
            background: #e74c3c;
            color: white;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            font-size: 12px;
            font-weight: bold;
            border-radius: 4px 4px 0 0;
            cursor: move;
            user-select: none;
            min-width: 200px;
        `;
        dragHeader.innerHTML = `
            <span>📷 ドラッグ:移動 | 4隅:サイズ変更</span>
            <div>
                <button id="undoPointBtn" style="background: rgba(255,255,255,0.2); border: none; color: white; cursor: pointer; font-size: 12px; padding: 4px 8px; margin-right: 5px; border-radius: 3px;" disabled>↶戻る</button>
                <button id="closeImageCanvas" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px; padding: 0; margin: 0;">✕</button>
            </div>
        `;
        
        // キャンバスのスタイルを調整
        this.imageCanvas.style.position = 'relative';
        this.imageCanvas.style.display = 'block';
        this.imageCanvas.style.cursor = 'crosshair';
        this.imageCanvas.style.borderRadius = '0 0 4px 4px';
        
        // リサイズハンドルを作成
        this.createResizeHandles(canvasContainer);
        
        // コンテナに要素を追加
        this.imageCanvas.parentNode.insertBefore(canvasContainer, this.imageCanvas);
        canvasContainer.appendChild(dragHeader);
        canvasContainer.appendChild(this.imageCanvas);
        
        // 戻るボタンのイベント
        document.getElementById('undoPointBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.undoLastPoint();
        });
        
        // 閉じるボタンのイベント
        document.getElementById('closeImageCanvas').addEventListener('click', (e) => {
            e.stopPropagation();
            this.hideImageCanvas();
        });
        
        // 画像のドラッグ移動（画像エリアをドラッグ）
        this.imageCanvas.addEventListener('mousedown', (e) => {
            // 点選択モードの場合は点選択を優先
            if (e.ctrlKey || e.metaKey) {
                isDragging = true;
                const containerRect = canvasContainer.getBoundingClientRect();
                dragOffset.x = e.clientX - containerRect.left;
                dragOffset.y = e.clientY - containerRect.top;
                this.imageCanvas.style.cursor = 'move';
                e.preventDefault();
            }
        });
        
        // ヘッダーのドラッグ移動
        dragHeader.addEventListener('mousedown', (e) => {
            if (e.target.tagName !== 'BUTTON') {
                isDragging = true;
                const containerRect = canvasContainer.getBoundingClientRect();
                dragOffset.x = e.clientX - containerRect.left;
                dragOffset.y = e.clientY - containerRect.top;
                document.body.style.cursor = 'move';
                e.preventDefault();
            }
        });
        
        // マウス移動イベント
        document.addEventListener('mousemove', (e) => {
            if (isDragging && !isResizing) {
                const newLeft = e.clientX - dragOffset.x;
                const newTop = e.clientY - dragOffset.y;
                
                // 画面境界内に制限
                const containerWidth = canvasContainer.offsetWidth;
                const containerHeight = canvasContainer.offsetHeight;
                const maxLeft = window.innerWidth - containerWidth;
                const maxTop = window.innerHeight - containerHeight;
                
                canvasContainer.style.left = Math.max(0, Math.min(maxLeft, newLeft)) + 'px';
                canvasContainer.style.top = Math.max(0, Math.min(maxTop, newTop)) + 'px';
                canvasContainer.style.transform = 'none';
            } else if (isResizing && resizeHandle) {
                this.handleResize(e, canvasContainer, resizeHandle, originalSize);
            }
        });
        
        // マウスアップイベント
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.cursor = 'default';
                this.imageCanvas.style.cursor = 'crosshair';
            }
            if (isResizing) {
                isResizing = false;
                resizeHandle = null;
                document.body.style.cursor = 'default';
            }
        });
        
        // リサイズハンドルのイベント設定
        const handles = canvasContainer.querySelectorAll('.resize-handle');
        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                isResizing = true;
                resizeHandle = handle.dataset.direction;
                originalSize = {
                    width: this.imageCanvas.width,
                    height: this.imageCanvas.height
                };
                dragOffset = {
                    x: e.clientX,
                    y: e.clientY
                };
                e.preventDefault();
                e.stopPropagation();
            });
        });
        
        // コンテナの参照を保存
        this.canvasContainer = canvasContainer;
    }
    
    createResizeHandles(container) {
        const handles = [
            { position: 'nw', cursor: 'nw-resize', style: 'top: -5px; left: -5px;' },
            { position: 'ne', cursor: 'ne-resize', style: 'top: -5px; right: -5px;' },
            { position: 'sw', cursor: 'sw-resize', style: 'bottom: -5px; left: -5px;' },
            { position: 'se', cursor: 'se-resize', style: 'bottom: -5px; right: -5px;' }
        ];
        
        handles.forEach(handleInfo => {
            const handle = document.createElement('div');
            handle.className = 'resize-handle';
            handle.dataset.direction = handleInfo.position;
            handle.style.cssText = `
                position: absolute;
                width: 10px;
                height: 10px;
                background: #3498db;
                border: 2px solid white;
                border-radius: 50%;
                cursor: ${handleInfo.cursor};
                z-index: 2001;
                ${handleInfo.style}
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            `;
            container.appendChild(handle);
        });
    }
    
    handleResize(e, container, direction, originalSize) {
        const deltaX = e.clientX - dragOffset.x;
        const deltaY = e.clientY - dragOffset.y;
        
        let newWidth = originalSize.width;
        let newHeight = originalSize.height;
        
        // 最小サイズ制限
        const minSize = 100;
        const maxSize = 800;
        
        switch (direction) {
            case 'se': // 右下
                newWidth = Math.max(minSize, Math.min(maxSize, originalSize.width + deltaX));
                newHeight = Math.max(minSize, Math.min(maxSize, originalSize.height + deltaY));
                break;
            case 'sw': // 左下
                newWidth = Math.max(minSize, Math.min(maxSize, originalSize.width - deltaX));
                newHeight = Math.max(minSize, Math.min(maxSize, originalSize.height + deltaY));
                break;
            case 'ne': // 右上
                newWidth = Math.max(minSize, Math.min(maxSize, originalSize.width + deltaX));
                newHeight = Math.max(minSize, Math.min(maxSize, originalSize.height - deltaY));
                break;
            case 'nw': // 左上
                newWidth = Math.max(minSize, Math.min(maxSize, originalSize.width - deltaX));
                newHeight = Math.max(minSize, Math.min(maxSize, originalSize.height - deltaY));
                break;
        }
        
        // アスペクト比を保持
        const aspectRatio = this.imageData.width / this.imageData.height;
        if (newWidth / aspectRatio !== newHeight) {
            newHeight = newWidth / aspectRatio;
        }
        
        // キャンバスのサイズを更新
        this.imageCanvas.width = newWidth;
        this.imageCanvas.height = newHeight;
        
        // スケールを更新
        this.imageScale = {
            x: newWidth / this.imageData.width,
            y: newHeight / this.imageData.height
        };
        
        // 画像を再描画
        this.redrawImage();
    }
    
    redrawImage() {
        const img = new Image();
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.imageCanvas.width, this.imageCanvas.height);
            this.ctx.drawImage(img, 0, 0, this.imageCanvas.width, this.imageCanvas.height);
            
            // 既存の選択点を再描画
            this.redrawSelectedPoints();
        };
        img.src = this.imageData.url;
    }
    
    redrawSelectedPoints() {
        const colors = ['#e74c3c', '#3498db'];
        this.imagePoints.forEach((point, index) => {
            this.ctx.fillStyle = colors[index];
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 8, 0, 2 * Math.PI);
            this.ctx.fill();
            
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText((index + 1).toString(), point.x, point.y);
        });
    }
    
    undoLastPoint() {
        if (this.imagePoints.length > 0) {
            this.imagePoints.pop();
            this.redrawImage();
            this.updatePointsDisplay();
            this.updateUndoButton();
            
            // 状態を更新
            if (this.imagePoints.length < 2) {
                this.isSelectingImagePoints = true;
                this.showImageSelectionGuide();
            } else if (this.imagePoints.length === 2 && this.mapPoints.length > 0) {
                this.mapPoints.pop();
                // マーカーを削除
                if (this.mapMarkers.length > 0) {
                    const marker = this.mapMarkers.pop();
                    marker.remove();
                }
                this.startMapPointSelection();
            }
        } else if (this.mapPoints.length > 0 && this.imagePoints.length === 2) {
            this.mapPoints.pop();
            // マーカーを削除
            if (this.mapMarkers.length > 0) {
                const marker = this.mapMarkers.pop();
                marker.remove();
            }
            this.updatePointsDisplay();
            this.updateUndoButton();
            this.startMapPointSelection();
        }
    }
    
    updateUndoButton() {
        const undoBtn = document.getElementById('undoPointBtn');
        if (undoBtn) {
            const canUndo = this.imagePoints.length > 0 || this.mapPoints.length > 0;
            undoBtn.disabled = !canUndo;
            undoBtn.style.opacity = canUndo ? '1' : '0.5';
        }
    }
    
    hideImageCanvas() {
        if (this.canvasContainer) {
            this.canvasContainer.style.display = 'none';
        }
        
        // 画像を再表示するボタンを追加
        this.addShowImageButton();
    }
    
    addShowImageButton() {
        // 既存のボタンがあれば削除
        const existingBtn = document.getElementById('showImageCanvasBtn');
        if (existingBtn) {
            document.body.removeChild(existingBtn);
        }
        
        const showBtn = document.createElement('button');
        showBtn.id = 'showImageCanvasBtn';
        showBtn.innerHTML = '📷 画像を再表示';
        showBtn.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            background: #e74c3c;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            z-index: 1500;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;
        
        showBtn.addEventListener('click', () => {
            if (this.canvasContainer) {
                this.canvasContainer.style.display = 'inline-block';
            }
            document.body.removeChild(showBtn);
        });
        
        document.body.appendChild(showBtn);
    }
    
    showImageSelectionGuide() {
        const info = this.overlaySection.querySelector('.info');
        const pointNumber = this.imagePoints.length + 1;
        const pointNames = ['最初', '2番目'];
        
        info.innerHTML = `
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #e74c3c;">
                📍 画像上で交差点を選択 (${pointNumber}/2)
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #f39c12;">
                <div style="font-size: 16px; font-weight: bold; color: #e67e22; margin-bottom: 8px;">
                    ${pointNames[this.imagePoints.length]}の交差点をクリック
                </div>
                <div style="font-size: 14px; color: #856404;">
                    左の画像で、道路が十字に交わる<strong>明確な交差点</strong>をクリックしてください
                </div>
            </div>
            
            <div style="background: #e8f5e8; padding: 12px; border-radius: 4px; font-size: 13px;">
                💡 <strong>コツ:</strong><br>
                • 画像内で一番分かりやすい交差点を選ぶ<br>
                • 2つの交差点は少し離れた場所を選ぶと精度が上がります<br>
                • 白い道路線がはっきり見える場所を選択
            </div>
        `;
        info.style.backgroundColor = '#f8f9fa';
        info.style.color = '#2c3e50';
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
        const pointNumber = this.mapPoints.length + 1;
        const pointNames = ['最初', '2番目'];
        const info = this.overlaySection.querySelector('.info');
        
        info.innerHTML = `
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #3498db;">
                🗺️ 地図上で対応する交差点を選択 (${pointNumber}/2)
            </div>
            
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #2196f3;">
                <div style="font-size: 16px; font-weight: bold; color: #1976d2; margin-bottom: 8px;">
                    画像の${pointNames[this.mapPoints.length]}の交差点に対応する地図上の交差点をクリック
                </div>
                <div style="font-size: 14px; color: #0d47a1;">
                    左の画像で選択した<strong>${pointNumber}番の赤い/青い点</strong>に該当する地図上の交差点を探してクリック
                </div>
            </div>
            
            <div style="background: #fff3cd; padding: 12px; border-radius: 4px; font-size: 13px;">
                💡 <strong>対応付けのコツ:</strong><br>
                • 画像の道路パターンと地図の道路パターンを比較<br>
                • 建物や掲示場名を手がかりにする<br>
                • 住所検索を活用して大まかな場所を特定
            </div>
        `;
        info.style.backgroundColor = '#f8f9fa';
        info.style.color = '#2c3e50';
    }
    
    addMapPoint(event) {
        const latlng = event.latlng;
        this.mapPoints.push(latlng);
        
        const colors = ['#e74c3c', '#3498db'];
        const pointNames = ['1番目', '2番目'];
        
        // マーカーを追加
        const marker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'intersection-marker',
                html: `<div style="background-color: ${colors[this.mapPoints.length - 1]}; color: white; padding: 8px 15px; border-radius: 20px; font-size: 14px; font-weight: bold; box-shadow: 0 3px 8px rgba(0,0,0,0.3); white-space: nowrap;">🚦 ${pointNames[this.mapPoints.length - 1]}の交差点</div>`,
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
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #28a745;">
                    ✅ 2つの交差点の対応付けが完了しました！
                </div>
                
                <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #28a745;">
                    <div style="font-size: 16px; font-weight: bold; color: #155724; margin-bottom: 8px;">
                        準備完了 🎉
                    </div>
                    <div style="font-size: 14px; color: #155724;">
                        「位置合わせを実行」をクリックすると、2つの交差点の位置関係を基に画像が自動的に地図上に配置されます
                    </div>
                </div>
                
                <div style="background: #e3f2fd; padding: 12px; border-radius: 4px; font-size: 13px;">
                    💡 配置後は右上のコントロールで回転・サイズ・透明度を微調整できます
                </div>
            `;
            info.style.backgroundColor = '#f8f9fa';
            info.style.color = '#2c3e50';
        } else {
            this.startMapPointSelection();
        }
    }
    
    updatePointsDisplay() {
        // 画像ポイントの表示更新
        this.imagePointsDiv.innerHTML = '';
        const imageColors = ['#e74c3c', '#3498db'];
        
        this.imagePoints.forEach((point, index) => {
            const div = document.createElement('div');
            div.className = 'point-item';
            div.innerHTML = `
                <span class="point-number" style="background-color: ${imageColors[index]};">✓</span> 
                ${index + 1}番目の交差点 - 選択済み
            `;
            this.imagePointsDiv.appendChild(div);
        });
        
        if (this.imagePoints.length < 2) {
            const div = document.createElement('div');
            div.className = 'point-item';
            div.style.color = '#e74c3c';
            div.style.fontWeight = 'bold';
            div.innerHTML = `
                <span class="point-number" style="background-color: ${imageColors[this.imagePoints.length]};">${this.imagePoints.length + 1}</span> 
                ${this.imagePoints.length + 1}番目の交差点 ← 次に選択
            `;
            this.imagePointsDiv.appendChild(div);
        }
        
        // 地図ポイントの表示更新
        this.mapPointsDiv.innerHTML = '';
        
        this.mapPoints.forEach((point, index) => {
            const div = document.createElement('div');
            div.className = 'point-item';
            div.innerHTML = `
                <span class="point-number" style="background-color: ${imageColors[index]};">✓</span> 
                対応する${index + 1}番目の交差点 - 選択済み
            `;
            this.mapPointsDiv.appendChild(div);
        });
        
        if (this.mapPoints.length < 2 && this.imagePoints.length === 2) {
            const div = document.createElement('div');
            div.className = 'point-item';
            div.style.color = '#3498db';
            div.style.fontWeight = 'bold';
            div.innerHTML = `
                <span class="point-number" style="background-color: ${imageColors[this.mapPoints.length]};">${this.mapPoints.length + 1}</span> 
                対応する${this.mapPoints.length + 1}番目の交差点 ← 次に選択
            `;
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
        
        // 2点間の位置関係を計算して画像を配置
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
            <div style="font-size: 18px; font-weight: bold; color: #28a745; margin-bottom: 15px;">
                🎉 画像の位置合わせが完了しました！
            </div>
            <div style="font-size: 14px; margin-bottom: 15px; color: #155724;">
                2つの交差点の位置関係を基に画像が自動配置されました。<br>
                地図上をクリックしてピンを配置できます。
            </div>
            <div style="background: #e3f2fd; padding: 12px; border-radius: 4px; font-size: 13px;">
                💡 <strong>微調整:</strong> 右上のコントロールで回転・サイズ・透明度を調整<br>
                💡 <strong>再配置:</strong> 「選択をリセット」で最初からやり直し
            </div>
        `;
        info.style.backgroundColor = '#d4edda';
        info.style.color = '#155724';
    }
    
    calculateAndApplyTransform() {
        // 画像上の2点
        const img1 = this.imagePoints[0];
        const img2 = this.imagePoints[1];
        
        // 地図上の2点
        const map1 = this.mapPoints[0];
        const map2 = this.mapPoints[1];
        
        // 画像上の2点を実際の画像座標に変換
        const realImg1 = {
            x: img1.x / this.imageScale.x,
            y: img1.y / this.imageScale.y
        };
        const realImg2 = {
            x: img2.x / this.imageScale.x,
            y: img2.y / this.imageScale.y
        };
        
        // 画像上の2点間の距離とベクトル
        const imgDx = realImg2.x - realImg1.x;
        const imgDy = realImg2.y - realImg1.y;
        const imgDistance = Math.sqrt(imgDx * imgDx + imgDy * imgDy);
        
        // 地図上の2点間の距離（メートル）
        const mapDistance = map1.distanceTo(map2);
        
        // スケール計算（メートル/ピクセル）
        const scale = mapDistance / imgDistance;
        
        // 画像の中心点を計算
        const imgCenterX = (realImg1.x + realImg2.x) / 2;
        const imgCenterY = (realImg1.y + realImg2.y) / 2;
        
        // 地図上の中心点を計算
        const mapCenterLat = (map1.lat + map2.lat) / 2;
        const mapCenterLng = (map1.lng + map2.lng) / 2;
        
        // 画像のサイズを地図座標系での範囲に変換
        const imgWidth = this.imageData.width;
        const imgHeight = this.imageData.height;
        
        // 地図上での画像の境界を計算
        const halfWidthInMeters = (imgWidth * scale) / 2;
        const halfHeightInMeters = (imgHeight * scale) / 2;
        
        // 緯度経度への変換（概算）
        const latPerMeter = 1 / 111320; // 1メートル当たりの緯度
        const lngPerMeter = 1 / (111320 * Math.cos(mapCenterLat * Math.PI / 180)); // 1メートル当たりの経度
        
        const bounds = L.latLngBounds(
            [mapCenterLat - halfHeightInMeters * latPerMeter, mapCenterLng - halfWidthInMeters * lngPerMeter],
            [mapCenterLat + halfHeightInMeters * latPerMeter, mapCenterLng + halfWidthInMeters * lngPerMeter]
        );
        
        // 画像オーバーレイを作成
        this.overlayLayer = L.imageOverlay(this.imageData.url, bounds, {
            opacity: 0.6,
            interactive: false
        }).addTo(this.map);
        
        // 地図をフィット
        this.map.fitBounds(bounds, { padding: [50, 50] });
        
        // 基準点マーカーを小さく表示（参考用）
        this.mapPoints.forEach((latlng, index) => {
            const colors = ['#e74c3c', '#3498db'];
            L.circleMarker(latlng, {
                color: colors[index],
                fillColor: colors[index],
                fillOpacity: 0.7,
                radius: 6
            }).addTo(this.map);
        });
    }
    
    toggleImageVisibility(visible) {
        if (this.overlayLayer) {
            if (visible) {
                this.overlayLayer.setOpacity(parseFloat(document.getElementById('imageOpacity').value));
            } else {
                this.overlayLayer.setOpacity(0);
            }
        }
    }
    
    setImageOpacity(opacity) {
        if (this.overlayLayer && document.getElementById('imageVisibleToggle').checked) {
            this.overlayLayer.setOpacity(opacity);
        }
    }
    
    rotateImage(degrees) {
        if (this.overlayLayer) {
            const element = this.overlayLayer.getElement();
            if (element) {
                element.style.transform = `rotate(${degrees}deg) scale(${document.getElementById('imageScale').value})`;
            }
        }
    }
    
    scaleImage(scale) {
        if (this.overlayLayer) {
            const element = this.overlayLayer.getElement();
            if (element) {
                const rotation = document.getElementById('imageRotation').value;
                element.style.transform = `rotate(${rotation}deg) scale(${scale})`;
            }
        }
    }
    
    resetAdjustments() {
        document.getElementById('imageOpacity').value = 0.6;
        document.getElementById('imageRotation').value = 0;
        document.getElementById('imageScale').value = 1;
        document.getElementById('rotationValue').textContent = '0°';
        document.getElementById('scaleValue').textContent = '100%';
        
        if (this.overlayLayer) {
            this.overlayLayer.setOpacity(0.6);
            const element = this.overlayLayer.getElement();
            if (element) {
                element.style.transform = 'rotate(0deg) scale(1)';
            }
        }
    }
    
    showOriginalImage() {
        // モーダルで元画像を表示（選択点付き）
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
        
        const canvas = document.createElement('canvas');
        canvas.width = this.imageData.width;
        canvas.height = this.imageData.height;
        canvas.style.cssText = `
            max-width: 95%;
            max-height: 95%;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;
        
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0);
            
            // 選択点を描画
            const colors = ['#e74c3c', '#3498db'];
            this.imagePoints.forEach((point, index) => {
                const x = point.x / this.imageScale.x;
                const y = point.y / this.imageScale.y;
                
                ctx.fillStyle = colors[index];
                ctx.beginPath();
                ctx.arc(x, y, 15, 0, 2 * Math.PI);
                ctx.fill();
                
                ctx.fillStyle = 'white';
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText((index + 1).toString(), x, y);
            });
        };
        img.src = this.imageData.url;
        
        const closeBtn = document.createElement('div');
        closeBtn.innerHTML = '✕ 閉じる';
        closeBtn.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(255,255,255,0.9);
            padding: 10px 20px;
            border-radius: 25px;
            cursor: pointer;
            font-weight: bold;
            color: #333;
        `;
        
        modal.appendChild(canvas);
        modal.appendChild(closeBtn);
        
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
        this.applyButton.disabled = true;
        this.applyButton.textContent = '位置合わせを実行';
        
        // 選択を再開
        if (this.imageData) {
            this.startImagePointSelection();
        }
    }
}