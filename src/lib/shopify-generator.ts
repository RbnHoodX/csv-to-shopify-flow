import type { VariantSeed } from './variant-expansion';
import type { RuleSet, NoStonesRuleSet } from './rulebook-parser';
import type { CostBreakdown } from './cost-calculator';
import type { ShopifyRow } from '@/types/core';
import { 
  buildParentChildRows,
  serializeShopifyRows,
  validateShopifyRows as validateRows,
  METAL_TRANSLATIONS,
  QUALITY_TRANSLATIONS
} from '@/utils';

// Re-export translation tables for backward compatibility
export { METAL_TRANSLATIONS, QUALITY_TRANSLATIONS };

// Re-export ShopifyRow type for backward compatibility
export type { ShopifyRow } from '@/types/core';

export interface ShopifyRowWithCosts extends ShopifyRow {
  costBreakdown: CostBreakdown;
}

/**
 * Generate Shopify rows from variant seeds with cost calculations using new utils
 */
export function generateShopifyRowsWithCosts(
  variants: VariantSeed[],
  naturalRules?: RuleSet,
  labGrownRules?: RuleSet,
  noStonesRules?: NoStonesRuleSet
): ShopifyRowWithCosts[] {
  if (variants.length === 0) return [];

  // Group variants by handle
  const variantsByHandle = variants.reduce((acc, variant) => {
    if (!acc[variant.handle]) {
      acc[variant.handle] = [];
    }
    acc[variant.handle].push(variant);
    return acc;
  }, {} as Record<string, VariantSeed[]>);

  const allRows: ShopifyRowWithCosts[] = [];

  for (const [handle, handleVariants] of Object.entries(variantsByHandle)) {
    // Build parent-child rows using the new utility
    const shopifyRows = buildParentChildRows(handleVariants, naturalRules, labGrownRules, noStonesRules);
    
    // Convert to ShopifyRowWithCosts by adding mock cost breakdowns
    // In a real implementation, the buildParentChildRows would return cost data
    const rowsWithCosts = shopifyRows.map(row => ({
      ...row,
      costBreakdown: {
        diamondCost: parseFloat(row['Diamond Cost'] || '0'),
        metalCost: parseFloat(row['Metal Cost'] || '0'),
        sideStoneCost: parseFloat(row['Side Stone'] || '0'),
        centerStoneCost: parseFloat(row['Center Stone'] || '0'),
        polishCost: parseFloat(row.Polish || '0'),
        braceletsCost: parseFloat(row.Bracelets || '0'),
        cadCreationCost: parseFloat(row['CAD Creation'] || '0'),
        constantCost: parseFloat(row['25$'] || '0'),
        totalCost: parseFloat(row['Cost per item'] || '0'),
        variantGrams: parseFloat(row['Variant Grams'] || '0'),
        sku: row['Variant SKU'],
        pricing: {
          cost: parseFloat(row['Cost per item'] || '0'),
          multiplier: 2.5,
          variantPrice: parseFloat(row['Variant Price'] || '0'),
          compareAtPrice: parseFloat(row['Variant Compare At Price'] || '0'),
          marginSource: 'fallback' as const
        },
        details: {
          baseGrams: parseFloat(row['Variant Grams'] || '0'),
          weightMultiplier: 1,
          metalPricePerGram: 2.5,
          diamondCarats: 0,
          diamondPricePerCarat: 0,
          sideStoneCount: 0,
          hasCenter: false,
          isBracelet: false
        }
      }
    }));

    allRows.push(...rowsWithCosts);
  }

  return allRows;
}

/**
 * Generate Shopify rows from variant seeds (backwards compatibility)
 */
export function generateShopifyRows(variants: VariantSeed[]): ShopifyRow[] {
  return generateShopifyRowsWithCosts(variants).map(({ costBreakdown, ...row }) => row);
}

/**
 * Convert Shopify rows to CSV string with exact header order per spec
 */
export function shopifyRowsToCSV(rows: ShopifyRow[]): string {
  return serializeShopifyRows(rows);
}

/**
 * Validate Shopify rows structure
 */
export function validateShopifyRows(rows: ShopifyRow[]): {
  isValid: boolean;
  errors: string[];
  stats: {
    totalRows: number;
    totalHandles: number;
    parentRows: number;
    childRows: number;
  };
} {
  return validateRows(rows);
}