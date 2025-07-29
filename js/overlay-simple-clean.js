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
        this.imagePoints = []; // 画像上の選択点
        this.mapPoints = []; // 地図上の選択点
        this.mapMarkers = [];
        this.overlayLayer = null;
        this.previewRectangle = null;
        this.imageWindow = null;
        this.isSelectingMapPoints = false;
        
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
            if (this.isSelectingMapPoints && this.mapPoints.length < 2) {
                this.addMapPoint(e);
            }
        });
    }
    
    setImage(imageData) {
        console.log('OverlayManager.setImage called with:', imageData);
        
        // 古い画像ウィンドウがあれば閉じる
        if (this.imageWindow) {
            console.log('Closing existing image window');
            this.imageWindow.close();
            this.imageWindow = null;
        }
        
        this.imageData = imageData;
        console.log('imageData set to:', this.imageData);
        
        this.resetPointsOnly();  // resetPointsから画像ウィンドウ処理を除外した版を呼ぶ
        console.log('resetPointsOnly completed');
        
        this.startMapSelection();
        console.log('startMapSelection completed');
    }
    
    startMapSelection() {
        console.log('startMapSelection called with imageData:', this.imageData);
        
        // シンプルなドラッグ&リサイズウィンドウを表示
        this.showImageWindow();
        
        // 初期状態の指示を表示
        this.updateInstructionText();
    }
    
    showImageWindow() {
        console.log('showImageWindow called with imageData:', this.imageData);
        
        // 既存のウィンドウがあれば閉じる
        if (this.imageWindow) {
            this.imageWindow.close();
        }
        
        if (!this.imageData) {
            console.error('imageData is null or undefined in showImageWindow');
            return;
        }
        
        // 新しいシンプルなドラッグ&リサイズウィンドウを作成
        this.imageWindow = new SimpleDragResizeWindow(this.imageData, (data) => {
            this.handleImagePointSelection(data);
        }, () => {
            // ×ボタンクリック時の削除処理
            this.deleteImage();
        });
        
        // 元のキャンバスは非表示
        this.imageCanvas.style.display = 'none';
    }
    
    handleImagePointSelection(data) {
        if (data.type === 'pointAdded') {
            this.imagePoints = data.points;
            this.updateUIForImagePoints();
            
            // 画像で2点選択完了したらマップ選択モードに
            if (this.imagePoints.length === 2) {
                this.isSelectingMapPoints = true;
                this.updateInstructionText();
            }
        } else if (data.type === 'pointRemoved') {
            this.imagePoints = data.points;
            this.updateUIForImagePoints();
            
            // マップの選択をリセット
            this.resetMapPoints();
            this.isSelectingMapPoints = false;
            this.updateInstructionText();
        }
    }
    
    resetMapPoints() {
        // マップのマーカーを削除
        this.mapMarkers.forEach(marker => marker.remove());
        this.mapMarkers = [];
        this.mapPoints = [];
    }
    
    updateUIForImagePoints() {
        this.updatePointsDisplay();
        
        // 適用ボタンの状態を更新
        if (this.imagePoints.length === 2 && this.mapPoints.length === 2) {
            this.applyButton.disabled = false;
        } else {
            this.applyButton.disabled = true;
        }
    }
    
    updateInstructionText() {
        const info = this.overlaySection.querySelector('.info');
        
        if (this.imagePoints.length === 0) {
            info.innerHTML = `
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #2c3e50;">
                    📍 画像上で2点を選択してください
                </div>
                <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #27ae60;">
                    <div style="font-size: 16px; font-weight: bold; color: #27ae60; margin-bottom: 8px;">
                        ステップ1: 画像の1点目をクリック
                    </div>
                    <div style="font-size: 14px; color: #2d5a2d;">
                        右の画像ウィンドウで最初の基準点をクリックしてください
                    </div>
                </div>
            `;
        } else if (this.imagePoints.length === 1) {
            info.innerHTML = `
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #2c3e50;">
                    📍 画像上で2点目を選択してください
                </div>
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #f39c12;">
                    <div style="font-size: 16px; font-weight: bold; color: #e67e22; margin-bottom: 8px;">
                        ステップ2: 画像の2点目をクリック
                    </div>
                    <div style="font-size: 14px; color: #856404;">
                        右の画像ウィンドウで2番目の基準点をクリックしてください
                    </div>
                </div>
            `;
        } else if (this.imagePoints.length === 2 && this.mapPoints.length === 0) {
            info.innerHTML = `
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #2c3e50;">
                    📍 地図上で対応する2点を選択してください
                </div>
                <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #2196f3;">
                    <div style="font-size: 16px; font-weight: bold; color: #1976d2; margin-bottom: 8px;">
                        ステップ3: 地図の1点目をクリック
                    </div>
                    <div style="font-size: 14px; color: #0d47a1;">
                        画像の1点目に対応する地図上の場所をクリックしてください
                    </div>
                </div>
            `;
        } else if (this.imagePoints.length === 2 && this.mapPoints.length === 1) {
            info.innerHTML = `
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #2c3e50;">
                    📍 地図上で2点目を選択してください
                </div>
                <div style="background: #f3e5f5; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #9c27b0;">
                    <div style="font-size: 16px; font-weight: bold; color: #7b1fa2; margin-bottom: 8px;">
                        ステップ4: 地図の2点目をクリック
                    </div>
                    <div style="font-size: 14px; color: #4a148c;">
                        画像の2点目に対応する地図上の場所をクリックしてください
                    </div>
                </div>
            `;
        } else if (this.imagePoints.length === 2 && this.mapPoints.length === 2) {
            info.innerHTML = `
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #28a745;">
                    ✅ 2点対応が完了しました！
                </div>
                <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #28a745;">
                    <div style="font-size: 16px; font-weight: bold; color: #28a745; margin-bottom: 8px;">
                        準備完了 🎉
                    </div>
                    <div style="font-size: 14px; color: #155724;">
                        「位置合わせを実行」をクリックして画像を配置してください
                    </div>
                </div>
            `;
        }
        
        info.style.backgroundColor = '#f8f9fa';
        info.style.color = '#2c3e50';
    }
    
    addMapPoint(event) {
        const latlng = event.latlng;
        this.mapPoints.push(latlng);
        
        const colors = ['#27ae60', '#e74c3c'];
        
        // マーカーを追加
        const marker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'simple-marker',
                html: `<div style="background-color: ${colors[this.mapPoints.length - 1]}; color: white; padding: 8px 15px; border-radius: 20px; font-size: 14px; font-weight: bold; box-shadow: 0 3px 8px rgba(0,0,0,0.3); white-space: nowrap;">📍 地図${this.mapPoints.length}</div>`,
                iconSize: [80, 40]
            })
        }).addTo(this.map);
        
        this.mapMarkers.push(marker);
        
        // UIを更新
        this.updateUIForImagePoints();
        this.updateInstructionText();
        this.updatePointsDisplay();
        
        // 2点完了時は選択モードを終了
        if (this.mapPoints.length === 2) {
            this.isSelectingMapPoints = false;
        }
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
        // 画像ポイントの表示更新
        this.imagePointsDiv.innerHTML = '';
        
        this.imagePoints.forEach((point, index) => {
            const div = document.createElement('div');
            div.className = 'point-item';
            div.innerHTML = `
                <span class="point-number" style="background-color: ${index === 0 ? '#27ae60' : '#e74c3c'};">✓</span> 
                画像${index + 1} - 選択済み
            `;
            this.imagePointsDiv.appendChild(div);
        });
        
        if (this.imagePoints.length < 2) {
            const nextIndex = this.imagePoints.length;
            const div = document.createElement('div');
            div.className = 'point-item';
            div.style.color = nextIndex === 0 ? '#27ae60' : '#e74c3c';
            div.style.fontWeight = 'bold';
            div.innerHTML = `
                <span class="point-number" style="background-color: ${nextIndex === 0 ? '#27ae60' : '#e74c3c'};">${nextIndex + 1}</span> 
                画像${nextIndex + 1} ← 次にクリック
            `;
            this.imagePointsDiv.appendChild(div);
        }
        
        // 地図ポイントの表示更新
        this.mapPointsDiv.innerHTML = '';
        
        this.mapPoints.forEach((point, index) => {
            const div = document.createElement('div');
            div.className = 'point-item';
            div.innerHTML = `
                <span class="point-number" style="background-color: ${index === 0 ? '#27ae60' : '#e74c3c'};">✓</span> 
                地図${index + 1} - 選択済み
            `;
            this.mapPointsDiv.appendChild(div);
        });
        
        if (this.mapPoints.length < 2 && this.imagePoints.length === 2) {
            const nextIndex = this.mapPoints.length;
            const div = document.createElement('div');
            div.className = 'point-item';
            div.style.color = nextIndex === 0 ? '#27ae60' : '#e74c3c';
            div.style.fontWeight = 'bold';
            div.innerHTML = `
                <span class="point-number" style="background-color: ${nextIndex === 0 ? '#27ae60' : '#e74c3c'};">${nextIndex + 1}</span> 
                地図${nextIndex + 1} ← 次にクリック
            `;
            this.mapPointsDiv.appendChild(div);
        }
    }
    
    calculate2PointTransform() {
        // 画像の2点と地図の2点から変換を計算
        const imagePoint1 = this.imagePoints[0];
        const imagePoint2 = this.imagePoints[1];
        const mapPoint1 = this.mapPoints[0];
        const mapPoint2 = this.mapPoints[1];
        
        // 画像上の2点間のベクトル
        const imageVector = {
            x: imagePoint2.x - imagePoint1.x,
            y: imagePoint2.y - imagePoint1.y
        };
        
        // 地図上の2点間のベクトル
        const mapVector = {
            lat: mapPoint2.lat - mapPoint1.lat,
            lng: mapPoint2.lng - mapPoint1.lng
        };
        
        // 画像の実際のサイズ
        const imageWidth = this.imageData.width;
        const imageHeight = this.imageData.height;
        
        // スケール計算（地図の距離 / 画像の距離）
        const imageDistance = Math.sqrt(imageVector.x * imageVector.x + imageVector.y * imageVector.y);
        const mapDistance = Math.sqrt(mapVector.lat * mapVector.lat + mapVector.lng * mapVector.lng);
        const scale = mapDistance / imageDistance;
        
        // 画像の4隅を地図座標に変換
        const corners = [
            { x: 0, y: 0 }, // 左上
            { x: imageWidth, y: 0 }, // 右上
            { x: imageWidth, y: imageHeight }, // 右下
            { x: 0, y: imageHeight } // 左下
        ];
        
        const transformedCorners = corners.map(corner => {
            // 画像座標を基準点1からの相対座標に変換
            const relativeX = corner.x - imagePoint1.x;
            const relativeY = corner.y - imagePoint1.y;
            
            // スケールを適用して地図座標に変換
            const lat = mapPoint1.lat + (relativeY * scale);
            const lng = mapPoint1.lng + (relativeX * scale);
            
            return [lat, lng];
        });
        
        // 境界ボックスを作成
        const lats = transformedCorners.map(corner => corner[0]);
        const lngs = transformedCorners.map(corner => corner[1]);
        
        const bounds = [
            [Math.min(...lats), Math.min(...lngs)], // 南西
            [Math.max(...lats), Math.max(...lngs)]  // 北東
        ];
        
        return bounds;
    }
    
    applyOverlay() {
        if (this.imagePoints.length !== 2 || this.mapPoints.length !== 2) return;
        
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
        
        // 2点対応による変換を計算
        const bounds = this.calculate2PointTransform();
        
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
    
    deleteImage() {
        console.log('deleteImage called');
        
        // 画像ウィンドウを先に閉じる
        if (this.imageWindow) {
            console.log('Closing image window');
            this.imageWindow.close();
            this.imageWindow = null;
        }
        
        // 全ての表示要素をリセット（画像ウィンドウは既に閉じているのでresetPointsOnlyを使用）
        this.resetPointsOnly();
        
        // オーバーレイセクションを非表示
        this.overlaySection.style.display = 'none';
        
        // ピンセクションも非表示
        const pinSection = document.getElementById('pinSection');
        if (pinSection) pinSection.style.display = 'none';
        
        // 元のキャンバスも非表示
        this.imageCanvas.style.display = 'none';
        
        // サイドバーの画像表示もリセット
        const uploadedImageDiv = document.getElementById('uploadedImage');
        const uploadArea = document.getElementById('uploadArea');
        const previewImage = document.getElementById('previewImage');
        const fileInput = document.getElementById('fileInput');
        
        if (uploadedImageDiv) uploadedImageDiv.style.display = 'none';
        if (uploadArea) uploadArea.style.display = 'block';
        if (previewImage) previewImage.src = '';
        if (fileInput) fileInput.value = '';
        
        // 画像データをクリア
        this.imageData = null;
        
        console.log('deleteImage completed');
    }
    
    resetPointsOnly() {
        // setImage用のリセット（画像ウィンドウは閉じない）
        this.imagePoints = [];
        this.mapPoints = [];
        this.isSelectingMapPoints = false;
        
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
        
        // コントロールパネルを非表示
        const imageControls = document.getElementById('imageControls');
        if (imageControls) {
            imageControls.style.display = 'none';
        }
        
        this.updatePointsDisplay();
        this.applyButton.disabled = true;
        this.applyButton.textContent = '位置合わせを実行';
    }
    
    resetPoints() {
        this.imagePoints = [];
        this.mapPoints = [];
        this.isSelectingMapPoints = false;
        
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
            this.imageWindow = null;
        }
        
        // コントロールパネルを非表示
        const imageControls = document.getElementById('imageControls');
        if (imageControls) {
            imageControls.style.display = 'none';
        }
        
        this.updatePointsDisplay();
        this.applyButton.disabled = true;
        this.applyButton.textContent = '位置合わせを実行';
        
        // 画像ウィンドウの点もクリア
        if (this.imageWindow) {
            this.imageWindow.clearPoints();
        }
        
        // 選択を再開
        if (this.imageData) {
            this.startMapSelection();
        }
    }
}