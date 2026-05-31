/**
 * Encodes an array of [lat, lng] coordinates into a Google Polyline string.
 */
export function encodePolyline(coordinates) {
    let result = '';
    let prevLat = 0;
    let prevLng = 0;
    for (const [lat, lng] of coordinates) {
        const latInt = Math.round(lat * 1e5);
        const lngInt = Math.round(lng * 1e5);
        const deltaLat = latInt - prevLat;
        const deltaLng = lngInt - prevLng;
        prevLat = latInt;
        prevLng = lngInt;
        result += encodeValue(deltaLat) + encodeValue(deltaLng);
    }
    return result;
}
function encodeValue(val) {
    let num = val < 0 ? ~(val << 1) : val << 1;
    let result = '';
    while (num >= 0x20) {
        result += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
        num >>= 5;
    }
    result += String.fromCharCode(num + 63);
    return result;
}
/**
 * Decodes a Google Polyline string into an array of [lat, lng] coordinates.
 */
export function decodePolyline(str) {
    const coordinates = [];
    let index = 0;
    const len = str.length;
    let lat = 0;
    let lng = 0;
    while (index < len) {
        let b;
        let shift = 0;
        let result = 0;
        do {
            b = str.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const deltaLat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += deltaLat;
        shift = 0;
        result = 0;
        do {
            b = str.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const deltaLng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += deltaLng;
        coordinates.push([lat / 1e5, lng / 1e5]);
    }
    return coordinates;
}
