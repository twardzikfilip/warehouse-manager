import { Component } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButton } from '@ionic/angular/standalone';
import { ExploreContainerComponent } from '../../explore-container/explore-container.component';
import { CameraService } from '../../services/camera.service';
import { OcrService } from '../../services/ocr.service';



@Component({
  selector: 'app-scan',
  templateUrl: 'scan.page.html',
  styleUrls: ['scan.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, ExploreContainerComponent, IonButton],
})
export class ScanPage {
  constructor(private cameraService: CameraService, private ocrService: OcrService) {}


  onButtonClick(): void {
    console.log('Button clicked in ScanPage');
    this.captureAndExtractText();
  }

  async captureAndExtractText(): Promise<void> {
      const base64Image = await this.cameraService.takePhoto();
      if (!base64Image) {
          console.error('No image captured.');
          return;
      }
      const extractedText = await this.ocrService.recognizeText(base64Image);
      console.log('Extracted Text:', extractedText);
  }


  ngOnInit(): void {
    console.log('ScanPage initialized');
  }

  ngOnDestroy(): void {
    console.log('ScanPage destroyed');
  }

  ngAfterViewInit(): void {
    console.log('ScanPage view initialized');
  }

  ngOnChanges(changes: any): void {
    console.log('ScanPage changes detected', changes);
  }
}
