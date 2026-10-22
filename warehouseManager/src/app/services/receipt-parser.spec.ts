import { LineConfidence, mergeReceipts, ParsedLine, ParsedReceipt, parsePolishNumber, parseReceipt } from './receipt-parser';
import { PZ_SAMPLE_OCR, PZ_SAMPLE_OCR_ALT } from '../testing/pz-sample-ocr';

const EXPECTED_LINES: [string, number][] = [
    ['DAM000009', 6], ['DAM000467', 2], ['DAM000161', 12], ['DAM000427', 4], ['DAM000226', 4],
    ['DAM000519', 2], ['DAM000250', 2], ['DAM000628', 1], ['DAM000168', 2], ['DAM000130', 18],
    ['DAM000079', 2], ['DAM000331', 4], ['DAM000366', 1],
];

const TABLE_HEADER = 'L p| Nr katalogowy   Nazwa artykułu   Symbol | J.m. | Ilość |St|Cena netto| Wartość netto |Cena brutto| Wartość brutto';

describe('parseReceipt', () => {
    for (const [label, text] of [['app preprocessing', PZ_SAMPLE_OCR], ['alternative preprocessing', PZ_SAMPLE_OCR_ALT]]) {
        describe(`sample document OCR (${label})`, () => {
            const result = parseReceipt(text);

            it('parses the header', () => {
                expect(result.number).toBe('PZMG 00336/10/26');
                expect(result.date).toBe('2026-10-20');
                expect(result.supplier).toBe('DAMBAT JASTRZĘBSKI SPÓŁKA KOMANDYTOWO-AKCYJNA');
                expect(result.supplierNip).toBe('5291844129');
                expect(result.invoiceNumber).toBe('F/036520/26/D');
                expect(result.warehouse).toBe('MG (Główny)');
            });

            it('finds all 13 lines with correct codes and quantities', () => {
                expect(result.lines.map((l) => [l.code, l.quantity])).toEqual(EXPECTED_LINES);
                expect(result.lines.every((l) => l.unit === 'szt.')).toBeTrue();
            });

            it('joins wrapped names', () => {
                expect(result.lines[1].name).toBe('IBO. POMPA CYR. AMG SOLAR 25-80/180 PWM');
                expect(result.lines[12].name).toBe('IBO. PRZEPOMPOWNIA AQUALIFT ŚCIEKÓW');
            });

            it('flags lines whose code had to be corrected', () => {
                expect(result.lines[5].confidence).toBe('check');
                expect(result.lines[0].confidence).toBe('ok');
            });
        });
    }

    it('reads the totals row when it is legible', () => {
        expect(parseReceipt(PZ_SAMPLE_OCR_ALT).footerQuantity).toBe(60);
        expect(parseReceipt(PZ_SAMPLE_OCR).footerQuantity).toBeUndefined();
    });

    it('only keeps a net price that reproduces the net value', () => {
        // Alternative OCR misreads 232,98 as 232,08; 12 × 232,08 ≠ 2 795,76.
        expect(parseReceipt(PZ_SAMPLE_OCR_ALT).lines[2].netPrice).toBeUndefined();
        expect(parseReceipt(PZ_SAMPLE_OCR).lines[2].netPrice).toBe(232.98);
    });

    it('separates a quantity glued to the VAT rate using price ratios', () => {
        const text = [
            TABLE_HEADER,
            '1 ABC123456      WIDGET ONE            szt.       1823    10,00      180,00    12,30      221,40',
            '2 ABC123457      WIDGET TWO            szt.       4123    25,50      102,00    31,37      125,46',
            '15 598,04   1 234,00',
        ].join('\n');
        const lines = parseReceipt(text).lines;
        expect(lines.map((l) => l.quantity)).toEqual([18, 4]);
        expect(lines.map((l) => l.confidence)).toEqual(['ok', 'ok']);
    });

    it('falls back to the quantity column and flags the line when prices are unreadable', () => {
        const text = [TABLE_HEADER, '1 ABC123456      WIDGET            szt.       723    1x,00      4o,00'].join('\n');
        const [line] = parseReceipt(text).lines;
        expect(line.quantity).toBe(7);
        expect(line.confidence).toBe('check');
    });

    it('snaps codes with a stray extra letter to the dominant prefix', () => {
        const row = (lp: number, code: string) => `${lp} ${code}      WIDGET            szt.       123    10,00      10,00    12,30      12,30`;
        const text = [TABLE_HEADER, row(1, 'DAM000001'), row(2, 'PDAM000002'), row(3, 'DAM000003')].join('\n');
        const lines = parseReceipt(text).lines;
        expect(lines.map((l) => l.code)).toEqual(['DAM000001', 'DAM000002', 'DAM000003']);
        expect(lines[1].confidence).toBe('check');
    });

    it('returns empty fields for unrelated text', () => {
        const result = parseReceipt('hello world');
        expect(result.number).toBe('');
        expect(result.lines).toEqual([]);
    });
});

describe('mergeReceipts', () => {
    const line = (code: string, quantity: number, confidence: LineConfidence = 'ok'): ParsedLine =>
        ({ code, name: code, unit: 'szt.', quantity, confidence });
    const receipt = (lines: ParsedLine[], extra: Partial<ParsedReceipt> = {}): ParsedReceipt =>
        ({ number: 'PZ 1/10/26', date: '2026-10-20', supplier: 'S', lines, ...extra });

    it('flags lines where the passes read different codes, even if each pass was confident', () => {
        const merged = mergeReceipts(
            receipt([line('DAM000009', 6), line('DAM000528', 1)]),
            receipt([line('DAM000009', 6), line('DAM000628', 1)]),
        );
        expect(merged.lines.map((l) => l.confidence)).toEqual(['ok', 'check']);
    });

    it('prefers the confident read when passes disagree', () => {
        const merged = mergeReceipts(
            receipt([line('DAM000079', 41, 'check')]),
            receipt([line('DAM000079', 4, 'ok')]),
        );
        expect(merged.lines[0].quantity).toBe(4);
        expect(merged.lines[0].confidence).toBe('check');
    });

    it('does not trust agreement of two uncertain reads', () => {
        const merged = mergeReceipts(receipt([line('DAM000079', 41, 'check')]), receipt([line('DAM000079', 41, 'check')]));
        expect(merged.lines[0].confidence).toBe('check');
    });

    it('aligns passes when one of them missed a row', () => {
        const merged = mergeReceipts(
            receipt([line('DAM000009', 6), line('DAM000467', 2), line('DAM000161', 12)]),
            receipt([line('DAM000009', 6), line('DAM000161', 12)]),
        );
        expect(merged.lines.map((l) => [l.code, l.confidence])).toEqual([
            ['DAM000009', 'ok'], ['DAM000467', 'check'], ['DAM000161', 'ok'],
        ]);
    });

    it('fills missing header fields and picks the plausible date', () => {
        jasmine.clock().install();
        try {
            jasmine.clock().mockDate(new Date('2026-10-22'));
            const merged = mergeReceipts(
                receipt([], { date: '', invoiceNumber: 'F/1' }),
                receipt([], { date: '2026-10-20', supplierNip: '5291844129' }),
            );
            expect(merged.date).toBe('2026-10-20');
            expect(merged.invoiceNumber).toBe('F/1');
            expect(merged.supplierNip).toBe('5291844129');
            expect(mergeReceipts(receipt([], { date: '2028-10-20' }), receipt([], { date: '2026-10-20' })).date).toBe('2026-10-20');
        } finally {
            jasmine.clock().uninstall();
        }
    });
});

describe('parsePolishNumber', () => {
    it('handles thousands separators and decimal commas', () => {
        expect(parsePolishNumber('1 081,56')).toBe(1081.56);
        expect(parsePolishNumber('15 598,04')).toBe(15598.04);
        expect(parsePolishNumber('180.26')).toBe(180.26);
    });
});
