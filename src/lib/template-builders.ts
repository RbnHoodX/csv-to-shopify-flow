import { trimAll, toNum, toFixed2 } from './csv-parser';

// Helper function to generate a simple hash code for consistent template selection
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}

// Helper function to get metal options for product descriptions
function getMetalOptions(variants: VariantSeed[]): string {
  const metals = new Set<string>();
  
  for (const variant of variants) {
    const inputRow = variant.inputRowRef;
    const metalCode = inputRow['Metal Code'] || inputRow['metalCode'] || '';
    
    if (metalCode) {
      // Translate metal codes to readable names
      const metalName = translateMetal(metalCode);
      if (metalName) {
        metals.add(metalName);
      }
    }
  }
  
  if (metals.size === 0) {
    return '14KT, 18KT & Platinum'; // Default fallback
  }
  
  return Array.from(metals).join(', ');
}

// Helper function to translate metal codes to readable names
function translateMetal(metalCode: string): string {
  const metalMap: { [key: string]: string } = {
    '14WG': '14KT White Gold',
    '14YG': '14KT Yellow Gold',
    '14RG': '14KT Rose Gold',
    '18WG': '18KT White Gold',
    '18YG': '18KT Yellow Gold',
    '18RG': '18KT Rose Gold',
    'PLAT': 'Platinum',
    '14K': '14KT',
    '18K': '18KT',
    'PT': 'Platinum'
  };
  
  return metalMap[metalCode.toUpperCase()] || metalCode;
}
import type { VariantSeed } from './variant-expansion';

// Configuration constants
export const FIXED_METALS_STRING = "in 14K, 18K, and 950";
export const BODY_TYPE_QUALIFIER = {
  lab: "labgrown",
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
 * Calculate total stone count for bracelets, pendants, and similar items
 * Dynamically sums all side stones from the input data
 */
function calculateTotalStoneCount(variants: VariantSeed[]): number {
  const firstVariant = variants[0];
  const inputRow = firstVariant.inputRowRef;
  
  let totalStones = 0;
  
  // Sum all side stones from columns 1-10
  for (let i = 1; i <= 10; i++) {
    const sideStones = toNum(inputRow[`Side ${i} Stones`] || '0');
    totalStones += sideStones;
  }
  
  return totalStones;
}

/**
 * Check if item is a bracelet or pendant based on category
 */
function isBraceletOrPendant(variants: VariantSeed[]): boolean {
  const firstVariant = variants[0];
  const inputRow = firstVariant.inputRowRef;
  
  const category = trimAll(
    inputRow["Category"] ||
    inputRow["Type"] ||
    ""
  ).toLowerCase();
  
  const subcategory = trimAll(
    inputRow["Subcategory"] ||
    inputRow["Sub Category"] ||
    ""
  ).toLowerCase();
  
  return category.includes("bracelet") || 
         category.includes("pendants") || 
         category.includes("pendant") ||
         subcategory.includes("bracelet") ||
         subcategory.includes("pendants") ||
         subcategory.includes("pendant");
}

/**
 * Build SEO title (same as title)
 */
export function buildSeo(product: Product): { title: string; description: string } {
  const title = buildTitle(product);
  const body = buildBody(product);
  
  // Extract text from HTML, remove HTML tags, take first 160 chars
  const cleanBody = body
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
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

function generateMarketingCopy(product: Product): string {
  const { variants, diamondType } = product;
  const firstVariant = variants[0];
  const inputRow = firstVariant.inputRowRef;
  const caratRange = getCaratRange(variants);
  const shapes = getUniqueShapesOrdered(variants);
  const shapesStr = orderShapesWithCenterFirst(shapes, product.hasCenter, inputRow).join(' & ');
  const subcategory = trimAll(inputRow['Subcategory'] || 'Jewelry');
  const stoneTypes = getStoneTypesPlural(variants);
  
  let html = '';
  
  // Add marketing paragraph
  const typeQualifier = diamondType === 'Natural' ? 'natural' : 'labgrown';
  html += `<p><span>Experience a true luxury with our ${caratRange} ${shapesStr} Cut ${typeQualifier} ${stoneTypes} - ${subcategory}. This ${subcategory} crafted with ${caratRange} ${typeQualifier} ${stoneTypes}. Select your choice of precious metal between 14 Karat, 18 Karat Yellow, White and Rose Gold OR Platinum. Shine with uniqueness with Primestyle diamond ${subcategory}.</span></p>`;
  
  // Add bullet points
  html += '<ul>';
  
  // Bullet point 1: Captivating cuts
  html += `<li>Captivating ${shapesStr} Cut: Our ${typeQualifier} ${stoneTypes}, available in ${shapesStr} cut, ranging from ${caratRange}, embody timeless beauty and brilliance.</li>`;
  
  // Bullet point 2: Sparkling elegance
  if (shapes.includes('Round') && shapes.includes('Princess')) {
    html += `<li>Sparkling Elegance: The Round cut showcases a dazzling array of facets, while the Princess cut exudes a captivating brilliance—together creating a stunning combination of elegance and radiance.</li>`;
  } else if (shapes.includes('Round')) {
    html += `<li>Sparkling Elegance: The Round cut showcases a dazzling array of facets, creating stunning brilliance and timeless beauty.</li>`;
  } else if (shapes.includes('Princess')) {
    html += `<li>Sparkling Elegance: The Princess cut exudes a captivating brilliance, creating stunning elegance and modern sophistication.</li>`;
  } else {
    html += `<li>Sparkling Elegance: Our ${shapesStr} cut showcases a dazzling array of facets, creating stunning brilliance and timeless beauty.</li>`;
  }
  
  // Bullet point 3: Ethical & Sustainable
  if (diamondType === 'LabGrown') {
    html += `<li>Ethical & Sustainable: Embrace eco-conscious luxury with our lab-grown ${stoneTypes}—ethically sourced, conflict-free, and environmentally friendly.</li>`;
  } else {
    html += `<li>Ethical & Sustainable: Embrace luxury with our natural ${stoneTypes}—ethically sourced and conflict-free.</li>`;
  }
  
  // Bullet point 4: Customizable Perfection
  html += `<li>Customizable Perfection: Personalize your dream ${subcategory.toLowerCase()} with a range of ${stoneTypes} sizes and metal options, including 14K and 18K White Gold, Yellow Gold, Rose Gold, or Platinum.</li>`;
  
  // Bullet point 5: Exquisite Craftsmanship
  html += `<li>Exquisite Craftsmanship: Each ${subcategory.toLowerCase()} is meticulously handcrafted by our skilled artisans, ensuring exceptional quality and attention to detail.</li>`;
  
  // Bullet point 6: Symbol of Eternal Love
  html += `<li>Symbol of Eternal Love: The ${shapesStr} cut ${typeQualifier} ${stoneTypes} represent everlasting love, making this ${subcategory.toLowerCase()} a profound symbol of your enduring commitment.</li>`;
  
  // Bullet point 7: Cherish Precious Moments
  html += `<li>Cherish Precious Moments: Celebrate life's most cherished occasions as the brilliance of our ${typeQualifier} ${stoneTypes} illuminates every moment with mesmerizing sparkle.</li>`;
  
  // Bullet point 8: Celebrate Your Love Story
  html += `<li>Celebrate Your Love Story: Our ${caratRange} ${shapesStr} Cut ${typeQualifier} ${stoneTypes} ${subcategory.toLowerCase()} celebrates the uniqueness of your love story and the promise of a lifetime together.</li>`;
  
  // Bullet point 9: Timeless Elegance
  html += `<li>Timeless Elegance: This exquisite ${subcategory.toLowerCase()} captures timeless elegance, symbolizing the eternal beauty of your love for generations to come.</li>`;
  
  html += '</ul>';
  
  return html;
}

/**
 * Helper function to format carat weight (trim trailing zeros)
 */
function formatCt(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Helper function to format carat range with uppercase CT and two decimals
 */
function formatCtRange(minCt: number, maxCt: number): string {
  if (minCt === maxCt) {
    return `${formatCt2(minCt)} CT`;
  }
  return `${formatCt2(minCt)}-${formatCt2(maxCt)} CT`;
}

/**
 * Helper function to join shapes with " & " separator and title-case
 */
function joinShapes(shapes: string[]): string {
  return shapes.map(shape => 
    shape.charAt(0).toUpperCase() + shape.slice(1).toLowerCase()
  ).join(' & ');
}

/**
 * Helper function to get stone type qualifier for body text
 */
function bodyTypeQualifier(type: 'lab' | 'natural' | 'no-stones'): string {
  switch (type) {
    case 'lab': return 'lab grown';
    case 'natural': return 'natural';
    case 'no-stones': return '';
    default: return '';
  }
}

/**
 * Helper function to format carat weight with exactly two decimals
 */
function formatCt2(n: number): string {
  return n.toFixed(2);
}

/**
 * Helper function to join shapes with title-case and proper separator
 */
function titleJoinShapes(shapes: string[]): string {
  return shapes.map(shape => 
    shape.charAt(0).toUpperCase() + shape.slice(1).toLowerCase()
  ).join(' & ');
}

/**
 * Helper function to normalize metal names
 */
function normalizeMetal(metal: string): string {
  return metal
    .replace(/14KT/gi, '14k')
    .replace(/18KT/gi, '18k')
    .toLowerCase();
}

/**
 * Build title for parent row following new capitalization rules
 */
export function buildTitle(product: Product): string {
  const { diamondType, variants } = product;
  const firstVariant = variants[0];
  const inputRow = firstVariant.inputRowRef;
  
  if (diamondType === 'NoStones') {
    const width = toNum(inputRow['Unique Charcteristic/ Width for plain wedding bands'] || '0');
    const subcategory = trimAll(inputRow['Subcategory'] || 'Jewelry');
    
    if (width > 0) {
      return `${width.toFixed(1)} mm - ${subcategory} - in 14KT, 18KT & Platinum`;
    } else {
      return `${subcategory} - in 14KT, 18KT & Platinum`;
    }
  }
  
  // Get carat range for parent
  const caratWeights = variants.map(calculateTotalCaratWeight);
  const minCt = Math.min(...caratWeights);
  const maxCt = Math.max(...caratWeights);
  const caratRange = formatCtRange(minCt, maxCt);
  
  // Get shapes and format with title-case
  const shapes = getUniqueShapesOrdered(variants);
  const shapesStr = titleJoinShapes(shapes);
  
  // Get subcategory
  const subcategory = trimAll(inputRow['Subcategory'] || 'Jewelry');
  
  // Build title following new rules
  if (diamondType === 'Natural') {
    // NATURAL: include "Natural Diamonds" (capital D)
    return `${caratRange} ${shapesStr} Cut Natural Diamonds - ${subcategory}`;
  } else {
    // LAB-GROWN: DO NOT include "Lab-Grown" in Title, but capitalize "Diamonds"
    return `${caratRange} ${shapesStr} Cut Diamonds - ${subcategory}`;
  }
}

/**
 * Build HTML body for parent row with proper structure
 */
export function buildBody(product: Product): string {
  const { diamondType, variants, hasCenter } = product;
  const firstVariant = variants[0];
  const inputRow = firstVariant.inputRowRef;
  
  if (diamondType === 'NoStones') {
    const width = toNum(inputRow['Unique Charcteristic/ Width for plain wedding bands'] || '0');
    const subcategory = trimAll(inputRow['Subcategory'] || 'Jewelry');
    
    if (width > 0) {
      return `<div><p><strong>${width.toFixed(1)} mm - ${subcategory} - in 14KT, 18KT & Platinum</strong></p><p>Expertly crafted jewelry piece from Primestyle.com. Made with precision and attention to detail.</p><p>Perfect for everyday wear or special occasions.</p><p><strong>${width.toFixed(1)} mm ${subcategory} in 14KT, 18KT, and Platinum</strong></p><p>Reward yourself with our ${width.toFixed(1)} mm ${subcategory.toLowerCase()} in 14KT, 18KT, and Platinum.</p><p>Select your choice of precious metal between 14 Karat, 18 Karat Yellow, White and Rose Gold, or Platinum.</p><p>At Primestyle.com, we deal ONLY with 100% real, natural, and conflict-free diamonds. Our diamonds are NOT enhanced nor treated.</p><p>Shine with chic with Primestyle diamonds ${subcategory.toLowerCase()}.</p></div>`;
    } else {
      return `<div><p><strong>${subcategory} - in 14KT, 18KT & Platinum</strong></p><p>Expertly crafted jewelry piece from Primestyle.com. Made with precision and attention to detail.</p><p>Select your choice of precious metal between 14 Karat, 18 Karat Yellow, White and Rose Gold, or Platinum.</p><p>At Primestyle.com, we deal ONLY with 100% real, natural, and conflict-free diamonds. Our diamonds are NOT enhanced nor treated.</p><p>Perfect for everyday wear or special occasions.</p></div>`;
    }
  }
  
  // Get title for first line (EXACT Title, no repetition)
  const title = buildTitle(product);
  
  // Get type qualifier for body text
  const typeQualifier = bodyTypeQualifier(diamondType === 'Natural' ? 'natural' : 'lab');
  
  let body = `<div><p><strong>${title}</strong></p><p>`;
  
  if (hasCenter) {
    // HAS CENTER: Center line + side stone lines in single paragraph
    body += `<strong>Center:</strong> Select center from the options above<br>`;
    
    // List side stones as separate lines in same paragraph
    const sideStoneGroups = listSideStoneGroups(variants, typeQualifier);
    sideStoneGroups.forEach((group, index) => {
      body += `<strong>Side Stones ${index + 1}:</strong> ${group}<br>`;
    });
  } else {
    // REPEATING-CORE TYPE: List all core weights ascending from CORE data only
    const coreWeights = listCoreWeightsAscending(variants);
    coreWeights.forEach((core, index) => {
      const shapesStr = titleJoinShapes(core.shapes);
      const caratWeight = formatCt2(core.totalCt);
      
      // For bracelets, pendants, and similar items, find the stone count for this specific carat weight
      let stoneCount = 1; // Default for single stone items
      
      if (isBraceletOrPendant(variants)) {
        // Find the variant that matches this carat weight to get the correct stone count
        const matchingVariant = variants.find(variant => {
          const variantTotalCt = toNum(variant.inputRowRef['Total Ct Weight'] || '0');
          return Math.abs(variantTotalCt - core.totalCt) < 0.01; // Allow small floating point differences
        });
        
        if (matchingVariant) {
          stoneCount = calculateTotalStoneCount([matchingVariant]);
        }
      }
      
      // Use actual stone count, but ensure we don't say "one round cut" unless truly single
      const stoneCountText = stoneCount === 1 ? "1" : stoneCount.toString();
      body += `<strong>${caratWeight} Carat:</strong> <span>${stoneCountText} ${shapesStr.toLowerCase()} cut ${typeQualifier} diamonds weighing ${caratWeight} Carat</span><br>`;
    });
  }
  
  return body;
}

/**
 * List side stone groups for variants with center stones
 */
function listSideStoneGroups(variants: VariantSeed[], typeQualifier: string): string[] {
  const groups: string[] = [];
  const firstVariant = variants[0];
  const inputRow = firstVariant.inputRowRef;
  
  // Check each side stone column
  for (let i = 1; i <= 10; i++) {
    const sideCt = toNum(inputRow[`Side ${i} Ct`] || '0');
    const sideShape = trimAll(inputRow[`Side ${i} shape`] || inputRow[`Side ${i} Shape`] || '');
    const sideStones = toNum(inputRow[`Side ${i} Stones`] || '0');
    
    if (sideCt > 0 && sideShape && sideStones > 0) {
      const shapeStr = sideShape.charAt(0).toUpperCase() + sideShape.slice(1).toLowerCase();
      // Use stone COUNT, not weight, followed by total carat
      // Format: "3 Round Cut natural diamonds weighing 0.30 carat"
      // Ensure we don't say "one round cut" unless truly a single stone
      const stoneCountText = sideStones === 1 ? "1" : sideStones.toString();
      groups.push(`${stoneCountText} ${shapeStr} Cut ${typeQualifier} diamonds weighing ${formatCt2(sideCt)} carat`);
    }
  }
  
  return groups;
}

/**
 * List core weights in ascending order for repeating-core items
 * Uses CORE rows only, not per-variant rows
 */
function listCoreWeightsAscending(variants: VariantSeed[]): Array<{coreNumber: string, totalCt: number, shapes: string[]}> {
  // Get unique cores from the input data (not from variants)
  const cores = new Map<string, {coreNumber: string, totalCt: number, shapes: string[]}>();
  
  for (const variant of variants) {
    const inputRow = variant.inputRowRef;
    const coreNumber = inputRow['coreNumber'] || inputRow['Core Number'] || '';
    const totalCt = toNum(inputRow['Total Ct Weight'] || '0');
    
    // Create unique key based on coreNumber + totalCt to handle multiple cores with same number but different weights
    const uniqueKey = `${coreNumber}-${totalCt}`;
    
    if (!cores.has(uniqueKey)) {
      // Get shapes for this core from input data
      const shapes = new Set<string>();
      
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
      
      cores.set(uniqueKey, {
        coreNumber,
        totalCt,
        shapes: Array.from(shapes).sort()
      });
    }
  }
  
  // Return cores sorted by total carat weight ascending
  return Array.from(cores.values()).sort((a, b) => a.totalCt - b.totalCt);
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
    tags.push(`tcw_${formatCt2(bucket)} CT - ${formatCt2(nextBucket)} CT`);
  }
  
  return tags;
}

/**
 * Build tags following new rules
 */
export function buildTags(product: Product): string {
  const { diamondType, variants } = product;
  const firstVariant = variants[0];
  const inputRow = firstVariant.inputRowRef;
  
  if (diamondType === 'NoStones') {
    // NO-STONES: Only keep tags that make sense for no-stones products
    const tagParts: string[] = [];
    
    // Add category_subcategory as first tag
    const category = trimAll(inputRow['Category'] || 'Jewelry');
    const subcategory = trimAll(inputRow['Subcategory'] || 'Piece');
    tagParts.push(`${category}_${subcategory}`);
    
    // Add width tag if present
    const width = toNum(inputRow['Unique Charcteristic/ Width for plain wedding bands'] || '0');
    if (width > 0) {
      tagParts.push(`WIDTH_${width.toFixed(1)}`);
    }
    
    // Add metal tags from variants
    const metalCodes = new Set<string>();
    variants.forEach(variant => {
      if (variant.metalCode) {
        const metalName = translateMetal(variant.metalCode);
        if (metalName) {
          metalCodes.add(metalName.toLowerCase().replace(/\s+/g, '_'));
        }
      }
    });
    metalCodes.forEach(metal => {
      tagParts.push(`metal_${metal}`);
    });
    
    // Add input tags if present (filter out stone-related tags)
    const inputTags = trimAll(inputRow['Tags'] || inputRow['Keywords'] || '');
    if (inputTags) {
      const inputTagArray = inputTags.split(',').map(tag => tag.trim());
      const filteredInputTags = inputTagArray.filter(tag => {
        const lowerTag = tag.toLowerCase();
        // Exclude stone-related tags
        return !lowerTag.startsWith('shape_') && 
               !lowerTag.startsWith('tcw_') && 
               !lowerTag.includes('carat') && 
               !lowerTag.includes('ct') &&
               !lowerTag.includes('stone') &&
               !lowerTag.includes('diamond');
      });
      if (filteredInputTags.length > 0) {
        tagParts.push(...filteredInputTags);
      }
    }
    
    return tagParts.join(', ');
  }
  
  // Diamonds items: keep existing tag logic
  const tagParts: string[] = [];
  
  // Add category_subcategory as first tag
  const category = trimAll(inputRow['Category'] || 'Jewelry');
  const subcategory = trimAll(inputRow['Subcategory'] || 'Piece');
  tagParts.push(`${category}_${subcategory}`);
  
  // Add item type as second tag with exact capitalization from input
  const diamondsType = inputRow.diamondsType || '';
  if (diamondsType) {
    tagParts.push(diamondsType);
  }
  
  // Add unique shape tags in consistent order
  const shapes = getUniqueShapesOrdered(variants);
  shapes.forEach(shape => {
    tagParts.push(`shape_${shape.toLowerCase()}`);
  });
  
  // Always add shape_round if it's not already there
  if (!shapes.some(shape => shape.toLowerCase() === 'round')) {
    tagParts.push('shape_round');
  }
  
  // Add TCW bucket tags
  const caratWeights = variants.map(calculateTotalCaratWeight);
  const minTCW = Math.min(...caratWeights);
  const maxTCW = Math.max(...caratWeights);
  const tcwBucketTags = generateTCWBucketTags(minTCW, maxTCW);
  tagParts.push(...tcwBucketTags);
  
  // Add input tags if present (filter out shape tags)
  const inputTags = trimAll(inputRow['Tags'] || inputRow['Keywords'] || '');
  if (inputTags) {
    const inputTagArray = inputTags.split(',').map(tag => tag.trim());
    const filteredInputTags = inputTagArray.filter(tag => !tag.toLowerCase().startsWith('shape_'));
    if (filteredInputTags.length > 0) {
      tagParts.push(...filteredInputTags);
    }
  }
  
  return tagParts.join(', ');
}

/**
 * Build SEO Title for parent row
 */
export function buildSeoTitleParent(item: {
  type: 'lab' | 'natural' | 'no-stones';
  subcategory: string;
  core: string;
  shapes: string[];
  caratRange?: { minCt: number; maxCt: number };
  widthMm?: number;
  metals?: string[];
  centerCt?: number;
  centerCtRange?: { minCt: number; maxCt: number };
}): string {
  const { type, subcategory, core, shapes, caratRange, widthMm, metals, centerCt, centerCtRange } = item;
  
  if (type === 'no-stones') {
    // No-stones parent: "{widthMm} mm - {Subcategory} - {Core}"
    if (widthMm) {
      return `${widthMm.toFixed(1)} mm - ${subcategory} - ${core} | Primestyle`;
    }
    return `${subcategory} - ${core} | Primestyle`;
  }
  
  // Stones parent: Include shape, metal, and center stone details
  const shapesStr = titleJoinShapes(shapes);
  const typeQualifier = type === 'lab' ? 'Lab Grown' : 'Natural';
  
  let title = '';
  if (caratRange && caratRange.minCt !== caratRange.maxCt) {
    title = `${formatCt2(caratRange.minCt)}-${formatCt2(caratRange.maxCt)} CT `;
  }
  
  // Add shapes and diamond type
  title += `${shapesStr} Cut ${typeQualifier} Diamonds`;
  
  // Add metal information if available
  if (metals && metals.length > 0) {
    const metalStr = metals.length === 1 ? metals[0] : `${metals[0]} & ${metals[metals.length - 1]}`;
    title += ` in ${metalStr}`;
  }
  
  // Add center stone details if available
  if (centerCtRange && centerCtRange.minCt > 0) {
    if (centerCtRange.minCt === centerCtRange.maxCt) {
      title += ` with ${formatCt2(centerCtRange.minCt)} CT Center`;
    } else {
      title += ` with ${formatCt2(centerCtRange.minCt)}-${formatCt2(centerCtRange.maxCt)} CT Center`;
    }
  } else if (centerCt && centerCt > 0) {
    title += ` with ${formatCt2(centerCt)} CT Center`;
  }
  
  title += ` - ${subcategory} | Primestyle`;
  
  // Remove double spaces
  title = title.replace(/\s+/g, ' ');
  
  // Length constraint: ≤ 65 chars, trim from left before last " - " if needed
  // if (title.length > 65) {
  //   const lastDashIndex = title.lastIndexOf(' - ');
  //   if (lastDashIndex > 0) {
  //     const requiredSuffix = title.substring(lastDashIndex);
  //     const availableSpace = 65 - requiredSuffix.length;
  //     if (availableSpace > 15) { // Ensure we keep meaningful content
  //       title = title.substring(0, availableSpace) + requiredSuffix;
  //     }
  //   }
  // }
  
  return title;
}

/**
 * Build SEO Title for variant row
 */
export function buildSeoTitleVariant(item: {
  type: 'lab' | 'natural' | 'no-stones';
  subcategory: string;
  sku: string;
  totalCt: number;
  shapes: string[];
  metal?: string;
  centerCt?: number;
  rowIndex?: number;
}): string {
  const { type, subcategory, sku, totalCt, shapes, metal, centerCt, rowIndex = 0 } = item;
  
  if (type === 'no-stones') {
    // No-stones variant: "{Subcategory} - {Metal} - {SKU}"
    return `${subcategory} - ${metal || ''} - ${sku} | Primestyle`;
  }
  
  // Stones variant: Include shape, metal, and center stone details
  const shapesStr = titleJoinShapes(shapes);
  const typeQualifier = type === 'lab' ? 'Lab Grown' : 'Natural';
  
  let title = '';
  
  // Add carat weight and shapes
  title += `${formatCt2(totalCt)} CT ${shapesStr} Cut ${typeQualifier} Diamonds`;
  
  // Add metal information if available
  if (metal) {
    title += ` in ${metal}`;
  }
  
  // Add center stone details if available
  if (centerCt && centerCt > 0) {
    title += ` with ${formatCt2(centerCt)} CT Center`;
  }
  
  title += ` - ${subcategory} | Primestyle`;
  
  // Remove double spaces
  title = title.replace(/\s+/g, ' ');
  
  // Length constraint: ≤ 65 chars, trim from left before last " - " if needed
  // if (title.length > 65) {
  //   const lastDashIndex = title.lastIndexOf(' - ');
  //   if (lastDashIndex > 0) {
  //     const requiredSuffix = title.substring(lastDashIndex);
  //     const availableSpace = 65 - requiredSuffix.length;
  //     if (availableSpace > 15) { // Ensure we keep meaningful content
  //       title = title.substring(0, availableSpace) + requiredSuffix;
  //     }
  //   }
  // }
  
  return title;
  

}

/**
 * Build SEO Description for parent row (summary format)
 */
export function buildSeoDescriptionParent(item: {
  type: 'lab' | 'natural' | 'no-stones';
  subcategory: string;
  shapes: string[];
  caratRange?: { minCt: number; maxCt: number };
  metals?: string[];
  centerCt?: number;
  centerCtRange?: { minCt: number; maxCt: number };
}, charLimit: number = 200): string {
  const { type, subcategory, shapes, caratRange, metals, centerCt, centerCtRange } = item;
  
  if (type === 'no-stones') {
    return `Expertly crafted ${subcategory.toLowerCase()} from PrimeStyle.com. Premium metals with precision craftsmanship.`;
  }
  
  // Stones parent: Expand title with richer descriptive language but keep same details
  const shapesLower = titleJoinShapes(shapes).toLowerCase().replace(' cut', '');
  const labOrNaturalSingular = type === 'lab' ? 'lab-grown diamond' : 'natural diamond';
  
  let description = '';
  if (caratRange && caratRange.minCt !== caratRange.maxCt) {
    description = `Stunning ${formatCt2(caratRange.minCt)}-${formatCt2(caratRange.maxCt)} ct ${shapesLower} cut ${labOrNaturalSingular} ${subcategory.toLowerCase().replace('s', '')}`;
  } else {
    description = `Exquisite ${formatCt2(caratRange?.minCt || 0)} ct ${shapesLower} cut ${labOrNaturalSingular} ${subcategory.toLowerCase().replace('s', '')}`;
  }
  
  // Add metal information if available
  if (metals && metals.length > 0) {
    const metalStr = metals.length === 1 ? metals[0] : `${metals[0]} and ${metals[metals.length - 1]}`;
    description += ` crafted in premium ${metalStr}`;
  }
  
  // Add center stone details if available
  if (centerCtRange && centerCtRange.minCt > 0) {
    if (centerCtRange.minCt === centerCtRange.maxCt) {
      description += ` featuring a beautiful ${formatCt2(centerCtRange.minCt)} ct center stone`;
    } else {
      description += ` featuring beautiful center stones ranging from ${formatCt2(centerCtRange.minCt)} to ${formatCt2(centerCtRange.maxCt)} ct`;
    }
  } else if (centerCt && centerCt > 0) {
    description += ` featuring a beautiful ${formatCt2(centerCt)} ct center stone`;
  }
  
  description += `. Expertly handcrafted by PrimeStyle artisans for exceptional brilliance, lasting beauty, and timeless elegance.`;
  
  // Remove double spaces
  description = description.replace(/\s+/g, ' ');
  
  // Ensure within character limit
  // if (description.length > charLimit) {
  //   description = description.substring(0, charLimit - 3) + '...';
  // }
  
  return description;
}

/**
 * Build SEO Description for variant row (one sentence, 150-160 chars)
 */
export function buildSeoDescriptionVariant(item: {
  type: 'lab' | 'natural' | 'no-stones';
  subcategory: string;
  totalCt: number;
  shapes: string[];
  metal: string;
  quality?: string;
  centerCt?: number;
  rowIndex?: number;
}, charLimit: number = 200): string {
  const { type, subcategory, totalCt, shapes, metal, quality, centerCt, rowIndex = 0 } = item;
  
  if (type === 'no-stones') {
    const description = `Celebrate your moment with a ${formatCt2(totalCt)}mm ${subcategory.toLowerCase()} in ${metal}. Handcrafted by PrimeStyle for lasting brilliance.`;
    return description.length > charLimit ? description.substring(0, charLimit - 3) + '...' : description;
  }
  
  // Stones variant: use enhanced template format with center stone info
  const ct = `${formatCt2(totalCt)} ct `;
  const cut = shapes.length > 0 ? `${shapes[0].toLowerCase()} cut ` : '';
  const lab = type === 'lab' ? 'lab-grown ' : 'natural ';
  const ring = subcategory.toLowerCase().replace('s', '');
  const metalPart = ` in ${normalizeMetal(metal)}`;
  
  // Add center stone information if available
  const centerPart = centerCt && centerCt > 0 ? ` featuring a beautiful ${formatCt2(centerCt)} ct center stone` : '';
  
  // Template array - 15 longer, more descriptive versions with center stone info
  const templates = [
    `Exquisite and sophisticated, this stunning ${ct}${cut}${lab}${ring}${metalPart}${centerPart}. Expertly crafted by PrimeStyle artisans for exceptional brilliance and lasting beauty.`,
    `Celebrate your most precious moments with this magnificent ${ct}${cut}${lab}${ring}${metalPart}${centerPart}. Ethically sourced and conflict-free, offering luxury at accessible prices.`,
    `Discover the perfect blend of elegance and affordability with this ${ct}${cut}${lab}${ring}${metalPart}${centerPart}. Premium quality craftsmanship that exceeds expectations without breaking the bank.`,
    `Make your commitment official with this breathtaking ${ct}${cut}${lab}${ring}${metalPart}${centerPart}. Handcrafted perfection that symbolizes your unique love story.`,
    `A timeless masterpiece: this ${ct}${cut}${lab}${ring}${metalPart}${centerPart}. Designed for daily elegance with PrimeStyle's signature attention to detail and lifetime support.`,
    `Embrace luxury and sophistication with this extraordinary ${ct}${cut}${lab}${ring}${metalPart}${centerPart}. Meticulously crafted for those who appreciate the finest things in life.`,
    `Transform your special day with this captivating ${ct}${cut}${lab}${ring}${metalPart}${centerPart}. Every facet reflects PrimeStyle's commitment to excellence and beauty.`,
    `Experience the perfect harmony of tradition and innovation with this ${ct}${cut}${lab}${ring}${metalPart}${centerPart}. A testament to PrimeStyle's legacy of exceptional craftsmanship.`,
    `Indulge in the ultimate expression of love with this ${ct}${cut}${lab}${ring}${metalPart}${centerPart}. Each detail carefully considered for maximum impact and lasting memories.`,
    `Unlock the door to everlasting romance with this ${ct}${cut}${lab}${ring}${metalPart}${centerPart}. PrimeStyle's dedication to perfection shines through in every aspect.`,
    `Step into a world of refined elegance with this ${ct}${cut}${lab}${ring}${metalPart}${centerPart}. A celebration of life's most precious moments, crafted with love.`,
    `Revel in the artistry of this magnificent ${ct}${cut}${lab}${ring}${metalPart}${centerPart}. PrimeStyle's master artisans have created something truly extraordinary.`,
    `Capture the essence of timeless beauty with this ${ct}${cut}${lab}${ring}${metalPart}${centerPart}. Every glance reveals new depths of sophistication and charm.`,
    `Immerse yourself in luxury with this exceptional ${ct}${cut}${lab}${ring}${metalPart}${centerPart}. PrimeStyle's commitment to quality ensures a lifetime of admiration.`,
    `Discover the perfect symbol of your devotion in this ${ct}${cut}${lab}${ring}${metalPart}${centerPart}. Crafted with passion and precision for the most discerning tastes.`,
    `Elevate your style with this remarkable ${ct}${cut}${lab}${ring}${metalPart}${centerPart}. A true testament to PrimeStyle's unwavering standards of excellence.`
  ];
  
  // Select template based on row index for consistency
  const templateIndex = rowIndex % templates.length;
  const description = templates[templateIndex];
  
  // Remove double spaces
  const cleanDescription = description.replace(/\s+/g, ' ');
  
  // Ensure within character limit
  // if (cleanDescription.length > charLimit) {
  //   return cleanDescription.substring(0, charLimit - 3) + '...';
  // }
  
  return cleanDescription;
}

/**
 * Build Image Alt text for variant (≤ 120 chars)
 */
export function buildImageAltVariant(item: {
  type: 'lab' | 'natural' | 'no-stones';
  subcategory: string;
  totalCt: number;
  shapes: string[];
  metal: string;
  centerCt?: number;
}, charLimit: number = 120): string {
  const { type, subcategory, totalCt, shapes, metal, centerCt } = item;
  
  if (type === 'no-stones') {
    // No-stones alt: "{widthMm} mm {subcategory} in {metalLower}"
    const normalizedMetal = normalizeMetal(metal);
    return `${formatCt2(totalCt)} mm ${subcategory.toLowerCase()} in ${normalizedMetal}`;
  }
  
  // Stones variant: "{totalCt} carat {shapesLower} cut {labOrNaturalSingular} {subcategory} in {metalLower}[ with {centerCt} carat center]"
  const shapesLower = titleJoinShapes(shapes).toLowerCase();
  const labOrNaturalSingular = type === 'lab' ? 'lab-grown diamond' : 'natural diamond';
  const normalizedMetal = normalizeMetal(metal);
  
  let alt = `${formatCt2(totalCt)} carat ${shapesLower} cut ${labOrNaturalSingular} ${subcategory.toLowerCase().replace('s', '')} in ${normalizedMetal}`;
  
  // Include center phrase only if centerCt exists
  if (centerCt) {
    alt += ` with ${formatCt2(centerCt)} carat center`;
  }
  
  // Remove double spaces
  alt = alt.replace(/\s+/g, ' ');
  
  // Ensure within character limit
  if (alt.length > charLimit) {
    alt = alt.substring(0, charLimit - 3) + '...';
  }
  
  return alt;
}

/**
 * Build Image Alt text for parent (≤ 120 chars)
 */
export function buildImageAltParent(item: {
  type: 'lab' | 'natural' | 'no-stones';
  subcategory: string;
  caratRange?: { minCt: number; maxCt: number };
  shapes: string[];
  widthMm?: number;
}, charLimit: number = 120): string {
  const { type, subcategory, caratRange, shapes, widthMm } = item;
  
  if (type === 'no-stones') {
    // No-stones parent alt: "{widthMm} mm {subcategory}"
    if (widthMm) {
      return `${widthMm.toFixed(1)} mm ${subcategory.toLowerCase()}`;
    }
    return subcategory.toLowerCase();
  }
  
  // Stones parent: "{minCt}-{maxCt} carat {shapesLower} cut {labOrNaturalSingular} {subcategory}"
  const shapesLower = titleJoinShapes(shapes).toLowerCase();
  const labOrNaturalSingular = type === 'lab' ? 'lab-grown diamond' : 'natural diamond';
  
  let alt = '';
  if (caratRange && caratRange.minCt !== caratRange.maxCt) {
    alt = `${formatCt2(caratRange.minCt)}-${formatCt2(caratRange.maxCt)} carat ${shapesLower} cut ${labOrNaturalSingular} ${subcategory.toLowerCase().replace('s', '')}`;
  } else {
    alt = `${formatCt2(caratRange?.minCt || 0)} carat ${shapesLower} cut ${labOrNaturalSingular} ${subcategory.toLowerCase().replace('s', '')}`;
  }
  
  // Remove double spaces
  alt = alt.replace(/\s+/g, ' ');
  
  // Ensure within character limit
  if (alt.length > charLimit) {
    alt = alt.substring(0, charLimit - 3) + '...';
  }
  
  return alt;
}

/**
 * Build Title for variant row (duplicate field) - uses variant-specific data
 */
export function buildTitleDuplicate(variant: VariantSeed, diamondType: 'Natural' | 'LabGrown' | 'NoStones'): string {
  const inputRow = variant.inputRowRef;
  
  if (diamondType === 'NoStones') {
    const width = toNum(inputRow['Unique Charcteristic/ Width for plain wedding bands'] || '0');
    const subcategory = trimAll(inputRow['Subcategory'] || 'Jewelry');
    
    if (width > 0) {
      return `${width.toFixed(1)} mm - ${subcategory} - in 14KT, 18KT & Platinum`;
    } else {
      return `${subcategory} - in 14KT, 18KT & Platinum`;
    }
  }
  
  // Get carat weight for this specific variant
  let totalCt: number;
  if (variant.scenario === 'Unique+Center' && variant.centerSize) {
    // For center variants, use center size + sum of side stones
    const centerCt = toNum(variant.centerSize);
    const sumSideCt = toNum(inputRow['Sum Side Ct'] || '0');
    totalCt = centerCt + sumSideCt;
  } else {
    // For other scenarios, use the total carat weight from input
    totalCt = toNum(inputRow['Total Ct Weight'] || '0');
  }
  
  // Get shapes for this specific variant
  const shapes = new Set<string>();
  
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
  
  const shapesStr = Array.from(shapes).sort().map(shape => 
    shape.charAt(0).toUpperCase() + shape.slice(1).toLowerCase()
  ).join(' & ');
  
  // Get subcategory
  const subcategory = trimAll(inputRow['Subcategory'] || 'Jewelry');
  
  // Build title following same rules as buildTitle
  if (diamondType === 'Natural') {
    // NATURAL: include "Natural Diamonds" (capital D)
    return `${totalCt.toFixed(2)} CT ${shapesStr} Cut Natural Diamonds - ${subcategory}`;
  } else {
    // LAB-GROWN: DO NOT include "Lab-Grown" in Title, but capitalize "Diamonds"
    return `${totalCt.toFixed(2)} CT ${shapesStr} Cut Diamonds - ${subcategory}`;
  }
}

/**
 * Build HTML body for variant row (duplicate field) - uses variant-specific data
 */
export function buildBodyDuplicate(variant: VariantSeed, diamondType: 'Natural' | 'LabGrown' | 'NoStones'): string {
  const inputRow = variant.inputRowRef;
  
  if (diamondType === 'NoStones') {
    const width = toNum(inputRow['Unique Charcteristic/ Width for plain wedding bands'] || '0');
    const subcategory = trimAll(inputRow['Subcategory'] || 'Jewelry');
    
    if (width > 0) {
      return `<div><p><strong>${width.toFixed(1)} mm - ${subcategory} - in 14KT, 18KT & Platinum</strong></p><p>Expertly crafted jewelry piece from Primestyle.com. Made with precision and attention to detail.</p><p>Perfect for everyday wear or special occasions.</p><p><strong>${width.toFixed(1)} mm ${subcategory} in 14KT, 18KT, and Platinum</strong></p><p>Reward yourself with our ${width.toFixed(1)} mm ${subcategory.toLowerCase()} in 14KT, 18KT, and Platinum.</p><p>Select your choice of precious metal between 14 Karat, 18 Karat Yellow, White and Rose Gold, or Platinum.</p><p>At Primestyle.com, we deal ONLY with 100% real, natural, and conflict-free diamonds. Our diamonds are NOT enhanced nor treated.</p><p>Shine with chic with Primestyle diamonds ${subcategory.toLowerCase()}.</p></div>`;
    } else {
      return `<div><p><strong>${subcategory} - in 14KT, 18KT & Platinum</strong></p><p>Expertly crafted jewelry piece from Primestyle.com. Made with precision and attention to detail.</p><p>Select your choice of precious metal between 14 Karat, 18 Karat Yellow, White and Rose Gold, or Platinum.</p><p>At Primestyle.com, we deal ONLY with 100% real, natural, and conflict-free diamonds. Our diamonds are NOT enhanced nor treated.</p><p>Perfect for everyday wear or special occasions.</p></div>`;
    }
  }
  
  // Get title for first line (EXACT Title, no repetition)
  const title = buildTitleDuplicate(variant, diamondType);
  
  // Get type qualifier for body text
  const typeQualifier = bodyTypeQualifier(diamondType === 'Natural' ? 'natural' : 'lab');
  
  // Check if this variant has a center stone
  const hasCenter = variant.centerSize && toNum(variant.centerSize) > 0;
  
  // Get carat weight and shapes for this specific variant (needed for templates)
  let totalCt: number;
  if (variant.scenario === 'Unique+Center' && variant.centerSize) {
    // For center variants, use center size + sum of side stones
    const centerCt = toNum(variant.centerSize);
    const sumSideCt = toNum(inputRow['Sum Side Ct'] || '0');
    totalCt = centerCt + sumSideCt;
  } else {
    // For other scenarios, use the total carat weight from input
    totalCt = toNum(inputRow['Total Ct Weight'] || '0');
  }
  
  // Get shapes for this specific variant
  const shapes = new Set<string>();
  
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
  
  let body = `<div><p><strong>${title}</strong></p><p>`;
  
  if (hasCenter) {
    // HAS CENTER: Center line + side stone lines in single paragraph
    body += `<strong>Center:</strong> Select center from the options above<br>`;
    
    // List side stones as separate lines in same paragraph
    const sideStoneGroups = listSideStoneGroups([variant], typeQualifier);
    sideStoneGroups.forEach((group, index) => {
      body += `<strong>Side Stones ${index + 1}:</strong> ${group}<br>`;
    });
  } else {
    // REPEATING-CORE TYPE: List this specific variant's core weight
    const shapesStr = Array.from(shapes).sort().map(shape => 
      shape.charAt(0).toUpperCase() + shape.slice(1).toLowerCase()
    ).join(' & ');
    
    // For bracelets, pendants, and similar items, get the stone count
    let stoneCount = 1; // Default for single stone items
    
    if (isBraceletOrPendant([variant])) {
      stoneCount = calculateTotalStoneCount([variant]);
    }
    
    // Use actual stone count, but ensure we don't say "one round cut" unless truly single
    const stoneCountText = stoneCount === 1 ? "1" : stoneCount.toString();
    body += `<strong>${totalCt.toFixed(2)} Carat:</strong> <span>${stoneCountText} ${shapesStr.toLowerCase()} cut ${typeQualifier} diamonds weighing ${totalCt.toFixed(2)} Carat</span><br>`;
  }
  
  body += `</p>`;
  
  // Add extra paragraph with 15 unique, engaging product description templates
  const descriptionTemplates = [
    `This ${totalCt.toFixed(2)} ct ${Array.from(shapes).sort().join(' & ')} Cut ${diamondType === 'Natural' ? 'Natural' : 'Lab Grown'} diamonds in ${getMetalOptions([variant])}${hasCenter ? ` with a beautiful center stone` : ''} showcases PrimeStyle's commitment to exceptional craftsmanship. The ${diamondType === 'Natural' ? 'natural' : 'lab-grown'} diamonds are carefully selected for their brilliance, while the premium metal setting ensures durability and timeless elegance. Perfect for marking life's most precious moments, this piece represents the perfect balance of luxury and accessibility.`,
    `Discover the perfect blend of sophistication and value in this ${totalCt.toFixed(2)} ct ${Array.from(shapes).sort().join(' & ')} Cut ${diamondType === 'Natural' ? 'Natural' : 'Lab Grown'} diamonds${hasCenter ? ` featuring a stunning center stone` : ''}. Set in premium ${getMetalOptions([variant]).toLowerCase()}, every facet reflects PrimeStyle's dedication to quality. The ${diamondType === 'Natural' ? 'natural' : 'lab-grown'} diamonds offer stunning sparkle, making this piece ideal for both everyday wear and special occasions. A testament to affordable luxury.`,
    `Handcrafted with precision, this ${totalCt.toFixed(2)} ct ${Array.from(shapes).sort().join(' & ')} Cut ${diamondType === 'Natural' ? 'Natural' : 'Lab Grown'} diamonds${hasCenter ? ` with an exquisite center stone` : ''} in ${getMetalOptions([variant]).toLowerCase()} embodies PrimeStyle's legacy of excellence. The ${diamondType === 'Natural' ? 'natural' : 'lab-grown'} diamonds are ethically sourced and expertly cut for maximum brilliance. Whether you're celebrating love or treating yourself, this piece delivers exceptional beauty without compromising on quality or price.`,
    `Elevate your jewelry collection with this stunning ${totalCt.toFixed(2)} ct ${Array.from(shapes).sort().join(' & ')} Cut ${diamondType === 'Natural' ? 'Natural' : 'Lab Grown'} diamonds${hasCenter ? ` featuring a magnificent center stone` : ''}. The ${getMetalOptions([variant]).toLowerCase()} setting provides the perfect backdrop for the ${diamondType === 'Natural' ? 'natural' : 'lab-grown'} diamonds to shine. PrimeStyle's master artisans have created a piece that balances elegance with practicality, making it perfect for both formal events and daily wear.`,
    `Experience luxury redefined with this ${totalCt.toFixed(2)} ct ${Array.from(shapes).sort().join(' & ')} Cut ${diamondType === 'Natural' ? 'Natural' : 'Lab Grown'} diamonds${hasCenter ? ` with a breathtaking center stone` : ''} in ${getMetalOptions([variant]).toLowerCase()}. Every detail reflects PrimeStyle's unwavering standards, from the carefully selected ${diamondType === 'Natural' ? 'natural' : 'lab-grown'} diamonds to the precision-crafted setting. This piece offers the perfect combination of beauty, durability, and value for the discerning jewelry lover.`,
    `Transform your style with this magnificent ${totalCt.toFixed(2)} ct ${Array.from(shapes).sort().join(' & ')} Cut ${diamondType === 'Natural' ? 'Natural' : 'Lab Grown'} diamonds${hasCenter ? ` featuring an extraordinary center stone` : ''}. Set in ${getMetalOptions([variant]).toLowerCase()}, the ${diamondType === 'Natural' ? 'natural' : 'lab-grown'} diamonds create a dazzling display of light and brilliance. PrimeStyle's commitment to quality craftsmanship ensures this piece will become a cherished part of your jewelry collection for years to come.`,
    `Indulge in the artistry of this ${totalCt.toFixed(2)} ct ${Array.from(shapes).sort().join(' & ')} Cut ${diamondType === 'Natural' ? 'Natural' : 'Lab Grown'} diamonds${hasCenter ? ` with a captivating center stone` : ''}. The ${getMetalOptions([variant]).toLowerCase()} setting enhances the natural beauty of the ${diamondType === 'Natural' ? 'natural' : 'lab-grown'} diamonds, creating a piece that's both sophisticated and wearable. PrimeStyle's attention to detail makes this jewelry perfect for those who appreciate fine craftsmanship without the premium price tag.`,
    `Celebrate your unique story with this ${totalCt.toFixed(2)} ct ${Array.from(shapes).sort().join(' & ')} Cut ${diamondType === 'Natural' ? 'Natural' : 'Lab Grown'} diamonds${hasCenter ? ` featuring a remarkable center stone` : ''} in ${getMetalOptions([variant]).toLowerCase()}. The ${diamondType === 'Natural' ? 'natural' : 'lab-grown'} diamonds are expertly cut to maximize their natural sparkle, while the setting ensures comfort and durability. PrimeStyle delivers exceptional quality that makes every day feel special.`,
    `Unlock the door to timeless elegance with this ${totalCt.toFixed(2)} ct ${Array.from(shapes).sort().join(' & ')} Cut ${diamondType === 'Natural' ? 'Natural' : 'Lab Grown'} diamonds${hasCenter ? ` with a stunning center stone` : ''}. Crafted in ${getMetalOptions([variant]).toLowerCase()}, the ${diamondType === 'Natural' ? 'natural' : 'lab-grown'} diamonds offer stunning brilliance that catches the eye from every angle. PrimeStyle's dedication to excellence makes this piece a smart investment in both beauty and quality.`,
    `Step into sophistication with this ${totalCt.toFixed(2)} ct ${Array.from(shapes).sort().join(' & ')} Cut ${diamondType === 'Natural' ? 'Natural' : 'Lab Grown'} diamonds${hasCenter ? ` featuring a beautiful center stone` : ''}. The ${getMetalOptions([variant]).toLowerCase()} setting provides the perfect foundation for the ${diamondType === 'Natural' ? 'natural' : 'lab-grown'} diamonds to showcase their natural beauty. PrimeStyle's commitment to affordable luxury means you can enjoy exceptional craftsmanship without the designer price tag.`,
    `Revel in the beauty of this ${totalCt.toFixed(2)} ct ${Array.from(shapes).sort().join(' & ')} Cut ${diamondType === 'Natural' ? 'Natural' : 'Lab Grown'} diamonds${hasCenter ? ` with an exceptional center stone` : ''}. Set in ${getMetalOptions([variant]).toLowerCase()}, the ${diamondType === 'Natural' ? 'natural' : 'lab-grown'} diamonds create a mesmerizing display of light and elegance. PrimeStyle's master craftsmen ensure every detail meets the highest standards, making this piece perfect for those who demand excellence.`,
    `Capture the essence of refined luxury with this ${totalCt.toFixed(2)} ct ${Array.from(shapes).sort().join(' & ')} Cut ${diamondType === 'Natural' ? 'Natural' : 'Lab Grown'} diamonds${hasCenter ? ` with a magnificent center stone` : ''}. The ${getMetalOptions([variant]).toLowerCase()} setting enhances the natural brilliance of the ${diamondType === 'Natural' ? 'natural' : 'lab-grown'} diamonds, creating a piece that's both stunning and practical. PrimeStyle delivers the perfect balance of beauty, quality, and affordability.`,
    `Immerse yourself in the world of fine jewelry with this ${totalCt.toFixed(2)} ct ${Array.from(shapes).sort().join(' & ')} Cut ${diamondType === 'Natural' ? 'Natural' : 'Lab Grown'} diamonds${hasCenter ? ` featuring a breathtaking center stone` : ''}. Crafted in ${getMetalOptions([variant]).toLowerCase()}, the ${diamondType === 'Natural' ? 'natural' : 'lab-grown'} diamonds offer exceptional sparkle that never fails to impress. PrimeStyle's dedication to quality ensures this piece will become a treasured part of your collection.`,
    `Discover the perfect expression of your style with this ${totalCt.toFixed(2)} ct ${Array.from(shapes).sort().join(' & ')} Cut ${diamondType === 'Natural' ? 'Natural' : 'Lab Grown'} diamonds${hasCenter ? ` with a captivating center stone` : ''}. The ${getMetalOptions([variant]).toLowerCase()} setting provides the ideal backdrop for the ${diamondType === 'Natural' ? 'natural' : 'lab-grown'} diamonds to shine. PrimeStyle's commitment to excellence means you can enjoy luxury craftsmanship at a price that makes sense.`,
    `Embrace the art of fine jewelry with this ${totalCt.toFixed(2)} ct ${Array.from(shapes).sort().join(' & ')} Cut ${diamondType === 'Natural' ? 'Natural' : 'Lab Grown'} diamonds${hasCenter ? ` featuring an extraordinary center stone` : ''}. Set in ${getMetalOptions([variant]).toLowerCase()}, the ${diamondType === 'Natural' ? 'natural' : 'lab-grown'} diamonds create a captivating display of elegance and sophistication. PrimeStyle's attention to detail ensures this piece offers exceptional value for the discerning jewelry enthusiast.`
  ];
  
  // Select template based on variant hash for consistency
  const templateIndex = Math.abs(hashCode(JSON.stringify(variant))) % descriptionTemplates.length;
  const selectedDescription = descriptionTemplates[templateIndex];
  
  body += `<p>${selectedDescription}</p></div>`;
  return body;
}
