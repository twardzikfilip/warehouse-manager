import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  IonBadge, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonCol, IonContent,
  IonGrid, IonHeader, IonItem, IonLabel, IonList, IonNote, IonRow, IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageSwitchComponent } from '../../components/language-switch/language-switch.component';
import { LanguageService } from '../../services/language.service';
import { LOW_STOCK_THRESHOLD, ProductStore } from '../../store/products.store';

@Component({
  selector: 'app-dashboard',
  templateUrl: 'dashboard.page.html',
  styleUrls: ['dashboard.page.scss'],
  imports: [
    DatePipe, DecimalPipe, TranslatePipe, LanguageSwitchComponent,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonContent, IonGrid, IonRow, IonCol, IonCard,
    IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonList, IonItem, IonLabel, IonNote, IonBadge,
  ],
})
export class DashboardPage {
  readonly productsStore = inject(ProductStore);
  readonly language = inject(LanguageService);

  readonly lowStockThreshold = LOW_STOCK_THRESHOLD;
}
