export type ReceiptLine = {
    code: string;
    name: string;
    unit: string;
    quantity: number;
    netPrice?: number;
    netValue?: number;
};

/** A goods receipt document (Dokument przyjęcia, PZ). */
export type ReceiptDocument = {
    id: string;
    number: string;
    /** ISO date (yyyy-mm-dd) printed on the document. */
    date: string;
    supplier: string;
    supplierNip?: string;
    invoiceNumber?: string;
    warehouse?: string;
    lines: ReceiptLine[];
    importedAt: string;
};

export type ReceiptInput = Omit<ReceiptDocument, 'id' | 'importedAt'>;
