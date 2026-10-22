import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonList, IonText, IonTitle, IonToolbar, ModalController,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { Product, ProductInput } from '../../models/product';
import { ProductStore } from '../../store/products.store';

/** Add/edit form; dismisses with role 'save' and a ProductInput. */
@Component({
  selector: 'app-product-form-modal',
  templateUrl: 'product-form-modal.component.html',
  imports: [
    FormsModule, TranslatePipe,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonList, IonItem, IonInput, IonText,
  ],
})
export class ProductFormModalComponent implements OnInit {
  @Input() product?: Product;

  private readonly modalController = inject(ModalController);
  private readonly productStore = inject(ProductStore);

  readonly form = signal<ProductInput>({ code: '', name: '', unit: 'szt.', quantity: 0 });
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    if (this.product) {
      const { code, name, unit, quantity } = this.product;
      this.form.set({ code, name, unit, quantity });
    }
  }

  update(changes: Partial<ProductInput>): void {
    this.form.update((form) => ({ ...form, ...changes }));
    this.error.set(null);
  }

  cancel(): void {
    this.modalController.dismiss(null, 'cancel');
  }

  save(): void {
    const form = this.form();
    const value: ProductInput = { ...form, code: form.code.trim(), name: form.name.trim(), unit: form.unit.trim(), quantity: Number(form.quantity) };
    if (!value.code || !value.name || !value.unit || !Number.isInteger(value.quantity) || value.quantity < 0) {
      this.error.set('productForm.required');
      return;
    }
    const existing = this.productStore.findByCode(value.code);
    if (existing && existing.id !== this.product?.id) {
      this.error.set('productForm.duplicateCode');
      return;
    }
    this.modalController.dismiss(value, 'save');
  }
}
