/**
 * Local adaptive threshold (same idea as ImageMagick `-lat WxH-offset%`): a pixel turns
 * white when it is brighter than its neighbourhood mean minus `offset`. Handles uneven
 * lighting on phone photos far better than a global threshold.
 *
 * Uses running column/row sums, so it needs O(width) extra memory regardless of window size.
 */
export function adaptiveThreshold(gray: Uint8ClampedArray, width: number, height: number, windowSize: number, offset: number): Uint8ClampedArray {
    const out = new Uint8ClampedArray(width * height);
    const r = Math.max(1, Math.floor(windowSize / 2));
    const colSum = new Float64Array(width);

    // Prime column sums with rows [0, r - 1]; the loop adds row y + r before use.
    for (let y = 0; y < Math.min(r, height); y++) {
        for (let x = 0; x < width; x++) {
            colSum[x] += gray[y * width + x];
        }
    }

    for (let y = 0; y < height; y++) {
        const addRow = y + r;
        const removeRow = y - r - 1;
        if (addRow < height) {
            for (let x = 0; x < width; x++) {
                colSum[x] += gray[addRow * width + x];
            }
        }
        if (removeRow >= 0) {
            for (let x = 0; x < width; x++) {
                colSum[x] -= gray[removeRow * width + x];
            }
        }
        const rowCount = Math.min(height - 1, y + r) - Math.max(0, y - r) + 1;

        let windowSum = 0;
        for (let x = 0; x < Math.min(r, width); x++) {
            windowSum += colSum[x];
        }
        for (let x = 0; x < width; x++) {
            if (x + r < width) {
                windowSum += colSum[x + r];
            }
            if (x - r - 1 >= 0) {
                windowSum -= colSum[x - r - 1];
            }
            const count = rowCount * (Math.min(width - 1, x + r) - Math.max(0, x - r) + 1);
            const i = y * width + x;
            out[i] = gray[i] > windowSum / count - offset ? 255 : 0;
        }
    }
    return out;
}
