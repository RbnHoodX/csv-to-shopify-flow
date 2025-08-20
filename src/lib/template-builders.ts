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
 * Build body content (parent-level only) - HTML format
 */
export function buildBody(product: Product): string {
  const { variants, diamondType, hasCenter, isRepeating } = product;
  const title = buildTitle(product);
  
  if (diamondType === 'NoStones') {
    // Special handling for no-stone items - match the exact sample format
    const { variants } = product;
    const inputRow = variants[0]?.inputRowRef;
    const width = inputRow?.['Unique Characteristics (width mm)'] || inputRow?.['Unique Charcteristic/ Width for plain wedding bands'];
    const subcategory = inputRow?.['Subcategory'] || 'Plain Wedding Bands';
    
    let html = '<div>';
    
    // Add title
    html += `<p><strong>${title}</strong></p>`;
    
    // Add main marketing paragraph (similar to diamond items but adapted for no-stones)
    html += `<p>Experience true luxury with our ${title}. This ${subcategory.toLowerCase()} is expertly crafted with precision and attention to detail. Select your choice of precious metal between 14 Karat, 18 Karat Yellow, White and Rose Gold, or Platinum. At Primestyle.com, we deal ONLY with 100% real, natural, and conflict-free diamonds. Our diamonds are NOT enhanced nor treated. Shine with uniqueness with Primestyle diamond ${subcategory.toLowerCase()}.</p>`;
    
    // Add subcategory section header
    html += `<p><strong>${subcategory} - Premium Rings</strong></p>`;
    
    // Add craftsmanship description
    html += `<p>Expertly crafted jewelry piece from Primestyle.com. Made with precision and attention to detail.</p>`;
    html += `<p>Perfect for everyday wear or special occasions.</p>`;
    
    // Add width-specific section if width is available
    if (width) {
      html += `<p><strong>${width} mm ${subcategory} in 14KT, 18KT &amp; Platinum</strong></p>`;
      html += `<p>Reward yourself with our ${width} mm ${subcategory.toLowerCase()} in 14KT, 18KT, and Platinum.</p>`;
      html += `<p>Select your choice of precious metal between 14 Karat, 18 Karat Yellow, White and Rose Gold, or Platinum.</p>`;
      html += `<p>At Primestyle.com, we deal ONLY with 100% real, natural, and conflict-free diamonds. Our diamonds are NOT enhanced nor treated.</p>`;
      html += `<p>Shine with chic with Primestyle diamonds ${subcategory.toLowerCase()}.</p>`;
    }
    
    html += '</div>';
    return html;
  }
  
  let html = '<div>';
  
  // Add title
  html += `<p><strong>${title}</strong></p>`;
  
  if (hasCenter && !isRepeating) {
    // Items WITH CENTER (both Natural and Lab-Grown)
    html += `<p><strong>Center:</strong> <span>Select center from the options above</span></p>`;
    
    const sideStoneGroups = listSideStoneGroups(variants);
    for (let i = 0; i < sideStoneGroups.length; i++) {
      const group = sideStoneGroups[i];
      // Extract the side stone details from the group text
      const match = group.match(/Side Stone \d+: (\d+) (.+?) Cut (.+?) weighing (.+?) carat/);
      if (match) {
        const [, quantity, shape, typeQualifier, weight] = match;
        html += `<p><strong>Side Stones ${i + 1}:</strong> <span>${quantity} ${shape.toLowerCase()} cut ${typeQualifier} weighing ${weight} carat</span></p>`;
      }
    }
  } else if (isRepeating) {
    // Repeating-core items WITHOUT CENTER
    const coreWeights = listCoreWeightsAscending(variants);
    for (const weightLine of coreWeights) {
      const match = weightLine.match(/At least one (.+?) Cut (.+?) weighing (.+?) carat/);
      if (match) {
        const [, shape, typeQualifier, weight] = match;
        html += `<p><strong>${weight}:</strong> <span>${shape.toLowerCase()} cut ${typeQualifier} weighing ${weight} carat</span></p>`;
      }
    }
  }
  
  // Add marketing copy
  html += generateMarketingCopy(product);
  
  html += '</div>';
  
  return html;
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
  const typeQualifier = diamondType === 'Natural' ? 'natural' : 'lab grown';
  html += `<p><span>Experience a true luxury with our ${caratRange} ${shapesStr} Cut ${typeQualifier} ${stoneTypes} – ${subcategory}. This ${subcategory} crafted with ${caratRange} ${typeQualifier} ${stoneTypes}. Select your choice of precious metal between 14 Karat, 18 Karat Yellow, White and Rose Gold OR Platinum. Shine with uniqueness with Primestyle diamond ${subcategory}.</span></p>`;
  
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
