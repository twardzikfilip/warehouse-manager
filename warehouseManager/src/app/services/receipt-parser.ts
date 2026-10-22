import { ReceiptLine } from '../models/receipt';

/**
 * Parser for OCR text of WAPRO Mag "Dokument przyjęcia" (PZ) documents.
 *
 * Table layout: Lp | Nr katalogowy | Nazwa artykułu | Symbol SWW | J.m. | Ilość | St % |
 * Cena netto | Wartość netto | Cena brutto | Wartość brutto, followed by a totals row.
 * OCR merges the quantity with the VAT rate ("6 23" -> "623") and garbles small print,
 * so quantities are recovered from price ratios (value / unit price) where possible.
 */

export type LineConfidence = 'ok' | 'check';

export type ParsedLine = ReceiptLine & { confidence: LineConfidence };

export type ParsedReceipt = {
    number: string;
    /** ISO yyyy-mm-dd, empty when not found. */
    date: string;
    supplier: string;
    supplierNip?: string;
    invoiceNumber?: string;
    warehouse?: string;
    lines: ParsedLine[];
    /** Total quantity printed in the totals row, used as a checksum. */
    footerQuantity?: number;
};

type RawRow = {
    prefix: string;
    digits: string;
    name: string;
    unit?: string;
    quantity: number;
    netPrice?: number;
    netValue?: number;
    confidence: LineConfidence;
};

// Catalog number: 2-4 letters + 5-8 digits; O/o is a common OCR misread of 0.
const CODE_RE = /\b([A-Z]{2,4}?)([0-9Oo]{5,8})\b/;
// Polish amounts: "1 081,56", "1081,56", "180,26" (dot tolerated as OCR misread of comma).
const AMOUNT_RE = /(^|[^\d,.])((?:\d{1,3}(?: \d{3})+|\d+)[,.]\d{1,2})(?!\d)/g;
const TABLE_HEADER_RE = /katalog|nazwa\s+artyku/i;
const TABLE_END_RE = /sporz|zatwier|wydrukowano/i;
const COLUMN_GAP_RE = /\s{3,}/;
const UNITS: Record<string, string> = {
    szt: 'szt.', kpl: 'kpl.', opak: 'opak.', op: 'op.', kg: 'kg', mb: 'mb', m: 'm', l: 'l',
};
const DEFAULT_UNIT = 'szt.';

export function parseReceipt(text: string): ParsedReceipt {
    const lines = text.replace(/\r/g, '').split('\n');
    const { rows, footerQuantity } = parseTable(lines);
    normalizeCodes(rows);
    const fallbackUnit = mostCommon(rows.map((r) => r.unit).filter((u): u is string => !!u)) ?? DEFAULT_UNIT;

    return {
        ...parseHeader(text),
        lines: rows.map((r) => ({
            code: r.prefix + r.digits,
            name: r.name,
            unit: r.unit ?? fallbackUnit,
            quantity: r.quantity,
            netPrice: r.netPrice,
            netValue: r.netValue,
            confidence: r.confidence,
        })),
        footerQuantity,
    };
}

/**
 * Combines parses of two OCR passes over differently preprocessed images. A line is only
 * trusted when both passes read the same code and quantity; any disagreement is flagged,
 * which catches confident single-pass misreads such as 628 -> 528.
 */
export function mergeReceipts(first: ParsedReceipt, second: ParsedReceipt): ParsedReceipt {
    const [a, b] = second.lines.length > first.lines.length ? [second, first] : [first, second];
    let next = 0;
    const lines = a.lines.map((line, index): ParsedLine => {
        // Passes may drop or add a row, so look a couple of rows ahead for the closest counterpart,
        // skipping rows that exactly match one of this pass's upcoming lines instead.
        const upcoming = new Set(a.lines.slice(index + 1, index + 3).map((l) => l.code));
        let k = -1;
        for (let i = next; i < Math.min(b.lines.length, next + 3); i++) {
            const code = b.lines[i].code;
            if (code === line.code) {
                k = i;
                break;
            }
            if (k < 0 && similarCodes(line.code, code) && !upcoming.has(code)) {
                k = i;
            }
        }
        if (k < 0) {
            return { ...line, confidence: 'check' };
        }
        next = k + 1;
        const other = b.lines[k];
        const prices = { netPrice: line.netPrice ?? other.netPrice, netValue: line.netValue ?? other.netValue };
        if (line.code === other.code && line.quantity === other.quantity) {
            const confident = line.confidence === 'ok' || other.confidence === 'ok';
            return { ...line, ...prices, confidence: confident ? 'ok' : 'check' };
        }
        const preferred = line.confidence === 'check' && other.confidence === 'ok' ? other : line;
        return { ...line, ...prices, code: preferred.code, quantity: preferred.quantity, confidence: 'check' };
    });

    const quantitySum = lines.reduce((sum, l) => sum + l.quantity, 0);
    const footerQuantity = [a.footerQuantity, b.footerQuantity].find((q) => q === quantitySum) ?? a.footerQuantity ?? b.footerQuantity;

    return {
        number: a.number || b.number,
        date: closestToToday(a.date, b.date),
        supplier: a.supplier || b.supplier,
        supplierNip: a.supplierNip ?? b.supplierNip,
        invoiceNumber: a.invoiceNumber ?? b.invoiceNumber,
        warehouse: a.warehouse ?? b.warehouse,
        lines,
        footerQuantity,
    };
}

export function parsePolishNumber(value: string): number {
    return Number(value.replace(/\s/g, '').replace(',', '.'));
}

function parseHeader(text: string): Omit<ParsedReceipt, 'lines' | 'footerQuantity'> {
    const number =
        text.match(/PRZYJ\S*\s+nr\.?\s*([A-Z]{2,6}\s*[0-9O]{2,}\/\d{1,2}\/\d{2,4})/i)?.[1] ??
        text.match(/\b(PZ[A-Z]*\s*\d{3,}\/\d{1,2}\/\d{2,4})/)?.[1] ??
        '';

    const dateMatch = text.match(/Data\s*[:;.,]?\s*(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/i);
    const date = dateMatch
        ? `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`
        : '';

    const supplierMatch = text.match(/Dostawca\s*[:;]?\s*(.+)/i);
    const supplier = supplierMatch ? firstColumn(supplierMatch[1]) : '';
    // The supplier's NIP follows the "Dostawca" line; the first NIP on the page is the buyer's.
    const afterSupplier = supplierMatch ? text.slice((supplierMatch.index ?? 0) + supplierMatch[0].length) : '';
    const nipDigits = afterSupplier.match(/NIP\s*[:;]?\s*(\d[\d\- ]{8,14}\d)/i)?.[1].replace(/\D/g, '');

    const invoiceNumber = text.match(/Nr\s+faktury\s*[:;]?\s*(\S+)/i)?.[1];
    const warehouseMatch = text.match(/magazynu\s*[:;]?\s*(.+)/i);
    const warehouse = warehouseMatch
        ? firstColumn(warehouseMatch[1]).replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
        : undefined;

    return {
        number: number.replace(/\s+/g, ' ').trim(),
        date,
        supplier,
        supplierNip: nipDigits?.length === 10 ? nipDigits : undefined,
        invoiceNumber,
        warehouse: warehouse || undefined,
    };
}

function parseTable(lines: string[]): { rows: RawRow[]; footerQuantity?: number } {
    const headerIndex = lines.findIndex((l) => TABLE_HEADER_RE.test(l));
    const rows: RawRow[] = [];
    let footerQuantity: number | undefined;

    for (const line of lines.slice(headerIndex + 1)) {
        if (TABLE_END_RE.test(line)) {
            break;
        }
        const codeMatch = line.match(CODE_RE);
        if (codeMatch) {
            rows.push(parseRow(line.slice((codeMatch.index ?? 0) + codeMatch[0].length), codeMatch[1], codeMatch[2]));
            continue;
        }
        if (rows.length === 0) {
            continue;
        }
        const amounts = findAmounts(line);
        const amountCount = amounts.length;
        if (amountCount >= 3) {
            // A product row whose catalog number OCR could not read.
            const row = parseRow(line.replace(/^[\s\W\d]{0,6}/, ''), '', '');
            rows.push({ ...row, confidence: 'check' });
            continue;
        }
        if (amountCount === 2) {
            // Totals row: "60 | XXXX | 12 681,33 | XXXX | 15 598,04".
            const total = line.slice(0, amounts[0].index).match(/\d+/);
            footerQuantity = total ? Number(total[0]) : undefined;
            break;
        }
        const continuation = cleanCell(line);
        if ((continuation.match(/[\p{L}\d]/gu) ?? []).length >= 2) {
            const last = rows[rows.length - 1];
            last.name = `${last.name} ${continuation}`.trim();
        }
    }
    return { rows, footerQuantity };
}

function parseRow(rest: string, prefix: string, digits: string): RawRow {
    const segments = rest.split(COLUMN_GAP_RE).map((s) => s.trim()).filter(Boolean);
    const name = cleanCell(segments[0] ?? '');
    const tail = segments.slice(1).join('   ');
    const unit = findUnit(tail);

    // Last four amounts are: net price, net value, gross price, gross value.
    const amounts = findAmounts(tail).slice(-4);
    const votes = new Map<number, number>();
    for (let i = 0; i + 1 < amounts.length; i++) {
        const q = integerRatio(amounts[i].value, amounts[i + 1].value);
        if (q !== undefined) {
            votes.set(q, (votes.get(q) ?? 0) + 1);
        }
    }

    // Quantity column (glued to VAT): first numeric cell before the amounts.
    const chunkDigits = (tail.slice(0, amounts[0]?.index ?? tail.length).split(COLUMN_GAP_RE).find((s) => /\d/.test(s)) ?? '')
        .replace(/\D/g, '');
    const chunkQuantity = quantityFromChunk(chunkDigits);
    const supportedByChunk = (q: number) => chunkDigits.startsWith(String(q));

    let quantity: number;
    let confidence: LineConfidence = 'check';
    const ranked = [...votes.entries()].sort(
        (a, b) => b[1] - a[1] || Number(supportedByChunk(b[0])) - Number(supportedByChunk(a[0])),
    );
    if (ranked.length > 0) {
        const [q, count] = ranked[0];
        quantity = q;
        if (count >= 2 || supportedByChunk(q)) {
            confidence = 'ok';
        }
    } else {
        quantity = chunkQuantity ?? 1;
    }

    let netPrice: number | undefined;
    let netValue: number | undefined;
    // Only trust the price when it reproduces the printed value up to rounding.
    if (amounts.length === 4 && Math.abs(amounts[0].value * quantity - amounts[1].value) <= 0.005 * quantity + 0.01) {
        netPrice = amounts[0].value;
        netValue = amounts[1].value;
    }

    return { prefix, digits, name, unit, quantity, netPrice, netValue, confidence };
}

function findAmounts(text: string): { value: number; index: number }[] {
    return [...text.matchAll(AMOUNT_RE)].map((m) => ({
        value: parsePolishNumber(m[2]),
        index: (m.index ?? 0) + m[1].length,
    }));
}

/** Returns n when value ≈ n × price for a whole n ≥ 1. */
function integerRatio(price: number, value: number): number | undefined {
    if (price <= 0) {
        return undefined;
    }
    const ratio = value / price;
    const n = Math.round(ratio);
    return n >= 1 && Math.abs(ratio - n) <= 0.005 * n ? n : undefined;
}

/** "623" -> 6, "1225" -> 12: strips the two-digit VAT rate glued to the quantity. */
function quantityFromChunk(digits: string): number | undefined {
    if (!digits) {
        return undefined;
    }
    const q = Number(digits.length >= 3 ? digits.slice(0, -2) : digits.length === 2 ? digits[0] : digits);
    return q >= 1 ? q : undefined;
}

function findUnit(tail: string): string | undefined {
    const match = tail.match(/(?:^|[^\p{L}])(szt|kpl|opak|op|kg|mb|m|l)\b/iu);
    return match ? UNITS[match[1].toLowerCase()] : undefined;
}

/** Snaps OCR-damaged codes (PAM000519, PDAM000519, DAMo00250, DAMO000366) to the document's dominant pattern. */
function normalizeCodes(rows: RawRow[]): void {
    for (const row of rows) {
        row.prefix = row.prefix.toUpperCase();
        row.digits = row.digits.replace(/[Oo]/g, '0');
    }
    const prefix = mostCommon(rows.map((r) => r.prefix));
    const digitCount = mostCommon(rows.map((r) => r.digits.length));
    for (const row of rows) {
        const oneLetterOff =
            row.prefix.length === prefix?.length
                ? hamming(row.prefix, prefix) === 1
                : row.prefix.length === (prefix?.length ?? 0) + 1 && (row.prefix.slice(1) === prefix || row.prefix.slice(0, -1) === prefix);
        if (prefix && row.prefix !== prefix && oneLetterOff) {
            row.prefix = prefix;
            row.confidence = 'check';
        }
        if (digitCount && row.digits.length > digitCount && /^0+$/.test(row.digits.slice(0, row.digits.length - digitCount))) {
            row.digits = row.digits.slice(-digitCount);
        }
    }
}

function firstColumn(text: string): string {
    return text.split(COLUMN_GAP_RE)[0].trim();
}

function cleanCell(text: string): string {
    return firstColumn(text.replace(/^[\s|[\](){}.,:;'"“”„—–\-*]+/, ''))
        .replace(/\s+[^\p{L}\d]+$/u, '')
        .replace(/[\s|[\]]+$/, '');
}

function similarCodes(a: string, b: string): boolean {
    return !!a && a.length === b.length && hamming(a, b) <= 2;
}

/** OCR can misread a year (2026 -> 2028); the plausible date is the one nearest today. */
function closestToToday(...dates: string[]): string {
    const valid = dates.filter((d) => d && !Number.isNaN(Date.parse(d)));
    const distance = (d: string) => Math.abs(Date.parse(d) - Date.now());
    return valid.sort((x, y) => distance(x) - distance(y))[0] ?? '';
}

function hamming(a: string, b: string): number {
    let d = 0;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            d++;
        }
    }
    return d;
}

function mostCommon<T>(values: T[]): T | undefined {
    const counts = new Map<T, number>();
    values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}
