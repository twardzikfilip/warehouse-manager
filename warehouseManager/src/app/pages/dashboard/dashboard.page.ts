import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  ActionSheetController, IonBadge, IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle,
  IonCardTitle, IonCol, IonContent, IonGrid, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonNote, IonRow, IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { languageOutline } from 'ionicons/icons';
import { LANGUAGES, LanguageService } from '../../services/language.service';
import { LOW_STOCK_THRESHOLD, ProductStore } from '../../store/products.store';

@Component({
  selector: 'app-dashboard',
  templateUrl: 'dashboard.page.html',
  styleUrls: ['dashboard.page.scss'],
  imports: [
    DatePipe, DecimalPipe, TranslatePipe,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent, IonGrid, IonRow, IonCol, IonCard,
    IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonList, IonItem, IonLabel, IonNote, IonBadge,
  ],
})
export class DashboardPage {
  readonly productsStore = inject(ProductStore);
  readonly language = inject(LanguageService);
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly translate = inject(TranslateService);

  readonly lowStockThreshold = LOW_STOCK_THRESHOLD;

  constructor() {
    addIcons({ languageOutline });
  }

  async chooseLanguage(): Promise<void> {
    const sheet = await this.actionSheetController.create({
      header: this.translate.instant('dashboard.language'),
      buttons: [
        ...LANGUAGES.map((language) => ({
          text: this.translate.instant(`language.${language}`),
          role: language === this.language.current() ? 'selected' : undefined,
          handler: () => {
            this.language.set(language);
          },
        })),
        { text: this.translate.instant('common.cancel'), role: 'cancel' },
      ],
    });
    await sheet.present();
  }
}
