import { trimAll, toNum, toFixed2 } from './csv-parser';
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

/**
 * Helper function to format carat weight (trim trailing zeros)
 */
function formatCt(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Helper function to format carat range with uppercase CT
 */
function formatCtRange(minCt: number, maxCt: number): string {
  if (minCt === maxCt) {
    return `${formatCt(minCt)} CT`;
  }
  return `${formatCt(minCt)}–${formatCt(maxCt)} CT`;
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
    case 'lab': return 'lab grown diamonds';
    case 'natural': return 'natural diamonds';
    case 'no-stones': return '';
    default: return '';
  }
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
  const shapesStr = joinShapes(shapes);
  
  // Get subcategory
  const subcategory = trimAll(inputRow['Subcategory'] || 'Jewelry');
  
  // Build title following new rules
  if (diamondType === 'Natural') {
    // NATURAL: include "Natural Diamonds"
    return `${caratRange} ${shapesStr} Cut Natural Diamonds - ${subcategory}`;
  } else {
    // LAB-GROWN: DO NOT include "Lab-Grown" in Title
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
  
  // Get title for first line
  const title = buildTitle(product);
  
  // Get type qualifier for body text
  const typeQualifier = bodyTypeQualifier(diamondType === 'Natural' ? 'natural' : 'lab');
  
  let body = `<div><p><strong>${title}</strong></p><p>`;
  
  if (hasCenter) {
    // HAS CENTER: Center line + side stone lines
    body += `<strong>Center:</strong> Select center from the options above<br>`;
    
    // List side stones as separate lines in same paragraph
    const sideStoneGroups = listSideStoneGroups(variants);
    sideStoneGroups.forEach((group, index) => {
      body += `<strong>Side Stones ${index + 1}:</strong> ${group}<br>`;
    });
  } else {
    // REPEATING-CORE TYPE: List all core weights ascending
    const coreWeights = listCoreWeightsAscending(variants);
    coreWeights.forEach((core, index) => {
      const shapes = getUniqueShapesOrdered([core.variant]);
      const shapesStr = joinShapes(shapes);
      body += `At least one ${shapesStr} Cut ${typeQualifier} weighing ${formatCt(core.totalCt)} carat.<br>`;
    });
  }
  
  body += `</p></div>`;
  return body;
}

/**
 * List side stone groups for variants with center stones
 */
function listSideStoneGroups(variants: VariantSeed[]): string[] {
  const groups: string[] = [];
  const firstVariant = variants[0];
  const inputRow = firstVariant.inputRowRef;
  
  // Check each side stone column
  for (let i = 1; i <= 10; i++) {
    const sideCt = toNum(inputRow[`Side ${i} Ct`] || '0');
    const sideShape = trimAll(inputRow[`Side ${i} shape`] || inputRow[`Side ${i} Shape`] || '');
    const sideType = trimAll(inputRow[`Side ${i} Type`] || inputRow[`Side ${i} type`] || 'diamond');
    
    if (sideCt > 0 && sideShape) {
      const shapeStr = sideShape.charAt(0).toUpperCase() + sideShape.slice(1).toLowerCase();
      const typeStr = sideType.charAt(0).toUpperCase() + sideType.slice(1).toLowerCase();
      groups.push(`${sideCt} ${shapeStr} Cut ${typeStr} weighing ${formatCt(sideCt)} carat`);
    }
  }
  
  return groups;
}

/**
 * List core weights in ascending order for repeating-core items
 */
function listCoreWeightsAscending(variants: VariantSeed[]): Array<{variant: VariantSeed, totalCt: number}> {
  return variants
    .map(variant => ({
      variant,
      totalCt: calculateTotalCaratWeight(variant)
    }))
    .sort((a, b) => a.totalCt - b.totalCt);
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
 * Build tags following new rules
 */
export function buildTags(product: Product): string {
  const { diamondType, variants } = product;
  const firstVariant = variants[0];
  const inputRow = firstVariant.inputRowRef;
  
  if (diamondType === 'NoStones') {
    // NO-STONES: width tag only, no shape or diamond tags
    const width = toNum(inputRow['Unique Charcteristic/ Width for plain wedding bands'] || '0');
    if (width > 0) {
      return `WIDTH_${width.toFixed(1)}`;
    }
    return '';
  }
  
  // Diamonds items: keep existing tag logic
  const tagParts: string[] = [];
  
  // Add category_subcategory as single tag
  const category = trimAll(inputRow['Category'] || 'Jewelry');
  const subcategory = trimAll(inputRow['Subcategory'] || 'Piece');
  tagParts.push(`${category}_${subcategory}`);
  
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
  coreNumber: string;
  shapes: string[];
  caratRange?: { minCt: number; maxCt: number };
}): string {
  const { type, subcategory, coreNumber, shapes, caratRange } = item;
  
  if (type === 'no-stones') {
    // No-stones parent: "<[width mm if available]> - <Subcategory> - <CoreNumber>"
    return `${subcategory} - ${coreNumber}`;
  }
  
  // Stones parent: "<[minCt–maxCt] CT> <Shapes> Cut <lab grown|natural> diamonds - <Subcategory> - <CoreNumber>"
  const shapesStr = joinShapes(shapes);
  const typeQualifier = bodyTypeQualifier(type);
  
  let title = '';
  if (caratRange && caratRange.minCt !== caratRange.maxCt) {
    title = `${formatCt(caratRange.minCt)}–${formatCt(caratRange.maxCt)} CT `;
  }
  title += `${shapesStr} Cut ${typeQualifier} diamonds - ${subcategory} - ${coreNumber}`;
  
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
}): string {
  const { type, subcategory, sku, totalCt, shapes, metal } = item;
  
  if (type === 'no-stones') {
    // No-stones variant: "<Subcategory> - <Metal> - <SKU>"
    return `${subcategory} - ${metal || ''} - ${sku}`;
  }
  
  // Stones variant: "<totalCt> CT <Shapes> Cut <lab grown|natural> diamonds - <Subcategory> - <SKU>"
  const shapesStr = joinShapes(shapes);
  const typeQualifier = bodyTypeQualifier(type);
  
  return `${formatCt(totalCt)} CT ${shapesStr} Cut ${typeQualifier} diamonds - ${subcategory} - ${sku}`;
}

/**
 * Build SEO Description for parent row (summary format)
 */
export function buildSeoDescriptionParent(item: {
  type: 'lab' | 'natural' | 'no-stones';
  subcategory: string;
  shapes: string[];
  caratRange?: { minCt: number; maxCt: number };
}, charLimit: number = 155): string {
  const { type, subcategory, shapes, caratRange } = item;
  
  if (type === 'no-stones') {
    return `Expertly crafted ${subcategory.toLowerCase()} from Primestyle.com. Premium metals with precision craftsmanship.`;
  }
  
  // Stones parent: brief range summary using minCt→maxCt, shapes, and type
  const shapesStr = joinShapes(shapes);
  const typeQualifier = bodyTypeQualifier(type);
  
  let description = '';
  if (caratRange && caratRange.minCt !== caratRange.maxCt) {
    description = `${formatCt(caratRange.minCt)} to ${formatCt(caratRange.maxCt)} carat `;
  }
  description += `${shapesStr.toLowerCase()} cut ${typeQualifier} diamond ${subcategory.toLowerCase()}. Premium quality with expert craftsmanship.`;
  
  // Ensure within character limit
  if (description.length > charLimit) {
    description = description.substring(0, charLimit - 3) + '...';
  }
  
  return description;
}

/**
 * Build SEO Description for variant row (LLM-ready format)
 */
export function buildSeoDescriptionVariant(item: {
  type: 'lab' | 'natural' | 'no-stones';
  subcategory: string;
  totalCt: number;
  shapes: string[];
  metal: string;
  quality: string;
}, charLimit: number = 155): {
  seoDescription: string;
  seoDescriptionPrompt: string;
} {
  const { type, subcategory, totalCt, shapes, metal, quality } = item;
  
  if (type === 'no-stones') {
    const description = `${formatCt(totalCt)}mm ${subcategory.toLowerCase()} in ${metal}. Expertly crafted jewelry with premium metals. Perfect for everyday wear.`;
    return {
      seoDescription: description,
      seoDescriptionPrompt: `Write a concise SEO meta description (<= ${charLimit} chars) for a ${subcategory}. Include: ${formatCt(totalCt)}mm width, ${metal} metal. Tone: elegant, factual, no fluff, no SKU, no price, sentence case.`
    };
  }
  
  // Stones variant: based on metal, totalCt, quality, shapes, type, subcategory
  const shapesStr = joinShapes(shapes);
  const typeQualifier = bodyTypeQualifier(type);
  
  const description = `${formatCt(totalCt)} carat ${shapesStr.toLowerCase()} cut ${typeQualifier} ${subcategory.toLowerCase()}. Metal: ${metal}. Quality: ${quality}. Premium ${typeQualifier} diamonds with expert craftsmanship.`;
  
  // Ensure within character limit
  let finalDescription = description;
  if (finalDescription.length > charLimit) {
    finalDescription = finalDescription.substring(0, charLimit - 3) + '...';
  }
  
  const prompt = `Write a concise SEO meta description (<= ${charLimit} chars) for a ${subcategory}. Include: ${formatCt(totalCt)} CT, ${shapesStr} cut, ${typeQualifier} diamonds, ${quality}, ${metal}. Tone: elegant, factual, no fluff, no SKU, no price, sentence case.`;
  
  return {
    seoDescription: finalDescription,
    seoDescriptionPrompt: prompt
  };
}

/**
 * Build Image Alt text prompt for variant (scaffold only)
 */
export function buildImageAltVariant(item: {
  type: 'lab' | 'natural' | 'no-stones';
  subcategory: string;
  totalCt: number;
  shapes: string[];
  metal: string;
  sku: string;
}, charLimit: number = 120): string {
  const { type, subcategory, totalCt, shapes, metal, sku } = item;
  
  if (type === 'no-stones') {
    return `Alt text (<=${charLimit} chars): ${formatCt(totalCt)}mm ${subcategory.toLowerCase()} in ${metal}, SKU ${sku}.`;
  }
  
  const shapesStr = joinShapes(shapes);
  const typeQualifier = bodyTypeQualifier(type);
  
  return `Alt text (<=${charLimit} chars): ${formatCt(totalCt)} CT ${shapesStr.toLowerCase()} cut ${typeQualifier} diamonds ${subcategory.toLowerCase()} in ${metal}, SKU ${sku}.`;
}
