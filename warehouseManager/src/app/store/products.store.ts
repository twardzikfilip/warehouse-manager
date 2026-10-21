import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { inject } from '@angular/core';
import { catchError, EMPTY, pipe, switchMap, tap } from 'rxjs';
import { ProductService } from '../services/product.service';
import { rxMethod } from '@ngrx/signals/rxjs-interop';

export type Product = {
    id: string;
    code: string;
    name: string;
    quantity: number;
}


type ProductStoreState = {
    products: Product[];
    loading: boolean;
    error: unknown;
    filter: { query: string; order: 'asc' | 'desc' };
};


export const ProductStore = signalStore(
    { providedIn: 'root' },
    withState<ProductStoreState>({
        products: [],
        loading: false,
        error: null,
        filter: { query: '', order: 'asc' }
    }),
    withMethods((
        store,
        productService = inject(ProductService),
    ) => ({
        loadProducts: rxMethod<void>(
            pipe(
                tap(() => patchState(store, { loading: true, error: null })),
                switchMap(() =>
                    productService.getProducts().pipe(
                        tap((products) => patchState(store, { products, loading: false })),
                        catchError((error) => {
                            patchState(store, { error, loading: false });
                            return EMPTY;
                        })
                    )
                )
            )
        )
        //addProduct: (productId: number) => { },
        //deleteProduct: (productId: number) => { },
    })),
    withHooks({
        onInit(store) {
            store.loadProducts();
        }
    })
)
