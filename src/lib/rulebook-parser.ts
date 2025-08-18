import { trimAll, toNum } from './csv-parser';

export interface RuleSet {
  metalsG: string[];      // Metals (center-present)
  centersH: string[];     // Center Sizes
  qualitiesI: string[];   // Qualities (center-present)
  metalsJ: string[];      // Metals (no-center)
  qualitiesK: string[];   // Qualities (no-center)
  weightIndex: Map<string, number>;  // Metal code → weight multiplier
  metalPrice: Map<string, number>;   // Metal code → price per gram
  labor: Map<string, number>;        // Labor type → cost
  margins: Array<{begin: number, end?: number, m: number}>; // Margin ranges
}

export interface NoStonesRuleSet {
  metalsA: string[];      // Metals list for no-stones items
}

/**
 * Split metal codes from a cell that may contain multiple codes
 * e.g., "14W 14Y 14R 18W 18Y 18R PLT" → ["14W", "14Y", "14R", "18W", "18Y", "18R", "PLT"]
 */
function splitMetalCodes(cellValue: string): string[] {
  if (!cellValue) return [];
  return trimAll(cellValue)
    .split(/[ ,|]+/)
    .filter(code => code.length > 0)
    .map(code => trimAll(code));
}

/**
 * Split center sizes from a cell that may contain multiple sizes
 * e.g., "0.50 0.75 1.00" → ["0.50", "0.75", "1.00"]
 */
function splitCenterSizes(cellValue: string): string[] {
  if (!cellValue) return [];
  return trimAll(cellValue)
    .split(/[ ,|]+/)
    .filter(size => size.length > 0)
    .map(size => trimAll(size));
}

/**
 * Find column index by header pattern (case-insensitive partial match)
 */
function findColumnIndex(headers: string[], pattern: string): number {
  return headers.findIndex(header => 
    header.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Extract lookup table from rows starting at a specific row index
 * Assumes two-column format: Key | Value
 */
function extractLookupTable(
  rows: Record<string, string>[], 
  startRowIndex: number, 
  keyColumn: string, 
  valueColumn: string
): Map<string, number> {
  const table = new Map<string, number>();
  
  for (let i = startRowIndex; i < rows.length; i++) {
    const row = rows[i];
    const key = trimAll(row[keyColumn]);
    const value = toNum(row[valueColumn]);
    
    if (key && !isNaN(value)) {
      table.set(key, value);
    } else if (!key && !row[valueColumn]) {
      // Empty row, might indicate end of table
      break;
    }
  }
  
  return table;
}

/**
 * Extract margin table with range format
 */
function extractMarginTable(rows: Record<string, string>[], startRowIndex: number): Array<{begin: number, end?: number, m: number}> {
  const margins: Array<{begin: number, end?: number, m: number}> = [];
  
  for (let i = startRowIndex; i < rows.length; i++) {
    const row = rows[i];
    const beginStr = trimAll(row['Range Begin'] || row['Begin'] || '');
    const endStr = trimAll(row['Range End'] || row['End'] || '');
    const multiplierStr = trimAll(row['Multiplier'] || row['M'] || '');
    
    const begin = toNum(beginStr);
    const end = endStr ? toNum(endStr) : undefined;
    const m = toNum(multiplierStr);
    
    if (!isNaN(begin) && !isNaN(m)) {
      margins.push({ begin, end: isNaN(end!) ? undefined : end, m });
    } else if (!beginStr && !endStr && !multiplierStr) {
      break;
    }
  }
  
  return margins;
}

/**
 * Extract labor table with label and cost columns
 */
function extractLaborTable(rows: Record<string, string>[], startRowIndex: number): Map<string, number> {
  const labor = new Map<string, number>();
  
  for (let i = startRowIndex; i < rows.length; i++) {
    const row = rows[i];
    const label = trimAll(row['Label'] || row['Labor'] || row['Description'] || '');
    const cost = toNum(row['Cost'] || row['Price'] || '');
    
    if (label && !isNaN(cost)) {
      labor.set(label, cost);
    } else if (!label && isNaN(cost)) {
      break;
    }
  }
  
  return labor;
}

/**
 * Extract rule sets from Natural Rules.csv or LabGrown Rules.csv
 */
export function extractRuleSets(ruleRows: Record<string, string>[]): RuleSet {
  if (!ruleRows || ruleRows.length === 0) {
    return {
      metalsG: [],
      centersH: [],
      qualitiesI: [],
      metalsJ: [],
      qualitiesK: [],
      weightIndex: new Map(),
      metalPrice: new Map(),
      labor: new Map(),
      margins: []
    };
  }

  const headers = Object.keys(ruleRows[0]);
  
  // Find column indices based on header patterns
  const colG = Math.max(6, findColumnIndex(headers, 'if center and diamonds')); // Column G (index 6)
  const colH = Math.max(7, findColumnIndex(headers, 'center size')); // Column H (index 7)
  const colI = Math.max(8, headers.findIndex(h => h.toLowerCase() === 'quality')); // Column I (index 8)
  const colJ = Math.max(9, findColumnIndex(headers, 'if no center and yes stones')); // Column J (index 9)
  const colK = Math.max(10, findColumnIndex(headers, 'quality')); // Column K (index 10) - second quality column

  // Extract arrays from columns
  const metalsG: string[] = [];
  const centersH: string[] = [];
  const qualitiesI: string[] = [];
  const metalsJ: string[] = [];
  const qualitiesK: string[] = [];

  // Process main data rows (assume first 20-30 rows contain the main data)
  const mainDataRows = Math.min(30, ruleRows.length);
  
  for (let i = 0; i < mainDataRows; i++) {
    const row = ruleRows[i];
    const rowValues = Object.values(row);
    
    // Column G: Metals (center-present)
    if (colG < rowValues.length) {
      const metalsCell = rowValues[colG];
      const metals = splitMetalCodes(metalsCell);
      metalsG.push(...metals);
    }
    
    // Column H: Center Sizes
    if (colH < rowValues.length) {
      const sizesCell = rowValues[colH];
      const sizes = splitCenterSizes(sizesCell);
      centersH.push(...sizes);
    }
    
    // Column I: Qualities (center-present)
    if (colI < rowValues.length) {
      const quality = trimAll(rowValues[colI]);
      if (quality) qualitiesI.push(quality);
    }
    
    // Column J: Metals (no-center)
    if (colJ < rowValues.length) {
      const metalsCell = rowValues[colJ];
      const metals = splitMetalCodes(metalsCell);
      metalsJ.push(...metals);
    }
    
    // Column K: Qualities (no-center)
    if (colK < rowValues.length && colK !== colI) {
      const quality = trimAll(rowValues[colK]);
      if (quality) qualitiesK.push(quality);
    }
  }

  // Remove duplicates
  const uniqueMetalsG = [...new Set(metalsG)].filter(m => m.length > 0);
  const uniqueCentersH = [...new Set(centersH)].filter(c => c.length > 0);
  const uniqueQualitiesI = [...new Set(qualitiesI)].filter(q => q.length > 0);
  const uniqueMetalsJ = [...new Set(metalsJ)].filter(m => m.length > 0);
  const uniqueQualitiesK = [...new Set(qualitiesK)].filter(q => q.length > 0);

  // Extract lookup tables (assume they start after main data, around row 35+)
  const tableStartRow = Math.min(35, ruleRows.length - 10);
  
  // Weight Index table (Metal code → multiplier)
  const weightIndex = extractLookupTable(
    ruleRows, 
    tableStartRow, 
    headers[0] || 'Metal', // First column for metal codes
    headers[1] || 'Weight' // Second column for weights
  );

  // Metal Price table (Metal code → price per gram)
  const metalPrice = extractLookupTable(
    ruleRows, 
    tableStartRow + 10, 
    headers[0] || 'Metal',
    headers[2] || 'Price'
  );

  // Labor table
  const labor = extractLaborTable(ruleRows, tableStartRow + 20);

  // Margin table
  const margins = extractMarginTable(ruleRows, tableStartRow + 30);

  return {
    metalsG: uniqueMetalsG,
    centersH: uniqueCentersH,
    qualitiesI: uniqueQualitiesI,
    metalsJ: uniqueMetalsJ,
    qualitiesK: uniqueQualitiesK,
    weightIndex,
    metalPrice,
    labor,
    margins
  };
}

/**
 * Extract rule sets from No Stones Rules.csv
 */
export function extractNoStonesRuleSets(ruleRows: Record<string, string>[]): NoStonesRuleSet {
  if (!ruleRows || ruleRows.length === 0) {
    return { metalsA: [] };
  }

  const headers = Object.keys(ruleRows[0]);
  const metalsA: string[] = [];

  // Column A: Metals list (first column)
  for (const row of ruleRows) {
    const metal = trimAll(row[headers[0]] || '');
    if (metal) {
      metalsA.push(metal);
    }
  }

  return {
    metalsA: [...new Set(metalsA)].filter(m => m.length > 0)
  };
}

/**
 * Log extracted rule set statistics
 */
export function logRuleSetStats(ruleSet: RuleSet | NoStonesRuleSet, type: 'Natural' | 'LabGrown' | 'NoStones'): void {
  if ('metalsA' in ruleSet) {
    // No Stones rules
    console.log(`${type} Rules - Metals A: ${ruleSet.metalsA.length}`);
    console.log('Metals A:', ruleSet.metalsA);
  } else {
    // Natural/LabGrown rules
    console.log(`${type} Rules extracted:`);
    console.log(`- Metals G (center-present): ${ruleSet.metalsG.length}`);
    console.log(`- Centers H: ${ruleSet.centersH.length}`);
    console.log(`- Qualities I (center-present): ${ruleSet.qualitiesI.length}`);
    console.log(`- Metals J (no-center): ${ruleSet.metalsJ.length}`);
    console.log(`- Qualities K (no-center): ${ruleSet.qualitiesK.length}`);
    console.log(`- Weight Index table: ${ruleSet.weightIndex.size} entries`);
    console.log(`- Metal Price table: ${ruleSet.metalPrice.size} entries`);
    console.log(`- Labor table: ${ruleSet.labor.size} entries`);
    console.log(`- Margin ranges: ${ruleSet.margins.length} entries`);
    
    // Log some sample data
    console.log('Sample metals G:', ruleSet.metalsG.slice(0, 5));
    console.log('Sample centers H:', ruleSet.centersH.slice(0, 5));
    console.log('Weight Index entries:', Array.from(ruleSet.weightIndex.entries()).slice(0, 3));
  }
}