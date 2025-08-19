import { trimAll } from './csv-parser';

/**
 * Weight lookup data structure
 * Maps core number -> metal code -> weight in grams
 */
export type WeightLookupTable = Map<string, Map<string, number>>;

/**
 * Create weight lookup table from CSV data
 * Expected CSV format:
 * Core Number, 14KT, 18KT, PLT, ... (metal columns)
 */
export function parseWeightLookupCSV(csvData: string[][]): WeightLookupTable {
  const weightTable: WeightLookupTable = new Map();
  
  if (csvData.length < 2) {
    console.warn('Weight lookup CSV has insufficient data');
    return weightTable;
  }

  const headers = csvData[0].map(h => trimAll(h));
  const coreNumberIndex = headers.findIndex(h => 
    h.toLowerCase().includes('core') || 
    h.toLowerCase().includes('number')
  );

  if (coreNumberIndex === -1) {
    console.error('Weight lookup CSV missing core number column');
    return weightTable;
  }

  // Find metal columns (skip core number column)
  const metalColumns: { index: number; metalCode: string }[] = [];
  headers.forEach((header, index) => {
    if (index === coreNumberIndex) return;
    
    const cleanHeader = trimAll(header).toUpperCase();
    if (cleanHeader && cleanHeader !== 'CORE NUMBER') {
      metalColumns.push({ index, metalCode: cleanHeader });
    }
  });

  console.log(`📊 Weight lookup: Found ${metalColumns.length} metal columns:`, metalColumns.map(m => m.metalCode));

  // Process data rows
  for (let i = 1; i < csvData.length; i++) {
    const row = csvData[i];
    const coreNumber = trimAll(row[coreNumberIndex] || '');
    
    if (!coreNumber) continue;

    const metalWeights = new Map<string, number>();
    
    for (const { index, metalCode } of metalColumns) {
      const weightStr = trimAll(row[index] || '');
      const weight = parseFloat(weightStr);
      
      if (!isNaN(weight) && weight > 0) {
        metalWeights.set(metalCode, weight);
      }
    }

    if (metalWeights.size > 0) {
      weightTable.set(coreNumber, metalWeights);
      console.log(`  ✅ ${coreNumber}: ${metalWeights.size} metal weights`);
    }
  }

  console.log(`📊 Weight lookup table loaded: ${weightTable.size} core numbers`);
  return weightTable;
}

/**
 * Get weight for a specific core number and metal code
 */
export function getVariantWeight(
  weightTable: WeightLookupTable,
  coreNumber: string,
  metalCode: string,
  fallbackWeight: number = 5
): { weight: number; isLookup: boolean } {
  const coreWeights = weightTable.get(coreNumber);
  
  if (!coreWeights) {
    console.warn(`Weight lookup: Core ${coreNumber} not found, using fallback weight ${fallbackWeight}g`);
    return { weight: fallbackWeight, isLookup: false };
  }

  // Try exact match first
  let weight = coreWeights.get(metalCode);
  if (weight !== undefined) {
    return { weight, isLookup: true };
  }

  // Try normalized metal code mapping
  const normalizedMetal = normalizeMetal(metalCode);
  for (const [lookupMetal, lookupWeight] of coreWeights.entries()) {
    if (normalizeMetal(lookupMetal) === normalizedMetal) {
      return { weight: lookupWeight, isLookup: true };
    }
  }

  console.warn(`Weight lookup: Metal ${metalCode} not found for core ${coreNumber}, using fallback weight ${fallbackWeight}g`);
  return { weight: fallbackWeight, isLookup: false };
}

/**
 * Normalize metal codes for comparison
 */
function normalizeMetal(metalCode: string): string {
  const normalized = trimAll(metalCode).toUpperCase();
  
  // Handle common variations
  const metalMappings: Record<string, string> = {
    '14W': '14KT',
    '14Y': '14KT', 
    '14R': '14KT',
    '18W': '18KT',
    '18Y': '18KT',
    '18R': '18KT',
    'PLT': 'PLATINUM',
    'PLAT': 'PLATINUM'
  };

  return metalMappings[normalized] || normalized;
}

/**
 * Default weight lookup data (can be used as fallback)
 * This would typically be loaded from an external CSV file
 */
export function getDefaultWeightLookup(): WeightLookupTable {
  const defaultTable: WeightLookupTable = new Map();
  
  // Example data structure - in production this would come from CSV
  const sampleData = [
    ['15686LB', 6.5, 8.0, 11.5], // [coreNumber, 14KT, 18KT, PLT]
    // Add more entries as needed
  ];

  // This is just example structure - real implementation would load from CSV
  console.log('Using default weight lookup (limited data)');
  
  return defaultTable;
}