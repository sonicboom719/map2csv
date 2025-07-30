// 入力履歴管理クラス
export class InputHistoryManager {
    constructor(maxHistory = 10) {
        this.maxHistory = maxHistory;
        this.storagePrefix = 'map2csv_input_';
        this.initializeHistory();
    }
    
    initializeHistory() {
        // 管理する入力フィールドのリスト
        this.fields = {
            'addressInput': '住所',
            'pinNumber': '掲示場番号',
            'pinName': '掲示場名',
            'pinMemo': 'メモ',
            'prefectureInput': '都道府県',
            'cityInput': '市区町村'
        };
        
        // 各フィールドの履歴を初期化
        this.history = {};
        for (const fieldId in this.fields) {
            this.history[fieldId] = this.loadHistory(fieldId);
        }
    }
    
    // LocalStorageから履歴を読み込み
    loadHistory(fieldId) {
        try {
            const stored = localStorage.getItem(this.storagePrefix + fieldId);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Failed to load history for', fieldId, error);
            return [];
        }
    }
    
    // LocalStorageに履歴を保存
    saveHistory(fieldId, history) {
        try {
            localStorage.setItem(this.storagePrefix + fieldId, JSON.stringify(history));
        } catch (error) {
            console.error('Failed to save history for', fieldId, error);
        }
    }
    
    // 新しい入力を履歴に追加
    addToHistory(fieldId, value) {
        if (!value || !value.trim()) return;
        
        const trimmedValue = value.trim();
        let history = this.history[fieldId] || [];
        
        // 既存の同じ値を削除（最新として追加するため）
        history = history.filter(item => item !== trimmedValue);
        
        // 新しい値を先頭に追加
        history.unshift(trimmedValue);
        
        // 最大件数を超えたら古いものを削除
        if (history.length > this.maxHistory) {
            history = history.slice(0, this.maxHistory);
        }
        
        this.history[fieldId] = history;
        this.saveHistory(fieldId, history);
    }
    
    // 特定フィールドの履歴を取得
    getHistory(fieldId) {
        return this.history[fieldId] || [];
    }
    
    // 入力フィールドにdatalistを設定
    setupField(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        
        // datalistが既にある場合は削除
        const existingDatalist = document.getElementById(fieldId + '-datalist');
        if (existingDatalist) {
            existingDatalist.remove();
        }
        
        // 新しいdatalistを作成
        const datalist = document.createElement('datalist');
        datalist.id = fieldId + '-datalist';
        field.setAttribute('list', datalist.id);
        field.parentNode.appendChild(datalist);
        
        // 履歴を更新
        this.updateDatalist(fieldId);
        
        // 入力完了時（フォーカスアウトまたはEnter）に履歴に追加
        field.addEventListener('blur', () => {
            this.addToHistory(fieldId, field.value);
        });
        
        field.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addToHistory(fieldId, field.value);
            }
        });
    }
    
    // datalistの内容を更新
    updateDatalist(fieldId) {
        const datalist = document.getElementById(fieldId + '-datalist');
        if (!datalist) return;
        
        // 既存のオプションをクリア
        datalist.innerHTML = '';
        
        // 履歴からオプションを作成
        const history = this.getHistory(fieldId);
        history.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            datalist.appendChild(option);
        });
    }
    
    // すべてのフィールドを初期化
    setupAllFields() {
        for (const fieldId in this.fields) {
            this.setupField(fieldId);
        }
    }
    
    // 特定フィールドの履歴をクリア
    clearHistory(fieldId) {
        this.history[fieldId] = [];
        this.saveHistory(fieldId, []);
        this.updateDatalist(fieldId);
    }
    
    // すべての履歴をクリア
    clearAllHistory() {
        for (const fieldId in this.fields) {
            this.clearHistory(fieldId);
        }
    }
}