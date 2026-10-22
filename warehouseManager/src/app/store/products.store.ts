import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { Product, ProductInput } from '../models/product';
import { ReceiptDocument, ReceiptInput } from '../models/receipt';
import { ProductService } from '../services/product.service';

export const LOW_STOCK_THRESHOLD = 5;
const RECENT_COUNT = 5;

export type ProductSortField = 'name' | 'code' | 'quantity' | 'updatedAt';

type ProductStoreState = {
    products: Product[];
    receipts: ReceiptDocument[];
    loaded: boolean;
    error: unknown;
    filter: { query: string; sortBy: ProductSortField; order: 'asc' | 'desc' };
};

/** Lowercase without diacritics, so "pompa" matches "POMPA" and "slimak" matches "ŚLIMAK". */
export function searchKey(value: string): string {
    return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
}

function sameCode(a: string, b: string): boolean {
    return a.trim().toUpperCase() === b.trim().toUpperCase();
}

export const ProductStore = signalStore(
    { providedIn: 'root' },
    withState<ProductStoreState>({
        products: [],
        receipts: [],
        loaded: false,
        error: null,
        filter: { query: '', sortBy: 'name', order: 'asc' },
    }),
    withComputed(({ products, receipts, filter }) => ({
        filteredProducts: computed(() => {
            const { query, sortBy, order } = filter();
            const key = searchKey(query.trim());
            const direction = order === 'asc' ? 1 : -1;
            return products()
                .filter((p) => !key || searchKey(p.code).includes(key) || searchKey(p.name).includes(key))
                .sort((a, b) => {
                    const result =
                        sortBy === 'quantity' ? a.quantity - b.quantity : String(a[sortBy]).localeCompare(String(b[sortBy]), 'pl');
                    return result * direction;
                });
        }),
        totalQuantity: computed(() => products().reduce((sum, p) => sum + p.quantity, 0)),
        lowStock: computed(() =>
            products()
                .filter((p) => p.quantity <= LOW_STOCK_THRESHOLD)
                .sort((a, b) => a.quantity - b.quantity),
        ),
        recentlyUpdated: computed(() =>
            [...products()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, RECENT_COUNT),
        ),
        recentReceipts: computed(() =>
            [...receipts()].sort((a, b) => b.importedAt.localeCompare(a.importedAt)).slice(0, RECENT_COUNT),
        ),
        receiptsThisMonth: computed(() => {
            const month = new Date().toISOString().slice(0, 7);
            return receipts().filter((r) => r.importedAt.startsWith(month)).length;
        }),
    })),
    withMethods((store, productService = inject(ProductService)) => {
        const saveProducts = (products: Product[]) => {
            patchState(store, { products });
            return productService.saveProducts(products).catch((error) => patchState(store, { error }));
        };
        const findByCode = (code: string) => store.products().find((p) => sameCode(p.code, code));

        return {
            async load(): Promise<void> {
                try {
                    const { products, receipts } = await productService.load();
                    patchState(store, { products, receipts, loaded: true, error: null });
                } catch (error) {
                    patchState(store, { loaded: true, error });
                }
            },

            findByCode,

            hasReceipt(number: string): boolean {
                return store.receipts().some((r) => r.number.trim() === number.trim());
            },

            /** Returns false when a product with this code already exists. */
            async addProduct(input: ProductInput): Promise<boolean> {
                if (findByCode(input.code)) {
                    return false;
                }
                const now = new Date().toISOString();
                const product: Product = { ...input, code: input.code.trim(), id: crypto.randomUUID(), createdAt: now, updatedAt: now };
                await saveProducts([...store.products(), product]);
                return true;
            },

            /** Returns false when the new code collides with another product. */
            async updateProduct(id: string, changes: Partial<ProductInput>): Promise<boolean> {
                const duplicate = changes.code !== undefined && store.products().some((p) => p.id !== id && sameCode(p.code, changes.code!));
                if (duplicate) {
                    return false;
                }
                const now = new Date().toISOString();
                await saveProducts(store.products().map((p) => (p.id === id ? { ...p, ...changes, updatedAt: now } : p)));
                return true;
            },

            async deleteProduct(id: string): Promise<void> {
                await saveProducts(store.products().filter((p) => p.id !== id));
            },

            async adjustQuantity(id: string, delta: number): Promise<void> {
                const now = new Date().toISOString();
                await saveProducts(
                    store.products().map((p) => (p.id === id ? { ...p, quantity: Math.max(0, p.quantity + delta), updatedAt: now } : p)),
                );
            },

            /** Adds the receipt's quantities to stock, creating products for unknown codes. */
            async importReceipt(input: ReceiptInput): Promise<void> {
                const now = new Date().toISOString();
                const products = [...store.products()];
                for (const line of input.lines) {
                    const index = products.findIndex((p) => sameCode(p.code, line.code));
                    if (index >= 0) {
                        const existing = products[index];
                        products[index] = {
                            ...existing,
                            name: line.name || existing.name,
                            quantity: existing.quantity + line.quantity,
                            lastNetPrice: line.netPrice ?? existing.lastNetPrice,
                            updatedAt: now,
                        };
                    } else {
                        products.push({
                            id: crypto.randomUUID(),
                            code: line.code.trim(),
                            name: line.name,
                            unit: line.unit,
                            quantity: line.quantity,
                            lastNetPrice: line.netPrice,
                            createdAt: now,
                            updatedAt: now,
                        });
                    }
                }
                const receipts = [...store.receipts(), { ...input, id: crypto.randomUUID(), importedAt: now }];
                patchState(store, { receipts });
                await Promise.all([saveProducts(products), productService.saveReceipts(receipts)]);
            },

            setFilter(filter: Partial<ProductStoreState['filter']>): void {
                patchState(store, { filter: { ...store.filter(), ...filter } });
            },
        };
    }),
    withHooks({
        onInit(store) {
            store.load();
        },
    }),
);
