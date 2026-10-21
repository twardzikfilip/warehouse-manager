import { Injectable } from '@angular/core';
import * as Tesseract from 'tesseract.js';

@Injectable({
    providedIn: 'root',
})
export class OcrService {
    constructor() {}

    async recognizeText(base64Image: string | null): Promise<string> {
        if (!base64Image) {
            throw new Error('No image provided for OCR.');
        }
        const result = await Tesseract.recognize(base64Image, 'eng');
        return result.data.text;
    }
}