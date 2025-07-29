// シンプルなドラッグ&リサイズウィンドウクラス
export class SimpleDragResizeWindow {
    constructor(imageData, onPointClick) {
        this.imageData = imageData;
        this.onPointClick = onPointClick;
        this.isDragging = false;
        this.isResizing = false;
        this.currentHandle = null;
        
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
            background: #e74c3c;
            color: white;
            padding: 12px 16px;
            font-size: 14px;
            font-weight: bold;
            cursor: move;
            user-select: none;
            border-radius: 8px 8px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        this.titleBar.innerHTML = `
            <span>📷 このバーをドラッグして移動・4隅の青い丸でリサイズ</span>
            <button id="closeWindow" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 16px; cursor: pointer; padding: 4px 8px; border-radius: 4px;">×</button>
        `;
        
        // 画像エリア
        this.imageArea = document.createElement('div');
        this.imageArea.style.cssText = `
            position: relative;
            padding: 15px;
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
        
        // リサイズハンドルを作成
        this.createResizeHandles();
        
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
                const maxSize = 400;
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
            
            // ラベル
            ctx.fillStyle = '#e74c3c';
            ctx.font = 'bold 12px Arial';
            ctx.fillText('1.左上', 5, 15);
            ctx.fillText('2.右下', width - 45, height - 5);
            
            // リサイズハンドルの位置を更新
            this.updateResizeHandles();
        };
        img.src = this.imageData.url;
    }
    
    createResizeHandles() {
        this.handles = [];
        const positions = ['nw', 'ne', 'se', 'sw'];
        const cursors = {
            'nw': 'nw-resize',
            'ne': 'ne-resize', 
            'se': 'se-resize',
            'sw': 'sw-resize'
        };
        
        positions.forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `resize-handle-${pos}`;
            handle.style.cssText = `
                position: absolute;
                width: 20px;
                height: 20px;
                background: #3498db;
                border: 3px solid white;
                border-radius: 50%;
                cursor: ${cursors[pos]};
                z-index: 10;
                box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                transition: transform 0.2s ease;
            `;
            
            // ホバー効果
            handle.addEventListener('mouseenter', () => {
                handle.style.transform = 'scale(1.2)';
                handle.style.background = '#2980b9';
            });
            
            handle.addEventListener('mouseleave', () => {
                handle.style.transform = 'scale(1)';
                handle.style.background = '#3498db';
            });
            
            // リサイズイベント
            handle.addEventListener('mousedown', (e) => {
                this.startResize(e, pos);
            });
            
            this.imageArea.appendChild(handle);
            this.handles.push({element: handle, position: pos});
        });
    }
    
    updateResizeHandles() {
        if (!this.handles) return;
        
        const canvasRect = this.canvas.getBoundingClientRect();
        const containerRect = this.imageArea.getBoundingClientRect();
        
        this.handles.forEach(handle => {
            const pos = handle.position;
            const element = handle.element;
            
            let left, top;
            
            switch(pos) {
                case 'nw': // 左上
                    left = canvasRect.left - containerRect.left - 10;
                    top = canvasRect.top - containerRect.top - 10;
                    break;
                case 'ne': // 右上
                    left = canvasRect.right - containerRect.left - 10;
                    top = canvasRect.top - containerRect.top - 10;
                    break;
                case 'se': // 右下
                    left = canvasRect.right - containerRect.left - 10;
                    top = canvasRect.bottom - containerRect.top - 10;
                    break;
                case 'sw': // 左下
                    left = canvasRect.left - containerRect.left - 10;
                    top = canvasRect.bottom - containerRect.top - 10;
                    break;
            }
            
            element.style.left = left + 'px';
            element.style.top = top + 'px';
        });
    }
    
    setupEvents() {
        // ドラッグイベント
        this.titleBar.addEventListener('mousedown', (e) => {
            if (e.target.id === 'closeWindow') {
                this.close();
                return;
            }
            
            this.startDrag(e);
        });
        
        // キャンバスクリックイベント
        this.canvas.addEventListener('click', (e) => {
            if (!this.isDragging && !this.isResizing && this.onPointClick) {
                this.onPointClick(e);
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
        newWidth = Math.max(200, Math.min(800, newWidth));
        
        // アスペクト比維持
        if (this.imageData) {
            const aspectRatio = this.imageData.width / this.imageData.height;
            newHeight = newWidth / aspectRatio;
        }
        
        // サイズ制限（高さも）
        newHeight = Math.max(150, Math.min(600, newHeight));
        
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
            
            // ラベル
            ctx.fillStyle = '#e74c3c';
            ctx.font = 'bold 12px Arial';
            ctx.fillText('1.左上', 5, 15);
            ctx.fillText('2.右下', width - 45, height - 5);
            
            // ハンドル位置を更新
            setTimeout(() => this.updateResizeHandles(), 10);
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
    
    close() {
        if (this.container) {
            this.container.remove();
        }
    }
}