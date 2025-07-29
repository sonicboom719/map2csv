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
        this.isSelectingMode = 'none'; // 'none', 'image', 'map'
        this.ctx = null;
        
        this.setupEventHandlers();
    }
    
    setupEventHandlers() {
        this.applyButton.addEventListener('click', () => {
            this.applyOverlay();
        });
        
        this.resetButton.addEventListener('click', () => {
            this.resetPoints();
        });
    }
    
    setImage(imageData) {
        this.imageData = imageData;
        this.resetPoints();
        this.showImageSelection();
    }
    
    showImageSelection() {
        // 簡略化：画像の4隅を自動的に使用
        const corners = [
            { x: 0, y: 0, name: '左上' },
            { x: this.imageData.width, y: 0, name: '右上' },
            { x: this.imageData.width, y: this.imageData.height, name: '右下' },
            { x: 0, y: this.imageData.height, name: '左下' }
        ];
        
        this.imagePoints = corners;
        this.updatePointsDisplay();
        
        // 地図上での範囲選択を開始
        this.startMapSelection();
    }
    
    startMapSelection() {
        this.isSelectingMode = 'map';
        
        const info = this.overlaySection.querySelector('.info');
        info.innerHTML = `<strong>地図上で画像を配置したい範囲を指定してください</strong><br>
                         1. 左上の角をクリック<br>
                         2. 右下の角をクリック`;
        info.style.backgroundColor = '#fff3cd';
        info.style.color = '#856404';
        
        // 地図クリックイベントを設定
        this.map.on('click', this.handleMapClick, this);
    }
    
    handleMapClick(e) {
        if (this.isSelectingMode !== 'map') return;
        
        const latlng = e.latlng;
        this.mapPoints.push(latlng);
        
        // マーカーを追加
        const pointNames = ['左上', '右下'];
        const marker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'selection-marker',
                html: `<div style="background-color: #e74c3c; color: white; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3); white-space: nowrap;">${pointNames[this.mapPoints.length - 1]}</div>`,
                iconSize: [60, 30]
            })
        }).addTo(this.map);
        
        this.mapMarkers.push(marker);
        
        if (this.mapPoints.length === 2) {
            // 2点が選択されたら、残りの2点を自動計算
            const leftTop = this.mapPoints[0];
            const rightBottom = this.mapPoints[1];
            
            // 右上と左下を追加
            const rightTop = L.latLng(leftTop.lat, rightBottom.lng);
            const leftBottom = L.latLng(rightBottom.lat, leftTop.lng);
            
            this.mapPoints = [leftTop, rightTop, rightBottom, leftBottom];
            
            // 範囲を表示
            this.showSelectionRectangle();
            
            this.map.off('click', this.handleMapClick, this);
            this.isSelectingMode = 'none';
            this.applyButton.disabled = false;
            
            const info = this.overlaySection.querySelector('.info');
            info.innerHTML = '<strong>範囲が選択されました</strong><br>「位置合わせを実行」をクリックして画像を配置します';
            info.style.backgroundColor = '#d4edda';
            info.style.color = '#155724';
        }
        
        this.updatePointsDisplay();
    }
    
    showSelectionRectangle() {
        // 選択範囲を矩形で表示
        const bounds = L.latLngBounds(this.mapPoints[0], this.mapPoints[2]);
        
        L.rectangle(bounds, {
            color: '#e74c3c',
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.1,
            fillColor: '#e74c3c'
        }).addTo(this.map);
    }
    
    applyOverlay() {
        if (this.mapPoints.length !== 4) return;
        
        // 既存のオーバーレイを削除
        if (this.overlayLayer) {
            this.map.removeLayer(this.overlayLayer);
        }
        
        // 選択マーカーを削除
        this.mapMarkers.forEach(marker => marker.remove());
        this.mapMarkers = [];
        
        // 境界ボックスを作成
        const bounds = L.latLngBounds(this.mapPoints[0], this.mapPoints[2]);
        
        // 画像オーバーレイを作成
        this.overlayLayer = L.imageOverlay(this.imageData.url, bounds, {
            opacity: 0.7,
            interactive: false
        }).addTo(this.map);
        
        console.log('Image overlay applied with bounds:', bounds);
        
        // 地図を画像の範囲にフィット
        this.map.fitBounds(bounds, { padding: [50, 50] });
        
        // 完了通知
        if (this.onOverlayApplied) {
            this.onOverlayApplied();
        }
        
        // UIの更新
        this.applyButton.disabled = true;
        this.applyButton.textContent = '位置合わせ完了';
        
        const info = this.overlaySection.querySelector('.info');
        info.innerHTML = '<strong>画像の配置が完了しました！</strong><br>地図上をクリックしてピンを配置できます';
        info.style.backgroundColor = '#d4edda';
        info.style.color = '#155724';
    }
    
    updatePointsDisplay() {
        // 画像ポイントの表示更新（自動設定）
        this.imagePointsDiv.innerHTML = '<div style="color: #28a745; font-size: 14px;">✓ 画像の4隅を自動設定しました</div>';
        
        // 地図ポイントの表示更新
        this.mapPointsDiv.innerHTML = '';
        
        if (this.mapPoints.length === 0) {
            this.mapPointsDiv.innerHTML = '<div style="color: #999; font-size: 14px;">地図上で範囲を選択してください</div>';
        } else if (this.mapPoints.length === 1) {
            this.mapPointsDiv.innerHTML = '<div style="color: #17a2b8; font-size: 14px;">左上を選択しました。次に右下を選択してください</div>';
        } else {
            this.mapPointsDiv.innerHTML = '<div style="color: #28a745; font-size: 14px;">✓ 範囲が選択されました</div>';
        }
    }
    
    resetPoints() {
        this.imagePoints = [];
        this.mapPoints = [];
        
        // マーカーを削除
        this.mapMarkers.forEach(marker => marker.remove());
        this.mapMarkers = [];
        
        // 地図のクリックイベントを解除
        this.map.off('click', this.handleMapClick, this);
        this.isSelectingMode = 'none';
        
        this.updatePointsDisplay();
        this.applyButton.disabled = true;
        this.applyButton.textContent = '位置合わせを実行';
        
        // 説明を元に戻す
        const info = this.overlaySection.querySelector('.info');
        info.textContent = '画像を配置する範囲を地図上で指定してください';
        info.style.backgroundColor = '#e3f2fd';
        info.style.color = '#1976d2';
        
        // 画像が設定されている場合は再開
        if (this.imageData) {
            this.showImageSelection();
        }
    }
}