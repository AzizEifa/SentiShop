// src/app/core/csv/csv-normalizer.ts
//
// Le backend attend un CSV strict : en-tête "text,product", séparateur virgule,
// texte <= 2000 caractères, produit <= 120 caractères.
// Ce module rend l'import tolérant côté navigateur (Excel FR avec ";", en-têtes
// "texte/produit", fichier sans en-tête, lignes vides) et renvoie un CSV propre.

export const MAX_TEXT = 2000;
export const MAX_PRODUCT = 120;
export const MAX_ROWS = 2000;

export interface CsvRow {
  /** Numéro de ligne dans le fichier d'origine (1 = première ligne). */
  line: number;
  text: string;
  product: string;
}

export interface ParsedCsv {
  rows: CsvRow[];
  delimiter: string;
  hasHeader: boolean;
  warnings: string[];
}

const TEXT_HEADERS = ['text', 'texte', 'avis', 'review', 'reviews', 'commentaire', 'comment', 'message'];
const PRODUCT_HEADERS = ['product', 'produit', 'article', 'item'];

const normalizeHeader = (h: string) =>
  h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Choisit le séparateur le plus présent dans la première ligne (hors guillemets). */
export function detectDelimiter(firstLine: string): string {
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let quoted = false;
  for (const c of firstLine) {
    if (c === '"') quoted = !quoted;
    else if (!quoted && c in counts) counts[c]++;
  }
  const [best, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return count > 0 ? best : ',';
}

/** Parse un CSV (RFC 4180 : guillemets, "" échappés, retours à la ligne dans un champ). */
export function parseRecords(content: string, delimiter: string): { cells: string[]; line: number }[] {
  const records: { cells: string[]; line: number }[] = [];
  let cells: string[] = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let recordLine = 1;

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (quoted) {
      if (c === '"' && content[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else { if (c === '\n') line++; field += c; }
    } else if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      cells.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && content[i + 1] === '\n') i++;
      cells.push(field);
      records.push({ cells, line: recordLine });
      cells = []; field = '';
      line++; recordLine = line;
    } else {
      field += c;
    }
  }
  if (field !== '' || cells.length) {
    cells.push(field);
    records.push({ cells, line: recordLine });
  }
  return records;
}

export function parseReviewsCsv(raw: string): ParsedCsv {
  const content = raw.replace(/^﻿/, '');
  const warnings: string[] = [];
  const delimiter = detectDelimiter(content.split(/\r?\n/, 1)[0] ?? '');
  const records = parseRecords(content, delimiter);

  let textCol = 0;
  let productCol = 1;
  let hasHeader = false;
  if (records.length) {
    const headers = records[0].cells.map(normalizeHeader);
    const t = headers.findIndex((h) => TEXT_HEADERS.includes(h));
    const p = headers.findIndex((h) => PRODUCT_HEADERS.includes(h));
    if (t >= 0 || p >= 0) {
      hasHeader = true;
      textCol = t >= 0 ? t : (p === 0 ? 1 : 0);
      productCol = p;
    }
  }

  const rows: CsvRow[] = [];
  let truncatedText = 0;
  let truncatedProduct = 0;
  let empty = 0;
  for (const rec of records.slice(hasHeader ? 1 : 0)) {
    let text = (rec.cells[textCol] ?? '').trim();
    let product = productCol >= 0 ? (rec.cells[productCol] ?? '').trim() : '';
    if (!text) {
      if (rec.cells.some((c) => c.trim())) empty++;
      continue;
    }
    if (text.length > MAX_TEXT) { text = text.slice(0, MAX_TEXT); truncatedText++; }
    if (product.length > MAX_PRODUCT) { product = product.slice(0, MAX_PRODUCT); truncatedProduct++; }
    rows.push({ line: rec.line, text, product });
  }

  if (empty) warnings.push(`${empty} ligne(s) sans texte ignorée(s)`);
  if (truncatedText) warnings.push(`${truncatedText} avis tronqué(s) à ${MAX_TEXT} caractères`);
  if (truncatedProduct) warnings.push(`${truncatedProduct} nom(s) de produit tronqué(s) à ${MAX_PRODUCT} caractères`);
  if (rows.length > MAX_ROWS) {
    warnings.push(`Limite de ${MAX_ROWS} avis : ${rows.length - MAX_ROWS} ligne(s) ignorée(s)`);
    rows.length = MAX_ROWS;
  }
  return { rows, delimiter, hasHeader, warnings };
}

const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;

/** CSV au format exact attendu par POST /api/reviews/import. */
export function toBackendCsv(rows: CsvRow[]): string {
  return ['text,product', ...rows.map((r) => `${quote(r.text)},${quote(r.product)}`)].join('\n');
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
