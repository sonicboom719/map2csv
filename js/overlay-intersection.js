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
        
        // 交差点の情報
        this.intersections = [
            {
                name: "北西交差点",
                description: "左上の十字交差点",
                mapHint: "東3条と横道が交わる北側の交差点",
                imageHint: "1番: 画像左上の道路が十字に交わる点をクリック",
                position: { x: 0.25, y: 0.15 }, // 画像内の相対位置
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
            
            // 全ての交差点にヒント円を表示
            this.drawAllIntersectionHints();
            
            // 選択ガイドを表示
            this.showCurrentIntersectionGuide();
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
            ctx.lineWidth = index === this.currentPointIndex ? 4 : 2;
            ctx.setLineDash(index === this.currentPointIndex ? [5, 5] : [10, 10]);
            ctx.beginPath();
            ctx.arc(x, y, 25, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();
            
            // 番号ラベル
            if (index === this.currentPointIndex) {
                ctx.fillStyle = '#e74c3c';
                ctx.fillRect(x - 15, y - 35, 30, 20);
                ctx.fillStyle = 'white';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText((index + 1).toString(), x, y - 25);
            }
        });
        
        // 現在選択すべき交差点を点滅させる
        this.animateCurrentIntersection();
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
                    this.ctx.arc(point.x, point.y, 12, 0, 2 * Math.PI);
                    this.ctx.fill();
                    
                    this.ctx.fillStyle = 'white';
                    this.ctx.font = 'bold 14px Arial';
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
                    this.ctx.lineWidth = 6;
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, 30, 0, 2 * Math.PI);
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
            <div style="font-size: 13px; color: #666;">
                道路の白い線が十字に交わる点を探してください
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
        this.ctx.arc(x, y, 12, 0, 2 * Math.PI);
        this.ctx.fill();
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText((this.imagePoints.length).toString(), x, y);
        
        this.currentPointIndex++;
        this.updatePointsDisplay();
        
        if (this.imagePoints.length === 4) {
            this.isSelectingImagePoints = false;
            this.imageCanvas.style.display = 'none';
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
                💡 <strong>探し方:</strong> 地図上で道路が十字に交わる交差点を探し、そこをクリックしてください
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
            `;
            info.style.backgroundColor = '#d4edda';
            info.style.color = '#155724';
        } else {
            this.startMapPointSelection();
        }
    }
    
    updatePointsDisplay() {
        // 画像ポイントの表示更新
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
            
            // 残りの交差点も表示
            for (let i = this.imagePoints.length + 1; i < 4; i++) {
                const futureIntersection = this.intersections[i];
                const futureDiv = document.createElement('div');
                futureDiv.className = 'point-item';
                futureDiv.style.color = '#999';
                futureDiv.innerHTML = `
                    <span class="point-number" style="background-color: #ccc;">${i + 1}</span> 
                    ${futureIntersection.name} - 未選択
                `;
                this.imagePointsDiv.appendChild(futureDiv);
            }
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
            
            // 残りの交差点も表示
            for (let i = this.mapPoints.length + 1; i < 4; i++) {
                const futureIntersection = this.intersections[i];
                const futureDiv = document.createElement('div');
                futureDiv.className = 'point-item';
                futureDiv.style.color = '#999';
                futureDiv.innerHTML = `
                    <span class="point-number" style="background-color: #ccc;">${i + 1}</span> 
                    ${futureIntersection.name} - 未選択
                `;
                this.mapPointsDiv.appendChild(futureDiv);
            }
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
        this.overlayLayer = L.imageOverlay(this.imageData.url, bounds, {
            opacity: 0.7,
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
        
        this.updatePointsDisplay();
        this.applyButton.disabled = true;
        this.applyButton.textContent = '位置合わせを実行';
        
        // 画像選択を再開
        if (this.imageData) {
            this.startImagePointSelection();
        }
    }
}