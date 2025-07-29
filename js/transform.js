// 射影変換の計算を行うクラス
export class ProjectiveTransform {
    constructor() {
        this.matrix = null;
    }
    
    // 4点から射影変換行列を計算
    computeTransform(srcPoints, dstPoints) {
        if (srcPoints.length !== 4 || dstPoints.length !== 4) {
            throw new Error('4点が必要です');
        }
        
        // 8x8の行列Aを構築
        const A = [];
        
        for (let i = 0; i < 4; i++) {
            const src = srcPoints[i];
            const dst = dstPoints[i];
            
            A.push([
                src.x, src.y, 1, 0, 0, 0, -dst.x * src.x, -dst.x * src.y
            ]);
            A.push([
                0, 0, 0, src.x, src.y, 1, -dst.y * src.x, -dst.y * src.y
            ]);
        }
        
        // bベクトル
        const b = [];
        for (let i = 0; i < 4; i++) {
            b.push(dstPoints[i].x);
            b.push(dstPoints[i].y);
        }
        
        // 連立方程式を解く
        try {
            const h = numeric.solve(A, b);
            
            // 3x3の変換行列を構築
            this.matrix = [
                [h[0], h[1], h[2]],
                [h[3], h[4], h[5]],
                [h[6], h[7], 1]
            ];
            
            return true;
        } catch (e) {
            console.error('変換行列の計算に失敗しました:', e);
            return false;
        }
    }
    
    // 点を変換
    transformPoint(point) {
        if (!this.matrix) return null;
        
        const x = point.x;
        const y = point.y;
        
        const w = this.matrix[2][0] * x + this.matrix[2][1] * y + this.matrix[2][2];
        const tx = (this.matrix[0][0] * x + this.matrix[0][1] * y + this.matrix[0][2]) / w;
        const ty = (this.matrix[1][0] * x + this.matrix[1][1] * y + this.matrix[1][2]) / w;
        
        return { x: tx, y: ty };
    }
    
    // 画像の4隅を変換して境界を取得
    getTransformedBounds(imageWidth, imageHeight) {
        const corners = [
            { x: 0, y: 0 },
            { x: imageWidth, y: 0 },
            { x: imageWidth, y: imageHeight },
            { x: 0, y: imageHeight }
        ];
        
        const transformed = corners.map(c => this.transformPoint(c));
        
        const xs = transformed.map(p => p.x);
        const ys = transformed.map(p => p.y);
        
        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
            corners: transformed
        };
    }
}