export class CsvImporter {
    constructor(options) {
        this.importButton = options.importButton;
        this.pinManager = options.pinManager;
        
        // モーダル要素を取得
        this.modal = document.getElementById('csvImportModal');
        this.fileInput = document.getElementById('csvFileInput');
        this.fileInfo = document.getElementById('fileInfo');
        this.fileName = document.getElementById('fileName');
        this.dataCount = document.getElementById('dataCount');
        this.columnSelection = document.getElementById('columnSelection');
        this.columnCheckboxes = document.getElementById('columnCheckboxes');
        this.executeButton = document.getElementById('executeImport');
        this.cancelButton = document.getElementById('cancelImport');
        
        // データ保持用
        this.csvData = null;
        this.csvHeaders = null;
        
        this.setupEventHandlers();
    }
    
    setupEventHandlers() {
        // CSVインポートボタンクリックでファイルダイアログを開く
        this.importButton.addEventListener('click', () => {
            this.fileInput.click();
        });
        
        // ファイル選択時の処理
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleFileSelection(file);
            }
        });
        
        // インポート実行ボタン
        this.executeButton.addEventListener('click', () => {
            this.executeImport();
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
    }
    
    handleFileSelection(file) {
        this.fileName.textContent = file.name;
        
        // CSVファイルを読み込み
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                // まず生の解析でデータ構造をチェック
                const rawResult = Papa.parse(e.target.result, {
                    header: false,
                    skipEmptyLines: true
                });
                
                // CSVの基本バリデーション
                const validationError = this.validateCsvStructure(rawResult);
                if (validationError) {
                    alert(validationError);
                    this.resetFileInput();
                    return;
                }
                
                // PapaParseでCSVを解析（ヘッダー付き）
                const result = Papa.parse(e.target.result, {
                    header: true,
                    skipEmptyLines: true,
                    transform: (value) => value.trim()
                });
                
                if (result.errors.length > 0) {
                    alert('CSVファイルの解析中にエラーが発生しました: ' + result.errors[0].message);
                    this.resetFileInput();
                    return;
                }
                
                this.csvData = result.data;
                this.csvHeaders = result.meta.fields;
                
                // データの妥当性をチェック
                const dataValidationError = this.validateCsvData();
                if (dataValidationError) {
                    alert(dataValidationError);
                    this.resetFileInput();
                    return;
                }
                
                // データ件数を表示
                this.dataCount.textContent = this.csvData.length;
                
                // 列選択UIを生成
                this.generateColumnCheckboxes();
                
                // モーダルを表示
                this.modal.style.display = 'flex';
                
            } catch (error) {
                alert('CSVファイルの読み込み中にエラーが発生しました: ' + error.message);
                this.resetFileInput();
            }
        };
        
        reader.readAsText(file, 'UTF-8');
    }
    
    validateCsvStructure(rawResult) {
        if (rawResult.errors.length > 0) {
            return 'CSVファイルの構造に問題があります: ' + rawResult.errors[0].message;
        }
        
        if (!rawResult.data || rawResult.data.length === 0) {
            return 'CSVファイルが空です。';
        }
        
        // ヘッダー行の存在チェック
        if (rawResult.data.length < 2) {
            return 'CSVファイルにはヘッダー行とデータ行が最低1行ずつ必要です。';
        }
        
        // 列数の整合性チェック
        const headerColumnCount = rawResult.data[0].length;
        if (headerColumnCount === 0) {
            return 'ヘッダー行に列が含まれていません。';
        }
        
        // 各データ行の列数をチェック
        for (let i = 1; i < rawResult.data.length; i++) {
            if (rawResult.data[i].length !== headerColumnCount) {
                return `行 ${i + 1} の列数（${rawResult.data[i].length}列）がヘッダー行の列数（${headerColumnCount}列）と一致しません。`;
            }
        }
        
        return null; // エラーなし
    }
    
    validateCsvData() {
        // ヘッダーの存在確認
        if (!this.csvHeaders || this.csvHeaders.length === 0) {
            return 'CSVファイルにヘッダー行が見つかりません。';
        }
        
        // 必須列の存在確認（lat, longのみ）
        const hasLatColumn = this.csvHeaders.some(header => header.toLowerCase() === 'lat');
        const hasLongColumn = this.csvHeaders.some(header => header.toLowerCase() === 'long');
        
        if (!hasLatColumn && !hasLongColumn) {
            return '必須列 "lat"（緯度）と "long"（経度）の両方が見つかりません。';
        } else if (!hasLatColumn) {
            return '必須列 "lat"（緯度）が見つかりません。';
        } else if (!hasLongColumn) {
            return '必須列 "long"（経度）が見つかりません。';
        }
        
        // データ行の存在確認
        if (this.csvData.length === 0) {
            return 'CSVファイルにデータが含まれていません。';
        }
        
        // 最低列数のチェック（lat, longの2列は最低必要）
        if (this.csvHeaders.length < 2) {
            return `列数が少なすぎます。最低でもlat, longの2列が必要です。現在の列数: ${this.csvHeaders.length}列`;
        }
        
        return null; // エラーなし
    }
    
    resetFileInput() {
        this.fileInput.value = '';
        this.csvData = null;
        this.csvHeaders = null;
    }
    
    generateColumnCheckboxes() {
        this.columnCheckboxes.innerHTML = '';
        
        // 候補列名とその説明のマッピング
        const candidateColumns = {
            'prefecture': '都道府県',
            'city': '市区町村', 
            'number': '掲示場番号',
            'address': '住所',
            'name': '場所名称',
            'lat': '緯度（必須）',
            'long': '経度（必須）',
            'note': 'メモ'
        };
        
        // 必須列
        const requiredColumns = ['lat', 'long'];
        
        this.csvHeaders.forEach(header => {
            const div = document.createElement('div');
            div.style.marginBottom = '8px';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = header;
            checkbox.id = `col_${header}`;
            checkbox.style.marginRight = '8px';
            
            const lowerHeader = header.toLowerCase();
            
            // lat/longは必須なので自動選択かつ無効化
            if (requiredColumns.includes(lowerHeader)) {
                checkbox.checked = true;
                checkbox.disabled = true; // 必須列は変更不可
            } else if (Object.keys(candidateColumns).includes(lowerHeader)) {
                // 候補列名の場合は自動選択
                checkbox.checked = true;
            }
            
            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.style.cursor = checkbox.disabled ? 'default' : 'pointer';
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            
            const columnName = document.createElement('strong');
            columnName.textContent = header;
            columnName.style.minWidth = '100px';
            
            const description = document.createElement('span');
            description.textContent = candidateColumns[lowerHeader] || 'その他の列';
            description.style.color = '#666';
            description.style.fontSize = '14px';
            
            // 必須列の場合は赤色で表示
            if (requiredColumns.includes(lowerHeader)) {
                description.style.color = '#e74c3c';
                description.style.fontWeight = 'bold';
                // 必須列のチェックボックスをグレーアウト
                checkbox.style.opacity = '0.7';
                label.style.opacity = '0.9';
            }
            
            label.appendChild(checkbox);
            label.appendChild(columnName);
            label.appendChild(description);
            div.appendChild(label);
            
            // チェックボックス変更時にボタン状態を更新
            checkbox.addEventListener('change', () => {
                this.updateExecuteButtonState();
            });
            
            this.columnCheckboxes.appendChild(div);
        });
        
        // ファイル情報と列選択を表示
        this.fileInfo.style.display = 'block';
        this.columnSelection.style.display = 'block';
        
        // ボタン状態を初期化
        this.updateExecuteButtonState();
    }
    
    updateExecuteButtonState() {
        const checkedBoxes = this.columnCheckboxes.querySelectorAll('input[type="checkbox"]:checked');
        const checkedColumns = Array.from(checkedBoxes).map(cb => cb.value.toLowerCase());
        
        // lat と long が選択されているかチェック（必須列なので常にtrueになるはず）
        const hasLat = checkedColumns.includes('lat');
        const hasLong = checkedColumns.includes('long');
        
        // lat/longが必須なので、これらは常に選択されているはず
        if (hasLat && hasLong) {
            this.executeButton.disabled = false;
            this.executeButton.style.opacity = '1';
            this.executeButton.style.cursor = 'pointer';
        } else {
            // 理論上はここに来ないはずだが、安全のため
            this.executeButton.disabled = true;
            this.executeButton.style.opacity = '0.5';
            this.executeButton.style.cursor = 'not-allowed';
        }
    }
    
    executeImport() {
        const checkedBoxes = this.columnCheckboxes.querySelectorAll('input[type="checkbox"]:checked');
        const selectedColumns = Array.from(checkedBoxes).map(cb => cb.value);
        
        // lat/long列の確認
        const latColumn = selectedColumns.find(col => col.toLowerCase() === 'lat');
        const longColumn = selectedColumns.find(col => col.toLowerCase() === 'long');
        
        if (!latColumn || !longColumn) {
            alert('緯度（lat）と経度（long）の列を選択してください。');
            return;
        }
        
        // インポートモードの取得
        const importMode = document.querySelector('input[name="importMode"]:checked').value;
        
        // 既存ピンをクリアする場合
        if (importMode === 'clear') {
            this.pinManager.clearAllPins();
        }
        
        let importedCount = 0;
        let errorCount = 0;
        
        // データをインポート
        this.csvData.forEach((row, index) => {
            try {
                const lat = parseFloat(row[latColumn]);
                const lng = parseFloat(row[longColumn]);
                
                // 緯度経度の妥当性チェック
                if (isNaN(lat) || isNaN(lng)) {
                    console.warn(`行 ${index + 2}: 無効な緯度経度 (${row[latColumn]}, ${row[longColumn]})`);
                    errorCount++;
                    return;
                }
                
                // 日本の範囲チェック（簡易版）
                if (lat < 20 || lat > 50 || lng < 110 || lng > 160) {
                    console.warn(`行 ${index + 2}: 範囲外の座標 (${lat}, ${lng})`);
                    errorCount++;
                    return;
                }
                
                // ピンを作成
                const latlng = L.latLng(lat, lng);
                const pin = this.pinManager.addPin(latlng, false);
                
                // 選択された列のデータを設定
                selectedColumns.forEach(colName => {
                    const value = row[colName] || '';
                    const lowerColName = colName.toLowerCase();
                    
                    switch (lowerColName) {
                        case 'number':
                            pin.number = value;
                            break;
                        case 'name':
                            pin.name = value;
                            break;
                        case 'note':
                        case 'memo':
                            pin.memo = value;
                            break;
                        // prefecture, city, address は現在のデータ構造では使用しない
                    }
                });
                
                // マーカーを更新
                this.pinManager.updatePinMarker(pin);
                importedCount++;
                
            } catch (error) {
                console.error(`行 ${index + 2} のインポート中にエラー:`, error);
                errorCount++;
            }
        });
        
        // エラーがある場合のみアラートを表示
        if (errorCount > 0) {
            alert(`${errorCount} 件のエラーがありました。詳細はコンソールを確認してください。`);
        }
        
        // 成功メッセージはコンソールに出力
        console.log(`${importedCount} 件のピンをインポートしました。`);
        
        // UIを更新
        this.pinManager.updatePinList();
        this.pinManager.updateExportButtonState();
        
        // モーダルを閉じる
        this.closeModal();
    }
    
    closeModal() {
        this.modal.style.display = 'none';
        this.fileInput.value = '';
        this.csvData = null;
        this.csvHeaders = null;
        this.fileInfo.style.display = 'none';
        this.columnSelection.style.display = 'none';
        this.columnCheckboxes.innerHTML = '';
    }
}