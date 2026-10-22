import { inject, Injectable } from '@angular/core';
import { Product } from '../models/product';
import { ReceiptDocument } from '../models/receipt';
import { StorageService } from './storage.service';

const SCHEMA_VERSION = 1;
const KEYS = {
    version: 'schemaVersion',
    products: 'products',
    receipts: 'receipts',
};

/** Persists products and imported receipts. */
@Injectable({
    providedIn: 'root',
})
export class ProductService {
    private readonly storage = inject(StorageService);

    async load(): Promise<{ products: Product[]; receipts: ReceiptDocument[] }> {
        // Migrations from older schema versions go here.
        if ((await this.storage.get<number>(KEYS.version)) === null) {
            await this.storage.set(KEYS.version, SCHEMA_VERSION);
        }
        const [products, receipts] = await Promise.all([
            this.storage.get<Product[]>(KEYS.products),
            this.storage.get<ReceiptDocument[]>(KEYS.receipts),
        ]);
        return { products: products ?? [], receipts: receipts ?? [] };
    }

    saveProducts(products: Product[]): Promise<void> {
        return this.storage.set(KEYS.products, products);
    }

    saveReceipts(receipts: ReceiptDocument[]): Promise<void> {
        return this.storage.set(KEYS.receipts, receipts);
    }
}
