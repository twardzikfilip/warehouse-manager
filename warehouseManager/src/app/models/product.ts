export type Product = {
    id: string;
    /** Catalog number (Nr katalogowy), unique business key. */
    code: string;
    name: string;
    unit: string;
    quantity: number;
    lastNetPrice?: number;
    createdAt: string;
    updatedAt: string;
};

export type ProductInput = Pick<Product, 'code' | 'name' | 'unit' | 'quantity'>;
