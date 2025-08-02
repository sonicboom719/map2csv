/**
 * OpenCV.jsを使用した画像変換処理クラス
 * 2点変換、3点アフィン変換、4点射影変換に対応
 */
export class OpenCVTransformer {
    /**
     * OpenCV.jsが読み込まれているかチェック
     * @returns {boolean} OpenCV.jsが利用可能かどうか
     */
    static isReady() {
        return typeof cv !== 'undefined' && window.cvReady === true;
    }

    /**
     * OpenCV.jsの読み込みを待機
     * @returns {Promise} OpenCV.jsが準備完了したら解決されるPromise
     */
    static async waitForOpenCV() {
        if (this.isReady()) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            window.addEventListener('opencv-ready', () => {
                resolve();
            }, { once: true });
        });
    }

    /**
     * 3点からアフィン変換行列を計算
     * @param {Array} srcPoints - 変換元の3点 [{x, y}, {x, y}, {x, y}]
     * @param {Array} dstPoints - 変換先の3点 [{x, y}, {x, y}, {x, y}]
     * @returns {cv.Mat} アフィン変換行列（2x3）
     */
    static calculateAffineTransform(srcPoints, dstPoints) {
        if (!this.isReady()) {
            throw new Error('OpenCV.js is not ready');
        }

        // 点の配列をフラット化
        const srcArray = [];
        const dstArray = [];
        
        srcPoints.forEach(point => {
            srcArray.push(point.x, point.y);
        });
        
        dstPoints.forEach(point => {
            dstArray.push(point.x, point.y);
        });

        // OpenCVのMat形式に変換
        const srcMat = cv.matFromArray(3, 2, cv.CV_32F, srcArray);
        const dstMat = cv.matFromArray(3, 2, cv.CV_32F, dstArray);

        // アフィン変換行列を計算
        const transformMatrix = cv.getAffineTransform(srcMat, dstMat);

        // メモリ解放
        srcMat.delete();
        dstMat.delete();

        return transformMatrix;
    }

    /**
     * 画像にアフィン変換を適用
     * @param {HTMLCanvasElement|HTMLImageElement} image - 変換する画像
     * @param {cv.Mat} transformMatrix - アフィン変換行列
     * @returns {string} 変換後の画像のData URL
     */
    static applyAffineTransform(image, transformMatrix) {
        if (!this.isReady()) {
            throw new Error('OpenCV.js is not ready');
        }

        // 画像をOpenCVのMat形式に変換
        const src = cv.imread(image);
        const dst = new cv.Mat();

        // アフィン変換を適用
        cv.warpAffine(src, dst, transformMatrix, src.size());

        // 結果をCanvasに描画
        const canvas = document.createElement('canvas');
        cv.imshow(canvas, dst);

        // Data URLとして取得
        const dataUrl = canvas.toDataURL();

        // メモリ解放
        src.delete();
        dst.delete();

        return dataUrl;
    }

    /**
     * 3点アフィン変換を使用して画像を変換し、Leaflet用の境界を計算
     * 3点の対応関係を正しく計算する方法
     * @param {Object} imageData - 画像データ {url, width, height}
     * @param {Array} imagePts - 画像上の3点
     * @param {Array} mapPts - 地図上の3点（緯度経度）
     * @returns {Promise<Object>} {imageUrl, bounds}
     */
    static async transformImageFor3Points(imageData, imagePts, mapPts) {
        console.log('🔧 3点変換開始 (座標対応版)');
        console.log('imageData:', imageData);
        console.log('imagePts:', imagePts);
        console.log('mapPts:', mapPts);
        
        return new Promise((resolve, reject) => {
            try {
                // 画像の4隅の座標
                const imageCorners = [
                    { x: 0, y: 0 },
                    { x: imageData.width, y: 0 },
                    { x: imageData.width, y: imageData.height },
                    { x: 0, y: imageData.height }
                ];
                
                // 真の3点アフィン変換を計算（3点すべてを使用）
                console.log('真の3点アフィン変換を実行');
                console.log('使用する3点:');
                console.log('  画像点1:', imagePts[0]);
                console.log('  画像点2:', imagePts[1]);
                console.log('  画像点3:', imagePts[2]);
                console.log('  地図点1:', mapPts[0]);
                console.log('  地図点2:', mapPts[1]);
                console.log('  地図点3:', mapPts[2]);
                
                // アフィン変換行列を計算
                const affineMatrix = this.calculateAffineMatrix3Points(imagePts, mapPts);
                
                console.log('計算されたアフィン変換行列:', affineMatrix);
                
                // 画像の4隅をアフィン変換で地図座標に変換
                const transformedCorners = imageCorners.map(corner => {
                    return this.applyAffineTransform3Points(corner, affineMatrix);
                });
                
                console.log('transformedCorners:', transformedCorners);
                
                // 境界ボックスを計算
                const lats = transformedCorners.map(c => c.lat);
                const lngs = transformedCorners.map(c => c.lng);
                
                const bounds = [
                    [Math.min(...lats), Math.min(...lngs)],
                    [Math.max(...lats), Math.max(...lngs)]
                ];
                
                console.log('計算された境界:', bounds);
                
                resolve({
                    imageUrl: imageData.url,
                    bounds: bounds
                });
                
            } catch (error) {
                console.error('3点変換エラー:', error);
                reject(error);
            }
        });
    }

    /**
     * 4点から射影変換行列を計算
     * @param {Array} srcPoints - 変換元の4点 [{x, y}, {x, y}, {x, y}, {x, y}]
     * @param {Array} dstPoints - 変換先の4点 [{x, y}, {x, y}, {x, y}, {x, y}]
     * @returns {cv.Mat} 射影変換行列（3x3）
     */
    static calculatePerspectiveTransform(srcPoints, dstPoints) {
        if (!this.isReady()) {
            throw new Error('OpenCV.js is not ready');
        }

        if (srcPoints.length !== 4 || dstPoints.length !== 4) {
            throw new Error('Perspective transform requires exactly 4 points');
        }

        // 点の配列をフラット化
        const srcArray = [];
        const dstArray = [];
        
        srcPoints.forEach(point => {
            srcArray.push(point.x, point.y);
        });
        
        dstPoints.forEach(point => {
            dstArray.push(point.x, point.y);
        });

        // OpenCVのMat形式に変換（4点なので4x2）
        const srcMat = cv.matFromArray(4, 2, cv.CV_32F, srcArray);
        const dstMat = cv.matFromArray(4, 2, cv.CV_32F, dstArray);

        // 射影変換行列を計算
        const transformMatrix = cv.getPerspectiveTransform(srcMat, dstMat);

        // メモリ解放
        srcMat.delete();
        dstMat.delete();

        return transformMatrix;
    }

    /**
     * 画像に射影変換を適用
     * @param {HTMLCanvasElement|HTMLImageElement} image - 変換する画像
     * @param {cv.Mat} transformMatrix - 射影変換行列
     * @param {Object} outputSize - 出力サイズ {width, height}
     * @returns {string} 変換後の画像のData URL
     */
    static applyPerspectiveTransform(image, transformMatrix, outputSize) {
        if (!this.isReady()) {
            throw new Error('OpenCV.js is not ready');
        }

        // 画像をOpenCVのMat形式に変換
        const src = cv.imread(image);
        const dst = new cv.Mat();

        // 出力サイズを設定
        const dsize = new cv.Size(outputSize.width, outputSize.height);

        // 射影変換を適用
        cv.warpPerspective(src, dst, transformMatrix, dsize);

        // 結果をCanvasに描画
        const canvas = document.createElement('canvas');
        cv.imshow(canvas, dst);

        // Data URLとして取得
        const dataUrl = canvas.toDataURL();

        // メモリ解放
        src.delete();
        dst.delete();

        return dataUrl;
    }

    /**
     * 4点射影変換を使用して画像を変換し、Leaflet用の境界を計算
     * @param {Object} imageData - 画像データ {url, width, height}
     * @param {Array} imagePts - 画像上の4点（左上、右上、右下、左下の順）
     * @param {Array} mapPts - 地図上の4点（緯度経度）
     * @returns {Promise<Object>} {imageUrl, bounds}
     */
    static async transformImageFor4Points(imageData, imagePts, mapPts) {
        console.log('🔧 4点射影変換開始 (真の4点射影変換)');
        console.log('imageData:', imageData);
        console.log('imagePts:', imagePts);
        console.log('mapPts:', mapPts);
        
        return new Promise((resolve, reject) => {
            try {
                if (imagePts.length !== 4 || mapPts.length !== 4) {
                    throw new Error('4点射影変換には正確に4点が必要です');
                }

                // OpenCV.jsが利用可能かチェック
                if (!this.isReady()) {
                    console.log('OpenCV.jsが準備できていないため、簡易4点変換を実行');
                    // フォールバック: 4点の境界ボックスを使用
                    const lats = mapPts.map(pt => pt.lat);
                    const lngs = mapPts.map(pt => pt.lng);
                    
                    const bounds = [
                        [Math.min(...lats), Math.min(...lngs)],
                        [Math.max(...lats), Math.max(...lngs)]
                    ];
                    
                    resolve({
                        imageUrl: imageData.url,
                        bounds: bounds,
                        transformed: false
                    });
                    return;
                }

                // 真の4点射影変換を実行（4点すべてを使用）
                console.log('真の4点射影変換を実行');
                console.log('使用する4点:');
                console.log('  画像点1:', imagePts[0]);
                console.log('  画像点2:', imagePts[1]);
                console.log('  画像点3:', imagePts[2]);
                console.log('  画像点4:', imagePts[3]);
                console.log('  地図点1:', mapPts[0]);
                console.log('  地図点2:', mapPts[1]);
                console.log('  地図点3:', mapPts[2]);
                console.log('  地図点4:', mapPts[3]);

                try {
                    // 射影変換行列を計算
                    const perspectiveMatrix = this.calculatePerspectiveMatrix4Points(imagePts, mapPts);
                    
                    console.log('計算された射影変換行列:', perspectiveMatrix);
                    
                    // 画像の4隅を射影変換で地図座標に変換
                    const imageCorners = [
                        { x: 0, y: 0 },                          // 左上
                        { x: imageData.width, y: 0 },            // 右上
                        { x: imageData.width, y: imageData.height }, // 右下
                        { x: 0, y: imageData.height }            // 左下
                    ];
                    
                    const transformedMapCorners = imageCorners.map(corner => 
                        this.applyPerspectiveTransform4Points(corner, perspectiveMatrix)
                    );
                    
                    console.log('変換された画像4隅の地図座標:', transformedMapCorners);
                    
                    // 変換された4隅から境界を計算
                    const transformedLats = transformedMapCorners.map(corner => corner.lat);
                    const transformedLngs = transformedMapCorners.map(corner => corner.lng);
                    
                    const bounds = [
                        [Math.min(...transformedLats), Math.min(...transformedLngs)],  // 南西
                        [Math.max(...transformedLats), Math.max(...transformedLngs)]   // 北東
                    ];
                    
                    console.log('真の4点射影変換完了');
                    console.log('選択した4点:', mapPts);
                    console.log('画像全体の変換境界:', bounds);
                    console.log('境界サイズ:', {
                        latSize: bounds[1][0] - bounds[0][0],
                        lngSize: bounds[1][1] - bounds[0][1]
                    });
                    
                    resolve({
                        imageUrl: imageData.url,  // 元画像を使用
                        bounds: bounds,
                        transformed: true,
                        transformType: 'perspective',
                        selectedPoints: mapPts,
                        transformedCorners: transformedMapCorners
                    });
                        
                } catch (transformError) {
                    console.error('4点射影変換処理エラー:', transformError);
                    // エラー時は元画像を使用
                    const lats = mapPts.map(pt => pt.lat);
                    const lngs = mapPts.map(pt => pt.lng);
                    const bounds = [
                        [Math.min(...lats), Math.min(...lngs)],
                        [Math.max(...lats), Math.max(...lngs)]
                    ];
                    
                    resolve({
                        imageUrl: imageData.url,
                        bounds: bounds,
                        transformed: false
                    });
                }
                
            } catch (error) {
                console.error('4点射影変換エラー:', error);
                reject(error);
            }
        });
    }

    /**
     * 点をアフィン変換行列で変換
     * @param {Object} point - {x, y}
     * @param {cv.Mat} transformMatrix - アフィン変換行列
     * @returns {Object} 変換後の点 {x, y}
     */
    static transformPoint(point, transformMatrix) {
        const data = transformMatrix.data32F;
        return {
            x: data[0] * point.x + data[1] * point.y + data[2],
            y: data[3] * point.x + data[4] * point.y + data[5]
        };
    }

    /**
     * 点を射影変換行列で変換
     * @param {Object} point - {x, y}
     * @param {cv.Mat} transformMatrix - 射影変換行列（3x3）
     * @returns {Object} 変換後の点 {x, y}
     */
    static transformPointPerspective(point, transformMatrix) {
        if (!this.isReady() || !transformMatrix) {
            throw new Error('OpenCV.js not ready or invalid matrix');
        }

        try {
            // 射影変換行列のデータを取得（32F または 64F）
            const data = transformMatrix.data64F || transformMatrix.data32F;
            
            if (!data || data.length < 9) {
                throw new Error('Invalid perspective matrix data');
            }
            
            const x = point.x;
            const y = point.y;
            
            // 同次座標での射影変換
            const w = data[6] * x + data[7] * y + data[8];
            
            if (Math.abs(w) < 1e-10) {
                console.warn('Near-zero denominator in perspective transformation:', w);
                return { x: x, y: y }; // フォールバック
            }
            
            return {
                x: (data[0] * x + data[1] * y + data[2]) / w,
                y: (data[3] * x + data[4] * y + data[5]) / w
            };
        } catch (error) {
            console.error('Point transformation error:', error);
            return { x: point.x, y: point.y }; // フォールバック
        }
    }

    /**
     * 3点を使ったアフィン変換行列を計算
     * @param {Array} srcPoints - 画像上の3点 [{x, y}, {x, y}, {x, y}]
     * @param {Array} dstPoints - 地図上の3点 [{lat, lng}, {lat, lng}, {lat, lng}]
     * @returns {Object} アフィン変換行列 {a, b, c, d, e, f}
     */
    static calculateAffineMatrix3Points(srcPoints, dstPoints) {
        if (srcPoints.length !== 3 || dstPoints.length !== 3) {
            throw new Error('Affine transform requires exactly 3 points');
        }

        const [src1, src2, src3] = srcPoints;
        const [dst1, dst2, dst3] = dstPoints;

        // 画像座標
        const x1 = src1.x, y1 = src1.y;
        const x2 = src2.x, y2 = src2.y;
        const x3 = src3.x, y3 = src3.y;

        // 地図座標（緯度経度）
        const u1 = dst1.lat, v1 = dst1.lng;
        const u2 = dst2.lat, v2 = dst2.lng;
        const u3 = dst3.lat, v3 = dst3.lng;

        // アフィン変換行列の計算
        // [lat] = [a b c] [x]
        // [lng]   [d e f] [y]
        // [1]             [1]

        // 連立方程式を解いてアフィン変換係数を求める
        const det = (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);

        if (Math.abs(det) < 1e-10) {
            console.warn('Singular matrix in 3-point affine transform, using identity');
            return {
                a: 1, b: 0, c: 0,
                d: 0, e: 1, f: 0
            };
        }

        // 緯度方向の変換係数
        const a = ((u1 - u3) * (y2 - y3) - (u2 - u3) * (y1 - y3)) / det;
        const b = ((x1 - x3) * (u2 - u3) - (x2 - x3) * (u1 - u3)) / det;
        const c = u3 - a * x3 - b * y3;

        // 経度方向の変換係数
        const d = ((v1 - v3) * (y2 - y3) - (v2 - v3) * (y1 - y3)) / det;
        const e = ((x1 - x3) * (v2 - v3) - (x2 - x3) * (v1 - v3)) / det;
        const f = v3 - d * x3 - e * y3;

        return { a, b, c, d, e, f };
    }

    /**
     * 3点アフィン変換を点に適用
     * @param {Object} point - 変換する点 {x, y}
     * @param {Object} matrix - アフィン変換行列 {a, b, c, d, e, f}
     * @returns {Object} 変換後の点 {lat, lng}
     */
    static applyAffineTransform3Points(point, matrix) {
        const { a, b, c, d, e, f } = matrix;

        return {
            lat: a * point.x + b * point.y + c,
            lng: d * point.x + e * point.y + f
        };
    }

    /**
     * 4点を使った射影変換行列を計算
     * @param {Array} srcPoints - 画像上の4点 [{x, y}, {x, y}, {x, y}, {x, y}]
     * @param {Array} dstPoints - 地図上の4点 [{lat, lng}, {lat, lng}, {lat, lng}, {lat, lng}]
     * @returns {Object} 射影変換行列 {a, b, c, d, e, f, g, h}
     */
    static calculatePerspectiveMatrix4Points(srcPoints, dstPoints) {
        if (srcPoints.length !== 4 || dstPoints.length !== 4) {
            throw new Error('Perspective transform requires exactly 4 points');
        }

        const [src1, src2, src3, src4] = srcPoints;
        const [dst1, dst2, dst3, dst4] = dstPoints;

        // 画像座標
        const x1 = src1.x, y1 = src1.y;
        const x2 = src2.x, y2 = src2.y;
        const x3 = src3.x, y3 = src3.y;
        const x4 = src4.x, y4 = src4.y;

        // 地図座標（緯度経度）
        const u1 = dst1.lat, v1 = dst1.lng;
        const u2 = dst2.lat, v2 = dst2.lng;
        const u3 = dst3.lat, v3 = dst3.lng;
        const u4 = dst4.lat, v4 = dst4.lng;

        // 射影変換行列の計算
        // [lat] = [a b c] [x]
        // [lng]   [d e f] [y]  
        // [1]     [g h 1] [1]
        
        // 同次座標での射影変換: u = (ax + by + c) / (gx + hy + 1)

        // 8x8の連立方程式を解いて8つの係数を求める
        const A = [
            [x1, y1, 1, 0, 0, 0, -u1*x1, -u1*y1],
            [0, 0, 0, x1, y1, 1, -v1*x1, -v1*y1],
            [x2, y2, 1, 0, 0, 0, -u2*x2, -u2*y2],
            [0, 0, 0, x2, y2, 1, -v2*x2, -v2*y2],
            [x3, y3, 1, 0, 0, 0, -u3*x3, -u3*y3],
            [0, 0, 0, x3, y3, 1, -v3*x3, -v3*y3],
            [x4, y4, 1, 0, 0, 0, -u4*x4, -u4*y4],
            [0, 0, 0, x4, y4, 1, -v4*x4, -v4*y4]
        ];

        const B = [u1, v1, u2, v2, u3, v3, u4, v4];

        // ガウス消去法で連立方程式を解く
        const solution = this.solveLinearSystem(A, B);

        if (!solution) {
            console.warn('Singular matrix in 4-point perspective transform, using identity');
            return {
                a: 1, b: 0, c: 0,
                d: 0, e: 1, f: 0,
                g: 0, h: 0
            };
        }

        return {
            a: solution[0], b: solution[1], c: solution[2],
            d: solution[3], e: solution[4], f: solution[5],
            g: solution[6], h: solution[7]
        };
    }

    /**
     * 4点射影変換を点に適用
     * @param {Object} point - 変換する点 {x, y}
     * @param {Object} matrix - 射影変換行列 {a, b, c, d, e, f, g, h}
     * @returns {Object} 変換後の点 {lat, lng}
     */
    static applyPerspectiveTransform4Points(point, matrix) {
        const { a, b, c, d, e, f, g, h } = matrix;
        const x = point.x;
        const y = point.y;

        // 同次座標での射影変換
        const w = g * x + h * y + 1;

        if (Math.abs(w) < 1e-10) {
            console.warn('Division by zero in perspective transform');
            return { lat: 0, lng: 0 };
        }

        return {
            lat: (a * x + b * y + c) / w,
            lng: (d * x + e * y + f) / w
        };
    }

    /**
     * ガウス消去法で連立方程式を解く
     * @param {Array} A - 係数行列
     * @param {Array} B - 定数項
     * @returns {Array|null} 解のベクトル、または null（特異行列の場合）
     */
    static solveLinearSystem(A, B) {
        const n = A.length;
        const augmented = A.map((row, i) => [...row, B[i]]);

        // 前進消去
        for (let i = 0; i < n; i++) {
            // ピボット選択
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
                    maxRow = k;
                }
            }

            // 行交換
            [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

            // 特異行列チェック
            if (Math.abs(augmented[i][i]) < 1e-10) {
                return null;
            }

            // 前進消去
            for (let k = i + 1; k < n; k++) {
                const factor = augmented[k][i] / augmented[i][i];
                for (let j = i; j <= n; j++) {
                    augmented[k][j] -= factor * augmented[i][j];
                }
            }
        }

        // 後退代入
        const solution = new Array(n);
        for (let i = n - 1; i >= 0; i--) {
            solution[i] = augmented[i][n];
            for (let j = i + 1; j < n; j++) {
                solution[i] -= augmented[i][j] * solution[j];
            }
            solution[i] /= augmented[i][i];
        }

        return solution;
    }

}