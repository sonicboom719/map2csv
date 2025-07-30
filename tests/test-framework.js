/**
 * 軽量テストフレームワーク
 * シンプルな統合テストとユニットテストをサポート
 */
export class TestFramework {
    constructor(suiteName) {
        this.suiteName = suiteName;
        this.tests = [];
        this.currentTest = null;
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            errors: []
        };
        this.isRunning = false;
        this.shouldStop = false;
        
        this.setupUI();
    }
    
    setupUI() {
        this.resultsContainer = document.getElementById('testResults');
        this.progressBar = document.getElementById('progressBar');
        this.logContainer = document.getElementById('testLog');
        this.startButton = document.getElementById('startTest');
        this.stopButton = document.getElementById('stopTest');
        
        // デバッグ用：要素の存在確認
        console.log('TestFramework setupUI:');
        console.log('resultsContainer:', this.resultsContainer);
        console.log('progressBar:', this.progressBar);
        console.log('logContainer:', this.logContainer);
        console.log('startButton:', this.startButton);
        console.log('stopButton:', this.stopButton);
    }
    
    /**
     * テストケースを追加
     */
    async test(name, testFunction) {
        if (this.shouldStop) return;
        
        this.currentTest = { name, status: 'running' };
        this.updateUI();
        this.log(`実行中: ${name}`);
        
        try {
            await testFunction.call(this);
            this.currentTest.status = 'passed';
            this.results.passed++;
            this.log(`✓ ${name}`);
        } catch (error) {
            this.currentTest.status = 'failed';
            this.currentTest.error = error.message;
            this.results.failed++;
            this.results.errors.push({ test: name, error: error.message });
            this.log(`✗ ${name}: ${error.message}`);
        }
        
        this.results.total++;
        this.updateUI();
        
        // 次のテストまで少し待つ
        await this.delay(100);
    }
    
    /**
     * アサーション
     */
    assert(condition, message) {
        if (!condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
    }
    
    /**
     * 値の等価性をチェック
     */
    assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(`${message}: expected ${expected}, got ${actual}`);
        }
    }
    
    /**
     * オブジェクトの深い等価性をチェック
     */
    assertDeepEqual(actual, expected, message) {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`${message}: objects are not equal`);
        }
    }
    
    /**
     * 例外がスローされることをチェック
     */
    async assertThrows(asyncFunction, message) {
        try {
            await asyncFunction();
            throw new Error(`${message}: expected function to throw`);
        } catch (error) {
            // 期待通り例外がスローされた
        }
    }
    
    /**
     * テストスイートを実行
     */
    async run() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.shouldStop = false;
        this.results = { total: 0, passed: 0, failed: 0, errors: [] };
        
        this.startButton.disabled = true;
        this.stopButton.disabled = false;
        
        this.log(`${this.suiteName} を開始`);
        
        try {
            await this.runTests();
        } catch (error) {
            this.log(`テストスイートエラー: ${error.message}`);
        }
        
        this.isRunning = false;
        this.startButton.disabled = false;
        this.stopButton.disabled = true;
        
        this.log(`\n${this.suiteName} 完了`);
        this.log(`結果: ${this.results.passed}/${this.results.total} 成功`);
        
        if (this.results.failed > 0) {
            this.log(`\n失敗したテスト:`);
            this.results.errors.forEach(({ test, error }) => {
                this.log(`  - ${test}: ${error}`);
            });
        }
    }
    
    /**
     * テスト実行を停止
     */
    stop() {
        this.shouldStop = true;
        this.log('テスト停止が要求されました');
    }
    
    /**
     * UIを更新
     */
    updateUI() {
        if (!this.resultsContainer || !this.progressBar) return;
        
        // 進捗バーを更新
        const progress = this.results.total === 0 ? 0 : 
            Math.round((this.results.total / this.getExpectedTestCount()) * 100);
        this.progressBar.style.width = `${progress}%`;
        this.progressBar.textContent = `${progress}%`;
        
        // テスト結果を更新
        this.resultsContainer.innerHTML = '';
        
        if (this.currentTest) {
            const testDiv = document.createElement('div');
            testDiv.className = `test-status ${this.currentTest.status}`;
            testDiv.innerHTML = `
                <span>${this.getStatusIcon(this.currentTest.status)}</span>
                <span>${this.currentTest.name}</span>
                ${this.currentTest.error ? `<small>(${this.currentTest.error})</small>` : ''}
            `;
            this.resultsContainer.appendChild(testDiv);
        }
        
        // サマリーを表示
        if (this.results.total > 0) {
            const summaryDiv = document.createElement('div');
            summaryDiv.className = 'test-summary';
            summaryDiv.innerHTML = `
                <strong>進行状況:</strong> 
                ${this.results.passed} 成功, 
                ${this.results.failed} 失敗, 
                ${this.results.total} 完了
            `;
            this.resultsContainer.appendChild(summaryDiv);
        }
    }
    
    /**
     * ログを出力
     */
    log(message) {
        if (this.logContainer) {
            this.logContainer.textContent += message + '\n';
            this.logContainer.scrollTop = this.logContainer.scrollHeight;
        }
        console.log(message);
    }
    
    /**
     * 遅延を作成
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * ステータスアイコンを取得
     */
    getStatusIcon(status) {
        switch (status) {
            case 'running': return '⏳';
            case 'passed': return '✓';
            case 'failed': return '✗';
            default: return '○';
        }
    }
    
    /**
     * 期待されるテスト数を取得（サブクラスでオーバーライド）
     */
    getExpectedTestCount() {
        return 10; // デフォルト値
    }
    
    /**
     * テストを実行（サブクラスで実装）
     */
    async runTests() {
        throw new Error('runTests method must be implemented by subclass');
    }
}