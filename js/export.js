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
            ['prefecture', 'city', 'number', 'address', 'name', 'lat', 'long', 'note'], // ヘッダー
            ...pins.map(pin => [
                prefecture,
                city,
                pin.number || '',
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
        
        // ファイル名を {city}_normalized_yyyymmddhhmmss.csv 形式にする
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const dateStr = `${year}${month}${day}${hours}${minutes}${seconds}`;
        
        // cityが空の場合は "unknown" を使用
        const cityName = city || 'unknown';
        a.download = `${cityName}_normalized_${dateStr}.csv`;
        
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