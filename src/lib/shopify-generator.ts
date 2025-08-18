import { trimAll, toNum, toFixed2, ctStr } from './csv-parser';
import type { VariantSeed } from './variant-expansion';
import type { RuleSet, NoStonesRuleSet } from './rulebook-parser';
import { calculateCostBreakdown, generateSKUWithRunningIndex, type CostBreakdown } from './cost-calculator';

// Translation tables (extendable constants)
export const METAL_TRANSLATIONS: Record<string, string> = {
  '14W': '14KT White Gold',
  '14Y': '14KT Yellow Gold',
  '14R': '14KT Rose Gold',
  '18W': '18KT White Gold',
  '18Y': '18KT Yellow Gold',
  '18R': '18KT Rose Gold',
  'PLT': 'Platinum'
};

export const QUALITY_TRANSLATIONS: Record<string, string> = {
  'FG': 'F-G/VS (Excellent)',
  'GH': 'G-H/VS (Very Good)',
  'HI': 'H-I/SI (Good)',
  'IJ': 'I-J/SI (Fair)',
  'VS1': 'VS1 (Very Good)',
  'VS2': 'VS2 (Good)',
  'SI1': 'SI1 (Fair)',
  'SI2': 'SI2 (Fair)'
};

export interface ShopifyRow {
  Handle: string;
  Title: string;
  'Body (HTML)': string;
  Vendor: string;
  'Product Category': string;
  Type: string;
  Tags: string;
  Published: string;
  'Option1 Name': string;
  'Option1 Value': string;
  'Option2 Name': string;
  'Option2 Value': string;
  'Option3 Name': string;
  'Option3 Value': string;
  'Variant SKU': string;
  'Variant Grams': string;
  'Variant Inventory Tracker': string;
  'Variant Inventory Qty': string;
  'Variant Inventory Policy': string;
  'Variant Fulfillment Service': string;
  'Variant Price': string;
  'Variant Compare At Price': string;
  'Variant Requires Shipping': string;
  'Variant Taxable': string;
  'Variant Barcode': string;
  'Image Src': string;
  'Image Position': string;
  'Image Alt Text': string;
  'Gift Card': string;
  'SEO Title': string;
  'SEO Description': string;
  'Google Shopping / Google Product Category': string;
  'Google Shopping / Gender': string;
  'Google Shopping / Age Group': string;
  'Google Shopping / MPN': string;
  'Google Shopping / AdWords Grouping': string;
  'Google Shopping / AdWords Labels': string;
  'Google Shopping / Condition': string;
  'Google Shopping / Custom Product': string;
  'Google Shopping / Custom Label 0': string;
  'Google Shopping / Custom Label 1': string;
  'Google Shopping / Custom Label 2': string;
  'Google Shopping / Custom Label 3': string;
  'Google Shopping / Custom Label 4': string;
  'Variant Image': string;
  'Variant Weight Unit': string;
  'Variant Tax Code': string;
  'Cost per item': string;
  'Price / International': string;
  'Compare At Price / International': string;
  Status: string;
}

export interface ShopifyRowWithCosts extends ShopifyRow {
  costBreakdown: CostBreakdown;
}

/**
 * Translate metal code to full metal name
 */
function translateMetal(metalCode: string): string {
  return METAL_TRANSLATIONS[metalCode] || metalCode;
}

/**
 * Translate quality code to full quality label
 */
function translateQuality(qualityCode: string): string {
  return QUALITY_TRANSLATIONS[qualityCode] || qualityCode;
}

/**
 * Calculate total carat string based on scenario
 */
function calculateTotalCarat(variant: VariantSeed): string {
  if (variant.scenario === 'Unique+Center' && variant.centerSize) {
    // Get side carat from input row
    const sideCt = toNum(
      variant.inputRowRef['Side ct'] ||
      variant.inputRowRef['Side Ct'] ||
      variant.inputRowRef['SideCt'] ||
      variant.inputRowRef['Side Carat'] ||
      '0'
    );
    
    const centerCt = toNum(variant.centerSize);
    const total = sideCt + centerCt;
    
    return ctStr(total, centerCt);
  } else {
    // Use input "Total Ct Weight"
    const totalCt = toNum(
      variant.inputRowRef['Total Ct Weight'] ||
      variant.inputRowRef['Total ct'] ||
      variant.inputRowRef['TotalCt'] ||
      variant.inputRowRef['Total Carat'] ||
      '0'
    );
    
    return ctStr(totalCt);
  }
}

/**
 * Create base product info from input row
 */
function createProductInfo(inputRow: any) {
  const title = trimAll(
    inputRow['Title'] ||
    inputRow['Product Name'] ||
    inputRow['Name'] ||
    `Product ${inputRow.coreNumber}`
  );

  const vendor = trimAll(
    inputRow['Vendor'] ||
    inputRow['Brand'] ||
    'Base44'
  );

  const type = trimAll(
    inputRow['Type'] ||
    inputRow['Product Type'] ||
    inputRow['Category'] ||
    'Jewelry'
  );

  const tags = trimAll(
    inputRow['Tags'] ||
    inputRow['Keywords'] ||
    ''
  );

  return { title, vendor, type, tags };
}

/**
 * Generate SKU for variant
 */
function generateSKU(variant: VariantSeed, index: number): string {
  const base = variant.core.replace(/[^A-Za-z0-9]/g, '');
  const metal = variant.metalCode;
  const suffix = String(index + 1).padStart(3, '0');
  return `${base}-${metal}-${suffix}`;
}

/**
 * Generate Shopify rows from variant seeds with cost calculations
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
    // Sort variants for consistent ordering
    const sortedVariants = handleVariants.sort((a, b) => {
      if (a.metalCode !== b.metalCode) return a.metalCode.localeCompare(b.metalCode);
      if (a.centerSize && b.centerSize && a.centerSize !== b.centerSize) {
        return toNum(a.centerSize) - toNum(b.centerSize);
      }
      if (a.qualityCode && b.qualityCode) return a.qualityCode.localeCompare(b.qualityCode);
      return 0;
    });

    const firstVariant = sortedVariants[0];
    const productInfo = createProductInfo(firstVariant.inputRowRef);
    const isNoStones = firstVariant.scenario === 'NoStones';
    
    // Get appropriate rule set
    let ruleSet: RuleSet | NoStonesRuleSet | undefined;
    if (firstVariant.inputRowRef.diamondsType?.toLowerCase().includes('natural')) ruleSet = naturalRules;
    else if (firstVariant.inputRowRef.diamondsType?.toLowerCase().includes('labgrown')) ruleSet = labGrownRules;
    else if (firstVariant.inputRowRef.diamondsType?.toLowerCase().includes('no stones')) ruleSet = noStonesRules;

    sortedVariants.forEach((variant, index) => {
      const isParent = index === 0;
      const sku = generateSKUWithRunningIndex(variant.core, sortedVariants, index);
      
      // Calculate cost breakdown
      const costBreakdown = ruleSet 
        ? calculateCostBreakdown(variant, ruleSet, sku)
        : {
            diamondCost: 0, metalCost: 0, sideStoneCost: 0, centerStoneCost: 0,
            polishCost: 25, braceletsCost: 0, cadCreationCost: 20, constantCost: 25,
            totalCost: 70, variantGrams: 5, sku,
            pricing: { cost: 70, multiplier: 2.5, variantPrice: 174.99, compareAtPrice: 280, marginSource: 'fallback' as const },
            details: {
              baseGrams: 5, weightMultiplier: 1, metalPricePerGram: 2.5,
              diamondCarats: 0, diamondPricePerCarat: 0, sideStoneCount: 0,
              hasCenter: false, isBracelet: false
            }
          };

      const row: ShopifyRowWithCosts = {
        Handle: handle,
        
        // Parent-only fields (blank for children)
        Title: isParent ? productInfo.title : '',
        'Body (HTML)': isParent ? `<p>${productInfo.title} - Premium jewelry from Base44</p>` : '',
        Vendor: isParent ? productInfo.vendor : '',
        'Product Category': isParent ? 'Jewelry' : '',
        Type: isParent ? productInfo.type : '',
        Tags: isParent ? productInfo.tags : '',
        Published: isParent ? 'TRUE' : '',
        'Image Src': isParent ? '' : '',
        'Image Position': isParent ? '1' : '',
        'Image Alt Text': isParent ? `${productInfo.title} jewelry` : '',
        
        // Option Names (parent-only, blank for No Stones)
        'Option1 Name': isParent && !isNoStones ? 'Metal/Color' : '',
        'Option2 Name': isParent && !isNoStones ? 'Total Carat' : '',
        'Option3 Name': isParent && !isNoStones ? 'Diamond Quality' : '',
        
        // Option Values (all variants, blank for No Stones except metal)
        'Option1 Value': isNoStones ? '' : translateMetal(variant.metalCode),
        'Option2 Value': isNoStones ? '' : calculateTotalCarat(variant),
        'Option3 Value': isNoStones || !variant.qualityCode ? '' : translateQuality(variant.qualityCode),
        
        // Variant-specific fields with calculated costs
        'Variant SKU': sku,
        'Variant Grams': toFixed2(costBreakdown.variantGrams),
        'Variant Inventory Tracker': 'shopify',
        'Variant Inventory Qty': '10',
        'Variant Inventory Policy': 'deny',
        'Variant Fulfillment Service': 'manual',
        'Variant Price': toFixed2(costBreakdown.pricing.variantPrice),
        'Variant Compare At Price': toFixed2(costBreakdown.pricing.compareAtPrice),
        'Variant Requires Shipping': 'TRUE',
        'Variant Taxable': 'TRUE',
        'Variant Barcode': '',
        'Variant Image': '',
        'Variant Weight Unit': 'g',
        'Variant Tax Code': '',
        'Cost per item': toFixed2(costBreakdown.totalCost),
        'Price / International': '',
        'Compare At Price / International': '',
        Status: 'active',
        
        // SEO fields (parent-only)
        'SEO Title': isParent ? `${productInfo.title} - ${productInfo.vendor}` : '',
        'SEO Description': isParent ? `Premium ${productInfo.title} from ${productInfo.vendor}. High-quality jewelry crafted with precision.` : '',
        
        // Google Shopping fields
        'Google Shopping / Google Product Category': isParent ? 'Apparel & Accessories > Jewelry' : '',
        'Google Shopping / Gender': '',
        'Google Shopping / Age Group': '',
        'Google Shopping / MPN': '',
        'Google Shopping / AdWords Grouping': '',
        'Google Shopping / AdWords Labels': '',
        'Google Shopping / Condition': isParent ? 'new' : '',
        'Google Shopping / Custom Product': '',
        'Google Shopping / Custom Label 0': '',
        'Google Shopping / Custom Label 1': '',
        'Google Shopping / Custom Label 2': '',
        'Google Shopping / Custom Label 3': '',
        'Google Shopping / Custom Label 4': '',
        
        'Gift Card': 'FALSE',
        
        // Cost breakdown for analysis
        costBreakdown
      };

      allRows.push(row);
    });
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
 * Convert Shopify rows to CSV string
 */
export function shopifyRowsToCSV(rows: ShopifyRow[]): string {
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const csvRows = [headers.join(',')];

  for (const row of rows) {
    const values = headers.map(header => {
      const value = row[header as keyof ShopifyRow];
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      const escaped = String(value).replace(/"/g, '""');
      return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
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
  const errors: string[] = [];
  const handles = new Set<string>();
  let parentRows = 0;
  let childRows = 0;

  const handleParentSeen = new Set<string>();

  for (const row of rows) {
    handles.add(row.Handle);

    // Check if this is a parent row (has Title)
    if (row.Title) {
      parentRows++;
      if (handleParentSeen.has(row.Handle)) {
        errors.push(`Multiple parent rows found for handle: ${row.Handle}`);
      }
      handleParentSeen.add(row.Handle);
    } else {
      childRows++;
      if (!handleParentSeen.has(row.Handle)) {
        errors.push(`Child row without parent for handle: ${row.Handle}`);
      }
    }

    // Validate required fields
    if (!row.Handle) {
      errors.push('Missing Handle in row');
    }
    if (!row['Variant SKU']) {
      errors.push(`Missing Variant SKU for handle: ${row.Handle}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    stats: {
      totalRows: rows.length,
      totalHandles: handles.size,
      parentRows,
      childRows
    }
  };
}