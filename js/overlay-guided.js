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
        
        // 対応する地名の情報（美唄市の例）
        this.landmarks = [
            {
                name: "左上角",
                description: "東3条北3丁目付近",
                searchQuery: "美唄市東3条北3丁目",
                imageHint: "1番: 画像の左上の角付近をクリック"
            },
            {
                name: "右上角", 
                description: "東5条北3丁目付近",
                searchQuery: "美唄市東5条北3丁目",
                imageHint: "2番: 画像の右上の角付近をクリック"
            },
            {
                name: "右下角",
                description: "東5条南3丁目付近", 
                searchQuery: "美唄市東5条南3丁目",
                imageHint: "3番: 画像の右下の角付近をクリック"
            },
            {
                name: "左下角",
                description: "東3条南3丁目付近",
                searchQuery: "美唄市東3条南3丁目", 
                imageHint: "4番: 画像の左下の角付近をクリック"
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
            
            // 選択ガイドを表示
            this.showCurrentPointGuide();
        };
        img.src = this.imageData.url;
    }
    
    showCurrentPointGuide() {
        const info = this.overlaySection.querySelector('.info');
        const landmark = this.landmarks[this.currentPointIndex];
        
        info.innerHTML = `
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">
                ${landmark.imageHint}
            </div>
            <div style="font-size: 14px;">
                この点は後で地図上の「${landmark.description}」に対応します
            </div>
        `;
        info.style.backgroundColor = '#e8f5e8';
        info.style.color = '#2d5a2d';
        
        // キャンバス上に選択すべき大体の場所を示すヒント円を描画
        this.drawLocationHint();
    }
    
    drawLocationHint() {
        const canvas = this.imageCanvas;
        const ctx = this.ctx;
        
        // 前回の画像を再描画
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // ヒント円を描画
            const hintPositions = [
                { x: canvas.width * 0.15, y: canvas.height * 0.15 }, // 左上
                { x: canvas.width * 0.85, y: canvas.height * 0.15 }, // 右上  
                { x: canvas.width * 0.85, y: canvas.height * 0.85 }, // 右下
                { x: canvas.width * 0.15, y: canvas.height * 0.85 }  // 左下
            ];
            
            const pos = hintPositions[this.currentPointIndex];
            
            // 点滅するヒント円
            let opacity = 0.3;
            const animate = () => {
                ctx.save();
                ctx.globalAlpha = opacity;
                ctx.strokeStyle = '#e74c3c';
                ctx.lineWidth = 4;
                ctx.setLineDash([10, 5]);
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 30, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.restore();
                
                opacity = opacity === 0.3 ? 0.8 : 0.3;
                setTimeout(animate, 800);
            };
            animate();
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
        this.ctx.arc(x, y, 10, 0, 2 * Math.PI);
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
            this.showCurrentPointGuide();
        }
    }
    
    startMapPointSelection() {
        const info = this.overlaySection.querySelector('.info');
        const landmark = this.landmarks[this.mapPoints.length];
        
        info.innerHTML = `
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">
                地図上で「${landmark.description}」をクリック
            </div>
            <div style="font-size: 14px;">
                検索: ${landmark.searchQuery}<br>
                または地図を見て大体の位置をクリック
            </div>
            <div style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 4px;">
                💡 ヒント: ${this.getLocationHint(this.mapPoints.length)}
            </div>
        `;
        info.style.backgroundColor = '#fff3cd';
        info.style.color = '#856404';
    }
    
    getLocationHint(pointIndex) {
        const hints = [
            "東3条と東4条の境界線付近、北側のエリア",
            "東5条付近の北側のエリア", 
            "東5条付近の南側のエリア",
            "東3条と東4条の境界線付近、南側のエリア"
        ];
        return hints[pointIndex];
    }
    
    addMapPoint(event) {
        const latlng = event.latlng;
        this.mapPoints.push(latlng);
        
        const landmark = this.landmarks[this.mapPoints.length - 1];
        
        // マーカーを追加
        const marker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'selection-marker',
                html: `<div style="background-color: #e74c3c; color: white; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3); white-space: nowrap;">${this.mapPoints.length}: ${landmark.name}</div>`,
                iconSize: [80, 30]
            })
        }).addTo(this.map);
        
        this.mapMarkers.push(marker);
        this.updatePointsDisplay();
        
        if (this.mapPoints.length === 4) {
            this.applyButton.disabled = false;
            const info = this.overlaySection.querySelector('.info');
            info.innerHTML = `
                <div style="font-size: 16px; font-weight: bold; color: #28a745;">
                    ✅ 4点の選択が完了しました！
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
            const landmark = this.landmarks[index];
            const div = document.createElement('div');
            div.className = 'point-item';
            div.innerHTML = `
                <span class="point-number" style="background-color: #e74c3c;">${index + 1}</span> 
                ${landmark.name} - 選択済み
            `;
            this.imagePointsDiv.appendChild(div);
        });
        
        if (this.imagePoints.length < 4) {
            const landmark = this.landmarks[this.imagePoints.length];
            const div = document.createElement('div');
            div.className = 'point-item';
            div.style.color = '#999';
            div.innerHTML = `
                <span class="point-number" style="background-color: #ccc;">${this.imagePoints.length + 1}</span> 
                ${landmark.name} - 未選択
            `;
            this.imagePointsDiv.appendChild(div);
        }
        
        // 地図ポイントの表示更新
        this.mapPointsDiv.innerHTML = '';
        this.mapPoints.forEach((point, index) => {
            const landmark = this.landmarks[index];
            const div = document.createElement('div');
            div.className = 'point-item';
            div.innerHTML = `
                <span class="point-number" style="background-color: #e74c3c;">${index + 1}</span> 
                ${landmark.description} - 選択済み
            `;
            this.mapPointsDiv.appendChild(div);
        });
        
        if (this.mapPoints.length < 4 && this.imagePoints.length === 4) {
            const landmark = this.landmarks[this.mapPoints.length];
            const div = document.createElement('div');
            div.className = 'point-item';
            div.style.color = '#999';
            div.innerHTML = `
                <span class="point-number" style="background-color: #ccc;">${this.mapPoints.length + 1}</span> 
                ${landmark.description} - 未選択
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
                🎉 画像の配置が完了しました！
            </div>
            <div style="font-size: 14px; margin-top: 10px;">
                地図上をクリックしてピンを配置し、情報を入力してください
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