import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { Product } from '../store/products.store';

@Injectable({
    providedIn: 'root',
})
export class ProductService {
    constructor() {}

    getProducts(): Observable<Product[]> {
        const mockProducts: Product[] = Array.from({ length: 10 }, () => ({
            id: uuidv4(),
            code: this.generateRandomCode(),
            name: this.generateRandomName(),
            quantity: 1
        }));

        return of(mockProducts);
    }

    private generateRandomCode(): string {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    private generateRandomName(): string {
        const words = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa'];
        const randomWord1 = words[Math.floor(Math.random() * words.length)];
        const randomWord2 = words[Math.floor(Math.random() * words.length)];
        return `${randomWord1} ${randomWord2}`;
    }
}