export class CsvExporter {
    constructor(options) {
        this.exportButton = options.exportButton;
        this.pinManager = options.pinManager;
        
        // モーダル要素を取得
        this.modal = document.getElementById('csvExportModal');
        this.prefectureInput = document.getElementById('exportPrefecture');
        this.cityInput = document.getElementById('exportCity');
        this.suffixInput = document.getElementById('exportSuffix');
        this.filenamePreview = document.getElementById('filenamePreview');
        this.executeButton = document.getElementById('executeExport');
        this.cancelButton = document.getElementById('cancelExport');
        
        this.setupEventHandlers();
    }
    
    setupEventHandlers() {
        // CSVエクスポートボタンクリックでモーダルを開く
        this.exportButton.addEventListener('click', () => {
            this.openExportModal();
        });
        
        // エクスポート実行ボタン
        this.executeButton.addEventListener('click', () => {
            this.exportToCsv();
        });
        
        // キャンセルボタン
        this.cancelButton.addEventListener('click', () => {
            this.closeModal();
        });
        
        // モーダル外クリックで閉じる
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });
        
        // Escキーでモーダルを閉じる
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.style.display !== 'none') {
                this.closeModal();
            }
        });
        
        // 入力値変更でプレビューを更新
        [this.cityInput, this.suffixInput].forEach(input => {
            input.addEventListener('input', () => {
                this.updateFilenamePreview();
            });
        });
    }
    
    openExportModal() {
        const pins = this.pinManager.getPins();
        
        if (pins.length === 0) {
            alert('エクスポートするピンがありません。');
            return;
        }
        
        // 既存の都道府県・市区町村入力値を取得してプリセット
        const currentPrefecture = document.getElementById('prefectureInput').value.trim();
        const currentCity = document.getElementById('cityInput').value.trim();
        
        this.prefectureInput.value = currentPrefecture;
        this.cityInput.value = currentCity;
        
        // ファイル名プレビューを更新
        this.updateFilenamePreview();
        
        // モーダルを表示
        this.modal.style.display = 'flex';
        
        // 最初の空の入力欄にフォーカス
        if (!this.prefectureInput.value) {
            this.prefectureInput.focus();
        } else if (!this.cityInput.value) {
            this.cityInput.focus();
        } else {
            this.suffixInput.focus();
        }
    }
    
    closeModal() {
        this.modal.style.display = 'none';
    }
    
    updateFilenamePreview() {
        const city = this.cityInput.value.trim() || 'sample';
        const suffix = this.suffixInput.value.trim();
        
        // _normalized + suffix.csv の形式
        const filename = `${city}_normalized${suffix}.csv`;
        this.filenamePreview.textContent = filename;
    }
    
    exportToCsv() {
        const pins = this.pinManager.getPins();
        
        if (pins.length === 0) {
            alert('エクスポートするピンがありません。');
            return;
        }
        
        // モーダルから都道府県と市区町村を取得
        const prefecture = this.prefectureInput.value.trim();
        const city = this.cityInput.value.trim();
        const suffix = this.suffixInput.value.trim();
        
        // CSVデータを作成
        const csvData = [
            ['prefecture', 'city', 'number', 'address', 'name', 'lat', 'long', 'note'], // ヘッダー
            ...pins.map(pin => [
                prefecture,
                city,
                pin.number || '', // 掲示場番号を出力
                '', // address is always empty
                pin.name || '',
                pin.latitude.toFixed(6),
                pin.longitude.toFixed(6),
                pin.memo || ''
            ])
        ];
        
        // PapaParseを使用してCSVを生成（引用符なし）
        const csv = Papa.unparse(csvData, {
            quotes: false,
            delimiter: ',',
            header: false
        });
        
        // UTF-8（BOMなし）で出力
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        
        // ダウンロードリンクを作成
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // ファイル名を {city}_normalized{suffix}.csv 形式にする
        // cityが空の場合は "unknown" を使用
        const cityName = city || 'unknown';
        a.download = `${cityName}_normalized${suffix}.csv`;
        
        // ダウンロードを実行
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // URLを解放
        URL.revokeObjectURL(url);
        
        // モーダルを閉じる
        this.closeModal();
    }
}