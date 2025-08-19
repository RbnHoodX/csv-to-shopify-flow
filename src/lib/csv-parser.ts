import Papa from 'papaparse';

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Parse CSV text using PapaParse with consistent configuration
 */
export function parseCsv(text: string): ParsedCSV {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  return {
    headers: result.meta.fields || [],
    rows: result.data as Record<string, string>[],
  };
}

/**
 * Trim and collapse leading/trailing spaces while preserving inner spacing
 */
export function trimAll(s: string | null | undefined): string {
  if (!s) return '';
  return String(s).trim().replace(/\s+/g, ' ');
}

/**
 * Convert string to number, handling comma separators
 * Returns NaN if conversion fails
 */
export function toNum(v: string | number | null | undefined): number {
  if (typeof v === 'number') return v;
  if (!v) return NaN;
  
  const cleaned = String(v)
    .replace(/,/g, '') // Remove thousand separators
    .trim();
  
  return parseFloat(cleaned);
}

/**
 * Format number as monetary 2-decimal string (no thousands separators)
 */
export function toFixed2(n: number | string | null | undefined): string {
  const num = typeof n === 'number' ? n : toNum(n);
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
}

/**
 * Format carat string as "X.XXCT Total" or "X.XXCT Total (Y.YYCT Center)"
 */
export function ctStr(total: number | string, center?: number | string): string {
  const totalNum = typeof total === 'number' ? total : toNum(total);
  const centerNum = center !== undefined ? (typeof center === 'number' ? center : toNum(center)) : undefined;
  
  if (isNaN(totalNum)) return '0.00CT Total';
  
  const totalStr = `${toFixed2(totalNum)}CT Total`;
  
  if (centerNum !== undefined && !isNaN(centerNum) && centerNum > 0) {
    return `${totalStr} (${toFixed2(centerNum)}CT Center)`;
  }
  
  return totalStr;
}

/**
 * Calculate sum of all side stone carat columns from input row
 * Looks for columns like: Side ct, Side1 ct, Side2 ct, Side Ct 1, etc.
 */
export function calculateSumSideCt(inputRow: any): number {
  let sumSideCt = 0;
  
  // Common side carat column patterns
  const sideCaratPatterns = [
    'Side ct', 'Side Ct', 'SideCt', 'Side Carat',
    'Side1 ct', 'Side1 Ct', 'Side1Ct', 'Side1 Carat',
    'Side2 ct', 'Side2 Ct', 'Side2Ct', 'Side2 Carat',
    'Side3 ct', 'Side3 Ct', 'Side3Ct', 'Side3 Carat',
    'Side4 ct', 'Side4 Ct', 'Side4Ct', 'Side4 Carat',
    'Side5 ct', 'Side5 Ct', 'Side5Ct', 'Side5 Carat',
    'Side Ct 1', 'Side Ct 2', 'Side Ct 3', 'Side Ct 4', 'Side Ct 5',
    'Sum Side Ct', 'SumSideCt', 'Sum Side Carat'
  ];
  
  // Check all possible side carat columns
  for (const pattern of sideCaratPatterns) {
    const value = inputRow[pattern];
    if (value !== undefined && value !== null && value !== '') {
      const numValue = toNum(value);
      if (!isNaN(numValue)) {
        sumSideCt += numValue;
      }
    }
  }
  
  return sumSideCt;
}

/**
 * Format number to 2 decimal places for carat display (toCt2)
 */
export function toCt2(n: number | string | null | undefined): string {
  return toFixed2(n);
}

export enum DiamondsType {
  Natural = 'Natural',
  Labgrown = 'Labgrown',
  NoStones = 'No Stones'
}

/**
 * Normalize a CSV row with common transformations
 */
export function normalizeRow(row: Record<string, string>): Record<string, any> {
  const normalized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(row)) {
    const trimmed = trimAll(value);
    normalized[key] = {
      raw: value,
      trimmed,
      numeric: toNum(trimmed),
      isValid: trimmed !== '',
    };
  }
  
  return normalized;
}