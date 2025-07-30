// シンプルなドラッグ&リサイズウィンドウクラス
export class SimpleDragResizeWindow {
    constructor(imageData, onPointClick, onClose) {
        this.imageData = imageData;
        this.onPointClick = onPointClick;
        this.onClose = onClose;
        this.isDragging = false;
        this.isResizing = false;
        this.currentHandle = null;
        this.selectedPoints = []; // 選択された2点を保存
        
        this.createWindow();
    }
    
    createWindow() {
        // メインウィンドウコンテナ
        this.container = document.createElement('div');
        this.container.id = 'imageWindow';
        this.container.style.cssText = `
            position: fixed;
            left: 50%;
            top: 100px;
            transform: translateX(-50%);
            background: white;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            z-index: 2000;
            overflow: visible;
        `;
        
        // タイトルバー（ドラッグハンドル）
        this.titleBar = document.createElement('div');
        this.titleBar.style.cssText = `
            background: #3498db;
            color: white;
            padding: 6px 12px;
            cursor: move;
            user-select: none;
            border-radius: 8px 8px 0 0;
            display: flex;
            justify-content: flex-end;
            align-items: center;
            height: 30px;
        `;
        this.titleBar.innerHTML = `
            <button id="closeWindow" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 16px; cursor: pointer; padding: 4px 8px; border-radius: 4px;">×</button>
        `;
        
        // 画像エリア
        this.imageArea = document.createElement('div');
        this.imageArea.style.cssText = `
            position: relative;
            padding: 0;
            background: white;
            border-radius: 0 0 8px 8px;
        `;
        
        // キャンバス
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = `
            display: block;
            border: 2px solid #3498db;
            border-radius: 4px;
            cursor: crosshair;
        `;
        
        // DOM構築
        this.imageArea.appendChild(this.canvas);
        this.container.appendChild(this.titleBar);
        this.container.appendChild(this.imageArea);
        document.body.appendChild(this.container);
        
        // 画像を描画
        this.drawImage();
        
        // イベントを設定
        this.setupEvents();
    }
    
    drawImage(useCurrentSize = false) {
        const img = new Image();
        img.onload = () => {
            let width, height;
            
            if (useCurrentSize) {
                // リサイズ時は現在のキャンバスサイズを使用
                width = this.canvas.width;
                height = this.canvas.height;
            } else {
                // 初期表示時は適切なサイズに調整
                const maxSize = 600;
                width = img.width;
                height = img.height;
                
                if (width > maxSize || height > maxSize) {
                    const ratio = Math.min(maxSize / width, maxSize / height);
                    width *= ratio;
                    height *= ratio;
                }
                
                this.canvas.width = width;
                this.canvas.height = height;
            }
            
            const ctx = this.canvas.getContext('2d');
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            // 参考線を描画
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            
            // 左上の角
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(40, 0);
            ctx.moveTo(0, 0);
            ctx.lineTo(0, 40);
            ctx.stroke();
            
            // 右下の角
            ctx.beginPath();
            ctx.moveTo(width - 40, height);
            ctx.lineTo(width, height);
            ctx.moveTo(width, height - 40);
            ctx.lineTo(width, height);
            ctx.stroke();
            
            // ラベル表示を削除
            
            // リサイズハンドルは削除
        };
        img.src = this.imageData.url;
    }
    
    // createResizeHandlesメソッドは削除（4隅のマウスカーソル変更で対応）
    
    // 4隅のリサイズ判定とカーソル変更
    getResizePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cornerSize = 20; // 角の判定エリアサイズ
        
        // 左上
        if (x <= cornerSize && y <= cornerSize) {
            return 'nw';
        }
        // 右上
        if (x >= rect.width - cornerSize && y <= cornerSize) {
            return 'ne';
        }
        // 右下
        if (x >= rect.width - cornerSize && y >= rect.height - cornerSize) {
            return 'se';
        }
        // 左下
        if (x <= cornerSize && y >= rect.height - cornerSize) {
            return 'sw';
        }
        
        return null;
    }
    
    updateCursor(e) {
        const position = this.getResizePosition(e);
        const cursors = {
            'nw': 'nw-resize',
            'ne': 'ne-resize',
            'se': 'se-resize',
            'sw': 'sw-resize'
        };
        
        if (position) {
            this.canvas.style.cursor = cursors[position];
        } else {
            this.canvas.style.cursor = 'crosshair';
        }
    }
    
    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // キャンバス座標を画像座標に変換
        const imageX = (x / this.canvas.width) * this.imageData.width;
        const imageY = (y / this.canvas.height) * this.imageData.height;
        
        const clickedPoint = { x: imageX, y: imageY, canvasX: x, canvasY: y };
        
        // 既存の点をクリックした場合はドラッグ開始
        const tolerance = 15; // クリック判定の許容範囲
        for (let i = 0; i < this.selectedPoints.length; i++) {
            const point = this.selectedPoints[i];
            const distance = Math.sqrt(
                Math.pow(point.canvasX - x, 2) + Math.pow(point.canvasY - y, 2)
            );
            
            if (distance <= tolerance) {
                // ドラッグを開始
                this.startPointDrag(i, e);
                return;
            }
        }
        
        // 新しい点を追加（最大2点）
        if (this.selectedPoints.length < 2) {
            this.selectedPoints.push(clickedPoint);
            this.redrawWithPoints();
            
            if (this.onPointClick) {
                this.onPointClick({ 
                    type: 'pointAdded', 
                    point: clickedPoint, 
                    points: this.selectedPoints 
                });
            }
        }
    }
    
    startPointDrag(pointIndex, e) {
        this.isDraggingPoint = true;
        this.draggedPointIndex = pointIndex;
        this.canvas.style.cursor = 'move';
        
        // マウス移動とマウスアップのイベントリスナーを追加
        const handleMouseMove = (e) => {
            if (!this.isDraggingPoint) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const x = Math.max(0, Math.min(this.canvas.width, e.clientX - rect.left));
            const y = Math.max(0, Math.min(this.canvas.height, e.clientY - rect.top));
            
            // 画像座標に変換
            const imageX = (x / this.canvas.width) * this.imageData.width;
            const imageY = (y / this.canvas.height) * this.imageData.height;
            
            // 点の位置を更新
            this.selectedPoints[this.draggedPointIndex] = {
                x: imageX,
                y: imageY,
                canvasX: x,
                canvasY: y
            };
            
            this.redrawWithPoints();
            
            // 点の位置が変更されたことを通知
            if (this.onPointClick) {
                this.onPointClick({
                    type: 'pointMoved',
                    index: this.draggedPointIndex,
                    points: this.selectedPoints
                });
            }
        };
        
        const handleMouseUp = () => {
            this.isDraggingPoint = false;
            this.draggedPointIndex = null;
            this.canvas.style.cursor = 'crosshair';
            
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }
    
    redrawWithPoints() {
        // 画像を再描画してから点を追加
        const img = new Image();
        img.onload = () => {
            const ctx = this.canvas.getContext('2d');
            const width = this.canvas.width;
            const height = this.canvas.height;
            
            // 画像をクリアして再描画
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            // 参考線を描画
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            
            // 左上の角
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(40, 0);
            ctx.moveTo(0, 0);
            ctx.lineTo(0, 40);
            ctx.stroke();
            
            // 右下の角
            ctx.beginPath();
            ctx.moveTo(width - 40, height);
            ctx.lineTo(width, height);
            ctx.moveTo(width, height - 40);
            ctx.lineTo(width, height);
            ctx.stroke();
            
            // ラベル表示を削除
            
            // 選択された点を描画
            ctx.setLineDash([]); // 線のスタイルをリセット
            this.selectedPoints.forEach((point, index) => {
                ctx.fillStyle = index === 0 ? '#27ae60' : '#e74c3c';
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 3;
                
                ctx.beginPath();
                ctx.arc(point.canvasX, point.canvasY, 12, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                
                // 番号を表示
                ctx.fillStyle = 'white';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText((index + 1).toString(), point.canvasX, point.canvasY + 4);
            });
        };
        img.src = this.imageData.url;
    }
    
    clearPoints() {
        this.selectedPoints = [];
        this.redrawWithPoints();
    }
    
    getSelectedPoints() {
        return this.selectedPoints;
    }
    
    setupEvents() {
        // ドラッグイベント
        // ×ボタン専用のクリックイベント
        const closeButton = this.titleBar.querySelector('#closeWindow');
        if (closeButton) {
            closeButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Close button clicked');
                
                // onCloseコールバックを呼び出し（これが削除処理を実行）
                if (this.onClose) {
                    this.onClose();
                }
            });
        }
        
        // タイトルバーのドラッグイベント（×ボタン以外）
        this.titleBar.addEventListener('mousedown', (e) => {
            if (e.target.id === 'closeWindow') {
                // ×ボタンの場合は何もしない（上で処理済み）
                return;
            }
            
            this.startDrag(e);
        });
        
        // キャンバスのマウスイベント
        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isDragging && !this.isResizing) {
                this.updateCursor(e);
            }
        });
        
        this.canvas.addEventListener('mousedown', (e) => {
            if (!this.isDragging) {
                const resizePosition = this.getResizePosition(e);
                if (resizePosition) {
                    this.startResize(e, resizePosition);
                } else {
                    this.handleCanvasClick(e);
                }
            }
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            if (!this.isDragging && !this.isResizing) {
                this.canvas.style.cursor = 'crosshair';
            }
        });
        
        // グローバルマウスイベント
        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.doDrag(e);
            } else if (this.isResizing) {
                this.doResize(e);
            }
        });
        
        document.addEventListener('mouseup', () => {
            this.stopDrag();
            this.stopResize();
        });
    }
    
    startDrag(e) {
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        
        const rect = this.container.getBoundingClientRect();
        this.dragStartLeft = rect.left;
        this.dragStartTop = rect.top;
        
        this.titleBar.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
    }
    
    doDrag(e) {
        const deltaX = e.clientX - this.dragStartX;
        const deltaY = e.clientY - this.dragStartY;
        
        this.container.style.left = (this.dragStartLeft + deltaX) + 'px';
        this.container.style.top = (this.dragStartTop + deltaY) + 'px';
        this.container.style.transform = 'none';
    }
    
    stopDrag() {
        if (this.isDragging) {
            this.isDragging = false;
            this.titleBar.style.cursor = 'move';
            document.body.style.userSelect = '';
        }
    }
    
    startResize(e, position) {
        this.isResizing = true;
        this.currentHandle = position;
        this.resizeStartX = e.clientX;
        this.resizeStartY = e.clientY;
        this.resizeStartWidth = this.canvas.width;
        this.resizeStartHeight = this.canvas.height;
        
        document.body.style.userSelect = 'none';
        e.preventDefault();
        e.stopPropagation();
    }
    
    doResize(e) {
        const deltaX = e.clientX - this.resizeStartX;
        const deltaY = e.clientY - this.resizeStartY;
        
        let newWidth = this.resizeStartWidth;
        let newHeight = this.resizeStartHeight;
        
        switch(this.currentHandle) {
            case 'se':
                newWidth = this.resizeStartWidth + deltaX;
                newHeight = this.resizeStartHeight + deltaY;
                break;
            case 'sw':
                newWidth = this.resizeStartWidth - deltaX;
                newHeight = this.resizeStartHeight + deltaY;
                break;
            case 'ne':
                newWidth = this.resizeStartWidth + deltaX;
                newHeight = this.resizeStartHeight - deltaY;
                break;
            case 'nw':
                newWidth = this.resizeStartWidth - deltaX;
                newHeight = this.resizeStartHeight - deltaY;
                break;
        }
        
        // サイズ制限
        newWidth = Math.max(200, Math.min(1200, newWidth));
        
        // アスペクト比維持
        if (this.imageData) {
            const aspectRatio = this.imageData.width / this.imageData.height;
            newHeight = newWidth / aspectRatio;
        }
        
        // サイズ制限（高さも）
        newHeight = Math.max(150, Math.min(900, newHeight));
        
        console.log(`Resizing to: ${newWidth}x${newHeight}`);
        
        // キャンバスサイズの更新
        this.canvas.width = newWidth;
        this.canvas.height = newHeight;
        
        // 即座に再描画
        this.redrawCanvas(newWidth, newHeight);
    }
    
    redrawCanvas(width, height) {
        const img = new Image();
        img.onload = () => {
            const ctx = this.canvas.getContext('2d');
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            // 参考線を描画
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            
            // 左上の角
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(40, 0);
            ctx.moveTo(0, 0);
            ctx.lineTo(0, 40);
            ctx.stroke();
            
            // 右下の角
            ctx.beginPath();
            ctx.moveTo(width - 40, height);
            ctx.lineTo(width, height);
            ctx.moveTo(width, height - 40);
            ctx.lineTo(width, height);
            ctx.stroke();
            
            // ラベル表示を削除
            
            // 選択された点も再描画（リサイズ後の座標に調整）
            ctx.setLineDash([]); // 線のスタイルをリセット
            this.selectedPoints.forEach((point, index) => {
                // リサイズ後の座標に変換
                const newCanvasX = (point.x / this.imageData.width) * width;
                const newCanvasY = (point.y / this.imageData.height) * height;
                
                // 新しい座標を保存
                point.canvasX = newCanvasX;
                point.canvasY = newCanvasY;
                
                ctx.fillStyle = index === 0 ? '#27ae60' : '#e74c3c';
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 3;
                
                ctx.beginPath();
                ctx.arc(newCanvasX, newCanvasY, 12, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                
                // 番号を表示
                ctx.fillStyle = 'white';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText((index + 1).toString(), newCanvasX, newCanvasY + 4);
            });
        };
        img.src = this.imageData.url;
    }
    
    stopResize() {
        if (this.isResizing) {
            this.isResizing = false;
            this.currentHandle = null;
            document.body.style.userSelect = '';
        }
    }
    
    // 選択された点を外部から設定する
    setSelectedPoints(points) {
        if (!this.canvas) return;
        
        console.log('Setting selected points:', points);
        this.selectedPoints = points.map(p => ({...p}));
        
        // 選択点を含めて再描画
        this.redrawWithPoints();
    }
    
    close() {
        console.log('SimpleDragResizeWindow close called');
        
        // メインコンテナを削除
        if (this.container && this.container.parentNode) {
            this.container.remove();
            this.container = null;
        }
        
        // イベントリスナーをクリア
        this.isDragging = false;
        this.isResizing = false;
        this.currentHandle = null;
        
        console.log('SimpleDragResizeWindow closed');
    }
}