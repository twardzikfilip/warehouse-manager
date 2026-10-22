import { EnvironmentProviders, Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { provideTranslateService } from '@ngx-translate/core';
import { Product } from '../models/product';
import { ReceiptDocument } from '../models/receipt';
import { ProductService } from '../services/product.service';

/** In-memory stand-in for the persistence layer. */
export class FakeProductService implements Pick<ProductService, 'load' | 'saveProducts' | 'saveReceipts'> {
    products: Product[] = [];
    receipts: ReceiptDocument[] = [];

    async load() {
        return { products: this.products, receipts: this.receipts };
    }

    async saveProducts(products: Product[]) {
        this.products = products;
    }

    async saveReceipts(receipts: ReceiptDocument[]) {
        this.receipts = receipts;
    }
}

export function provideTestDependencies(productService = new FakeProductService()): (Provider | EnvironmentProviders)[] {
    return [
        provideRouter([]),
        provideIonicAngular(),
        provideTranslateService({ fallbackLang: 'en' }),
        { provide: ProductService, useValue: productService },
    ];
}
