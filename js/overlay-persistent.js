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
        this.isSelectingImagePoints = true;
        this.currentPointIndex = 0;
        this.ctx = null;
        this.imageVisible = true;
        
        // 交差点情報
        this.intersections = [
            {
                name: "北西交差点",
                description: "左上の十字交差点",
                mapHint: "東3条と横道が交わる北側の交差点",
                imageHint: "1番: 画像左上の道路が十字に交わる点をクリック",
                position: { x: 0.25, y: 0.15 },
                roadInfo: "東3条 × 横道（北）"
            },
            {
                name: "北東交差点", 
                description: "右上の十字交差点",
                mapHint: "東5条と横道が交わる北側の交差点",
                imageHint: "2番: 画像右上の道路が十字に交わる点をクリック",
                position: { x: 0.88, y: 0.15 },
                roadInfo: "東5条 × 横道（北）"
            },
            {
                name: "南東交差点",
                description: "右下の十字交差点", 
                mapHint: "東5条と横道が交わる南側の交差点",
                imageHint: "3番: 画像右下の道路が十字に交わる点をクリック",
                position: { x: 0.88, y: 0.85 },
                roadInfo: "東5条 × 横道（南）"
            },
            {
                name: "南西交差点",
                description: "左下の十字交差点",
                mapHint: "東3条と横道が交わる南側の交差点", 
                imageHint: "4番: 画像左下の道路が十字に交わる点をクリック",
                position: { x: 0.25, y: 0.85 },
                roadInfo: "東3条 × 横道（南）"
            }
        ];
        
        this.setupEventHandlers();
        this.createImageControlPanel();
    }
    
    createImageControlPanel() {
        // 画像表示コントロールパネルを作成
        const controlDiv = document.createElement('div');
        controlDiv.id = 'imageControls';
        controlDiv.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: white;
            padding: 10px;
            border-radius: 5px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            z-index: 1000;
            display: none;
        `;
        
        controlDiv.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold; font-size: 14px;">📷 画像表示コントロール</div>
            <div style="margin-bottom: 8px;">
                <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" id="imageVisibleToggle" checked style="margin-right: 8px;">
                    画像を表示
                </label>
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: block; font-size: 12px; margin-bottom: 4px;">透明度:</label>
                <input type="range" id="imageOpacity" min="0.1" max="1" step="0.1" value="0.7" 
                       style="width: 100%;">
                <div style="font-size: 11px; color: #666; text-align: center;">
                    <span style="float: left;">透明</span>
                    <span style="float: right;">不透明</span>
                </div>
            </div>
            <div style="margin-top: 10px;">
                <button id="enlargeImageBtn" style="width: 100%; padding: 5px; font-size: 12px; background: #3498db; color: white; border: none; border-radius: 3px; cursor: pointer;">
                    画像を拡大表示
                </button>
            </div>
        `;
        
        document.querySelector('.map-container').appendChild(controlDiv);
        
        // イベントリスナーを追加
        document.getElementById('imageVisibleToggle').addEventListener('change', (e) => {
            this.toggleImageVisibility(e.target.checked);
        });
        
        document.getElementById('imageOpacity').addEventListener('input', (e) => {
            this.setImageOpacity(parseFloat(e.target.value));
        });
        
        document.getElementById('enlargeImageBtn').addEventListener('click', () => {
            this.showEnlargedImage();
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
            if (this.isSelectingImagePoints && this.imagePoints.length < 4) {
                this.addImagePoint(e);
            }
        });
        
        // 地図のクリックイベント
        this.map.on('click', (e) => {
            if (!this.isSelectingImagePoints && this.mapPoints.length < 4) {
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
        this.currentPointIndex = 0;
        
        // コントロールパネルを表示
        document.getElementById('imageControls').style.display = 'block';
        
        // 画像をキャンバスに描画（サイドバーに小さく表示）
        this.setupImageCanvas();
        
        // 選択ガイドを表示
        this.showCurrentIntersectionGuide();
    }
    
    setupImageCanvas() {
        const img = new Image();
        img.onload = () => {
            // キャンバスのサイズを設定（サイドバー用に小さく）
            const maxSize = 300;
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
            this.imageCanvas.style.opacity = '0.9';
            
            this.ctx = this.imageCanvas.getContext('2d');
            this.ctx.drawImage(img, 0, 0, width, height);
            
            // 画像とキャンバスのサイズ比を保存
            this.imageScale = {
                x: width / img.width,
                y: height / img.height
            };
            
            // 全ての交差点にヒント円を表示
            this.drawAllIntersectionHints();
            this.animateCurrentIntersection();
        };
        img.src = this.imageData.url;
    }
    
    drawAllIntersectionHints() {
        const canvas = this.imageCanvas;
        const ctx = this.ctx;
        
        // 全ての交差点位置にヒント円を描画
        this.intersections.forEach((intersection, index) => {
            const x = canvas.width * intersection.position.x;
            const y = canvas.height * intersection.position.y;
            
            // 薄い円（まだ選択されていない交差点）
            ctx.save();
            ctx.globalAlpha = index === this.currentPointIndex ? 0.8 : 0.3;
            ctx.strokeStyle = index === this.currentPointIndex ? '#e74c3c' : '#95a5a6';
            ctx.lineWidth = index === this.currentPointIndex ? 3 : 2;
            ctx.setLineDash(index === this.currentPointIndex ? [5, 5] : [10, 10]);
            ctx.beginPath();
            ctx.arc(x, y, 20, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();
            
            // 番号ラベル
            ctx.fillStyle = index < this.imagePoints.length ? '#28a745' : (index === this.currentPointIndex ? '#e74c3c' : '#95a5a6');
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((index + 1).toString(), x, y);
        });
    }
    
    animateCurrentIntersection() {
        if (this.currentPointIndex >= 4) return;
        
        const intersection = this.intersections[this.currentPointIndex];
        const x = this.imageCanvas.width * intersection.position.x;
        const y = this.imageCanvas.height * intersection.position.y;
        
        let opacity = 0.3;
        const animate = () => {
            if (this.currentPointIndex >= this.intersections.length) return;
            
            // 元の画像を再描画
            const img = new Image();
            img.onload = () => {
                this.ctx.clearRect(0, 0, this.imageCanvas.width, this.imageCanvas.height);
                this.ctx.drawImage(img, 0, 0, this.imageCanvas.width, this.imageCanvas.height);
                
                // 既に選択された点を描画
                this.imagePoints.forEach((point, index) => {
                    this.ctx.fillStyle = '#28a745';
                    this.ctx.beginPath();
                    this.ctx.arc(point.x, point.y, 10, 0, 2 * Math.PI);
                    this.ctx.fill();
                    
                    this.ctx.fillStyle = 'white';
                    this.ctx.font = 'bold 12px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText((index + 1).toString(), point.x, point.y);
                });
                
                // 全てのヒント円を再描画
                this.drawAllIntersectionHints();
                
                // 現在の交差点を点滅
                if (this.currentPointIndex < 4) {
                    this.ctx.save();
                    this.ctx.globalAlpha = opacity;
                    this.ctx.strokeStyle = '#e74c3c';
                    this.ctx.lineWidth = 4;
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, 25, 0, 2 * Math.PI);
                    this.ctx.stroke();
                    this.ctx.restore();
                    
                    opacity = opacity === 0.3 ? 0.9 : 0.3;
                    setTimeout(animate, 800);
                }
            };
            img.src = this.imageData.url;
        };
        animate();
    }
    
    showCurrentIntersectionGuide() {
        if (this.currentPointIndex >= 4) return;
        
        const intersection = this.intersections[this.currentPointIndex];
        const info = this.overlaySection.querySelector('.info');
        
        info.innerHTML = `
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #e74c3c;">
                🚦 ${intersection.imageHint}
            </div>
            <div style="font-size: 14px; margin-bottom: 8px;">
                <strong>目印:</strong> ${intersection.description}
            </div>
            <div style="font-size: 13px; color: #666; margin-bottom: 10px;">
                左の画像で道路の白い線が十字に交わる点を探してください
            </div>
            <div style="background: #e8f5e8; padding: 8px; border-radius: 4px; font-size: 12px;">
                💡 画像が小さい場合は「画像を拡大表示」ボタンで大きく表示できます
            </div>
        `;
        info.style.backgroundColor = '#fff3cd';
        info.style.color = '#856404';
    }
    
    addImagePoint(event) {
        const rect = this.imageCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        this.imagePoints.push({ x, y });
        
        // ポイントを描画（緑色で選択完了を示す）
        this.ctx.fillStyle = '#28a745';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 10, 0, 2 * Math.PI);
        this.ctx.fill();
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText((this.imagePoints.length).toString(), x, y);
        
        this.currentPointIndex++;
        this.updatePointsDisplay();
        
        if (this.imagePoints.length === 4) {
            this.isSelectingImagePoints = false;
            // 画像は消さずに、地図選択に移行
            this.startMapPointSelection();
        } else {
            this.showCurrentIntersectionGuide();
            this.animateCurrentIntersection();
        }
    }
    
    startMapPointSelection() {
        const intersection = this.intersections[this.mapPoints.length];
        const info = this.overlaySection.querySelector('.info');
        
        info.innerHTML = `
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #3498db;">
                🗺️ 地図上で「${intersection.name}」をクリック
            </div>
            <div style="font-size: 14px; margin-bottom: 8px;">
                <strong>場所:</strong> ${intersection.mapHint}
            </div>
            <div style="font-size: 13px; margin-bottom: 8px;">
                <strong>道路:</strong> ${intersection.roadInfo}
            </div>
            <div style="margin-top: 10px; padding: 10px; background: #e8f5e8; border-radius: 4px; font-size: 13px;">
                💡 <strong>確認方法:</strong> 左の画像で選択した${this.mapPoints.length + 1}番の交差点に対応する地図上の交差点をクリック
            </div>
        `;
        info.style.backgroundColor = '#e3f2fd';
        info.style.color = '#1976d2';
    }
    
    addMapPoint(event) {
        const latlng = event.latlng;
        this.mapPoints.push(latlng);
        
        const intersection = this.intersections[this.mapPoints.length - 1];
        
        // マーカーを追加
        const marker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'intersection-marker',
                html: `<div style="background-color: #e74c3c; color: white; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3); white-space: nowrap;">🚦 ${this.mapPoints.length}: ${intersection.name}</div>`,
                iconSize: [120, 30]
            })
        }).addTo(this.map);
        
        this.mapMarkers.push(marker);
        this.updatePointsDisplay();
        
        if (this.mapPoints.length === 4) {
            this.applyButton.disabled = false;
            const info = this.overlaySection.querySelector('.info');
            info.innerHTML = `
                <div style="font-size: 16px; font-weight: bold; color: #28a745;">
                    ✅ 4つの交差点の選択が完了しました！
                </div>
                <div style="font-size: 14px; margin-top: 10px;">
                    「位置合わせを実行」ボタンをクリックして画像を地図に配置してください
                </div>
                <div style="background: #fff3cd; padding: 8px; border-radius: 4px; font-size: 12px; margin-top: 8px;">
                    💡 配置後も画像表示コントロールで透明度を調整できます
                </div>
            `;
            info.style.backgroundColor = '#d4edda';
            info.style.color = '#155724';
        } else {
            this.startMapPointSelection();
        }
    }
    
    toggleImageVisibility(visible) {
        this.imageVisible = visible;
        if (this.overlayLayer) {
            if (visible) {
                this.overlayLayer.setOpacity(parseFloat(document.getElementById('imageOpacity').value));
            } else {
                this.overlayLayer.setOpacity(0);
            }
        }
    }
    
    setImageOpacity(opacity) {
        if (this.overlayLayer && this.imageVisible) {
            this.overlayLayer.setOpacity(opacity);
        }
    }
    
    showEnlargedImage() {
        // モーダルで画像を拡大表示
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        `;
        
        const img = document.createElement('img');
        img.src = this.imageData.url;
        img.style.cssText = `
            max-width: 90%;
            max-height: 90%;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;
        
        const closeBtn = document.createElement('div');
        closeBtn.innerHTML = '✕ 閉じる';
        closeBtn.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            background: white;
            padding: 10px 20px;
            border-radius: 20px;
            cursor: pointer;
            font-weight: bold;
        `;
        
        modal.appendChild(img);
        modal.appendChild(closeBtn);
        
        // 選択済みの点を表示
        if (this.imagePoints.length > 0) {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || this.imageData.width;
            canvas.height = img.naturalHeight || this.imageData.height;
            
            const ctx = canvas.getContext('2d');
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
                
                // 選択済みの点を描画
                this.imagePoints.forEach((point, index) => {
                    const x = (point.x / this.imageScale.x);
                    const y = (point.y / this.imageScale.y);
                    
                    ctx.fillStyle = '#28a745';
                    ctx.beginPath();
                    ctx.arc(x, y, 15, 0, 2 * Math.PI);
                    ctx.fill();
                    
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 20px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText((index + 1).toString(), x, y);
                });
                
                img.src = canvas.toDataURL();
            };
        }
        
        modal.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        document.body.appendChild(modal);
    }
    
    updatePointsDisplay() {
        // 既存の更新ロジックをそのまま使用
        this.imagePointsDiv.innerHTML = '';
        this.imagePoints.forEach((point, index) => {
            const intersection = this.intersections[index];
            const div = document.createElement('div');
            div.className = 'point-item';
            div.innerHTML = `
                <span class="point-number" style="background-color: #28a745;">✓</span> 
                ${intersection.name} - 選択済み
            `;
            this.imagePointsDiv.appendChild(div);
        });
        
        if (this.imagePoints.length < 4) {
            const intersection = this.intersections[this.imagePoints.length];
            const div = document.createElement('div');
            div.className = 'point-item';
            div.style.color = '#e74c3c';
            div.style.fontWeight = 'bold';
            div.innerHTML = `
                <span class="point-number" style="background-color: #e74c3c;">${this.imagePoints.length + 1}</span> 
                ${intersection.name} ← 次に選択
            `;
            this.imagePointsDiv.appendChild(div);
        }
        
        // 地図ポイントの表示更新
        this.mapPointsDiv.innerHTML = '';
        this.mapPoints.forEach((point, index) => {
            const intersection = this.intersections[index];
            const div = document.createElement('div');
            div.className = 'point-item';
            div.innerHTML = `
                <span class="point-number" style="background-color: #28a745;">✓</span> 
                ${intersection.name} - 選択済み
            `;
            this.mapPointsDiv.appendChild(div);
        });
        
        if (this.mapPoints.length < 4 && this.imagePoints.length === 4) {
            const intersection = this.intersections[this.mapPoints.length];
            const div = document.createElement('div');
            div.className = 'point-item';
            div.style.color = '#3498db';
            div.style.fontWeight = 'bold';
            div.innerHTML = `
                <span class="point-number" style="background-color: #3498db;">${this.mapPoints.length + 1}</span> 
                ${intersection.name} ← 次に選択
            `;
            this.mapPointsDiv.appendChild(div);
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
        
        // 境界ボックスを計算
        const lats = this.mapPoints.map(p => p.lat);
        const lngs = this.mapPoints.map(p => p.lng);
        const bounds = L.latLngBounds(
            [Math.min(...lats), Math.min(...lngs)],
            [Math.max(...lats), Math.max(...lngs)]
        );
        
        // 画像オーバーレイを作成
        const opacity = parseFloat(document.getElementById('imageOpacity').value);
        this.overlayLayer = L.imageOverlay(this.imageData.url, bounds, {
            opacity: this.imageVisible ? opacity : 0,
            interactive: false
        }).addTo(this.map);
        
        // 地図を画像の範囲にフィット
        this.map.fitBounds(bounds, { padding: [20, 20] });
        
        // 完了通知
        if (this.onOverlayApplied) {
            this.onOverlayApplied();
        }
        
        // UIの更新
        this.applyButton.disabled = true;
        this.applyButton.textContent = '位置合わせ完了';
        
        const info = this.overlaySection.querySelector('.info');
        info.innerHTML = `
            <div style="font-size: 16px; font-weight: bold; color: #28a745;">
                🎉 交差点を基準にした画像配置が完了しました！
            </div>
            <div style="font-size: 14px; margin-top: 10px;">
                地図上をクリックしてピンを配置し、掲示場情報を入力してください
            </div>
            <div style="background: #e3f2fd; padding: 8px; border-radius: 4px; font-size: 12px; margin-top: 8px;">
                💡 右上のコントロールで画像の表示/非表示と透明度を調整できます
            </div>
        `;
        info.style.backgroundColor = '#d4edda';
        info.style.color = '#155724';
    }
    
    resetPoints() {
        this.imagePoints = [];
        this.mapPoints = [];
        this.currentPointIndex = 0;
        
        // マーカーを削除
        this.mapMarkers.forEach(marker => marker.remove());
        this.mapMarkers = [];
        
        // オーバーレイを削除
        if (this.overlayLayer) {
            this.map.removeLayer(this.overlayLayer);
            this.overlayLayer = null;
        }
        
        // コントロールパネルを非表示
        document.getElementById('imageControls').style.display = 'none';
        
        this.updatePointsDisplay();
        this.applyButton.disabled = true;
        this.applyButton.textContent = '位置合わせを実行';
        
        // 画像選択を再開
        if (this.imageData) {
            this.startImagePointSelection();
        }
    }
}