import { trimAll, toFixed2 } from './csv-parser';
import type { RuleSet, NoStonesRuleSet } from './rulebook-parser';

// Default multipliers by type/category
const DEFAULT_MULTIPLIERS: Record<string, number> = {
  'rings': 2,
  'bracelets': 2,
  'pendants': 2.5,
  'default': 2.5 // Fallback
};

export interface PricingResult {
  cost: number;
  multiplier: number;
  variantPrice: number;
  compareAtPrice: number;
  marginSource: 'margin_table' | 'type_default' | 'fallback';
}

/**
 * Get category/type from input row for default multiplier lookup
 */
function getProductType(inputRow: any): string {
  const category = trimAll(
    inputRow['Category'] ||
    inputRow['Type'] ||
    inputRow['Subcategory'] ||
    inputRow['Product Type'] ||
    ''
  ).toLowerCase();

  const subcategory = trimAll(
    inputRow['Subcategory'] ||
    inputRow['Sub Category'] ||
    ''
  ).toLowerCase();

  // Combine category and subcategory if both exist
  const fullType = subcategory ? `${category}_${subcategory}` : category;
  
  return fullType;
}

/**
 * Find multiplier from margin brackets
 */
function findMultiplierFromMargins(
  cost: number,
  margins: Array<{begin: number, end?: number, m: number}>
): number | null {
  for (const margin of margins) {
    // Check if cost falls within this bracket
    const withinBegin = cost >= margin.begin;
    const withinEnd = margin.end === undefined || cost < margin.end;
    
    if (withinBegin && withinEnd) {
      return margin.m;
    }
  }
  
  return null;
}

/**
 * Get default multiplier based on product type
 */
function getDefaultMultiplier(productType: string): number {
  // Check exact match first
  if (DEFAULT_MULTIPLIERS[productType]) {
    return DEFAULT_MULTIPLIERS[productType];
  }
  
  // Check for partial matches
  for (const [key, multiplier] of Object.entries(DEFAULT_MULTIPLIERS)) {
    if (key !== 'default' && productType.includes(key)) {
      return multiplier;
    }
  }
  
  // Return default fallback
  return DEFAULT_MULTIPLIERS.default;
}

/**
 * Calculate pricing for a variant
 */
export function calculatePricing(
  cost: number,
  inputRow: any,
  ruleSet?: RuleSet | NoStonesRuleSet
): PricingResult {
  let multiplier: number;
  let marginSource: PricingResult['marginSource'];

  // Try to find multiplier from margin table first
  if (ruleSet && 'margins' in ruleSet && ruleSet.margins.length > 0) {
    const tableMultiplier = findMultiplierFromMargins(cost, ruleSet.margins);
    
    if (tableMultiplier !== null) {
      multiplier = tableMultiplier;
      marginSource = 'margin_table';
    } else {
      // No matching bracket, use type default
      const productType = getProductType(inputRow);
      multiplier = getDefaultMultiplier(productType);
      marginSource = 'type_default';
    }
  } else {
    // No margin table available, use type default
    const productType = getProductType(inputRow);
    multiplier = getDefaultMultiplier(productType);
    marginSource = 'fallback';
  }

  // Calculate prices
  const variantPrice = Math.max(0, (cost * multiplier) - 0.01);
  const compareAtPrice = cost * 4;

  return {
    cost,
    multiplier,
    variantPrice,
    compareAtPrice,
    marginSource
  };
}

/**
 * Format pricing result for display
 */
export function formatPricingResult(pricing: PricingResult): {
  variantPrice: string;
  compareAtPrice: string;
  multiplierDisplay: string;
} {
  return {
    variantPrice: toFixed2(pricing.variantPrice),
    compareAtPrice: toFixed2(pricing.compareAtPrice),
    multiplierDisplay: `${pricing.multiplier}× (${pricing.marginSource.replace('_', ' ')})`
  };
}

/**
 * Get margin bracket display for debugging
 */
export function getMarginBracketDisplay(
  margins: Array<{begin: number, end?: number, m: number}>
): string[] {
  return margins.map(margin => {
    const begin = toFixed2(margin.begin);
    const end = margin.end ? toFixed2(margin.end) : '∞';
    return `$${begin} - $${end}: ${margin.m}×`;
  });
}