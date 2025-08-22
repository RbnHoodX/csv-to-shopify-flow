import { trimAll, toNum, toFixed2, ctStr, calculateSumSideCt, toCt2 } from './csv-parser';
import type { VariantSeed } from './variant-expansion';
import type { RuleSet, NoStonesRuleSet } from './rulebook-parser';
import { calculateCostBreakdown, generateSKUWithRunningIndex, type CostBreakdown } from './cost-calculator';
import type { WeightLookupTable } from './weight-lookup';
import { generateSEOData } from './seo-generator';
import { 
  buildTitle, 
  buildBody, 
  buildSeo, 
  buildSeoTitleParent,
  buildSeoTitleVariant,
  buildSeoDescriptionParent,
  buildSeoDescriptionVariant,
  buildImageAltVariant,
  buildImageAltParent,
  hasCenter,
  type Product 
} from './template-builders';

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
  'Product Type': string;
  'Core Number': string;
  Category: string;
  'Center Stone Diamond': string;
  'Side Stones Diamond': string;
  'Metal Cost': string;
  'Center Stone Labor': string;
  'Side Stones Labor': string;
  Polish: string;
  Bracelets: string;
  Pendants: string;
  'CAD Creation': string;
  Additional: string;
  'Title (duplicate)': string;
  'Description (duplicate)': string;
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
 * Calculate total carat weight for a variant (for internal calculations)
 */
function calculateTotalCaratWeight(variant: VariantSeed): number {
  if (variant.scenario === 'Unique+Center' && variant.centerSize) {
    const sumSideCt = calculateSumSideCt(variant.inputRowRef);
    const centerCt = toNum(variant.centerSize);
    return sumSideCt + centerCt;
  } else {
    return toNum(
      variant.inputRowRef['Total Ct Weight'] ||
      variant.inputRowRef['Total ct'] ||
      variant.inputRowRef['TotalCt'] ||
      variant.inputRowRef['Total Carat'] ||
      '0'
    );
  }
}

/**
 * Calculate total carat string for Option2 Value based on scenario
 */
function calculateTotalCarat(variant: VariantSeed): string {
  if (variant.scenario === 'Unique+Center' && variant.centerSize) {
    // Fix: sum all side columns + center size from rule
    const sumSideCt = calculateSumSideCt(variant.inputRowRef);
    const centerCt = toNum(variant.centerSize);
    const totalVariantCt = sumSideCt + centerCt;
    return `${toCt2(totalVariantCt)}CT Total (${toCt2(centerCt)}CT Center)`;
  } else {
    // For no-center scenarios: use TotalCtWeight from row
    const totalCt = toNum(
      variant.inputRowRef['Total Ct Weight'] ||
      variant.inputRowRef['Total ct'] ||
      variant.inputRowRef['TotalCt'] ||
      variant.inputRowRef['Total Carat'] ||
      '0'
    );
    return `${toCt2(totalCt)}CT Total`;
  }
}

/**
 * Collect unique shapes from variants and format for title
 */
function collectShapes(variants: VariantSeed[]): string[] {
  const shapes = new Set<string>();
  
  for (const variant of variants) {
    // Add center shape if present (check multiple column name variations)
    const centerShape = trimAll(
      variant.inputRowRef['Center shape'] ||
      variant.inputRowRef['Center Shape'] ||
      variant.inputRowRef['CenterShape'] ||
      variant.inputRowRef['Shape'] ||
      ''
    );
    if (centerShape) {
      // Convert to title case
      shapes.add(centerShape.charAt(0).toUpperCase() + centerShape.slice(1).toLowerCase());
    }
    
    // Add side shapes (may be comma-separated, check multiple column name variations)
    const sideShapes = trimAll(
      variant.inputRowRef['Side shapes'] || 
      variant.inputRowRef['Side shape'] || 
      variant.inputRowRef['Side Shapes'] || 
      variant.inputRowRef['Side Shape'] || 
      variant.inputRowRef['SideShapes'] || 
      variant.inputRowRef['SideShape'] || 
      ''
    );
    if (sideShapes) {
      const shapeList = sideShapes.split(',').map((s: string) => trimAll(s)).filter((s: string) => s);
      shapeList.forEach((shape: string) => {
        if (shape) {
          // Convert to title case
          shapes.add(shape.charAt(0).toUpperCase() + shape.slice(1).toLowerCase());
        }
      });
    }
  }
  
  return Array.from(shapes).sort();
}

/**
 * Generate TCW bucket tags from min and max total carat weights
 */
function generateTCWBucketTags(minTCW: number, maxTCW: number): string[] {
  const tags: string[] = [];
  const startBucket = Math.floor(minTCW);
  const endBucket = Math.ceil(maxTCW);
  
  for (let bucket = startBucket; bucket < endBucket; bucket++) {
    const nextBucket = bucket + 1;
    tags.push(`tcw_${bucket.toFixed(2)} CT - ${nextBucket.toFixed(2)} CT`);
  }
  
  return tags;
}



/**
 * Create enhanced product info from variants per handle using new template builders
 */
function createProductInfo(variants: VariantSeed[]) {
  const firstVariant = variants[0];
  const inputRow = firstVariant.inputRowRef;
  
  // Determine diamond type
  const diamondType = inputRow.diamondsType || 'diamonds';
  let productDiamondType: 'Natural' | 'LabGrown' | 'NoStones';
  
  if (firstVariant.scenario === 'NoStones') {
    productDiamondType = 'NoStones';
  } else if (diamondType.toLowerCase().includes('natural')) {
    productDiamondType = 'Natural';
  } else if (diamondType.toLowerCase().includes('labgrown') || diamondType.toLowerCase().includes('lab-grown')) {
    productDiamondType = 'LabGrown';
  } else {
    // Default to Natural if unclear
    productDiamondType = 'Natural';
  }
  
  // Determine if repeating (multiple input rows with same core)
  const isRepeating = firstVariant.scenario === 'Repeating';
  
  // Create product object for template builders
  const product: Product = {
    variants,
    diamondType: productDiamondType,
    hasCenter: hasCenter(variants),
    isRepeating
  };
  
  // Use new template builders
  const title = buildTitle(product);
  const bodyHTML = buildBody(product);
  const seoData = buildSeo(product);
  
  // Get category and subcategory for other fields
  const category = trimAll(inputRow['Category'] || 'Jewelry');
  const subcategory = trimAll(inputRow['Subcategory'] || inputRow['Type'] || 'Piece');
  
  // Vendor is always "Primestyle.com"
  const vendor = 'Primestyle.com';
  
  // Type format: "{Category}_{Subcategory}"
  const type = `${category}_${subcategory}`;
  
  // Build comprehensive tags (keeping existing tag logic for now)
  const tagParts: string[] = [];
  
  // Add category_subcategory as first tag
  tagParts.push(`${category}_${subcategory}`);
  
  // Add item type as second tag with exact capitalization from input
  const diamondsType = inputRow.diamondsType || '';
  if (diamondsType) {
    tagParts.push(diamondsType);
  }
  
  // Add unique shape tags in consistent order (before TCW tags)
  const shapes = collectShapes(variants);
  const uniqueShapes = [...new Set(shapes)].sort(); // Remove duplicates and sort
  uniqueShapes.forEach(shape => {
    tagParts.push(`shape_${shape.toLowerCase()}`);
  });
  
  // Always add shape_round if it's not already there
  if (!uniqueShapes.some(shape => shape.toLowerCase() === 'round')) {
    tagParts.push('shape_round');
  }
  
  // Add TCW bucket tags (only for stones scenarios)
  if (firstVariant.scenario !== 'NoStones') {
    const caratWeights = variants.map(calculateTotalCaratWeight);
    const minTCW = Math.min(...caratWeights);
    const maxTCW = Math.max(...caratWeights);
    const tcwBucketTags = generateTCWBucketTags(minTCW, maxTCW);
    tagParts.push(...tcwBucketTags);
  }
  
  // Add input tags if present (but filter out shape tags to avoid duplication)
  const inputTags = trimAll(inputRow['Tags'] || inputRow['Keywords'] || '');
  if (inputTags) {
    const inputTagArray = inputTags.split(',').map(tag => tag.trim());
    const filteredInputTags = inputTagArray.filter(tag => !tag.toLowerCase().startsWith('shape_'));
    if (filteredInputTags.length > 0) {
      tagParts.push(...filteredInputTags);
    }
  }
  
  const tags = tagParts.join(', ');
  
  // Generate Google Product Category based on type
  let googleCategory = 'Apparel & Accessories > Jewelry';
  if (category.toLowerCase().includes('ring')) {
    googleCategory = 'Apparel & Accessories > Jewelry > Rings';
  } else if (category.toLowerCase().includes('bracelet')) {
    googleCategory = 'Apparel & Accessories > Jewelry > Bracelets';
  } else if (category.toLowerCase().includes('pendant') || category.toLowerCase().includes('necklace')) {
    googleCategory = 'Apparel & Accessories > Jewelry > Necklaces';
  } else if (category.toLowerCase().includes('earring')) {
    googleCategory = 'Apparel & Accessories > Jewelry > Earrings';
  }
  
  return { 
    title, 
    vendor, 
    type, 
    tags, 
    bodyHTML, 
    googleCategory,
    diamondType: inputRow.diamondsType || 'diamonds',
    qualities: [...new Set(variants.map(v => v.qualityCode).filter(Boolean))],
    metals: [...new Set(variants.map(v => translateMetal(v.metalCode)))],
    seoTitle: seoData.title,
    seoDescription: seoData.description
  };
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
 * Extract numeric suffix from SKU for sorting
 */
function extractSKUSuffix(sku: string): number {
  const match = sku.match(/-(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Generate Shopify rows from variant seeds with cost calculations
 */
export function generateShopifyRowsWithCosts(
  variants: VariantSeed[],
  naturalRules?: RuleSet,
  labGrownRules?: RuleSet,
  noStonesRules?: NoStonesRuleSet,
  weightTable?: WeightLookupTable
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
    // Keep variants in rulebook order - DO NOT SORT here
    // The expansion already provides them in the correct rule order
    const sortedVariants = handleVariants;

    const firstVariant = sortedVariants[0];
    const productInfo = createProductInfo(sortedVariants);
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
      console.log(`🔍 Weight table status for ${variant.core}:`, {
        hasWeightTable: !!weightTable,
        weightTableSize: weightTable?.size || 0,
        metalCode: variant.metalCode,
        scenario: variant.scenario
      });
      
      const costBreakdown = ruleSet 
        ? calculateCostBreakdown(variant, ruleSet, sku)
        : {
            centerStoneDiamond: 0, sideStoneDiamond: 0, metalCost: 0, 
            centerStoneLabor: 0, sideStoneLabor: 0, polishCost: 25, 
            braceletsCost: 0, pendantsCost: 0, cadCreationCost: 20, additionalCost: 25,
            totalCost: 70, variantGrams: 5, sku, published: true,
            pricing: { cost: 70, multiplier: 2.5, variantPrice: 174.99, compareAtPrice: 280, marginSource: 'fallback' as const },
            details: {
              baseGrams: 5, weightMultiplier: 1, metalPricePerGram: 2.5,
              centerCarats: 0, sideCarats: 0, centerPricePerCarat: 0, sidePricePerCarat: 0, 
              sideStoneCount: 0, hasCenter: false, isBracelet: false, isPendant: false
            }
          };

      // Generate SEO data for EVERY variant using new functions
      const diamondType = firstVariant.inputRowRef.diamondsType?.toLowerCase() || 'natural';
      let type: 'lab' | 'natural' | 'no-stones';
      if (firstVariant.scenario === 'NoStones') type = 'no-stones';
      else if (diamondType.includes('labgrown')) type = 'lab';
      else type = 'natural';
      
      const subcategory = trimAll(firstVariant.inputRowRef['Subcategory'] || 'Jewelry');
      const totalCt = calculateTotalCaratWeight(variant);
      const centerCt = variant.centerSize ? toNum(variant.centerSize) : undefined;
      const shapes = collectShapes([variant]);
      const metal = translateMetal(variant.metalCode);
      const quality = variant.quality || variant.qualityCode || 'GH';
      
      // Get width for no-stones items
      const widthMm = type === 'no-stones' ? toNum(firstVariant.inputRowRef['Unique Charcteristic/ Width for plain wedding bands'] || '0') : undefined;
      
      let seoTitle: string;
      let seoDescription: string;
      let imageAltText: string;
      
      if (isParent) {
        // Parent SEO data
        const caratWeights = sortedVariants.map(calculateTotalCaratWeight);
        const caratRange = caratWeights.length > 0 ? {
          minCt: Math.min(...caratWeights),
          maxCt: Math.max(...caratWeights)
        } : undefined;
        
        // Calculate center stone range across all variants
        const centerStoneWeights = sortedVariants
          .map(v => v.centerSize ? toNum(v.centerSize) : 0)
          .filter(ct => ct > 0);
        const centerCtRange = centerStoneWeights.length > 0 ? {
          minCt: Math.min(...centerStoneWeights),
          maxCt: Math.max(...centerStoneWeights)
        } : undefined;
        
        seoTitle = buildSeoTitleParent({ type, subcategory, core: variant.core, shapes, caratRange, widthMm, metals: productInfo.metals, centerCt: centerCt, centerCtRange });
        seoDescription = buildSeoDescriptionParent({ type, subcategory, shapes, caratRange, metals: productInfo.metals, centerCt: centerCt, centerCtRange });
        imageAltText = buildImageAltParent({ type, subcategory, caratRange, shapes, widthMm });
      } else {
        // Variant SEO data
        seoTitle = buildSeoTitleVariant({ type, subcategory, sku, totalCt, shapes, metal, centerCt, rowIndex: index });
        seoDescription = buildSeoDescriptionVariant({ type, subcategory, totalCt, shapes, metal, quality, centerCt, rowIndex: index });
        imageAltText = buildImageAltVariant({ type, subcategory, totalCt, shapes, metal, centerCt });
      }
      
      const seoData = {
        seoTitle,
        seoDescription,
        imageAltText,
        googleMPN: sku
      };

      const row: ShopifyRowWithCosts = {
        Handle: handle,
        
        // Parent-only fields (blank for children) - Following exact spec order
        Title: isParent ? productInfo.title : '',
        'Body (HTML)': isParent ? productInfo.bodyHTML : '',
        Vendor: isParent ? productInfo.vendor : '',
        Type: isParent ? productInfo.type : '',
        Tags: isParent ? productInfo.tags : '',
        Published: 'TRUE', // All items should have TRUE value
        
        // Option Names (parent-only, blank for No Stones)
        'Option1 Name': isParent && !isNoStones ? 'Metal/Color' : '',
        'Option1 Value': isNoStones ? '' : translateMetal(variant.metalCode),
        'Option2 Name': isParent && !isNoStones ? 'Total Carat' : '',
        'Option2 Value': isNoStones ? '' : calculateTotalCarat(variant),
        'Option3 Name': isParent && !isNoStones ? 'Diamond Quality' : '',
        'Option3 Value': isNoStones || !variant.qualityCode ? '' : translateQuality(variant.qualityCode),
        
        // Variant-specific fields with calculated costs and corrected inventory settings
        'Variant SKU': sku,
        'Variant Grams': toFixed2(costBreakdown.variantGrams),
        'Variant Inventory Tracker': '', // Fixed: blank (not "shopify")
        'Variant Inventory Qty': '1', // Fixed: 1 (not 10)
        'Variant Inventory Policy': 'Continue', // Fixed: "Continue" with capital C
        'Variant Fulfillment Service': 'Manual', // Fixed: "Manual" with capital M
        'Variant Price': `$${toFixed2(costBreakdown.pricing.variantPrice)}`,
        'Variant Compare At Price': `$${toFixed2(costBreakdown.pricing.compareAtPrice)}`,
        'Variant Requires Shipping': 'TRUE',
        'Variant Taxable': 'TRUE',
        'Variant Barcode': '',
        
        // Image fields
        'Image Src': isParent ? '' : '',
        'Image Position': '',
        'Image Alt Text': seoData.imageAltText,
        'Gift Card': isParent ? 'FALSE' : '',
        
        // SEO fields (parent-only)
        'SEO Title': seoData.seoTitle,
        'SEO Description': seoData.seoDescription,
        
        // Google Shopping fields
        'Google Shopping / Google Product Category': isParent ? productInfo.googleCategory : '',
        'Google Shopping / Gender': isParent ? 'Female' : '',
        'Google Shopping / Age Group': isParent ? 'Adult' : '',
        'Google Shopping / MPN': seoData.googleMPN,  // MPN on all variants
        'Google Shopping / AdWords Grouping': isParent ? productInfo.type : '',
        'Google Shopping / AdWords Labels': '',
        'Google Shopping / Condition': isParent ? 'New' : '',
        'Google Shopping / Custom Product': isParent ? 'FALSE' : '',
        'Google Shopping / Custom Label 0': '',
        'Google Shopping / Custom Label 1': '',
        'Google Shopping / Custom Label 2': '',
        'Google Shopping / Custom Label 3': '',
        'Google Shopping / Custom Label 4': '',
        
        // Additional variant fields
        'Variant Image': '',
        'Variant Weight Unit': 'Grams',
        'Variant Tax Code': '',
        'Cost per item': `$${toFixed2(costBreakdown.totalCost)}`,
        
        // New spec fields
        'Product Type': productInfo.type,
        'Core Number': variant.core,
        Category: trimAll(firstVariant.inputRowRef['Category'] || 'Jewelry'),
        
        // Cost breakdown fields
        'Center Stone Diamond': `$${toFixed2(costBreakdown.centerStoneDiamond)}`,
        'Side Stones Diamond': `$${toFixed2(costBreakdown.sideStoneDiamond)}`,
        'Metal Cost': `$${toFixed2(costBreakdown.metalCost)}`,
        'Center Stone Labor': `$${toFixed2(costBreakdown.centerStoneLabor)}`,
        'Side Stones Labor': `$${toFixed2(costBreakdown.sideStoneLabor)}`,
        Polish: `$${toFixed2(costBreakdown.polishCost)}`,
        Bracelets: `$${toFixed2(costBreakdown.braceletsCost)}`,
        Pendants: `$${toFixed2(costBreakdown.pendantsCost)}`,
        'CAD Creation': `$${toFixed2(costBreakdown.cadCreationCost)}`,
        Additional: `$${toFixed2(costBreakdown.additionalCost)}`,
        
        // Duplicate fields per spec
        'Title (duplicate)': productInfo.title,
        'Description (duplicate)': productInfo.bodyHTML,
        
        // Cost breakdown for analysis
        costBreakdown
      };

      allRows.push(row);
    });
  }

  // Preserve input row order - DO NOT SORT final rows
  // Rows are already in the correct order: input order → variant order within each handle

  return allRows;
}

/**
 * Generate Shopify rows from variant seeds (backwards compatibility)
 */
export function generateShopifyRows(
  variants: VariantSeed[], 
  naturalRules?: RuleSet, 
  labGrownRules?: RuleSet, 
  noStonesRules?: NoStonesRuleSet, 
  weightTable?: WeightLookupTable
): ShopifyRow[] {
  return generateShopifyRowsWithCosts(variants, naturalRules, labGrownRules, noStonesRules, weightTable).map(({ costBreakdown, ...row }) => row);
}

/**
 * Convert Shopify rows to CSV string with exact header order per spec
 */
export function shopifyRowsToCSV(rows: ShopifyRow[]): string {
  if (rows.length === 0) return '';

  // Exact header order per specification
  const headers = [
    'Handle',
    'Title',
    'Body (HTML)',
    'Vendor',
    'Type',
    'Tags',
    'Published',
    'Option1 Name',
    'Option1 Value',
    'Option2 Name',
    'Option2 Value',
    'Option3 Name',
    'Option3 Value',
    'Variant SKU',
    'Variant Grams',
    'Variant Inventory Tracker',
    'Variant Inventory Qty',
    'Variant Inventory Policy',
    'Variant Fulfillment Service',
    'Variant Price',
    'Variant Compare At Price',
    'Variant Requires Shipping',
    'Variant Taxable',
    'Variant Barcode',
    'Image Src',
    'Image Position',
    'Image Alt Text',
    'Gift Card',
    'SEO Title',
    'SEO Description',
    'Google Shopping / Google Product Category',
    'Google Shopping / Gender',
    'Google Shopping / Age Group',
    'Google Shopping / MPN',
    'Google Shopping / AdWords Grouping',
    'Google Shopping / AdWords Labels',
    'Google Shopping / Condition',
    'Google Shopping / Custom Product',
    'Google Shopping / Custom Label 0',
    'Google Shopping / Custom Label 1',
    'Google Shopping / Custom Label 2',
    'Google Shopping / Custom Label 3',
    'Google Shopping / Custom Label 4',
    'Variant Image',
    'Variant Weight Unit',
    'Variant Tax Code',
    'Cost per item',
    'Product Type',
    'Core Number',
    'Category',
    'Center Stone Diamond',
    'Side Stones Diamond',
    'Metal Cost',
    'Center Stone Labor',
    'Side Stones Labor',
    'Polish',
    'Bracelets',
    'Pendants',
    'CAD Creation',
    'Additional',
    'Title (duplicate)',
    'Description (duplicate)'
  ];

  const csvRows = [headers.join(',')];

  for (const row of rows) {
    const values = headers.map(header => {
      const value = row[header as keyof ShopifyRow] || '';
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