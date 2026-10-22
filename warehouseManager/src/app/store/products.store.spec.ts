import { TestBed } from '@angular/core/testing';
import { ProductInput } from '../models/product';
import { FakeProductService, provideTestDependencies } from '../testing/test-providers';
import { ProductStore, searchKey } from './products.store';

describe('ProductStore', () => {
    let store: InstanceType<typeof ProductStore>;
    let persistence: FakeProductService;

    const pump: ProductInput = { code: 'DAM000009', name: 'IBO. POMPA SCR-0,25 GŁĘBINOWA 3"', unit: 'szt.', quantity: 6 };
    const valve: ProductInput = { code: 'DAM000427', name: 'IBO. ELEKTROZAWÓR KULOWY DN32', unit: 'szt.', quantity: 4 };

    beforeEach(async () => {
        persistence = new FakeProductService();
        TestBed.configureTestingModule({ providers: provideTestDependencies(persistence) });
        store = TestBed.inject(ProductStore);
        await store.load();
    });

    it('adds products, persists them and rejects duplicate codes', async () => {
        expect(await store.addProduct(pump)).toBeTrue();
        expect(await store.addProduct({ ...valve, code: 'dam000009 ' })).toBeFalse();
        expect(store.products().length).toBe(1);
        expect(persistence.products.length).toBe(1);
    });

    it('does not let quantity go below zero', async () => {
        await store.addProduct({ ...pump, quantity: 1 });
        const id = store.products()[0].id;
        await store.adjustQuantity(id, -1);
        await store.adjustQuantity(id, -1);
        expect(store.products()[0].quantity).toBe(0);
    });

    it('rejects updating a product to a code used by another product', async () => {
        await store.addProduct(pump);
        await store.addProduct(valve);
        const valveId = store.findByCode(valve.code)!.id;
        expect(await store.updateProduct(valveId, { code: pump.code })).toBeFalse();
        expect(await store.updateProduct(valveId, { quantity: 9 })).toBeTrue();
        expect(store.findByCode(valve.code)!.quantity).toBe(9);
    });

    it('imports a receipt: adds to existing stock and creates new products', async () => {
        await store.addProduct(pump);
        await store.importReceipt({
            number: 'PZMG 00336/10/26',
            date: '2026-10-20',
            supplier: 'DAMBAT',
            lines: [
                { code: 'DAM000009', name: 'IBO. POMPA SCR-0,25 GŁĘBINOWA 3"', unit: 'szt.', quantity: 6, netPrice: 180.26 },
                { code: 'DAM000130', name: 'IBO. POMPA NOVA 25-60/180', unit: 'szt.', quantity: 18 },
            ],
        });
        expect(store.findByCode('DAM000009')!.quantity).toBe(12);
        expect(store.findByCode('DAM000009')!.lastNetPrice).toBe(180.26);
        expect(store.findByCode('DAM000130')!.quantity).toBe(18);
        expect(store.hasReceipt('PZMG 00336/10/26')).toBeTrue();
        expect(persistence.receipts.length).toBe(1);
        expect(store.recentReceipts().length).toBe(1);
        expect(store.totalQuantity()).toBe(30);
    });

    it('filters ignoring case and Polish diacritics, and sorts', async () => {
        await store.addProduct(pump);
        await store.addProduct(valve);
        store.setFilter({ query: 'glebinowa' });
        expect(store.filteredProducts().map((p) => p.code)).toEqual(['DAM000009']);

        store.setFilter({ query: '', sortBy: 'quantity', order: 'desc' });
        expect(store.filteredProducts().map((p) => p.quantity)).toEqual([6, 4]);
    });

    it('lists low stock products', async () => {
        await store.addProduct({ ...pump, quantity: 20 });
        await store.addProduct({ ...valve, quantity: 2 });
        expect(store.lowStock().map((p) => p.code)).toEqual([valve.code]);
    });
});

describe('searchKey', () => {
    it('strips diacritics including ł', () => {
        expect(searchKey('ŚCIEKÓW Łódź')).toBe('sciekow lodz');
    });
});
