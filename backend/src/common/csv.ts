/**
 * FEAT-6: RFC 4180 quoting i zastita od spreadsheet formula.
 *
 * Navodnici sami po sebi NE štite od formula. Tekstualna ćelija koja nakon
 * vodećih praznina/kontrolnih znakova počinje s =, +, - ili @ dobija apostrof.
 * Brojevi ostaju brojevi: negativno mjerenje ne smije postati tekst.
 */
export type CsvCell = string | number | boolean | null | undefined;

// eslint-disable-next-line no-control-regex -- namjerno hvatamo kontrolne znakove prije formule
const FORMULA_PREFIX = /^[\s\u0000-\u001f\u007f]*[=+\-@]/;

export function escapeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';

  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(
  rows: readonly (readonly CsvCell[])[],
  lineEnding: '\n' | '\r\n' = '\r\n',
): string {
  return rows
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join(lineEnding);
}
