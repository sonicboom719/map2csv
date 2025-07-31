/**
 * 正規化CSVファイルのマージとソート機能を提供するクラス
 */
export class ConcatCsv {
    constructor() {
        this.uploadedFiles = [];
        this.mergedData = [];
        this.originalMergedData = []; // 元の順序を保持
        this.sortType = 'none'; // 'none', 'string', 'numeric'
        this.globalPrefecture = null; // 全ファイル共通のprefecture
        this.globalCity = null; // 全ファイル共通のcity
    }
    
    /**
     * 正規化CSVファイルを追加
     * @param {File} file - 正規化CSVファイル
     * @returns {Promise<void>}
     */
    async addFile(file) {
        console.log('ConcatCsv.addFile called with:', file.name);
        const text = await file.text();
        console.log('File text length:', text.length);
        console.log('File text preview:', text.substring(0, 200));
        
        const parsed = Papa.parse(text, {
            header: true,
            skipEmptyLines: true
        });
        
        console.log('Parsed data:', parsed.data);
        console.log('Parse errors:', parsed.errors);
        
        if (parsed.errors.length > 0) {
            // 最初のエラーのみを表示
            const firstError = parsed.errors[0];
            
            // エラータイプを日本語に変換
            let errorMessage = '';
            switch (firstError.type) {
                case 'FieldMismatch':
                    if (firstError.code === 'TooManyFields') {
                        errorMessage = `列数が多すぎます: ${firstError.message || ''}`;
                    } else if (firstError.code === 'TooFewFields') {
                        errorMessage = `列数が少なすぎます: ${firstError.message || ''}`;
                    } else {
                        errorMessage = `列数が一致しません: ${firstError.message || ''}`;
                    }
                    break;
                case 'Quotes':
                    errorMessage = `引用符のエラー: ${firstError.message || ''}`;
                    break;
                default:
                    errorMessage = firstError.message || 'パースエラー';
            }
            
            // 行番号の修正
            // PapaParseのrowはデータ行のインデックス（0ベース）
            // CSVファイルの実際の行番号 = row + 2（ヘッダー行 + 1）
            console.log('PapaParse error row:', firstError.row);
            const displayRow = firstError.row !== undefined ? firstError.row + 2 : '不明';
            
            throw new Error(`${file.name} - ${errorMessage} (行: ${displayRow})`);
        }
        
        // ヘッダー行のバリデーション
        if (parsed.data.length > 0) {
            // 必須列の定義（prefecture,city,number,address,name,lat,long）
            const requiredColumns = ['prefecture', 'city', 'number', 'address', 'name', 'lat', 'long'];
            const optionalColumns = ['note']; // 任意列
            const headers = Object.keys(parsed.data[0]);
            
            // 必須列の確認
            const missingColumns = requiredColumns.filter(col => !headers.includes(col));
            
            if (missingColumns.length > 0) {
                throw new Error(`${file.name} - 必須列が不足しています: ${missingColumns.join(', ')}`);
            }
            
            // 許可されていない列の確認
            const allowedColumns = [...requiredColumns, ...optionalColumns];
            const unexpectedColumns = headers.filter(col => !allowedColumns.includes(col));
            
            if (unexpectedColumns.length > 0) {
                throw new Error(`${file.name} - 許可されていない列があります: ${unexpectedColumns.join(', ')}`);
            }
        } else {
            throw new Error(`${file.name} - データが空です`);
        }
        
        this.uploadedFiles.push({
            name: file.name,
            data: parsed.data,
            errors: [] // エラー情報を保持（将来の拡張用）
        });
        
        console.log('Files uploaded count:', this.uploadedFiles.length);
        this.mergeFiles();
    }
    
    /**
     * ファイルを削除
     * @param {number} index - ファイルのインデックス
     */
    removeFile(index) {
        this.uploadedFiles.splice(index, 1);
        // 全ファイルが削除された場合はグローバル値もリセット
        if (this.uploadedFiles.length === 0) {
            this.globalPrefecture = null;
            this.globalCity = null;
        }
        this.mergeFiles();
    }
    
    /**
     * 全ファイルをクリア
     */
    clearFiles() {
        this.uploadedFiles = [];
        this.mergedData = [];
        this.originalMergedData = [];
        this.globalPrefecture = null;
        this.globalCity = null;
    }
    
    /**
     * ファイルをマージ
     */
    mergeFiles() {
        console.log('ConcatCsv.mergeFiles called');
        this.mergedData = [];
        this.cityName = null;
        
        console.log('Processing', this.uploadedFiles.length, 'files');
        
        for (const file of this.uploadedFiles) {
            console.log('Processing file:', file.name, 'with', file.data.length, 'rows');
            let fileHasError = false;
            let filePrefecture = null;
            let fileCity = null;
            let fileRows = []; // このファイルの有効な行データを一時保存
            
            // まず全行をバリデーション
            for (let rowIndex = 0; rowIndex < file.data.length; rowIndex++) {
                const row = file.data[rowIndex];
                console.log('Processing row:', row);
                
                // 空文字列チェック（address, name, note以外は空文字列NG）
                const emptyFields = [];
                
                // prefecture, city, number, lat, longのみチェック
                if (!row.prefecture || row.prefecture.trim() === '') emptyFields.push('prefecture');
                if (!row.city || row.city.trim() === '') emptyFields.push('city');
                if (!row.number || row.number.trim() === '') emptyFields.push('number');
                if (!row.lat || row.lat.toString().trim() === '') emptyFields.push('lat');
                if (!row.long || row.long.toString().trim() === '') emptyFields.push('long');
                
                // address, name, noteは空文字列でもOKなので、明示的にチェックしない
                console.log(`Row ${rowIndex + 2} - address: "${row.address}", name: "${row.name}", note: "${row.note}" (これらは空でもOK)`);
                
                if (emptyFields.length > 0) {
                    file.errors = [{
                        row: rowIndex + 2,
                        message: `必須フィールドが空です: ${emptyFields.join(', ')}`
                    }];
                    console.log(`File ${file.name} has empty required fields at row ${rowIndex + 2}, skipping entire file`);
                    fileHasError = true;
                    break;
                }
                
                // lat/longの数値型と範囲チェック
                const lat = parseFloat(row.lat);
                const long = parseFloat(row.long);
                
                // lat の数値型チェック
                if (isNaN(lat)) {
                    file.errors = [{
                        row: rowIndex + 2,
                        message: `latは実数である必要があります (値: "${row.lat}")`
                    }];
                    fileHasError = true;
                    break;
                }
                
                // long の数値型チェック
                if (isNaN(long)) {
                    file.errors = [{
                        row: rowIndex + 2,
                        message: `longは実数である必要があります (値: "${row.long}")`
                    }];
                    fileHasError = true;
                    break;
                }
                
                // lat の範囲チェック (20 < lat < 50)
                if (lat <= 20 || lat >= 50) {
                    file.errors = [{
                        row: rowIndex + 2,
                        message: `latは20から50の範囲内である必要があります (値: ${lat})`
                    }];
                    fileHasError = true;
                    break;
                }
                
                // long の範囲チェック (110 < long < 160)
                if (long <= 110 || long >= 160) {
                    file.errors = [{
                        row: rowIndex + 2,
                        message: `longは110から160の範囲内である必要があります (値: ${long})`
                    }];
                    fileHasError = true;
                    break;
                }
                
                // prefecture/cityの一貫性チェック
                if (rowIndex === 0) {
                    // 最初の行の値を基準として設定
                    filePrefecture = row.prefecture || '';
                    fileCity = row.city || '';
                    
                    // グローバルな値との比較（最初のファイルの場合は設定、以降は比較）
                    if (this.globalPrefecture === null) {
                        this.globalPrefecture = filePrefecture;
                        this.globalCity = fileCity;
                    } else {
                        // 既存のグローバル値と比較
                        if (filePrefecture !== this.globalPrefecture) {
                            file.errors = [{
                                row: rowIndex + 2,
                                message: `prefectureが他のファイルと一致しません (期待値: "${this.globalPrefecture}", 実際: "${filePrefecture}")`
                            }];
                            fileHasError = true;
                            break;
                        }
                        if (fileCity !== this.globalCity) {
                            file.errors = [{
                                row: rowIndex + 2,
                                message: `cityが他のファイルと一致しません (期待値: "${this.globalCity}", 実際: "${fileCity}")`
                            }];
                            fileHasError = true;
                            break;
                        }
                    }
                } else {
                    // 2行目以降は最初の行と比較
                    const currentPrefecture = row.prefecture || '';
                    const currentCity = row.city || '';
                    
                    if (currentPrefecture !== filePrefecture) {
                        file.errors = [{
                            row: rowIndex + 2,
                            message: `prefectureが一致しません (期待値: "${filePrefecture}", 実際: "${currentPrefecture}")`
                        }];
                        fileHasError = true;
                        break;
                    }
                    if (currentCity !== fileCity) {
                        file.errors = [{
                            row: rowIndex + 2,
                            message: `cityが一致しません (期待値: "${fileCity}", 実際: "${currentCity}")`
                        }];
                        fileHasError = true;
                        break;
                    }
                }
                
                // バリデーション通過した行を一時保存
                fileRows.push(row);
            }
            
            // エラーがなかった場合のみデータをマージ
            if (!fileHasError) {
                console.log(`File ${file.name} passed validation, adding ${fileRows.length} rows to merged data`);
                
                for (const row of fileRows) {
                    // city列から市区町村名を取得（最初に見つかった値を使用）
                    if (!this.cityName && row.city) {
                        this.cityName = row.city;
                        console.log('City name detected:', this.cityName);
                    }
                    
                    // 全8列のデータを設定
                    const mergedRow = {
                        prefecture: row.prefecture || '',
                        city: row.city || '',
                        number: row.number || '',
                        address: row.address || '',
                        name: row.name || '',
                        lat: row.lat || '',
                        long: row.long || '',
                        note: row.note || ''
                    };
                    
                    this.mergedData.push(mergedRow);
                    console.log('Added merged row:', mergedRow);
                }
            } else {
                // エラーがあったファイルの情報をコンソールに出力
                console.warn(`ファイル "${file.name}" でエラーが検出されました:`, file.errors[0]);
                console.warn(`ファイル "${file.name}" の全${fileRows.length}行のデータはインポートされませんでした`);
            }
        }
        
        console.log('Total merged data rows:', this.mergedData.length);
        
        // 元の順序を保存
        this.originalMergedData = [...this.mergedData];
        
        this.sortData();
    }
    
    /**
     * ソートタイプを設定
     * @param {string} type - 'none', 'string', 'numeric'
     */
    setSortType(type) {
        this.sortType = type;
        this.sortData();
    }
    
    /**
     * データをソート
     */
    sortData() {
        if (this.sortType === 'none') {
            // 元の順序に戻す
            this.mergedData = [...this.originalMergedData];
            return;
        }
        
        if (this.sortType === 'string') {
            // 条件付きaddressソート + numberの文字列昇順ソート
            this.mergedData.sort((a, b) => {
                // 第1キー: addressの条件付きソート
                const addressCompare = this.compareAddress(a.address || '', b.address || '');
                if (addressCompare !== 0) {
                    return addressCompare;
                }
                
                // 第2キー: number の文字列昇順
                return (a.number || '').localeCompare(b.number || '');
            });
        } else if (this.sortType === 'numeric') {
            // 条件付きaddressソート + numberの数値昇順ソート
            this.mergedData.sort((a, b) => {
                // 第1キー: addressの条件付きソート
                const addressCompare = this.compareAddress(a.address || '', b.address || '');
                if (addressCompare !== 0) {
                    return addressCompare;
                }
                
                // 第2キー: number の数値昇順
                const numsA = this.extractNumbers(a.number || '');
                const numsB = this.extractNumbers(b.number || '');
                
                // 数値配列を比較
                for (let i = 0; i < Math.max(numsA.length, numsB.length); i++) {
                    const numA = numsA[i] !== undefined ? numsA[i] : -1;
                    const numB = numsB[i] !== undefined ? numsB[i] : -1;
                    
                    if (numA !== numB) {
                        return numA - numB;
                    }
                }
                
                // 数値が同じ場合は文字列として比較
                return (a.number || '').localeCompare(b.number || '');
            });
        }
    }
    
    /**
     * addressの条件付き比較
     * 各行のaddressが「*区」で始まる場合は「*区」部分をキーに、そうでなければaddress全体をキーにソート
     * @param {string} addressA - 比較対象A
     * @param {string} addressB - 比較対象B
     * @returns {number} - 比較結果
     */
    compareAddress(addressA, addressB) {
        // addressAのソートキーを決定
        const kuMatchA = addressA.match(/(.*区)/);
        const sortKeyA = kuMatchA ? kuMatchA[1] : addressA;
        
        // addressBのソートキーを決定
        const kuMatchB = addressB.match(/(.*区)/);
        const sortKeyB = kuMatchB ? kuMatchB[1] : addressB;
        
        return sortKeyA.localeCompare(sortKeyB);
    }
    
    /**
     * 文字列から数値を抽出
     * @param {string} str - 入力文字列
     * @returns {number[]} - 抽出された数値の配列
     */
    extractNumbers(str) {
        const matches = str.match(/\d+/g);
        return matches ? matches.map(n => parseInt(n, 10)) : [];
    }
    
    /**
     * マージされたデータを取得
     * @returns {Array} マージされたデータ
     */
    getMergedData() {
        return this.mergedData;
    }
    
    /**
     * 正規化CSVとしてエクスポート
     * @returns {string} 正規化CSV文字列
     */
    exportToCsv() {
        if (this.mergedData.length === 0) {
            throw new Error('エクスポートするデータがありません');
        }
        
        const csv = Papa.unparse(this.mergedData, {
            header: true,
            columns: ['prefecture', 'city', 'number', 'address', 'name', 'lat', 'long', 'note']
        });
        
        return csv;
    }
    
    /**
     * ファイルをダウンロード
     */
    downloadCsv() {
        const csv = this.exportToCsv();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        // city名を取得（見つからない場合は"output"を使用）
        const cityName = this.cityName || 'output';
        
        link.setAttribute('href', url);
        link.setAttribute('download', `${cityName}_normalized.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    /**
     * 市区町村名を取得
     * @returns {string|null} 市区町村名
     */
    getCityName() {
        return this.cityName;
    }
    
    /**
     * プレビュー用HTMLテーブルを生成
     * @returns {string} HTMLテーブル文字列
     */
    generatePreviewTable() {
        console.log('ConcatCsv.generatePreviewTable called, data length:', this.mergedData.length);
        
        if (this.mergedData.length === 0) {
            console.log('No data, returning empty message');
            return '<p style="text-align: center; color: #999;">データがありません</p>';
        }
        
        let html = '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
        html += '<thead><tr style="background-color: #f0f0f0;">';
        html += '<th style="border: 1px solid #ddd; padding: 4px; text-align: left;">#</th>';
        html += '<th style="border: 1px solid #ddd; padding: 4px; text-align: left;">prefecture</th>';
        html += '<th style="border: 1px solid #ddd; padding: 4px; text-align: left;">city</th>';
        html += '<th style="border: 1px solid #ddd; padding: 4px; text-align: left;">number</th>';
        html += '<th style="border: 1px solid #ddd; padding: 4px; text-align: left;">address</th>';
        html += '<th style="border: 1px solid #ddd; padding: 4px; text-align: left;">name</th>';
        html += '<th style="border: 1px solid #ddd; padding: 4px; text-align: left;">lat</th>';
        html += '<th style="border: 1px solid #ddd; padding: 4px; text-align: left;">long</th>';
        html += '<th style="border: 1px solid #ddd; padding: 4px; text-align: left;">note</th>';
        html += '</tr></thead>';
        html += '<tbody>';
        
        // 全データ行を表示
        this.mergedData.forEach((row, index) => {
            html += '<tr>';
            html += `<td style="border: 1px solid #ddd; padding: 4px; color: #999;">${index + 1}</td>`;
            html += `<td style="border: 1px solid #ddd; padding: 4px;">${this.escapeHtml(row.prefecture)}</td>`;
            html += `<td style="border: 1px solid #ddd; padding: 4px;">${this.escapeHtml(row.city)}</td>`;
            html += `<td style="border: 1px solid #ddd; padding: 4px;">${this.escapeHtml(row.number)}</td>`;
            html += `<td style="border: 1px solid #ddd; padding: 4px;">${this.escapeHtml(row.address)}</td>`;
            html += `<td style="border: 1px solid #ddd; padding: 4px;">${this.escapeHtml(row.name)}</td>`;
            html += `<td style="border: 1px solid #ddd; padding: 4px;">${this.escapeHtml(row.lat)}</td>`;
            html += `<td style="border: 1px solid #ddd; padding: 4px;">${this.escapeHtml(row.long)}</td>`;
            html += `<td style="border: 1px solid #ddd; padding: 4px;">${this.escapeHtml(row.note)}</td>`;
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        
        return html;
    }
    
    /**
     * HTMLエスケープ
     * @param {string} text - エスケープする文字列
     * @returns {string} エスケープされた文字列
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}