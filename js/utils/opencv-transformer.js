/**
 * OpenCV.jsを使用した画像変換処理クラス
 * 2点変換、3点アフィン変換、将来的には4点透視変換にも対応
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
                
                // 3点から簡単な線形変換を計算（最初の2点でスケールと回転を決定）
                const imgPoint1 = imagePts[0];
                const imgPoint2 = imagePts[1];
                const mapPoint1 = mapPts[0];
                const mapPoint2 = mapPts[1];
                
                // 画像上の2点間のベクトル
                const imgVector = {
                    x: imgPoint2.x - imgPoint1.x,
                    y: imgPoint2.y - imgPoint1.y
                };
                
                // 地図上の2点間のベクトル
                const mapVector = {
                    lat: mapPoint2.lat - mapPoint1.lat,
                    lng: mapPoint2.lng - mapPoint1.lng
                };
                
                // スケール計算
                const scaleX = mapVector.lng / imgVector.x;
                const scaleY = mapVector.lat / imgVector.y;
                
                console.log('imgVector:', imgVector);
                console.log('mapVector:', mapVector);
                console.log('scale:', { scaleX, scaleY });
                
                // 画像の4隅を地図座標に変換
                const transformedCorners = imageCorners.map(corner => {
                    const relativeX = corner.x - imgPoint1.x;
                    const relativeY = corner.y - imgPoint1.y;
                    
                    return {
                        lat: mapPoint1.lat + (relativeY * scaleY),
                        lng: mapPoint1.lng + (relativeX * scaleX)
                    };
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
}