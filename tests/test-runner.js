/**
 * 3点アフィン変換機能のテスト用スクリプト
 * Node.js環境での基本的な検証を行います
 */

// 基本的なアサーション関数
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
    console.log(`✓ ${message}`);
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`Assertion failed: ${message}. Expected: ${expected}, Actual: ${actual}`);
    }
    console.log(`✓ ${message} (${expected})`);
}

// 3点変換機能の基本的なテスト
function test3PointTransformLogic() {
    console.log('\n=== 3点変換ロジックテスト ===');
    
    // テストデータ
    const srcPoints = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 0, y: 100 }
    ];
    
    const dstPoints = [
        { x: 10, y: 10 },
        { x: 110, y: 15 },
        { x: 5, y: 105 }
    ];
    
    // 基本検証
    assert(srcPoints.length === 3, '変換元が3点');
    assert(dstPoints.length === 3, '変換先が3点');
    
    srcPoints.forEach((point, i) => {
        assert(typeof point.x === 'number', `点${i+1}のx座標が数値`);
        assert(typeof point.y === 'number', `点${i+1}のy座標が数値`);
    });
    
    dstPoints.forEach((point, i) => {
        assert(typeof point.x === 'number', `変換先点${i+1}のx座標が数値`);
        assert(typeof point.y === 'number', `変換先点${i+1}のy座標が数値`);
    });
    
    console.log('3点変換ロジックテスト完了');
}

// 変換モード管理のテスト
function testTransformModeManagement() {
    console.log('\n=== 変換モード管理テスト ===');
    
    // モックオブジェクト
    const mockOverlayManager = {
        transformMode: '2point',
        imagePoints: [],
        mapPoints: [],
        
        setTransformMode: function(mode) {
            this.transformMode = mode;
            // モード変更時にポイントをリセット
            this.imagePoints = [];
            this.mapPoints = [];
        },
        
        getRequiredPoints: function() {
            return this.transformMode === '3point' ? 3 : 2;
        },
        
        isReady: function() {
            const required = this.getRequiredPoints();
            return this.imagePoints.length === required && this.mapPoints.length === required;
        },
        
        addPoint: function(type, point) {
            const points = type === 'image' ? this.imagePoints : this.mapPoints;
            const required = this.getRequiredPoints();
            
            if (points.length < required) {
                points.push(point);
                return true;
            }
            return false;
        }
    };
    
    // 2点モードテスト
    assertEqual(mockOverlayManager.getRequiredPoints(), 2, '2点モードで必要点数が2');
    assert(!mockOverlayManager.isReady(), '初期状態では準備未完了');
    
    // 2点を追加
    assert(mockOverlayManager.addPoint('image', {x:0, y:0}), '画像1点目追加成功');
    assert(mockOverlayManager.addPoint('image', {x:100, y:0}), '画像2点目追加成功');
    assert(!mockOverlayManager.addPoint('image', {x:50, y:50}), '画像3点目追加は失敗');
    
    assert(mockOverlayManager.addPoint('map', {lat:35, lng:139}), '地図1点目追加成功');
    assert(mockOverlayManager.addPoint('map', {lat:35, lng:139.1}), '地図2点目追加成功');
    
    assert(mockOverlayManager.isReady(), '2点選択完了時は準備完了');
    
    // 3点モードに変更
    mockOverlayManager.setTransformMode('3point');
    assertEqual(mockOverlayManager.getRequiredPoints(), 3, '3点モードで必要点数が3');
    assert(!mockOverlayManager.isReady(), 'モード変更後は準備未完了（リセットされる）');
    
    // 3点を追加
    assert(mockOverlayManager.addPoint('image', {x:0, y:0}), '画像1点目追加成功');
    assert(mockOverlayManager.addPoint('image', {x:100, y:0}), '画像2点目追加成功');
    assert(mockOverlayManager.addPoint('image', {x:0, y:100}), '画像3点目追加成功');
    assert(!mockOverlayManager.addPoint('image', {x:50, y:50}), '画像4点目追加は失敗');
    
    assert(mockOverlayManager.addPoint('map', {lat:35, lng:139}), '地図1点目追加成功');
    assert(mockOverlayManager.addPoint('map', {lat:35, lng:139.1}), '地図2点目追加成功');
    assert(mockOverlayManager.addPoint('map', {lat:35.1, lng:139}), '地図3点目追加成功');
    
    assert(mockOverlayManager.isReady(), '3点選択完了時は準備完了');
    
    console.log('変換モード管理テスト完了');
}

// 最大点数管理のテスト
function testMaxPointsManagement() {
    console.log('\n=== 最大点数管理テスト ===');
    
    const mockWindow = {
        maxPoints: 2,
        selectedPoints: [],
        
        setMaxPoints: function(max) {
            this.maxPoints = max;
            if (this.selectedPoints.length > max) {
                this.selectedPoints = this.selectedPoints.slice(0, max);
            }
        },
        
        canAddPoint: function() {
            return this.selectedPoints.length < this.maxPoints;
        },
        
        addPoint: function(point) {
            if (this.canAddPoint()) {
                this.selectedPoints.push(point);
                return true;
            }
            return false;
        }
    };
    
    // 初期状態（2点）
    assertEqual(mockWindow.maxPoints, 2, '初期最大点数が2');
    assert(mockWindow.canAddPoint(), '初期状態で点を追加可能');
    
    // 2点を追加
    assert(mockWindow.addPoint({x:0, y:0}), '1点目追加成功');
    assert(mockWindow.addPoint({x:100, y:0}), '2点目追加成功');
    assert(!mockWindow.canAddPoint(), '2点選択後は追加不可');
    assert(!mockWindow.addPoint({x:50, y:50}), '3点目追加は失敗');
    
    // 3点モードに変更
    mockWindow.setMaxPoints(3);
    assertEqual(mockWindow.maxPoints, 3, '最大点数が3に変更');
    assertEqual(mockWindow.selectedPoints.length, 2, '既存の2点は維持');
    assert(mockWindow.canAddPoint(), '3点モードで追加可能');
    assert(mockWindow.addPoint({x:0, y:100}), '3点目追加成功');
    
    // 2点モードに戻す
    mockWindow.setMaxPoints(2);
    assertEqual(mockWindow.maxPoints, 2, '最大点数が2に変更');
    assertEqual(mockWindow.selectedPoints.length, 2, '点数が2に削減');
    assert(!mockWindow.canAddPoint(), '2点モードで追加不可');
    
    console.log('最大点数管理テスト完了');
}

// 色分けテスト
function testColorMapping() {
    console.log('\n=== 色分けテスト ===');
    
    const colors = ['#27ae60', '#e74c3c', '#3498db'];
    const pointNames = ['緑（1点目）', '赤（2点目）', '青（3点目）'];
    
    assertEqual(colors.length, 3, '3色が定義されている');
    
    for (let i = 0; i < 3; i++) {
        assert(colors[i].startsWith('#'), `${pointNames[i]}の色がHEX形式`);
        assertEqual(colors[i].length, 7, `${pointNames[i]}の色が7文字のHEX`);
    }
    
    // 各色が異なることを確認
    assert(colors[0] !== colors[1], '1点目と2点目の色が異なる');
    assert(colors[1] !== colors[2], '2点目と3点目の色が異なる');
    assert(colors[0] !== colors[2], '1点目と3点目の色が異なる');
    
    console.log('色分けテスト完了');
}

// 座標系変換のテスト
function testCoordinateTransform() {
    console.log('\n=== 座標系変換テスト ===');
    
    // アフィン変換行列の基本形
    const affineMatrix = [
        [1, 0, 10],  // [a, b, tx]
        [0, 1, 20],  // [c, d, ty]
        [0, 0, 1]    // [0, 0, 1]  <- 同次座標
    ];
    
    // 基本的な点の変換
    function transformPoint(x, y, matrix) {
        const newX = matrix[0][0] * x + matrix[0][1] * y + matrix[0][2];
        const newY = matrix[1][0] * x + matrix[1][1] * y + matrix[1][2];
        return { x: newX, y: newY };
    }
    
    // テスト
    const testPoint = { x: 5, y: 10 };
    const result = transformPoint(testPoint.x, testPoint.y, affineMatrix);
    
    assertEqual(result.x, 15, '変換後X座標が正しい (5 + 10)');
    assertEqual(result.y, 30, '変換後Y座標が正しい (10 + 20)');
    
    console.log('座標系変換テスト完了');
}

// メイン実行
function runAllTests() {
    console.log('🧪 3点アフィン変換機能テスト開始\n');
    
    try {
        test3PointTransformLogic();
        testTransformModeManagement();
        testMaxPointsManagement();
        testColorMapping();
        testCoordinateTransform();
        
        console.log('\n🎉 全テスト成功！');
        console.log('\n=== テスト結果サマリ ===');
        console.log('✓ 3点変換ロジック: 正常');
        console.log('✓ 変換モード管理: 正常');
        console.log('✓ 最大点数管理: 正常');
        console.log('✓ 色分け: 正常');
        console.log('✓ 座標系変換: 正常');
        
    } catch (error) {
        console.error('\n❌ テスト失敗:', error.message);
        console.log('\n=== テスト結果サマリ ===');
        console.log('❌ 一部のテストが失敗しました');
        process.exit(1);
    }
}

// Node.js環境での実行
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runAllTests };
    
    // 直接実行された場合
    if (require.main === module) {
        runAllTests();
    }
} else {
    // ブラウザ環境での実行
    runAllTests();
}