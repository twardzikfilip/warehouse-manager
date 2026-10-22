import { Component, computed, inject, isDevMode, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonAccordion, IonAccordionGroup, IonButton, IonButtons, IonCard, IonCardContent, IonContent, IonFooter, IonHeader,
  IonIcon, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonProgressBar, IonText, IonTitle, IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { addOutline, cameraOutline, closeCircleOutline, documentTextOutline, warningOutline } from 'ionicons/icons';
import { CameraService } from '../../services/camera.service';
import { ImagePreprocessService, OCR_VARIANTS } from '../../services/image-preprocess.service';
import { OcrService } from '../../services/ocr.service';
import { mergeReceipts, ParsedLine, ParsedReceipt, parseReceipt } from '../../services/receipt-parser';
import { ProductStore } from '../../store/products.store';

type ScanStep = 'idle' | 'preparing' | 'recognizing' | 'review';
type ReceiptHeader = Omit<ParsedReceipt, 'lines' | 'footerQuantity'>;

const SAMPLE_DOCUMENT = 'assets/warehouse_listing.jpeg';

@Component({
  selector: 'app-scan',
  templateUrl: 'scan.page.html',
  styleUrls: ['scan.page.scss'],
  imports: [
    FormsModule, TranslatePipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonFooter, IonButtons, IonButton, IonIcon, IonCard, IonCardContent,
    IonProgressBar, IonList, IonListHeader, IonItem, IonLabel, IonInput, IonNote, IonText, IonAccordionGroup, IonAccordion,
  ],
})
export class ScanPage {
  private readonly cameraService = inject(CameraService);
  private readonly preprocessService = inject(ImagePreprocessService);
  private readonly ocrService = inject(OcrService);
  private readonly productStore = inject(ProductStore);
  private readonly translate = inject(TranslateService);
  private readonly toastController = inject(ToastController);
  private readonly router = inject(Router);

  readonly devMode = isDevMode();
  readonly step = signal<ScanStep>('idle');
  readonly header = signal<ReceiptHeader>({ number: '', date: '', supplier: '' });
  readonly lines = signal<ParsedLine[]>([]);
  readonly footerQuantity = signal<number | undefined>(undefined);
  readonly rawText = signal('');

  readonly ocrPass = signal(0);
  /** Overall progress across all OCR passes, 0–1. */
  readonly progress = computed(() => (this.ocrPass() + this.ocrService.progress()) / OCR_VARIANTS.length);
  readonly progressPercent = computed(() => Math.round(this.progress() * 100));
  readonly totalQuantity = computed(() => this.lines().reduce((sum, l) => sum + (Number(l.quantity) || 0), 0));
  readonly checksumMismatch = computed(() => {
    const footer = this.footerQuantity();
    return footer !== undefined && footer !== this.totalQuantity();
  });
  readonly linesToCheck = computed(() => this.lines().filter((l) => l.confidence === 'check').length);
  readonly isDuplicate = computed(() => !!this.header().number && this.productStore.hasReceipt(this.header().number));
  readonly isValid = computed(
    () => this.lines().length > 0 && this.lines().every((l) => l.code.trim() && l.name.trim() && Number.isInteger(Number(l.quantity)) && Number(l.quantity) >= 1),
  );

  constructor() {
    addIcons({ cameraOutline, documentTextOutline, addOutline, closeCircleOutline, warningOutline });
  }

  async takePhoto(): Promise<void> {
    const image = await this.cameraService.getPhoto({
      header: this.translate.instant('scan.photoPrompt.header'),
      photo: this.translate.instant('scan.photoPrompt.photo'),
      picture: this.translate.instant('scan.photoPrompt.picture'),
      cancel: this.translate.instant('common.cancel'),
    });
    if (image) {
      await this.process(image);
    }
  }

  useSample(): Promise<void> {
    return this.process(SAMPLE_DOCUMENT);
  }

  existingQuantity(code: string): number | undefined {
    return this.productStore.findByCode(code)?.quantity;
  }

  updateHeader(changes: Partial<ReceiptHeader>): void {
    this.header.update((header) => ({ ...header, ...changes }));
  }

  /** Editing a line counts as checking it. */
  updateLine(index: number, changes: Partial<ParsedLine>): void {
    this.lines.update((lines) => lines.map((line, i) => (i === index ? { ...line, ...changes, confidence: 'ok' } : line)));
  }

  removeLine(index: number): void {
    this.lines.update((lines) => lines.filter((_, i) => i !== index));
  }

  addLine(): void {
    this.lines.update((lines) => [...lines, { code: '', name: '', unit: 'szt.', quantity: 1, confidence: 'check' }]);
  }

  reset(): void {
    this.step.set('idle');
    this.lines.set([]);
    this.rawText.set('');
    this.footerQuantity.set(undefined);
    this.header.set({ number: '', date: '', supplier: '' });
  }

  async accept(): Promise<void> {
    if (!this.isValid()) {
      return;
    }
    const lines = this.lines().map(({ confidence, ...line }) => ({
      ...line,
      code: line.code.trim().toUpperCase(),
      name: line.name.trim(),
      quantity: Number(line.quantity),
    }));
    await this.productStore.importReceipt({ ...this.header(), lines });
    await this.showToast(this.translate.instant('scan.imported', { count: lines.length }));
    this.reset();
    await this.router.navigateByUrl('/tabs/list');
  }

  private async process(image: string): Promise<void> {
    try {
      this.step.set('preparing');
      const prepared = await this.preprocessService.prepare(image);
      this.step.set('recognizing');
      const texts: string[] = [];
      for (const [pass, variant] of OCR_VARIANTS.entries()) {
        this.ocrPass.set(pass);
        texts.push(await this.ocrService.recognizeText(this.preprocessService.binarize(prepared, variant)));
      }
      const { lines, footerQuantity, ...header } = texts.map(parseReceipt).reduce(mergeReceipts);
      this.rawText.set(texts[0]);
      this.header.set(header);
      this.lines.set(lines);
      this.footerQuantity.set(footerQuantity);
      this.step.set('review');
    } catch (error) {
      console.error('Document recognition failed', error);
      this.step.set('idle');
      await this.showToast(this.translate.instant('scan.ocrError'), 'danger');
    }
  }

  private async showToast(message: string, color?: string): Promise<void> {
    const toast = await this.toastController.create({ message, color, duration: 2500, position: 'top' });
    await toast.present();
  }
}
