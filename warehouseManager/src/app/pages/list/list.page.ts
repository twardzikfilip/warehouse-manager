import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  AlertController, IonBadge, IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonItem,
  IonItemOption, IonItemOptions, IonItemSliding, IonLabel, IonList, IonSearchbar, IonSelect, IonSelectOption,
  IonTitle, IonToolbar, ModalController, ToastController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { add, addCircleOutline, arrowDown, arrowUp, createOutline, removeCircleOutline, trashOutline } from 'ionicons/icons';
import { LanguageSwitchComponent } from '../../components/language-switch/language-switch.component';
import { ProductFormModalComponent } from '../../components/product-form-modal/product-form-modal.component';
import { Product, ProductInput } from '../../models/product';
import { LanguageService } from '../../services/language.service';
import { LOW_STOCK_THRESHOLD, ProductSortField, ProductStore } from '../../store/products.store';

@Component({
  selector: 'app-list',
  templateUrl: 'list.page.html',
  styleUrls: ['list.page.scss'],
  imports: [
    DatePipe, TranslatePipe, LanguageSwitchComponent,
    IonHeader, IonToolbar, IonTitle, IonContent, IonSearchbar, IonSelect, IonSelectOption, IonButtons, IonButton, IonIcon,
    IonList, IonItemSliding, IonItem, IonLabel, IonBadge, IonItemOptions, IonItemOption, IonFab, IonFabButton,
  ],
})
export class ListPage {
  readonly productsStore = inject(ProductStore);
  readonly language = inject(LanguageService);
  private readonly modalController = inject(ModalController);
  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);
  private readonly translate = inject(TranslateService);

  readonly lowStockThreshold = LOW_STOCK_THRESHOLD;
  readonly sortFields: ProductSortField[] = ['name', 'code', 'quantity', 'updatedAt'];

  constructor() {
    addIcons({ add, addCircleOutline, removeCircleOutline, arrowUp, arrowDown, createOutline, trashOutline });
  }

  onSearch(query: string | null | undefined): void {
    this.productsStore.setFilter({ query: query ?? '' });
  }

  onSortChange(sortBy: ProductSortField): void {
    this.productsStore.setFilter({ sortBy });
  }

  toggleOrder(): void {
    this.productsStore.setFilter({ order: this.productsStore.filter().order === 'asc' ? 'desc' : 'asc' });
  }

  adjust(product: Product, delta: number): void {
    this.productsStore.adjustQuantity(product.id, delta);
  }

  async openForm(product?: Product, sliding?: IonItemSliding): Promise<void> {
    await sliding?.close();
    const modal = await this.modalController.create({ component: ProductFormModalComponent, componentProps: { product } });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<ProductInput>();
    if (role !== 'save' || !data) {
      return;
    }
    if (product) {
      await this.productsStore.updateProduct(product.id, data);
    } else {
      await this.productsStore.addProduct(data);
    }
  }

  async confirmDelete(product: Product, sliding: IonItemSliding): Promise<void> {
    await sliding.close();
    const alert = await this.alertController.create({
      header: this.translate.instant('list.deleteConfirm.header'),
      message: this.translate.instant('list.deleteConfirm.message', { name: product.name }),
      buttons: [
        { text: this.translate.instant('common.cancel'), role: 'cancel' },
        {
          text: this.translate.instant('common.delete'),
          role: 'destructive',
          handler: () => {
            this.productsStore.deleteProduct(product.id).then(() => this.showToast('list.deleted'));
          },
        },
      ],
    });
    await alert.present();
  }

  private async showToast(key: string): Promise<void> {
    const toast = await this.toastController.create({ message: this.translate.instant(key), duration: 2000, position: 'top' });
    await toast.present();
  }
}
