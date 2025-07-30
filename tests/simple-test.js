/**
 * シンプルなテストランナー
 * ユニットテスト専用の軽量バージョン
 */
export class SimpleTestRunner {
    constructor(name) {
        this.name = name;
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            errors: []
        };
        this.isRunning = false;
    }
    
    /**
     * テストを実行
     */
    async test(name, testFunction) {
        console.log(`実行中: ${name}`);
        
        try {
            await testFunction.call(this);
            this.results.passed++;
            console.log(`✓ ${name}`);
            return true;
        } catch (error) {
            this.results.failed++;
            this.results.errors.push({ test: name, error: error.message });
            console.log(`✗ ${name}: ${error.message}`);
            return false;
        } finally {
            this.results.total++;
        }
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
     * 遅延を作成
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * テスト結果をHTMLに表示
     */
    displayResults(containerId, sectionName) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const sectionTests = this.results.errors.filter(e => 
            e.test.toLowerCase().includes(sectionName.toLowerCase())
        );
        
        const resultDiv = document.createElement('div');
        resultDiv.className = sectionTests.length === 0 ? 'test-result passed' : 'test-result failed';
        resultDiv.innerHTML = `
            <span>${sectionTests.length === 0 ? '✓' : '✗'}</span>
            <span>${sectionName} テスト ${sectionTests.length === 0 ? '成功' : '失敗'}</span>
        `;
        container.appendChild(resultDiv);
    }
    
    /**
     * サマリーを表示
     */
    displaySummary(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const successRate = this.results.total === 0 ? 0 : 
            Math.round((this.results.passed / this.results.total) * 100);
        
        container.innerHTML = `
            <strong>テスト結果:</strong> 
            ${this.results.passed}/${this.results.total} 成功 
            (成功率: ${successRate}%)
            ${this.results.failed > 0 ? `<br><span style="color: #dc3545;">失敗: ${this.results.failed}</span>` : ''}
        `;
    }
    
    /**
     * ログを表示
     */
    log(message) {
        const logContainer = document.getElementById('testLog');
        if (logContainer) {
            logContainer.textContent += message + '\n';
            logContainer.scrollTop = logContainer.scrollHeight;
        }
        console.log(message);
    }
    
    /**
     * テスト結果をクリア
     */
    clear() {
        this.results = { total: 0, passed: 0, failed: 0, errors: [] };
    }
}