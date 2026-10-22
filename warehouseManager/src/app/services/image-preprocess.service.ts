import { Injectable } from '@angular/core';
import { adaptiveThreshold } from './image-threshold';

/** Short side of the page after scaling; small print OCRs far better when upscaled. */
const TARGET_SHORT_SIDE = 2880;
const MAX_SCALE = 3;

export type ThresholdVariant = {
    /** Threshold window as a fraction of the short side. */
    windowRatio: number;
    /** Offset below the local mean, 0–1. */
    offset: number;
};

/**
 * Two complementary settings, tuned on the sample PZ photo: each misreads different
 * characters, so comparing their OCR results exposes misreads (see mergeReceipts).
 */
export const OCR_VARIANTS: ThresholdVariant[] = [
    { windowRatio: 1 / 72, offset: 0.05 },
    { windowRatio: 1 / 36, offset: 0.08 },
];

export type PreparedImage = { gray: Uint8ClampedArray; width: number; height: number };

@Injectable({
    providedIn: 'root',
})
export class ImagePreprocessService {
    /** Scales and grayscales a document photo; binarize() it once per OCR pass. */
    async prepare(imageUrl: string): Promise<PreparedImage> {
        const image = await loadImage(imageUrl);
        const scale = Math.min(MAX_SCALE, TARGET_SHORT_SIDE / Math.min(image.naturalWidth, image.naturalHeight));
        const width = Math.round(image.naturalWidth * scale);
        const height = Math.round(image.naturalHeight * scale);

        const ctx = createContext(width, height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, 0, 0, width, height);

        const rgba = ctx.getImageData(0, 0, width, height).data;
        const gray = new Uint8ClampedArray(width * height);
        for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
            gray[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
        }
        return { gray, width, height };
    }

    binarize({ gray, width, height }: PreparedImage, variant: ThresholdVariant): HTMLCanvasElement {
        const window = Math.round(Math.min(width, height) * variant.windowRatio);
        const binary = adaptiveThreshold(gray, width, height, window, variant.offset * 255);

        const ctx = createContext(width, height);
        const imageData = ctx.createImageData(width, height);
        const rgba = imageData.data;
        for (let i = 0, p = 0; i < binary.length; i++, p += 4) {
            rgba[p] = rgba[p + 1] = rgba[p + 2] = binary[i];
            rgba[p + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);
        return ctx.canvas;
    }
}

function createContext(width: number, height: number): CanvasRenderingContext2D {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas.getContext('2d', { willReadFrequently: true })!;
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Could not load image.'));
        image.src = url;
    });
}
