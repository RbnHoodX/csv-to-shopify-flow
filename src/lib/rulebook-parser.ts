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
  
  // Use exact column indices for G, H, I, J, K (0-based indexing)
  const colG = 6; // Column G (index 6) - "If Center and Diamonds Natural"
  const colH = 7; // Column H (index 7) - Center sizes
  const colI = 8; // Column I (index 8) - Qualities for center case
  const colJ = 9; // Column J (index 9) - "If No Center and Yes Stones"
  const colK = 10; // Column K (index 10) - Qualities for no-center case

  // Extract arrays from columns - read ALL rows in the file to capture complete rule blocks
  const metalsG: string[] = [];
  const centersH: string[] = [];
  const qualitiesI: string[] = [];
  const metalsJ: string[] = [];
  const qualitiesK: string[] = [];

  // Process ALL rows to capture complete rule blocks (not just first 30)
  for (let i = 0; i < ruleRows.length; i++) {
    const row = ruleRows[i];
    const rowValues = Object.values(row);
    
    // Stop processing if we hit lookup tables (look for clear table headers)
    const firstCell = trimAll(rowValues[0] || '');
    if (firstCell.toLowerCase().includes('metal') && 
        (trimAll(rowValues[1] || '').toLowerCase().includes('weight') || 
         trimAll(rowValues[1] || '').toLowerCase().includes('price'))) {
      break; // We've hit the lookup tables section
    }
    
    // Column G: Metals (center-present) - read entire block
    if (colG < rowValues.length) {
      const metalsCell = trimAll(rowValues[colG]);
      if (metalsCell) {
        const metals = splitMetalCodes(metalsCell);
        metalsG.push(...metals);
      }
    }
    
    // Column H: Center Sizes - read entire block  
    if (colH < rowValues.length) {
      const sizesCell = trimAll(rowValues[colH]);
      if (sizesCell) {
        const sizes = splitCenterSizes(sizesCell);
        centersH.push(...sizes);
      }
    }
    
    // Column I: Qualities (center-present) - read entire block
    if (colI < rowValues.length) {
      const quality = trimAll(rowValues[colI]);
      if (quality) qualitiesI.push(quality);
    }
    
    // Column J: Metals (no-center) - read entire block
    if (colJ < rowValues.length) {
      const metalsCell = trimAll(rowValues[colJ]);
      if (metalsCell) {
        const metals = splitMetalCodes(metalsCell);
        metalsJ.push(...metals);
      }
    }
    
    // Column K: Qualities (no-center) - read entire block
    if (colK < rowValues.length) {
      const quality = trimAll(rowValues[colK]);
      if (quality) qualitiesK.push(quality);
    }
  }

  // Preserve order from CSV but remove duplicates while maintaining first occurrence order
  const uniqueMetalsG = [...new Set(metalsG)].filter(m => m.length > 0);
  const uniqueCentersH = [...new Set(centersH)].filter(c => c.length > 0);
  const uniqueQualitiesI = [...new Set(qualitiesI)].filter(q => q.length > 0);
  const uniqueMetalsJ = [...new Set(metalsJ)].filter(m => m.length > 0);
  const uniqueQualitiesK = [...new Set(qualitiesK)].filter(q => q.length > 0);

  console.log(`🔍 All headers found:`, headers);
  console.log(`🔍 Total rows in file: ${ruleRows.length}`);

  // Find where lookup tables start by looking for Weight Index header specifically
  let tableStartRow = 0;
  for (let i = 0; i < ruleRows.length; i++) {
    const row = ruleRows[i];
    const rowValues = Object.values(row);
    
    // Look for "Weight Index" header specifically
    const hasWeightIndex = rowValues.some(cell => 
      trimAll(cell || '').toLowerCase().includes('weight index')
    );
    
    if (hasWeightIndex) {
      tableStartRow = i + 1; // Start from the row after the header
      console.log(`📊 Found Weight Index table starting at row ${tableStartRow}`);
      console.log(`📊 Weight Index header row:`, rowValues);
      break;
    }
    
    // Fallback: look for typical lookup table headers
    const firstCell = trimAll(rowValues[0] || '');
    if (firstCell.toLowerCase().includes('metal') && 
        (trimAll(rowValues[1] || '').toLowerCase().includes('weight') || 
         trimAll(rowValues[1] || '').toLowerCase().includes('price'))) {
      tableStartRow = i;
      console.log(`📊 Found fallback table starting at row ${tableStartRow}`);
      break;
    }
  }

  console.log(`📊 Final tableStartRow: ${tableStartRow}`);

  // Extract lookup tables dynamically
  const weightIndex = new Map<string, number>();
  const metalPrice = new Map<string, number>();
  const labor = new Map<string, number>();
  const margins: Array<{begin: number, end?: number, m: number}> = [];

  // Try to extract lookup tables if we found a starting point
  if (tableStartRow > 0) {
    // Find Weight Index column by searching for "Weight Index" header
    const weightIndexColIndex = findColumnIndex(headers, 'Weight Index');
    console.log(`🔍 Searching for 'Weight Index' in headers, found at index: ${weightIndexColIndex}`);
    
    let weightTable = new Map<string, number>();
    
    if (weightIndexColIndex >= 0) {
      console.log(`📊 Found Weight Index column at index ${weightIndexColIndex} (${headers[weightIndexColIndex]})`);
      console.log(`📊 Will use next column at index ${weightIndexColIndex + 1} for multipliers`);
      
      // Extract weight index data: metal codes from Weight Index column, multipliers from next column
      for (let i = tableStartRow; i < ruleRows.length; i++) {
        const row = ruleRows[i];
        const rowValues = Object.values(row);
        
        console.log(`📊 Row ${i} values:`, rowValues.slice(weightIndexColIndex, weightIndexColIndex + 2));
        
        // Get metal code from Weight Index column
        const metalCode = trimAll(rowValues[weightIndexColIndex] || '');
        // Get multiplier from next column
        const multiplier = toNum(rowValues[weightIndexColIndex + 1] || '');
        
        console.log(`📊 Processing: metal='${metalCode}', multiplier=${multiplier}`);
        
        if (metalCode && !isNaN(multiplier)) {
          weightTable.set(metalCode, multiplier);
          console.log(`📊 Weight Index: ${metalCode} → ${multiplier}`);
        } else if (!metalCode && isNaN(multiplier)) {
          // Empty row, might indicate end of table
          console.log(`📊 Hit empty row, stopping extraction at row ${i}`);
          break;
        }
      }
      
      console.log(`📊 Extracted ${weightTable.size} weight index entries`);
    } else {
      console.warn('Weight Index column not found');
      console.log(`🔍 Available headers for debugging:`, headers.map((h, i) => `${i}: "${h}"`));
    }
    
    // Metal Price table (look for next table)
    let priceTableStart = tableStartRow + 10;
    for (let i = tableStartRow + 5; i < ruleRows.length; i++) {
      const row = ruleRows[i];
      const firstCell = trimAll(row[headers[0]] || '');
      const secondCell = trimAll(row[headers[2] || headers[1]] || '');
      if (firstCell && secondCell && !isNaN(toNum(secondCell))) {
        priceTableStart = i;
        break;
      }
    }
    
    const priceTable = extractLookupTable(
      ruleRows, 
      priceTableStart, 
      headers[0] || 'Metal',
      headers[2] || 'Price'
    );

    // Copy extracted tables
    weightTable.forEach((value, key) => weightIndex.set(key, value));
    priceTable.forEach((value, key) => metalPrice.set(key, value));

    // Labor and margins tables (approximate positions)
    const laborTable = extractLaborTable(ruleRows, tableStartRow + 20);
    const marginTable = extractMarginTable(ruleRows, tableStartRow + 30);
    
    laborTable.forEach((value, key) => labor.set(key, value));
    margins.push(...marginTable);
  }

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