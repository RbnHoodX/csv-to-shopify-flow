import { trimAll, toFixed2, toCt2 } from './csv-parser';
import type { VariantSeed } from './variant-expansion';
import { METAL_TRANSLATIONS } from './shopify-generator';

/**
 * Generate SEO Title for a variant
 * Format: "X.XX CT [Metal] - [Subcategory]"
 * Example: "1.50 CT White Gold - Engagement Rings"
 */
export function generateSEOTitle(
  variant: VariantSeed,
  totalCarats: number,
  sku: string
): string {
  const metalName = METAL_TRANSLATIONS[variant.metalCode] || variant.metalCode;
  const subcategory = trimAll(
    variant.inputRowRef['Subcategory'] ||
    variant.inputRowRef['Sub Category'] ||
    variant.inputRowRef['Category'] ||
    'Jewelry'
  );

  return `${toCt2(totalCarats)} CT ${metalName} - ${subcategory}`;
}

/**
 * Generate SEO Description for a variant
 * Include: total carat, quality, subcategory, diamond type, metal, and SKU
 */
export function generateSEODescription(
  variant: VariantSeed,
  totalCarats: number,
  sku: string
): string {
  const metalName = METAL_TRANSLATIONS[variant.metalCode] || variant.metalCode;
  const subcategory = trimAll(
    variant.inputRowRef['Subcategory'] ||
    variant.inputRowRef['Sub Category'] ||
    variant.inputRowRef['Category'] ||
    'jewelry'
  );
  
  const diamondType = variant.inputRowRef.diamondsType?.toLowerCase().includes('natural') 
    ? 'natural diamonds'
    : variant.inputRowRef.diamondsType?.toLowerCase().includes('labgrown') 
    ? 'lab grown diamonds'
    : 'diamonds';

  const qualityCode = variant.qualityCode || 'premium quality';
  
  if (variant.scenario === 'NoStones') {
    return `Shop this stunning ${metalName} ${subcategory.toLowerCase()} crafted with premium materials and exceptional attention to detail. SKU: ${sku}. Perfect for any special occasion.`;
  }

  return `Beautiful ${toCt2(totalCarats)} carat ${qualityCode} ${diamondType} ${subcategory.toLowerCase()} in ${metalName}. Expertly crafted with premium materials and exceptional attention to detail. SKU: ${sku}. Perfect for engagements, anniversaries, or any special occasion.`;
}

/**
 * Get Google Shopping MPN (Manufacturer Part Number)
 * Simply use the Variant SKU
 */
export function getGoogleShoppingMPN(sku: string): string {
  return sku;
}

/**
 * Generate comprehensive SEO data for a variant
 */
export function generateSEOData(
  variant: VariantSeed,
  totalCarats: number,
  sku: string,
  isParent: boolean
): {
  seoTitle: string;
  seoDescription: string;
  googleMPN: string;
} {
  // Generate SEO data for all rows
  return {
    seoTitle: generateSEOTitle(variant, totalCarats, sku),
    seoDescription: generateSEODescription(variant, totalCarats, sku),
    googleMPN: sku
  };
}