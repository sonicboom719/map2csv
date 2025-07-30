// 座標変換ユーティリティ
export class CoordinateTransformer {
    /**
     * 2点の線形変換を計算
     */
    static calculateTransform(imagePoint1, imagePoint2, mapPoint1, mapPoint2) {
        const imageVector = {
            x: imagePoint2.x - imagePoint1.x,
            y: imagePoint2.y - imagePoint1.y
        };
        
        const mapVector = {
            lat: mapPoint2.lat - mapPoint1.lat,
            lng: mapPoint2.lng - mapPoint1.lng
        };
        
        const scaleX = mapVector.lng / imageVector.x;
        const scaleY = mapVector.lat / imageVector.y;
        
        return { scaleX, scaleY, imagePoint1, mapPoint1 };
    }
    
    /**
     * 画像座標を地図座標に変換
     */
    static transformPoint(imageX, imageY, transform) {
        const { scaleX, scaleY, imagePoint1, mapPoint1 } = transform;
        const relX = imageX - imagePoint1.x;
        const relY = imageY - imagePoint1.y;
        
        return [
            mapPoint1.lat + (relY * scaleY),
            mapPoint1.lng + (relX * scaleX)
        ];
    }
    
    /**
     * 回転角度を計算
     */
    static calculateRotationAngle(imageVector, mapPixelVector) {
        const imageAngle = Math.atan2(imageVector.y, imageVector.x);
        const mapAngle = Math.atan2(mapPixelVector.y, mapPixelVector.x);
        return mapAngle - imageAngle;
    }
}