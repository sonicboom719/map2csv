import { SimpleDragResizeWindow } from './simple-drag-resize.js';
import { CONFIG } from './config.js';
import { CoordinateTransformer } from './utils/coordinate-transformer.js';
import { ErrorHandler } from './utils/error-handler.js';

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
        this.isRepositioning = false; // 位置調整中かどうかのフラグ
        this.savedOverlayData = null; // オーバーレイのデータを保存
        
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
        
        const mapContainer = document.querySelector('.map-container') || document.body;
        mapContainer.appendChild(controlDiv);
        
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
            if (this.isRepositioning) {
                this.cancelRepositioning();
            } else {
                this.startRepositioning();
            }
        });
    }
    
    setupEventHandlers() {
        this.applyButton.addEventListener('click', () => {
            console.log('🖱️ 位置合わせ実行ボタンがクリックされました');
            this.applyOverlay();
        });
        
        this.resetButton.addEventListener('click', () => {
            this.handleResetClick();
        });
        
        // 地図のクリックイベント
        this.mapClickHandler = (e) => {
            // 画像で2点選択完了後はマップクリックを受け付ける
            if (this.imagePoints.length === 2) {
                this.addMapPoint(e);
            }
        };
        
        this.map.on('click', this.mapClickHandler);
    }
    
    handleResetClick() {
        // ピンが登録されているかチェック
        const hasPins = window.app && window.app.pinManager && window.app.pinManager.getPins().length > 0;
        
        if (hasPins) {
            // ピンがある場合のみ確認
            const confirmed = confirm('リセットすると登録されたピンも全てリセットされますがよろしいですか？');
            if (!confirmed) {
                return; // キャンセルされた場合は何もしない
            }
            
            // ピンも全てリセット
            window.app.pinManager.clearAllPins();
            
            // ピンマネージャーを無効化
            window.app.pinManager.disable();
            
            // 右サイドバーとピンセクションを非表示
            document.getElementById('rightSidebar').style.display = 'none';
            document.getElementById('pinSection').style.display = 'none';
        }
        
        // 既存のオーバーレイを削除
        if (this.overlayLayer) {
            this.map.removeLayer(this.overlayLayer);
            this.overlayLayer = null;
        }
        
        // コントロールパネルを非表示
        const imageControls = document.getElementById('imageControls');
        if (imageControls) {
            imageControls.style.display = 'none';
        }
        
        // 通常のリセット処理を実行
        this.resetPoints();
        
        // 適用ボタンを再表示
        this.applyButton.style.display = 'block';
        
        // 「３．画像の位置合わせ」モードに戻る
        if (this.imageData) {
            // ピンマネージャーが有効な場合は無効化（ピンがない場合も念のため）
            if (window.app && window.app.pinManager && !hasPins) {
                window.app.pinManager.disable();
            }
            
            // 画像ウィンドウを再表示（既に表示されている場合があるのでチェック）
            if (!this.imageWindow) {
                this.startMapSelection();
            }
            
            // 初期状態の指示を表示
            this.updateInstructionText();
        }
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
        
        // マップのカーソルを十字に設定
        this.setMapCursor('crosshair');
    }
    
    setMapCursor(cursor) {
        // 地図コンテナのカーソルを設定
        const mapContainer = this.map.getContainer();
        if (mapContainer) {
            mapContainer.style.cursor = cursor;
        }
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
            this.updateInstructionText();
        } else if (data.type === 'pointMoved') {
            this.imagePoints = data.points;
            // 点が移動しても選択状態は維持
            this.updateUIForImagePoints();
        }
    }
    
    resetMapPoints() {
        // マップのマーカーを削除（各点につき2つのマーカー）
        this.mapMarkers.forEach(marker => marker.remove());
        this.mapMarkers = [];
        this.mapPoints = [];
    }
    
    updateUIForImagePoints() {
        this.updatePointsDisplay();
        
        // 適用ボタンの状態を更新
        console.log('🔄 ボタン状態更新:', {
            imagePoints: this.imagePoints.length,
            mapPoints: this.mapPoints.length,
            shouldEnable: this.imagePoints.length === 2 && this.mapPoints.length === 2
        });
        
        if (this.imagePoints.length === 2 && this.mapPoints.length === 2) {
            this.applyButton.disabled = false;
            console.log('✅ 位置合わせボタンが有効化されました');
        } else {
            this.applyButton.disabled = true;
            console.log('⚠️ 位置合わせボタンが無効化されました');
        }
    }
    
    updateInstructionText() {
        const info = this.overlaySection.querySelector('.info');
        
        // 画像選択中はマップのカーソルを通常に戻す
        if (this.imagePoints.length < 2) {
            this.setMapCursor('');
        }
        
        if (this.imagePoints.length === 0) {
            info.innerHTML = `
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #2c3e50;">
                    📍 画像上で2点を選択します
                </div>
                <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #27ae60;">
                    <div style="font-size: 16px; font-weight: bold; color: #27ae60; margin-bottom: 8px;">
                        STEP1: 画像の1点目をCLICK
                    </div>
                    <div style="font-size: 14px; color: #2d5a2d;">
                        右の画像ウィンドウで最初の基準点をCLICKしてください
                    </div>
                </div>
            `;
        } else if (this.imagePoints.length === 1) {
            info.innerHTML = `
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #2c3e50;">
                    📍 画像上で2点目を選択します
                </div>
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #f39c12;">
                    <div style="font-size: 16px; font-weight: bold; color: #e67e22; margin-bottom: 8px;">
                        STEP2: 画像の2点目をCLICK
                    </div>
                    <div style="font-size: 14px; color: #856404;">
                        右の画像ウィンドウで2番目の基準点をCLICKしてください
                    </div>
                </div>
            `;
        } else if (this.imagePoints.length === 2 && this.mapPoints.length === 0) {
            // 地図選択開始時にカーソルを十字に設定
            this.setMapCursor('crosshair');
            
            info.innerHTML = `
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #2c3e50;">
                    📍 地図上で対応する2点を選択してください
                </div>
                <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #2196f3;">
                    <div style="font-size: 16px; font-weight: bold; color: #1976d2; margin-bottom: 8px;">
                        STEP3: 地図の1点目をCLICK
                    </div>
                    <div style="font-size: 14px; color: #0d47a1;">
                        画像の1点目に対応する地図上の場所をCLICKしてください
                    </div>
                </div>
            `;
        } else if (this.imagePoints.length === 2 && this.mapPoints.length === 1) {
            info.innerHTML = `
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #2c3e50;">
                    📍 地図上で2点目を選択します
                </div>
                <div style="background: #f3e5f5; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #9c27b0;">
                    <div style="font-size: 16px; font-weight: bold; color: #7b1fa2; margin-bottom: 8px;">
                        STEP4: 地図の2点目をCLICK
                    </div>
                    <div style="font-size: 14px; color: #4a148c;">
                        画像の2点目に対応する地図上の場所をCLICKしてください
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
                        「位置合わせを実行」をCLICKして画像を配置してください
                    </div>
                </div>
            `;
        }
        
        info.style.backgroundColor = '#f8f9fa';
        info.style.color = '#2c3e50';
    }
    
    addMapPoint(event) {
        const latlng = event.latlng;
        console.log('Map clicked at:', latlng);
        
        // 新しい点を追加（最大2点）
        if (this.mapPoints.length < 2) {
            console.log(`Adding new point ${this.mapPoints.length + 1} at:`, latlng);
            this.mapPoints.push(latlng);
            
            const colors = ['#27ae60', '#e74c3c'];
            const index = this.mapPoints.length - 1;
            
            // ドラッグ可能なマーカーを作成
            const marker = L.circleMarker(latlng, {
                radius: CONFIG.UI.MARKER_SIZES.SELECTION_RADIUS,
                fillColor: colors[index],
                color: 'white',
                weight: 3,
                opacity: 1,
                fillOpacity: 1,
                draggable: true
            }).addTo(this.map);
            
            // マーカーにドラッグ機能を手動で追加
            this.addMapMarkerDragHandler(marker, index);
            
            // 番号を追加（ドラッグ可能）
            const numberMarker = L.marker(latlng, {
                icon: L.divIcon({
                    className: 'map-point-number',
                    html: `<div style="background: transparent; color: white; font-size: 14px; font-weight: bold; text-align: center; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">${this.mapPoints.length}</div>`,
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                }),
                draggable: true
            }).addTo(this.map);
            
            // 番号マーカーのドラッグハンドラー
            numberMarker.on('drag', (e) => {
                const newLatLng = e.target.getLatLng();
                this.mapPoints[index] = newLatLng;
                marker.setLatLng(newLatLng);
            });
            
            // マーカーのドラッグに番号を追従させる
            marker._numberMarker = numberMarker;
            
            this.mapMarkers.push(marker);
            this.mapMarkers.push(numberMarker);
            
            console.log(`Total map points: ${this.mapPoints.length}, Total markers: ${this.mapMarkers.length}`);
            
            // UIを更新
            this.updateUIForImagePoints();
            this.updateInstructionText();
            this.updatePointsDisplay();
        } else {
            console.log('Maximum 2 points already selected');
        }
    }
    
    addMapMarkerDragHandler(marker, index) {
        let isDragging = false;
        let startLatLng;
        
        marker.on('mousedown', (e) => {
            isDragging = true;
            startLatLng = e.latlng;
            L.DomEvent.stopPropagation(e);
            
            const mouseMoveHandler = (e) => {
                if (!isDragging) return;
                
                const containerPoint = this.map.mouseEventToContainerPoint(e);
                const newLatLng = this.map.containerPointToLatLng(containerPoint);
                
                marker.setLatLng(newLatLng);
                this.mapPoints[index] = newLatLng;
                
                // 番号マーカーも一緒に移動
                if (marker._numberMarker) {
                    marker._numberMarker.setLatLng(newLatLng);
                }
            };
            
            const mouseUpHandler = () => {
                isDragging = false;
                this.map.off('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            };
            
            this.map.on('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        });
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
                画像${nextIndex + 1} ← 次にCLICK
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
                地図${nextIndex + 1} ← 次にCLICK
            `;
            this.mapPointsDiv.appendChild(div);
        }
    }
    
    calculate2PointTransform() {
        // 画像の2点と地図の2点から正確な変換を計算
        const imagePoint1 = this.imagePoints[0];
        const imagePoint2 = this.imagePoints[1];
        const mapPoint1 = this.mapPoints[0];
        const mapPoint2 = this.mapPoints[1];
        
        console.log('Image points:', imagePoint1, imagePoint2);
        console.log('Map points:', mapPoint1, mapPoint2);
        
        // 変換パラメータを保存（回転用）
        this.transformParams = {
            imageOrigin: imagePoint1,
            imagePoint2: imagePoint2,
            mapOrigin: mapPoint1,
            mapPoint2: mapPoint2
        };
        
        // 2点から画像全体の配置を計算
        // 画像の4隅の座標
        const imageWidth = this.imageData.width;
        const imageHeight = this.imageData.height;
        
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
        
        // スケールファクターを計算（2点間の距離比）
        const imageDistance = Math.sqrt(imageVector.x * imageVector.x + imageVector.y * imageVector.y);
        const mapDistance = Math.sqrt(mapVector.lat * mapVector.lat + mapVector.lng * mapVector.lng);
        const scale = mapDistance / imageDistance;
        
        console.log('Scale factor:', scale);
        
        // 座標変換パラメータを計算
        const transform = CoordinateTransformer.calculateTransform(
            imagePoint1, imagePoint2, mapPoint1, mapPoint2
        );
        
        console.log('Scale factors:', { scaleX: transform.scaleX, scaleY: transform.scaleY });
        
        // 画像の4隅を変換
        const corners = [
            CoordinateTransformer.transformPoint(0, 0, transform), // 左上
            CoordinateTransformer.transformPoint(imageWidth, 0, transform), // 右上
            CoordinateTransformer.transformPoint(imageWidth, imageHeight, transform), // 右下
            CoordinateTransformer.transformPoint(0, imageHeight, transform) // 左下
        ];
        
        console.log('Transformed corners:', corners);
        
        // 境界ボックスを作成（元の画像のアスペクト比を保持）
        const lats = corners.map(corner => corner[0]);
        const lngs = corners.map(corner => corner[1]);
        
        const bounds = [
            [Math.min(...lats), Math.min(...lngs)], // 南西
            [Math.max(...lats), Math.max(...lngs)]  // 北東
        ];
        
        console.log('Final bounds:', bounds);
        
        // 確認：変換された基準点が正しいかチェック
        const transformedPoint1 = CoordinateTransformer.transformPoint(imagePoint1.x, imagePoint1.y, transform);
        const transformedPoint2 = CoordinateTransformer.transformPoint(imagePoint2.x, imagePoint2.y, transform);
        console.log('=== 2点一致検証 ===');
        console.log('変換点1:', transformedPoint1, '期待値:', [mapPoint1.lat, mapPoint1.lng]);
        console.log('変換点2:', transformedPoint2, '期待値:', [mapPoint2.lat, mapPoint2.lng]);
        console.log('誤差1:', [Math.abs(transformedPoint1[0] - mapPoint1.lat), Math.abs(transformedPoint1[1] - mapPoint1.lng)]);
        console.log('誤差2:', [Math.abs(transformedPoint2[0] - mapPoint2.lat), Math.abs(transformedPoint2[1] - mapPoint2.lng)]);
        
        return bounds;
    }
    
    create2PointImageOverlay(bounds, opacity) {
        // 回転が必要な場合は画像を事前回転
        const params = this.transformParams;
        const imageVector = {
            x: params.imagePoint2.x - params.imageOrigin.x,
            y: params.imagePoint2.y - params.imageOrigin.y
        };
        const mapVector = {
            lat: params.mapPoint2.lat - params.mapOrigin.lat,
            lng: params.mapPoint2.lng - params.mapOrigin.lng
        };
        
        // 地図上の2点をピクセル座標に変換して正確な角度を計算
        const mapPixel1 = this.map.latLngToContainerPoint([params.mapOrigin.lat, params.mapOrigin.lng]);
        const mapPixel2 = this.map.latLngToContainerPoint([params.mapPoint2.lat, params.mapPoint2.lng]);
        
        const mapPixelVector = {
            x: mapPixel2.x - mapPixel1.x,
            y: mapPixel2.y - mapPixel1.y
        };
        
        // 画像の角度計算（Y軸下向き）
        const imageAngle = Math.atan2(imageVector.y, imageVector.x);
        
        // 地図の角度計算（ピクセル座標、Y軸下向き）
        const mapAngle = Math.atan2(mapPixelVector.y, mapPixelVector.x);
        
        // 同じ座標系での回転角度
        const rotationRadians = mapAngle - imageAngle;
        const rotationDegrees = rotationRadians * 180 / Math.PI;
        
        console.log('Corrected angle calculation:', {
            imageVector: imageVector,
            mapPixelVector: mapPixelVector,
            imageAngle: imageAngle * 180 / Math.PI,
            mapAngle: mapAngle * 180 / Math.PI,
            rotationDegrees: rotationDegrees
        });
        
        console.log('Rotation needed:', rotationDegrees, 'degrees');
        
        // 回転が小さい場合（5度未満）は回転なしで処理
        if (Math.abs(rotationDegrees) < 5) {
            console.log('Small rotation, using standard ImageOverlay');
            
            const overlay = L.imageOverlay(this.imageData.url, bounds, {
                opacity: opacity,
                interactive: false
            }).addTo(this.map);
            
            overlay.setOpacity = function(newOpacity) {
                const img = this.getElement();
                if (img) {
                    img.style.opacity = newOpacity;
                }
                this.options.opacity = newOpacity;
            }.bind(overlay);
            
            return overlay;
        }
        
        // 回転が必要な場合は事前に画像を回転
        console.log('Large rotation, pre-rotating image');
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        return new Promise((resolve) => {
            img.onload = () => {
                // 元画像と同じサイズのキャンバスを作成（回転で切れないよう十分大きく）
                const diagonal = Math.sqrt(img.width * img.width + img.height * img.height);
                canvas.width = diagonal;
                canvas.height = diagonal;
                
                // 中心で回転
                ctx.translate(diagonal / 2, diagonal / 2);
                ctx.rotate(rotationRadians);
                ctx.drawImage(img, -img.width / 2, -img.height / 2);
                
                // 回転済み画像でオーバーレイ作成
                const rotatedImageUrl = canvas.toDataURL();
                
                // 回転後の画像に合わせて新しいboundsを計算
                // 元の変換パラメータを使って回転後の基準点を計算
                const imagePoint1 = params.imageOrigin;
                const imagePoint2 = params.imagePoint2;
                const mapPoint1 = params.mapOrigin;
                const mapPoint2 = params.mapPoint2;
                
                // 回転後の基準点を計算（キャンバス中心基準）
                const centerX = diagonal / 2;
                const centerY = diagonal / 2;
                
                // 元画像の基準点を中心座標系に変換
                const relX1 = imagePoint1.x - img.width / 2;
                const relY1 = imagePoint1.y - img.height / 2;
                const relX2 = imagePoint2.x - img.width / 2;
                const relY2 = imagePoint2.y - img.height / 2;
                
                // 回転を適用
                const cos = Math.cos(rotationRadians);
                const sin = Math.sin(rotationRadians);
                
                const rotatedX1 = relX1 * cos - relY1 * sin + centerX;
                const rotatedY1 = relX1 * sin + relY1 * cos + centerY;
                const rotatedX2 = relX2 * cos - relY2 * sin + centerX;
                const rotatedY2 = relX2 * sin + relY2 * cos + centerY;
                
                console.log('Rotated points:', {
                    point1: { x: rotatedX1, y: rotatedY1 },
                    point2: { x: rotatedX2, y: rotatedY2 }
                });
                
                // 新しい変換パラメータを作成
                const newImageVector = {
                    x: rotatedX2 - rotatedX1,
                    y: rotatedY2 - rotatedY1
                };
                
                // スケールファクター（回転後も同じ）
                const newImageDistance = Math.sqrt(newImageVector.x * newImageVector.x + newImageVector.y * newImageVector.y);
                const mapDistance = Math.sqrt(mapVector.lat * mapVector.lat + mapVector.lng * mapVector.lng);
                const scaleX = mapVector.lng / newImageVector.x;
                const scaleY = mapVector.lat / newImageVector.y;
                
                // 回転後画像の4隅を変換
                const transformPoint = (imageX, imageY) => {
                    const relX = imageX - rotatedX1;
                    const relY = imageY - rotatedY1;
                    
                    const lat = mapPoint1.lat + (relY * scaleY);
                    const lng = mapPoint1.lng + (relX * scaleX);
                    
                    return [lat, lng];
                };
                
                const newCorners = [
                    transformPoint(0, 0), // 左上
                    transformPoint(diagonal, 0), // 右上
                    transformPoint(diagonal, diagonal), // 右下
                    transformPoint(0, diagonal) // 左下
                ];
                
                const newLats = newCorners.map(corner => corner[0]);
                const newLngs = newCorners.map(corner => corner[1]);
                
                const newBounds = [
                    [Math.min(...newLats), Math.min(...newLngs)], // 南西
                    [Math.max(...newLats), Math.max(...newLngs)]  // 北東
                ];
                
                console.log('New bounds for rotated image:', newBounds);
                
                const overlay = L.imageOverlay(rotatedImageUrl, newBounds, {
                    opacity: opacity,
                    interactive: false
                }).addTo(this.map);
                
                overlay.setOpacity = function(newOpacity) {
                    const img = this.getElement();
                    if (img) {
                        img.style.opacity = newOpacity;
                    }
                    this.options.opacity = newOpacity;
                }.bind(overlay);
                
                resolve(overlay);
            };
            
            img.src = this.imageData.url;
        });
    }
    
    applyOverlay() {
        console.log('🔄 applyOverlay実行:', {
            imagePoints: this.imagePoints.length,
            mapPoints: this.mapPoints.length,
            imagePointsData: this.imagePoints,
            mapPointsData: this.mapPoints
        });
        
        if (this.imagePoints.length !== 2 || this.mapPoints.length !== 2) {
            console.warn('⚠️ 点の選択が不十分です。画像2点、地図2点が必要です。');
            alert('画像上で2点、地図上で2点を選択してください。');
            return;
        }
        
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
        
        // 2点が正確に一致する画像オーバーレイを作成
        const opacity = parseFloat(document.getElementById('imageOpacity').value);
        
        // カスタム画像オーバーレイで正確な2点対応を実現
        const overlayResult = this.create2PointImageOverlay(bounds, opacity);
        
        // Promiseかどうかをチェック
        if (overlayResult instanceof Promise) {
            overlayResult.then((overlay) => {
                this.overlayLayer = overlay;
                this.finishApplyOverlay();
            });
        } else {
            this.overlayLayer = overlayResult;
            this.finishApplyOverlay();
        }
    }
    
    finishApplyOverlay() {
        // オーバーレイデータを保存（位置調整キャンセル時に使用）
        if (this.overlayLayer) {
            const bounds = this.overlayLayer.getBounds();
            this.savedOverlayData = {
                imageUrl: this.imageData.url,
                bounds: [
                    bounds.getSouthWest().lat,
                    bounds.getSouthWest().lng,
                    bounds.getNorthEast().lat,
                    bounds.getNorthEast().lng
                ]
            };
        }
        
        // 画像ウィンドウは閉じる
        if (this.imageWindow) {
            this.imageWindow.close();
        }
        
        // マップのカーソルを元に戻す
        this.setMapCursor('');
        
        // オーバーレイマネージャーのマップクリックイベントを削除（ピンマネージャーと競合しないように）
        if (this.mapClickHandler) {
            this.map.off('click', this.mapClickHandler);
        }
        
        // UIの更新
        this.applyButton.disabled = true;
        this.applyButton.style.display = 'none';
        
        // オーバーレイが完全に作成されてからピンマネージャーを有効化
        if (this.onOverlayApplied) {
            this.onOverlayApplied();
        }
        
        const info = this.overlaySection.querySelector('.info');
        info.innerHTML = `
            <div style="font-size: 18px; font-weight: bold; color: #28a745; margin-bottom: 10px;">
                🎉 画像が地図に配置されました！
            </div>
            <div style="font-size: 14px; margin-bottom: 15px; color: #155724;">
                地図上をCLICKしてピンを配置し、掲示場情報を入力してください
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
        closeBtn.innerHTML = '✕ 閉じる（CLICK）';
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
        // 位置調整モードを開始
        this.isRepositioning = true;
        
        // ボタンのテキストを変更
        const repositionBtn = document.getElementById('repositionBtn');
        if (repositionBtn) {
            repositionBtn.textContent = '位置の調整をキャンセル';
            repositionBtn.style.background = '#c0392b'; // より暗い赤色に変更
        }
        
        // 位置調整モード
        if (this.overlayLayer) {
            this.map.removeLayer(this.overlayLayer);
            this.overlayLayer = null;
        }
        
        // ピンマネージャーを無効化（位置調整中はピンを配置できないようにする）
        if (window.app && window.app.pinManager) {
            window.app.pinManager.disable();
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
                    html: `<div style="background-color: ${colors[index]}; color: white; width: 36px; height: 36px; border-radius: 50%; font-size: 16px; font-weight: bold; box-shadow: 0 3px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">${index + 1}</div>`,
                    iconSize: [36, 36]
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
        this.applyButton.style.display = 'block';
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
                💡 位置が決まったら「位置合わせを実行」をCLICK
            </div>
        `;
        info.style.backgroundColor = '#fef9e7';
        info.style.color = '#856404';
    }
    
    deleteImage() {
        console.log('deleteImage called');
        
        // ピンが登録されている場合はクリア
        if (window.app && window.app.pinManager) {
            if (window.app.pinManager.getPins().length > 0) {
                window.app.pinManager.clearAllPins();
            }
            window.app.pinManager.disable();
        }
        
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
        
        // 右サイドバーとピンセクションも非表示
        const rightSidebar = document.getElementById('rightSidebar');
        const pinSection = document.getElementById('pinSection');
        if (rightSidebar) rightSidebar.style.display = 'none';
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
        
        // マップのカーソルを元に戻す
        this.setMapCursor('');
        
        // 画像データをクリア
        this.imageData = null;
        
        // 都道府県・市区町村の入力もクリア
        const prefectureInput = document.getElementById('prefectureInput');
        const cityInput = document.getElementById('cityInput');
        if (prefectureInput) prefectureInput.value = '';
        if (cityInput) cityInput.value = '';
        
        console.log('deleteImage completed - reset to initial state');
    }
    
    cancelRepositioning() {
        // 位置調整モードをキャンセル
        this.isRepositioning = false;
        
        // ボタンのテキストを元に戻す
        const repositionBtn = document.getElementById('repositionBtn');
        if (repositionBtn) {
            repositionBtn.textContent = '位置を調整';
            repositionBtn.style.background = '#e67e22'; // 元のオレンジ色に戻す
        }
        
        // マーカーを削除
        this.mapMarkers.forEach(marker => marker.remove());
        this.mapMarkers = [];
        
        // プレビュー矩形を削除
        if (this.previewRectangle) {
            this.map.removeLayer(this.previewRectangle);
            this.previewRectangle = null;
        }
        
        // オーバーレイレイヤーを再度追加
        if (this.savedOverlayData) {
            const bounds = L.latLngBounds(
                [this.savedOverlayData.bounds[0], this.savedOverlayData.bounds[1]],
                [this.savedOverlayData.bounds[2], this.savedOverlayData.bounds[3]]
            );
            
            this.overlayLayer = L.imageOverlay(this.savedOverlayData.imageUrl, bounds, {
                opacity: parseFloat(document.getElementById('imageOpacity').value) || 0.7
            }).addTo(this.map);
        }
        
        // ピンマネージャーを再度有効化
        if (window.app && window.app.pinManager) {
            window.app.pinManager.enable();
        }
        
        // インフォメッセージを表示
        const info = document.getElementById('overlayInfo');
        info.innerHTML = `
            <div style="font-size: 16px; font-weight: bold; color: #3498db;">
                📍 位置調整をキャンセルしました
            </div>
            <div style="font-size: 14px; margin-top: 10px;">
                画像の配置を維持し、ピン配置モードに戻りました
            </div>
        `;
        info.style.backgroundColor = '#ecf0f1';
        info.style.color = '#2c3e50';
        
        // 地図のクリックイベントリスナーを削除
        this.map.off('click', this.mapClickHandler);
        this.mapClickHandler = null;
        
        // カーソルを元に戻す
        this.setMapCursor('');
    }
    
    resetPointsOnly() {
        // setImage用のリセット（画像ウィンドウは閉じない）
        this.imagePoints = [];
        this.mapPoints = [];
        
        // マーカーを削除（各点につき2つのマーカー）
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
        
        // マーカーを削除（各点につき2つのマーカー）
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
        
        // ピンマネージャーを無効化（念のため）
        if (window.app && window.app.pinManager) {
            window.app.pinManager.disable();
        }
        
        // オーバーレイマネージャーのマップクリックイベントを復活
        if (this.mapClickHandler) {
            this.map.off('click', this.mapClickHandler);
            this.map.on('click', this.mapClickHandler);
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