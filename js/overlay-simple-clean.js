import { SimpleDragResizeWindow } from './simple-drag-resize.js';

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
        this.mapPoints = [];
        this.mapMarkers = [];
        this.overlayLayer = null;
        this.previewRectangle = null;
        this.imageWindow = null;
        
        this.setupEventHandlers();
        this.createControlPanel();
    }
    
    createControlPanel() {
        // 画像表示コントロールパネルを作成
        const controlDiv = document.createElement('div');
        controlDiv.id = 'imageControls';
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
            min-width: 200px;
        `;
        
        controlDiv.innerHTML = `
            <div style="margin-bottom: 15px; font-weight: bold; font-size: 16px; color: #2c3e50;">📷 画像コントロール</div>
            
            <div style="margin-bottom: 10px;">
                <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" id="imageVisibleToggle" checked style="margin-right: 8px;">
                    <span style="font-size: 14px;">画像を表示</span>
                </label>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; font-size: 14px; margin-bottom: 5px;">透明度:</label>
                <input type="range" id="imageOpacity" min="0.1" max="1" step="0.1" value="0.6" 
                       style="width: 100%;">
                <div style="font-size: 11px; color: #666; display: flex; justify-content: space-between;">
                    <span>透明</span>
                    <span>不透明</span>
                </div>
            </div>
            
            <button id="showOriginalBtn" style="width: 100%; padding: 8px; font-size: 13px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 8px;">
                元画像を表示
            </button>
            
            <button id="repositionBtn" style="width: 100%; padding: 8px; font-size: 13px; background: #e67e22; color: white; border: none; border-radius: 4px; cursor: pointer;">
                位置を調整
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
        
        document.getElementById('repositionBtn').addEventListener('click', () => {
            this.startRepositioning();
        });
    }
    
    setupEventHandlers() {
        this.applyButton.addEventListener('click', () => {
            this.applyOverlay();
        });
        
        this.resetButton.addEventListener('click', () => {
            this.resetPoints();
        });
        
        // 地図のクリックイベント
        this.map.on('click', (e) => {
            if (this.mapPoints.length < 2) {
                this.addMapPoint(e);
            }
        });
    }
    
    setImage(imageData) {
        this.imageData = imageData;
        this.resetPoints();
        this.startMapSelection();
    }
    
    startMapSelection() {
        // シンプルなドラッグ&リサイズウィンドウを表示
        this.showImageWindow();
        
        const info = this.overlaySection.querySelector('.info');
        info.innerHTML = `
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #2c3e50;">
                📍 とても簡単！2回クリックするだけ
            </div>
            
            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #27ae60;">
                <div style="font-size: 16px; font-weight: bold; color: #27ae60; margin-bottom: 8px;">
                    ステップ1: 左上をクリック
                </div>
                <div style="font-size: 14px; color: #2d5a2d;">
                    地図上で画像を配置したい範囲の<strong>左上の角</strong>をクリックしてください
                </div>
            </div>
            
            <div style="font-size: 13px; color: #7f8c8d; background: #f8f9fa; padding: 10px; border-radius: 4px;">
                💡 <strong>コツ:</strong> 右の画像ウィンドウを参考に、地図上の対応する場所を探してクリック<br>
                🔧 <strong>画像操作:</strong> 赤いバーをドラッグして移動・4隅の青い丸でリサイズ
            </div>
        `;
        info.style.backgroundColor = '#f8f9fa';
        info.style.color = '#2c3e50';
    }
    
    showImageWindow() {
        // 既存のウィンドウがあれば閉じる
        if (this.imageWindow) {
            this.imageWindow.close();
        }
        
        // 新しいシンプルなドラッグ&リサイズウィンドウを作成
        this.imageWindow = new SimpleDragResizeWindow(this.imageData, (e) => {
            // キャンバスクリック時の処理（特になし）
            console.log('Image window canvas clicked');
        });
        
        // 元のキャンバスは非表示
        this.imageCanvas.style.display = 'none';
    }
    
    addMapPoint(event) {
        const latlng = event.latlng;
        this.mapPoints.push(latlng);
        
        const pointNames = ['左上', '右下'];
        const colors = ['#27ae60', '#e74c3c'];
        
        // マーカーを追加
        const marker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'simple-marker',
                html: `<div style="background-color: ${colors[this.mapPoints.length - 1]}; color: white; padding: 8px 15px; border-radius: 20px; font-size: 14px; font-weight: bold; box-shadow: 0 3px 8px rgba(0,0,0,0.3); white-space: nowrap;">📍 ${this.mapPoints.length}. ${pointNames[this.mapPoints.length - 1]}</div>`,
                iconSize: [80, 40]
            })
        }).addTo(this.map);
        
        this.mapMarkers.push(marker);
        
        if (this.mapPoints.length === 1) {
            // 1点目が選択された
            const info = this.overlaySection.querySelector('.info');
            info.innerHTML = `
                <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #27ae60;">
                    ✅ 左上が選択されました！
                </div>
                
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #f39c12;">
                    <div style="font-size: 16px; font-weight: bold; color: #e67e22; margin-bottom: 8px;">
                        ステップ2: 右下をクリック
                    </div>
                    <div style="font-size: 14px; color: #856404;">
                        次に、画像を配置したい範囲の<strong>右下の角</strong>をクリックしてください
                    </div>
                </div>
                
                <div style="font-size: 13px; color: #7f8c8d; background: #f8f9fa; padding: 10px; border-radius: 4px;">
                    💡 2点目をクリックすると、その間に四角形の範囲が自動的に作られます
                </div>
            `;
            info.style.backgroundColor = '#f8f9fa';
            info.style.color = '#2c3e50';
        } else if (this.mapPoints.length === 2) {
            // 2点目が選択された - プレビュー表示
            this.showPreviewRectangle();
            this.applyButton.disabled = false;
            
            const info = this.overlaySection.querySelector('.info');
            info.innerHTML = `
                <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #e74c3c;">
                    ✅ 右下が選択されました！
                </div>
                
                <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #28a745;">
                    <div style="font-size: 16px; font-weight: bold; color: #28a745; margin-bottom: 8px;">
                        範囲が決まりました 🎉
                    </div>
                    <div style="font-size: 14px; color: #155724;">
                        赤い四角形の範囲に画像が配置されます。「位置合わせを実行」をクリックしてください。
                    </div>
                </div>
                
                <div style="font-size: 13px; color: #6c757d; background: #f8f9fa; padding: 10px; border-radius: 4px;">
                    💡 位置がずれている場合は「選択をリセット」で最初からやり直せます
                </div>
            `;
            info.style.backgroundColor = '#f8f9fa';
            info.style.color = '#2c3e50';
        }
        
        this.updatePointsDisplay();
    }
    
    showPreviewRectangle() {
        if (this.mapPoints.length === 2) {
            // プレビュー四角形を表示
            const bounds = L.latLngBounds(this.mapPoints[0], this.mapPoints[1]);
            
            if (this.previewRectangle) {
                this.map.removeLayer(this.previewRectangle);
            }
            
            this.previewRectangle = L.rectangle(bounds, {
                color: '#e74c3c',
                weight: 3,
                opacity: 0.8,
                fillOpacity: 0.1,
                fillColor: '#e74c3c',
                dashArray: '10, 5'
            }).addTo(this.map);
            
            // 地図をフィット
            this.map.fitBounds(bounds, { padding: [50, 50] });
        }
    }
    
    updatePointsDisplay() {
        // 画像は固定表示なので簡単なメッセージのみ
        this.imagePointsDiv.innerHTML = `
            <div style="text-align: center; color: #3498db; font-size: 14px; padding: 15px;">
                → 右の画像ウィンドウが地図上に配置されます
            </div>
        `;
        
        // 地図ポイントの表示更新
        this.mapPointsDiv.innerHTML = '';
        
        const pointNames = ['左上の角', '右下の角'];
        const colors = ['#27ae60', '#e74c3c'];
        
        this.mapPoints.forEach((point, index) => {
            const div = document.createElement('div');
            div.className = 'point-item';
            div.innerHTML = `
                <span class="point-number" style="background-color: ${colors[index]};">✓</span> 
                ${pointNames[index]} - 選択済み
            `;
            this.mapPointsDiv.appendChild(div);
        });
        
        if (this.mapPoints.length < 2) {
            const nextIndex = this.mapPoints.length;
            const div = document.createElement('div');
            div.className = 'point-item';
            div.style.color = nextIndex === 0 ? '#27ae60' : '#e74c3c';
            div.style.fontWeight = 'bold';
            div.innerHTML = `
                <span class="point-number" style="background-color: ${colors[nextIndex]};">${nextIndex + 1}</span> 
                ${pointNames[nextIndex]} ← 次にクリック
            `;
            this.mapPointsDiv.appendChild(div);
        }
    }
    
    applyOverlay() {
        if (this.mapPoints.length !== 2) return;
        
        // コントロールパネルを表示
        document.getElementById('imageControls').style.display = 'block';
        
        // 既存のオーバーレイを削除
        if (this.overlayLayer) {
            this.map.removeLayer(this.overlayLayer);
        }
        
        // プレビュー四角形を削除
        if (this.previewRectangle) {
            this.map.removeLayer(this.previewRectangle);
            this.previewRectangle = null;
        }
        
        // 選択マーカーを削除
        this.mapMarkers.forEach(marker => marker.remove());
        this.mapMarkers = [];
        
        // 境界ボックスを作成
        const bounds = L.latLngBounds(this.mapPoints[0], this.mapPoints[1]);
        
        // 画像オーバーレイを作成
        const opacity = parseFloat(document.getElementById('imageOpacity').value);
        this.overlayLayer = L.imageOverlay(this.imageData.url, bounds, {
            opacity: opacity,
            interactive: false
        }).addTo(this.map);
        
        // 画像ウィンドウは閉じる
        if (this.imageWindow) {
            this.imageWindow.close();
        }
        
        // 完了通知
        if (this.onOverlayApplied) {
            this.onOverlayApplied();
        }
        
        // UIの更新
        this.applyButton.disabled = true;
        this.applyButton.textContent = '配置完了';
        
        const info = this.overlaySection.querySelector('.info');
        info.innerHTML = `
            <div style="font-size: 18px; font-weight: bold; color: #28a745; margin-bottom: 10px;">
                🎉 画像が地図に配置されました！
            </div>
            <div style="font-size: 14px; margin-bottom: 15px; color: #155724;">
                地図上をクリックしてピンを配置し、施設情報を入力してください
            </div>
            <div style="background: #e3f2fd; padding: 12px; border-radius: 4px; font-size: 13px;">
                💡 <strong>便利機能:</strong><br>
                • 右上のコントロールで画像の表示/透明度を調整<br>
                • 「元画像を表示」で大きな画像を確認<br>
                • 「位置を調整」で配置をやり直し
            </div>
        `;
        info.style.backgroundColor = '#d4edda';
        info.style.color = '#155724';
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
    
    showOriginalImage() {
        // モーダルで元画像を表示
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
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;
        
        const closeBtn = document.createElement('div');
        closeBtn.innerHTML = '✕ 閉じる（クリック）';
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
        
        modal.appendChild(img);
        modal.appendChild(closeBtn);
        
        modal.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        document.body.appendChild(modal);
    }
    
    startRepositioning() {
        // 位置調整モード
        if (this.overlayLayer) {
            this.map.removeLayer(this.overlayLayer);
            this.overlayLayer = null;
        }
        
        // 元の2点を復元
        this.mapMarkers.forEach(marker => marker.remove());
        this.mapMarkers = [];
        
        this.mapPoints.forEach((latlng, index) => {
            const pointNames = ['左上', '右下'];
            const colors = ['#27ae60', '#e74c3c'];
            
            const marker = L.marker(latlng, {
                icon: L.divIcon({
                    className: 'simple-marker',
                    html: `<div style="background-color: ${colors[index]}; color: white; padding: 8px 15px; border-radius: 20px; font-size: 14px; font-weight: bold; box-shadow: 0 3px 8px rgba(0,0,0,0.3); white-space: nowrap;">📍 ${index + 1}. ${pointNames[index]}</div>`,
                    iconSize: [80, 40]
                }),
                draggable: true
            }).addTo(this.map);
            
            // ドラッグで位置調整
            marker.on('dragend', (e) => {
                this.mapPoints[index] = e.target.getLatLng();
                this.showPreviewRectangle();
            });
            
            this.mapMarkers.push(marker);
        });
        
        this.showPreviewRectangle();
        this.applyButton.disabled = false;
        this.applyButton.textContent = '位置合わせを実行';
        
        const info = this.overlaySection.querySelector('.info');
        info.innerHTML = `
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #e67e22;">
                🔧 位置調整モード
            </div>
            <div style="font-size: 14px; margin-bottom: 10px;">
                赤と緑のマーカーをドラッグして位置を調整できます
            </div>
            <div style="background: #fff3cd; padding: 10px; border-radius: 4px; font-size: 13px;">
                💡 位置が決まったら「位置合わせを実行」をクリック
            </div>
        `;
        info.style.backgroundColor = '#fef9e7';
        info.style.color = '#856404';
    }
    
    resetPoints() {
        this.mapPoints = [];
        
        // マーカーを削除
        this.mapMarkers.forEach(marker => marker.remove());
        this.mapMarkers = [];
        
        // オーバーレイを削除
        if (this.overlayLayer) {
            this.map.removeLayer(this.overlayLayer);
            this.overlayLayer = null;
        }
        
        // プレビュー四角形を削除
        if (this.previewRectangle) {
            this.map.removeLayer(this.previewRectangle);
            this.previewRectangle = null;
        }
        
        // 画像ウィンドウを閉じる
        if (this.imageWindow) {
            this.imageWindow.close();
        }
        
        // コントロールパネルを非表示
        document.getElementById('imageControls').style.display = 'none';
        
        this.updatePointsDisplay();
        this.applyButton.disabled = true;
        this.applyButton.textContent = '位置合わせを実行';
        
        // 選択を再開
        if (this.imageData) {
            this.startMapSelection();
        }
    }
}