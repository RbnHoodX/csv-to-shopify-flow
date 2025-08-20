import { trimAll, toNum, toFixed2 } from './csv-parser';
import type { VariantSeed } from './variant-expansion';

// Configuration constants
export const FIXED_METALS_STRING = "in 14K, 18K, and 950";
export const BODY_TYPE_QUALIFIER = {
  lab: "lab grown",
  natural: "natural"
} as const;

export interface Product {
  variants: VariantSeed[];
  diamondType: 'Natural' | 'LabGrown' | 'NoStones';
  hasCenter: boolean;
  isRepeating: boolean;
}

/**
 * Get carat range across all variants
 */
export function getCaratRange(variants: VariantSeed[]): string {
  const caratWeights = variants.map(calculateTotalCaratWeight);
  const minTCW = Math.min(...caratWeights);
  const maxTCW = Math.max(...caratWeights);
  
  if (minTCW === maxTCW) {
    return `${minTCW.toFixed(2)} ct`;
  }
  return `${minTCW.toFixed(2)}-${maxTCW.toFixed(2)} ct`;
}

/**
 * Get unique shapes from center + all side-stone columns, ordered properly
 */
export function getUniqueShapesOrdered(variants: VariantSeed[]): string[] {
  const shapes = new Set<string>();
  
  for (const variant of variants) {
    const inputRow = variant.inputRowRef;
    
    // Add center shape if present
    const centerShape = trimAll(
      inputRow['Center shape'] ||
      inputRow['Center Shape'] ||
      inputRow['CenterShape'] ||
      inputRow['Shape'] ||
      ''
    );
    
    if (centerShape) {
      shapes.add(capitalizeFirst(centerShape));
    }
    
    // Add side shapes from all side stone columns
    for (let i = 1; i <= 10; i++) {
      const sideShape = trimAll(
        inputRow[`Side ${i} shape`] ||
        inputRow[`Side ${i} Shape`] ||
        inputRow[`Side ${i}Shape`] ||
        ''
      );
      
      if (sideShape) {
        shapes.add(capitalizeFirst(sideShape));
      }
    }
  }
  
  return Array.from(shapes).sort();
}

/**
 * Get stone types pluralized and joined with "and"
 */
export function getStoneTypesPlural(variants: VariantSeed[]): string {
  const stoneTypes = new Set<string>();
  
  for (const variant of variants) {
    const inputRow = variant.inputRowRef;
    
    // Add center stone type if present
    const centerType = trimAll(
      inputRow['Center Type'] ||
      inputRow['Center type'] ||
      inputRow['CenterType'] ||
      ''
    );
    
    if (centerType) {
      stoneTypes.add(pluralizeStoneType(centerType));
    }
    
    // Add side stone types from all side stone columns
    for (let i = 1; i <= 10; i++) {
      const sideType = trimAll(
        inputRow[`Side ${i} Type`] ||
        inputRow[`Side ${i} type`] ||
        inputRow[`Side ${i}Type`] ||
        ''
      );
      
      if (sideType) {
        stoneTypes.add(pluralizeStoneType(sideType));
      }
    }
  }
  
  return Array.from(stoneTypes).join(' and ');
}

/**
 * Check if product has center stone
 */
export function hasCenter(variants: VariantSeed[]): boolean {
  return variants.some(variant => {
    const centerCt = toNum(variant.inputRowRef['Center ct'] || '0');
    return centerCt > 0;
  });
}

/**
 * List side stone groups separately
 */
export function listSideStoneGroups(variants: VariantSeed[]): string[] {
  const firstVariant = variants[0];
  const inputRow = firstVariant.inputRowRef;
  const groups: string[] = [];
  
  for (let i = 1; i <= 10; i++) {
    const sideCt = toNum(inputRow[`Side ${i} Ct`] || '0');
    const sideShape = trimAll(inputRow[`Side ${i} shape`] || '');
    const sideType = trimAll(inputRow[`Side ${i} Type`] || '');
    const sideStones = toNum(inputRow[`Side ${i} Stones`] || '0');
    
    if (sideCt > 0 && sideShape && sideType) {
      const typeQualifier = getTypeQualifier(firstVariant.inputRowRef.diamondsType || '');
      const stoneTypePlural = pluralizeStoneType(sideType);
      const group = `Side Stone ${i}: ${sideStones} ${capitalizeFirst(sideShape)} Cut ${typeQualifier} ${stoneTypePlural} weighing ${toFixed2(sideCt)} carat`;
      groups.push(group);
    }
  }
  
  return groups;
}

/**
 * List core weights in ascending order for repeating items
 */
export function listCoreWeightsAscending(variants: VariantSeed[]): string[] {
  const coreWeights = new Set<number>();
  
  for (const variant of variants) {
    const totalCt = toNum(variant.inputRowRef['Total Ct Weight'] || '0');
    if (totalCt > 0) {
      coreWeights.add(totalCt);
    }
  }
  
  return Array.from(coreWeights)
    .sort((a, b) => a - b)
    .map(weight => {
      const firstVariant = variants[0];
      const inputRow = firstVariant.inputRowRef;
      const shape = trimAll(inputRow['Center shape'] || inputRow['Shape'] || '');
      const typeQualifier = getTypeQualifier(inputRow.diamondsType || '');
      const stoneType = trimAll(inputRow['Center Type'] || 'diamond');
      const stoneTypePlural = pluralizeStoneType(stoneType);
      
      return `At least one ${capitalizeFirst(shape)} Cut ${typeQualifier} ${stoneTypePlural} weighing ${toFixed2(weight)} carat.`;
    });
}

/**
 * Build title based on product type
 */
export function buildTitle(product: Product): string {
  const { variants, diamondType, hasCenter } = product;
  const firstVariant = variants[0];
  const inputRow = firstVariant.inputRowRef;
  
  if (diamondType === 'NoStones') {
    const width = toNum(inputRow['Unique Charcteristic/ Width for plain wedding bands'] || '0');
    const subcategory = trimAll(inputRow['Subcategory'] || 'Jewelry');
    
    if (width > 0) {
      return `${width.toFixed(1)} MM - ${subcategory} - ${FIXED_METALS_STRING}`;
    } else {
      return `${subcategory} - ${FIXED_METALS_STRING}`;
    }
  }
  
  const caratRange = getCaratRange(variants);
  const shapes = getUniqueShapesOrdered(variants);
  const stoneTypes = getStoneTypesPlural(variants);
  const subcategory = trimAll(inputRow['Subcategory'] || 'Jewelry');
  
  // Order shapes: center shape first if present, then remaining shapes A→Z
  const orderedShapes = orderShapesWithCenterFirst(shapes, hasCenter, inputRow);
  const shapesStr = orderedShapes.join(' & ');
  
  if (diamondType === 'Natural') {
    return `${caratRange} - ${shapesStr} Cut Natural ${stoneTypes} - ${subcategory}`;
  } else {
    // Lab-Grown: no prefix
    return `${caratRange} - ${shapesStr} Cut ${stoneTypes} - ${subcategory}`;
  }
}

/**
 * Build body content (parent-level only)
 */
export function buildBody(product: Product): string {
  const { variants, diamondType, hasCenter, isRepeating } = product;
  const title = buildTitle(product);
  
  let body = `${title}\n\n`;
  
  if (diamondType === 'NoStones') {
    return body;
  }
  
  if (hasCenter && !isRepeating) {
    // Items WITH CENTER (both Natural and Lab-Grown)
    body += `**Center:** Select center from the options above.\n`;
    
    const sideStoneGroups = listSideStoneGroups(variants);
    if (sideStoneGroups.length > 0) {
      body += sideStoneGroups.join(' | ');
    }
  } else if (isRepeating) {
    // Repeating-core items WITHOUT CENTER
    const coreWeights = listCoreWeightsAscending(variants);
    body += coreWeights.join('\n');
  }
  
  return body;
}

/**
 * Build SEO title (same as title)
 */
export function buildSeo(product: Product): { title: string; description: string } {
  const title = buildTitle(product);
  const body = buildBody(product);
  
  // Remove markdown and bold formatting, take first 160 chars
  const cleanBody = body
    .replace(/\*\*/g, '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const description = cleanBody.length > 160 
    ? cleanBody.substring(0, 157) + '...'
    : cleanBody;
  
  return { title, description };
}

// Helper functions

function calculateTotalCaratWeight(variant: VariantSeed): number {
  const inputRow = variant.inputRowRef;
  
  if (variant.scenario === 'Unique+Center' && variant.centerSize) {
    // For center variants, use center size + sum of side stones
    const centerCt = toNum(variant.centerSize);
    const sumSideCt = toNum(inputRow['Sum Side Ct'] || '0');
    return centerCt + sumSideCt;
  } else {
    // For other scenarios, use the total carat weight from input
    return toNum(inputRow['Total Ct Weight'] || '0');
  }
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function pluralizeStoneType(type: string): string {
  const lowerType = type.toLowerCase();
  if (lowerType === 'diamond') return 'diamonds';
  if (lowerType === 'sapphire') return 'sapphires';
  if (lowerType === 'ruby') return 'rubies';
  if (lowerType === 'emerald') return 'emeralds';
  return lowerType + 's';
}

function getTypeQualifier(diamondType: string): string {
  const lowerType = diamondType.toLowerCase();
  if (lowerType.includes('natural')) return BODY_TYPE_QUALIFIER.natural;
  if (lowerType.includes('labgrown') || lowerType.includes('lab-grown')) return BODY_TYPE_QUALIFIER.lab;
  return '';
}

function orderShapesWithCenterFirst(shapes: string[], hasCenter: boolean, inputRow: any): string[] {
  // Custom shape ordering: Round should come before Princess
  // This is a business rule, not alphabetical ordering
  return shapes.sort((a, b) => {
    // Round should always come first
    if (a === 'Round' && b !== 'Round') return -1;
    if (b === 'Round' && a !== 'Round') return 1;
    
    // For all other shapes, use alphabetical ordering
    return a.localeCompare(b);
  });
}
