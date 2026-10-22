import { Injectable, signal } from '@angular/core';
import { createWorker, PSM, Worker } from 'tesseract.js';

@Injectable({
    providedIn: 'root',
})
export class OcrService {
    /** Recognition progress, 0–1. */
    readonly progress = signal(0);

    private worker?: Promise<Worker>;

    /** Documents are always Polish, independent of the UI language. */
    async recognizeText(image: HTMLCanvasElement | string): Promise<string> {
        this.progress.set(0);
        const worker = await this.getWorker();
        const result = await worker.recognize(image);
        this.progress.set(1);
        return result.data.text;
    }

    private getWorker(): Promise<Worker> {
        this.worker ??= (async () => {
            const worker = await createWorker('pol+eng', 1, {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        this.progress.set(m.progress);
                    }
                },
            });
            // Single uniform block keeps table rows on one line; spaces mark column gaps for the parser.
            await worker.setParameters({
                tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
                preserve_interword_spaces: '1',
            });
            return worker;
        })().catch((error) => {
            this.worker = undefined;
            throw error;
        });
        return this.worker;
    }
}
