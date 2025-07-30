import { ERROR_MESSAGES } from '../config.js';

// エラーハンドリングユーティリティ
export class ErrorHandler {
    /**
     * 非同期操作のエラーハンドリング
     */
    static async handleAsyncOperation(operation, context = '') {
        try {
            return await operation();
        } catch (error) {
            this.logError(error, context);
            throw this.createUserFriendlyError(error);
        }
    }
    
    /**
     * ネットワークエラーの判定と処理
     */
    static handleNetworkError(error, response = null) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            return new Error(ERROR_MESSAGES.NETWORK_ERROR);
        }
        
        if (response && !response.ok) {
            return new Error(`HTTPエラー: ${response.status} ${response.statusText}`);
        }
        
        return error;
    }
    
    /**
     * DOM要素の存在確認
     */
    static requireElement(elementId) {
        const element = document.getElementById(elementId);
        if (!element) {
            throw new Error(`Required element not found: ${elementId}`);
        }
        return element;
    }
    
    /**
     * ユーザーフレンドリーなエラーメッセージを生成
     */
    static createUserFriendlyError(error) {
        if (error.name === 'TypeError') {
            return new Error(ERROR_MESSAGES.NETWORK_ERROR);
        }
        
        // その他のエラーはそのまま返す
        return error;
    }
    
    /**
     * エラーログの記録
     */
    static logError(error, context = '') {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] ${context}:`, error);
    }
    
    /**
     * ユーザーへのエラー表示
     */
    static showUserError(message) {
        // より良いUI（トースト等）に置き換え可能
        alert(message);
    }
}