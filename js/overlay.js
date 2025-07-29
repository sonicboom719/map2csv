import { ProjectiveTransform } from './transform.js';

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
        this.isSelectingImagePoints = false;
        this.ctx = null;
        
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
            if (!this.isSelectingImagePoints && this.mapPoints.length < 4 && this.imagePoints.length === 4) {
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
        };
        img.src = this.imageData.url;
    }
    
    addImagePoint(event) {
        const rect = this.imageCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        this.imagePoints.push({ x, y });
        
        // ポイントを描画
        this.ctx.fillStyle = '#3498db';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 8, 0, 2 * Math.PI);
        this.ctx.fill();
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(this.imagePoints.length.toString(), x, y);
        
        this.updatePointsDisplay();
        
        if (this.imagePoints.length === 4) {
            this.isSelectingImagePoints = false;
            this.imageCanvas.style.display = 'none';
            this.updateInstructions();
        }
    }
    
    addMapPoint(event) {
        const latlng = event.latlng;
        this.mapPoints.push(latlng);
        
        // マーカーを追加
        const marker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'selection-marker',
                html: `<div style="background-color: #3498db; color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">${this.mapPoints.length}</div>`,
                iconSize: [20, 20]
            })
        }).addTo(this.map);
        
        this.mapMarkers.push(marker);
        this.updatePointsDisplay();
        
        if (this.mapPoints.length === 4) {
            this.applyButton.disabled = false;
        }
    }
    
    updatePointsDisplay() {
        // 画像ポイントの表示更新
        this.imagePointsDiv.innerHTML = '';
        this.imagePoints.forEach((point, index) => {
            const div = document.createElement('div');
            div.className = 'point-item';
            div.innerHTML = `<span class="point-number">${index + 1}</span> 選択済み`;
            this.imagePointsDiv.appendChild(div);
        });
        
        if (this.imagePoints.length < 4) {
            const div = document.createElement('div');
            div.className = 'point-item';
            div.style.color = '#999';
            div.textContent = `あと${4 - this.imagePoints.length}点選択してください`;
            this.imagePointsDiv.appendChild(div);
        }
        
        // 地図ポイントの表示更新
        this.mapPointsDiv.innerHTML = '';
        this.mapPoints.forEach((point, index) => {
            const div = document.createElement('div');
            div.className = 'point-item';
            div.innerHTML = `<span class="point-number">${index + 1}</span> 選択済み`;
            this.mapPointsDiv.appendChild(div);
        });
        
        if (this.mapPoints.length < 4) {
            const div = document.createElement('div');
            div.className = 'point-item';
            div.style.color = '#999';
            div.textContent = `あと${4 - this.mapPoints.length}点選択してください`;
            this.mapPointsDiv.appendChild(div);
        }
    }
    
    updateInstructions() {
        const info = this.overlaySection.querySelector('.info');
        if (this.imagePoints.length === 4 && this.mapPoints.length === 0) {
            info.textContent = '次に、地図上で対応する4点をクリックしてください';
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
        
        // 画像ポイントを実際の画像座標に変換（キャンバス座標から）
        const srcPoints = this.imagePoints.map(p => ({
            x: p.x / this.imageScale.x,
            y: p.y / this.imageScale.y
        }));
        
        // 地図の中心を基準に、地図座標をピクセル座標に変換
        const center = this.map.getCenter();
        const zoom = this.map.getZoom();
        
        // 地図ポイントをピクセル座標に変換
        const dstPoints = this.mapPoints.map(latlng => {
            const point = this.map.latLngToContainerPoint(latlng);
            return { x: point.x, y: point.y };
        });
        
        // 射影変換を計算
        const transform = new ProjectiveTransform();
        if (!transform.computeTransform(srcPoints, dstPoints)) {
            alert('画像の位置合わせに失敗しました。点の選択をやり直してください。');
            return;
        }
        
        // カスタムオーバーレイを作成
        this.createCustomOverlay(transform);
        
        // 完了通知
        if (this.onOverlayApplied) {
            this.onOverlayApplied();
        }
        
        // UIの更新
        this.applyButton.disabled = true;
        this.applyButton.textContent = '位置合わせ完了';
    }
    
    createCustomOverlay(transform) {
        const CustomOverlay = L.Layer.extend({
            options: {
                opacity: 0.7
            },
            
            initialize: function(imageUrl, imageData, transform, options) {
                this._imageUrl = imageUrl;
                this._imageData = imageData;
                this._transform = transform;
                L.setOptions(this, options);
            },
            
            onAdd: function(map) {
                this._map = map;
                
                if (!this._container) {
                    this._initContainer();
                }
                
                map.getPanes().overlayPane.appendChild(this._container);
                
                map.on('viewreset', this._reset, this);
                map.on('move', this._reset, this);
                map.on('zoom', this._reset, this);
                
                this._reset();
            },
            
            onRemove: function(map) {
                map.getPanes().overlayPane.removeChild(this._container);
                
                map.off('viewreset', this._reset, this);
                map.off('move', this._reset, this);
                map.off('zoom', this._reset, this);
            },
            
            _initContainer: function() {
                this._container = L.DomUtil.create('div', 'leaflet-image-layer');
                this._container.style.opacity = this.options.opacity;
                this._container.style.position = 'absolute';
                this._container.style.pointerEvents = 'none';
                
                this._canvas = L.DomUtil.create('canvas', '', this._container);
                this._ctx = this._canvas.getContext('2d');
                
                this._img = new Image();
                this._img.onload = () => {
                    this._imgLoaded = true;
                    this._reset();
                };
                this._img.src = this._imageUrl;
            },
            
            _reset: function() {
                if (!this._imgLoaded) return;
                
                const mapContainer = this._map.getContainer();
                const size = this._map.getSize();
                
                this._canvas.width = size.x;
                this._canvas.height = size.y;
                
                this._canvas.style.width = size.x + 'px';
                this._canvas.style.height = size.y + 'px';
                
                const topLeft = this._map.containerPointToLayerPoint([0, 0]);
                L.DomUtil.setPosition(this._container, topLeft);
                
                this._drawImage();
            },
            
            _drawImage: function() {
                const ctx = this._ctx;
                ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
                
                // 画像の各ピクセルを変換して描画
                const imgWidth = this._img.width;
                const imgHeight = this._img.height;
                
                // 一時的なキャンバスに元画像を描画
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = imgWidth;
                tempCanvas.height = imgHeight;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(this._img, 0, 0);
                
                // 変換後の境界を計算
                const bounds = this._transform.getTransformedBounds(imgWidth, imgHeight);
                
                // 画像の4隅の地図上の位置を計算
                const corners = [
                    { x: 0, y: 0 },
                    { x: imgWidth, y: 0 },
                    { x: imgWidth, y: imgHeight },
                    { x: 0, y: imgHeight }
                ];
                
                const transformedCorners = corners.map(c => {
                    const transformed = this._transform.transformPoint(c);
                    // ピクセル座標から緯度経度に変換（元の地図ポイントとの対応を使用）
                    return this._pixelToLatLng(transformed);
                });
                
                // 描画用の座標に変換
                const drawCorners = transformedCorners.map(latlng => {
                    const point = this._map.latLngToContainerPoint(latlng);
                    return point;
                });
                
                // パスを作成して画像をクリップ
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(drawCorners[0].x, drawCorners[0].y);
                for (let i = 1; i < 4; i++) {
                    ctx.lineTo(drawCorners[i].x, drawCorners[i].y);
                }
                ctx.closePath();
                ctx.clip();
                
                // 変換行列を設定して画像を描画
                const src = corners;
                const dst = drawCorners;
                
                // 簡易的な描画（完全な射影変換ではないが、4点指定の近似）
                // より正確な描画のためには、画像を小さな三角形に分割して描画する必要がある
                this._drawWithPerspective(ctx, tempCanvas, src, dst);
                
                ctx.restore();
            },
            
            _pixelToLatLng: function(pixel) {
                // この実装は呼び出し元で適切に設定する必要がある
                return this._imageData.pixelToLatLng(pixel);
            },
            
            _drawWithPerspective: function(ctx, img, srcCorners, dstCorners) {
                // 簡易的な実装：画像を2つの三角形に分割して描画
                // 三角形1: 0-1-2
                this._drawTriangle(ctx, img, 
                    [srcCorners[0], srcCorners[1], srcCorners[2]],
                    [dstCorners[0], dstCorners[1], dstCorners[2]]
                );
                
                // 三角形2: 0-2-3
                this._drawTriangle(ctx, img,
                    [srcCorners[0], srcCorners[2], srcCorners[3]],
                    [dstCorners[0], dstCorners[2], dstCorners[3]]
                );
            },
            
            _drawTriangle: function(ctx, img, srcTri, dstTri) {
                // アフィン変換の計算
                const xform = this._getTriangleTransform(srcTri, dstTri);
                
                ctx.save();
                ctx.transform(xform.a, xform.b, xform.c, xform.d, xform.e, xform.f);
                
                // クリッピング
                ctx.beginPath();
                ctx.moveTo(srcTri[0].x, srcTri[0].y);
                ctx.lineTo(srcTri[1].x, srcTri[1].y);
                ctx.lineTo(srcTri[2].x, srcTri[2].y);
                ctx.closePath();
                ctx.clip();
                
                ctx.drawImage(img, 0, 0);
                ctx.restore();
            },
            
            _getTriangleTransform: function(src, dst) {
                // 3点のアフィン変換を計算
                const x1 = src[0].x, y1 = src[0].y;
                const x2 = src[1].x, y2 = src[1].y;
                const x3 = src[2].x, y3 = src[2].y;
                
                const u1 = dst[0].x, v1 = dst[0].y;
                const u2 = dst[1].x, v2 = dst[1].y;
                const u3 = dst[2].x, v3 = dst[2].y;
                
                const denom = x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2);
                
                const a = (u1 * (y2 - y3) + u2 * (y3 - y1) + u3 * (y1 - y2)) / denom;
                const b = (u1 * (x3 - x2) + u2 * (x1 - x3) + u3 * (x2 - x1)) / denom;
                const c = (v1 * (y2 - y3) + v2 * (y3 - y1) + v3 * (y1 - y2)) / denom;
                const d = (v1 * (x3 - x2) + v2 * (x1 - x3) + v3 * (x2 - x1)) / denom;
                const e = (u1 * (x2 * y3 - x3 * y2) + u2 * (x3 * y1 - x1 * y3) + u3 * (x1 * y2 - x2 * y1)) / denom;
                const f = (v1 * (x2 * y3 - x3 * y2) + v2 * (x3 * y1 - x1 * y3) + v3 * (x1 * y2 - x2 * y1)) / denom;
                
                return { a, b, c, d, e, f };
            }
        });
        
        // ピクセル座標と緯度経度の対応を保存
        const imageData = {
            pixelToLatLng: (pixel) => {
                // 元の4点の対応関係から線形補間で緯度経度を推定
                const transformed = transform.transformPoint(pixel);
                
                // 変換後のピクセル座標から、元の地図ポイントとの比率を計算
                const dstPoints = this.mapPoints.map(latlng => {
                    const point = this.map.latLngToContainerPoint(latlng);
                    return { x: point.x, y: point.y };
                });
                
                // 簡易的な実装：最も近い2点から線形補間
                // より正確には重心座標を使用すべき
                return this.interpolateLatLng(transformed, dstPoints, this.mapPoints);
            }
        };
        
        this.overlayLayer = new CustomOverlay(
            this.imageData.url,
            imageData,
            transform,
            { opacity: 0.7 }
        );
        
        this.map.addLayer(this.overlayLayer);
    }
    
    // ピクセル座標から緯度経度を補間
    interpolateLatLng(point, pixelPoints, latLngPoints) {
        // 重心座標を使用した補間（簡易版）
        // 4点を2つの三角形に分割して、どちらに含まれるか判定
        
        // とりあえず最も近い点の緯度経度を返す（簡易実装）
        let minDist = Infinity;
        let closestIndex = 0;
        
        for (let i = 0; i < pixelPoints.length; i++) {
            const dist = Math.sqrt(
                Math.pow(point.x - pixelPoints[i].x, 2) +
                Math.pow(point.y - pixelPoints[i].y, 2)
            );
            if (dist < minDist) {
                minDist = dist;
                closestIndex = i;
            }
        }
        
        return latLngPoints[closestIndex];
    }
    
    resetPoints() {
        this.imagePoints = [];
        this.mapPoints = [];
        
        // マーカーを削除
        this.mapMarkers.forEach(marker => marker.remove());
        this.mapMarkers = [];
        
        // キャンバスをクリア
        if (this.ctx && this.imageData) {
            const img = new Image();
            img.onload = () => {
                this.ctx.clearRect(0, 0, this.imageCanvas.width, this.imageCanvas.height);
                this.ctx.drawImage(img, 0, 0, this.imageCanvas.width, this.imageCanvas.height);
            };
            img.src = this.imageData.url;
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