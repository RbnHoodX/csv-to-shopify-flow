import { trimAll, toNum, toFixed2, ctStr, calculateSumSideCt, toCt2 } from './csv-parser';
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
  'Diamond Cost': string;
  'Metal Cost': string;
  'Side Stone': string;
  'Center Stone': string;
  Polish: string;
  Bracelets: string;
  'CAD Creation': string;
  '25$': string;
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
    // Add center shape if present
    if (variant.inputRowRef['Center shape']) {
      const centerShape = trimAll(variant.inputRowRef['Center shape']);
      if (centerShape) {
        // Convert to title case
        shapes.add(centerShape.charAt(0).toUpperCase() + centerShape.slice(1).toLowerCase());
      }
    }
    
    // Add side shapes (may be comma-separated)
    const sideShapes = variant.inputRowRef['Side shapes'] || variant.inputRowRef['Side shape'] || '';
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
 * Generate body HTML based on scenario
 */
function generateBodyHTML(variants: VariantSeed[], title: string, scenario: string): string {
  const firstVariant = variants[0];
  const inputRow = firstVariant.inputRowRef;
  const diamondType = inputRow.diamondsType || 'diamonds';
  const core = firstVariant.core;
  const category = trimAll(inputRow['Category'] || 'Jewelry');
  
  if (scenario === 'NoStones') {
    return `<p><strong>${title}</strong></p>
<p>Expertly crafted jewelry piece from Primestyle.com. Made with precision and attention to detail.</p>
<p>Perfect for everyday wear or special occasions.</p>`;
  }
  
  // Calculate carat range for detailed description
  const caratWeights = variants.map(calculateTotalCaratWeight);
  const minTCW = Math.min(...caratWeights);
  const maxTCW = Math.max(...caratWeights);
  const caratRange = minTCW === maxTCW ? `${minTCW.toFixed(2)}` : `${minTCW.toFixed(2)}-${maxTCW.toFixed(2)}`;
  
  // Get diamond details
  const centerShape = inputRow['Center shape'] || 'round';
  const sideShapes = inputRow['Side shapes'] || inputRow['Side shape'] || '';
  
  // Build the detailed HTML body format
  let bodyHTML = `<p><b>${title}<br></b>`;
  
  if (scenario === 'Unique+Center' && firstVariant.centerSize) {
    const centerSize = toCt2(toNum(firstVariant.centerSize));
    bodyHTML += `<b>${centerSize} Carat:</b><span> ${centerShape} cut center diamond weighing ${centerSize} carat</span><br>`;
    
    // Add side stone info if present
    const sumSideCt = calculateSumSideCt(inputRow);
    if (sumSideCt > 0) {
      const sideCount = toNum(inputRow['Side Stone Count'] || inputRow['Side count'] || '0');
      if (sideCount > 0) {
        bodyHTML += `<b>${toCt2(sumSideCt)} Carat:</b><span> ${sideCount} ${sideShapes || 'round'} cut diamonds weighing ${toCt2(sumSideCt)} carat</span><br>`;
      }
    }
  } else {
    // For repeating or no-center scenarios
    const totalCt = toNum(inputRow['Total Ct Weight'] || inputRow['Total ct'] || inputRow['TotalCt'] || '0');
    if (totalCt > 0) {
      bodyHTML += `<b>${toCt2(totalCt)} Carat:</b><span> diamonds weighing ${toCt2(totalCt)} carat</span><br>`;
    }
  }
  
  bodyHTML += `</p>`;
  
  // Add detailed description paragraph
  const diamondTypeText = diamondType.toLowerCase().includes('natural') ? 'natural diamonds' : 
                         diamondType.toLowerCase().includes('labgrown') ? 'lab grown diamonds' : 
                         'diamonds';
  
  const subcategory = trimAll(inputRow['Subcategory'] || inputRow['Type'] || category);
  
  bodyHTML += `<p><span>Experience a true luxury with our ${caratRange} CT ${collectShapes(variants).join(' & ')} Cut - ${subcategory} MDL#${core}. This ${subcategory} crafted with ${caratRange} carat ${diamondTypeText}. Select your choice of precious metal between 14 Karat, 18 Karat Yellow, White and Rose Gold OR Platinum. Shine with uniqueness with Primestyle diamond ${subcategory}.</span></p>`;
  
  return bodyHTML;
}

/**
 * Create enhanced product info from variants per handle
 */
function createProductInfo(variants: VariantSeed[]) {
  const firstVariant = variants[0];
  const inputRow = firstVariant.inputRowRef;
  
  // Calculate carat range for title
  const caratWeights = variants.map(calculateTotalCaratWeight);
  const minTCW = Math.min(...caratWeights);
  const maxTCW = Math.max(...caratWeights);
  
  // Collect unique shapes and format for title
  const shapes = collectShapes(variants);
  const shapesStr = shapes.length > 0 ? shapes.join(' & ') + ' Cut' : 'Mixed Cut';
  
  // Get category and subcategory
  const category = trimAll(inputRow['Category'] || 'Jewelry');
  const subcategory = trimAll(inputRow['Subcategory'] || inputRow['Type'] || 'Piece');
  
  // Generate title based on spec: "{MinTCW}-{MaxTCW} CT {Shapes} Cut - {Subcategory}"
  const title = firstVariant.scenario === 'NoStones' 
    ? `${subcategory} - Premium ${category}`
    : minTCW === maxTCW 
      ? `${minTCW.toFixed(2)} CT ${shapesStr} - ${subcategory}`
      : `${minTCW.toFixed(2)}-${maxTCW.toFixed(2)} CT ${shapesStr} - ${subcategory}`;
  
  // Vendor is always "Primestyle.com"
  const vendor = 'Primestyle.com';
  
  // Type format: "{Category}_{Subcategory}"
  const type = `${category}_${subcategory}`;
  
  // Build comprehensive tags
  const tagParts: string[] = [];
  
  // Add category
  tagParts.push(category);
  
  // Add category_subcategory as single tag
  tagParts.push(`${category}_${subcategory}`);
  
  // Add shape tags
  shapes.forEach(shape => {
    tagParts.push(`shape_${shape.toLowerCase()}`);
  });
  
  // Add TCW bucket tags (only for stones scenarios)
  if (firstVariant.scenario !== 'NoStones') {
    const tcwBucketTags = generateTCWBucketTags(minTCW, maxTCW);
    tagParts.push(...tcwBucketTags);
  }
  
  // Add input tags if present
  const inputTags = trimAll(inputRow['Tags'] || inputRow['Keywords'] || '');
  if (inputTags) {
    tagParts.push(inputTags);
  }
  
  const tags = tagParts.join(', ');
  
  // Generate body HTML
  const bodyHTML = generateBodyHTML(variants, title, firstVariant.scenario);
  
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
    metals: [...new Set(variants.map(v => v.metalCode))]
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

      // Generate enhanced SEO title and description
      const seoTitle = isParent ? `${productInfo.title} | ${productInfo.qualities.join('/')} ${productInfo.diamondType} | ${productInfo.metals.join('/')} | ${productInfo.vendor}` : '';
      const seoDescription = isParent ? `Shop ${productInfo.title} featuring ${productInfo.diamondType} in ${productInfo.metals.join('/')} metal. Premium quality ${productInfo.qualities.join('/')} diamonds. SKU: ${sku}. Free shipping available.` : '';

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
        'Variant Price': toFixed2(costBreakdown.pricing.variantPrice),
        'Variant Compare At Price': toFixed2(costBreakdown.pricing.compareAtPrice),
        'Variant Requires Shipping': 'TRUE',
        'Variant Taxable': 'TRUE',
        'Variant Barcode': '',
        
        // Image fields
        'Image Src': isParent ? '' : '',
        'Image Position': isParent ? '1' : '',
        'Image Alt Text': isParent ? productInfo.title : '',
        'Gift Card': 'FALSE',
        
        // Enhanced SEO fields (parent-only)
        'SEO Title': seoTitle,
        'SEO Description': seoDescription,
        
        // Enhanced Google Shopping fields (parent-only)
        'Google Shopping / Google Product Category': isParent ? productInfo.googleCategory : '',
        'Google Shopping / Gender': isParent ? 'Female' : '',
        'Google Shopping / Age Group': isParent ? 'Adult' : '',
        'Google Shopping / MPN': isParent ? sku : '',
        'Google Shopping / AdWords Grouping': '',
        'Google Shopping / AdWords Labels': '',
        'Google Shopping / Condition': isParent ? 'new' : '',
        'Google Shopping / Custom Product': '',
        'Google Shopping / Custom Label 0': '',
        'Google Shopping / Custom Label 1': '',
        'Google Shopping / Custom Label 2': '',
        'Google Shopping / Custom Label 3': '',
        'Google Shopping / Custom Label 4': '',
        
        // Additional variant fields
        'Variant Image': '',
        'Variant Weight Unit': 'g',
        'Variant Tax Code': '',
        'Cost per item': toFixed2(costBreakdown.totalCost),
        
        // New spec fields
        'Product Type': isParent ? productInfo.type : '',
        'Core Number': variant.core,
        Category: isParent ? trimAll(firstVariant.inputRowRef['Category'] || 'Jewelry') : '',
        
        // Cost breakdown fields
        'Diamond Cost': toFixed2(costBreakdown.diamondCost),
        'Metal Cost': toFixed2(costBreakdown.metalCost),
        'Side Stone': toFixed2(costBreakdown.sideStoneCost),
        'Center Stone': toFixed2(costBreakdown.centerStoneCost),
        Polish: toFixed2(costBreakdown.polishCost),
        Bracelets: toFixed2(costBreakdown.braceletsCost),
        'CAD Creation': toFixed2(costBreakdown.cadCreationCost),
        '25$': toFixed2(costBreakdown.constantCost),
        
        // Duplicate fields per spec
        'Title (duplicate)': isParent ? productInfo.title : '',
        'Description (duplicate)': isParent ? productInfo.bodyHTML : '',
        
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
export function generateShopifyRows(variants: VariantSeed[]): ShopifyRow[] {
  return generateShopifyRowsWithCosts(variants).map(({ costBreakdown, ...row }) => row);
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
    'Diamond Cost',
    'Metal Cost',
    'Side Stone',
    'Center Stone',
    'Polish',
    'Bracelets',
    'CAD Creation',
    '25$',
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