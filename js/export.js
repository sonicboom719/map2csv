export class CsvExporter {
    constructor(options) {
        this.exportButton = options.exportButton;
        this.pinManager = options.pinManager;
        
        this.setupEventHandlers();
    }
    
    setupEventHandlers() {
        this.exportButton.addEventListener('click', () => {
            this.exportToCsv();
        });
    }
    
    exportToCsv() {
        const pins = this.pinManager.getPins();
        
        if (pins.length === 0) {
            alert('エクスポートするピンがありません。');
            return;
        }
        
        // 都道府県と市区町村を取得
        const prefecture = document.getElementById('prefectureInput').value.trim();
        const city = document.getElementById('cityInput').value.trim();
        
        // CSVデータを作成
        const csvData = [
            ['都道府県', '市区町村', '緯度', '経度', '掲示場番号', 'メモ'], // ヘッダー
            ...pins.map(pin => [
                prefecture,
                city,
                pin.latitude.toFixed(6),
                pin.longitude.toFixed(6),
                pin.number || '',
                pin.memo || ''
            ])
        ];
        
        // PapaParseを使用してCSVを生成
        const csv = Papa.unparse(csvData, {
            quotes: true,
            delimiter: ',',
            header: false
        });
        
        // BOMを追加（Excelで日本語が文字化けしないように）
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8' });
        
        // ダウンロードリンクを作成
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // ファイル名に日時を含める
        const now = new Date();
        const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
        a.download = `pins_${dateStr}.csv`;
        
        // ダウンロードを実行
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // URLを解放
        URL.revokeObjectURL(url);
        
        // 完了メッセージ
        const message = `${pins.length}件のピン情報をCSVファイルとしてダウンロードしました。`;
        alert(message);
    }
}