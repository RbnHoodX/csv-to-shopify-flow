import { trimAll, toFixed2, toCt2 } from './csv-parser';
import type { VariantSeed } from './variant-expansion';
import { METAL_TRANSLATIONS, QUALITY_TRANSLATIONS } from './shopify-generator';

/**
 * Collect unique shapes from input row
 */
function collectShapes(inputRow: any): string[] {
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
    shapes.add(centerShape.charAt(0).toUpperCase() + centerShape.slice(1).toLowerCase());
  }

  // Add side shapes (may be comma-separated)
  const sideShapes = trimAll(
    inputRow['Side shapes'] ||
    inputRow['Side shape'] ||
    inputRow['Side Shapes'] ||
    inputRow['Side Shape'] ||
    inputRow['SideShapes'] ||
    inputRow['SideShape'] ||
    ''
  );

  if (sideShapes) {
    const shapeList = sideShapes.split(',').map((s: string) => trimAll(s)).filter((s: string) => s);
    shapeList.forEach((shape: string) => {
      if (shape) {
        shapes.add(shape.charAt(0).toUpperCase() + shape.slice(1).toLowerCase());
      }
    });
  }

  return Array.from(shapes).sort();
}

/**
 * Get diamond type text
 */
function getDiamondTypeText(diamondsType: string): string {
  const type = trimAll(diamondsType).toLowerCase();
  if (type.includes('natural')) return 'NATURAL';
  if (type.includes('labgrown') || type.includes('lab-grown')) return 'LABGROWN';
  if (type.includes('no stones') || type.includes('nostones')) return 'NO STONES';
  return 'DIAMONDS';
}

/**
 * Get subcategory text
 */
function getSubcategoryText(inputRow: any): string {
  return trimAll(
    inputRow['Subcategory'] ||
    inputRow['Sub Category'] ||
    inputRow['Category'] ||
    'Jewelry'
  );
}

/**
 * Generate SEO Title for a variant
 * Format: "X.XX CT [Shapes] Diamonds [Subcategory] [Metal]"
 * Example: "1.55 CT Princess & Round Diamonds Engagement Rings 14KT White Gold"
 */
export function generateSEOTitle(
  variant: VariantSeed,
  totalCarats: number,
  sku: string
): string {
  const metalName = METAL_TRANSLATIONS[variant.metalCode] || variant.metalCode;
  const subcategory = getSubcategoryText(variant.inputRowRef);
  const shapes = collectShapes(variant.inputRowRef);
  const shapesText = shapes.length > 0 ? shapes.join(' & ') : 'Mixed';
  const diamondType = getDiamondTypeText(variant.inputRowRef.diamondsType);

  if (variant.scenario === 'NoStones') {
    return `${toCt2(totalCarats)} CT ${subcategory} ${metalName}`;
  }

  return `${toCt2(totalCarats)} CT ${shapesText} ${diamondType} ${subcategory} ${metalName}`;
}

/**
 * Generate SEO Description for a variant
 * Format: "X.XXCT Total (X.XXCT Center) [Quality] [Shapes] - [Subcategory] [DiamondType] [Metal] SKU [SKU]"
 * Example: "1.55CT Total (0.50CT Center) F-G/VS (Excellent) Princess & Round - Engagement Rings LABGROWN 14KT White Gold SKU 15686LB-2"
 */
export function generateSEODescription(
  variant: VariantSeed,
  totalCarats: number,
  sku: string
): string {
  const metalName = METAL_TRANSLATIONS[variant.metalCode] || variant.metalCode;
  const subcategory = getSubcategoryText(variant.inputRowRef);
  const shapes = collectShapes(variant.inputRowRef);
  const shapesText = shapes.length > 0 ? shapes.join(' & ') : 'Mixed';
  const diamondType = getDiamondTypeText(variant.inputRowRef.diamondsType);
  const qualityText = QUALITY_TRANSLATIONS[variant.quality || ''] || variant.quality || 'Premium Quality';

  if (variant.scenario === 'NoStones') {
    return `${toCt2(totalCarats)}CT ${subcategory} ${metalName} SKU ${sku}`;
  }

  // For variants with center stone, include center carat info
  let centerInfo = '';
  if (variant.scenario === 'Unique+Center' && variant.centerSize) {
    const centerCarats = parseFloat(variant.centerSize);
    if (!isNaN(centerCarats)) {
      centerInfo = ` (${toFixed2(centerCarats)}CT Center)`;
    }
  }

  return `${toFixed2(totalCarats)}CT Total${centerInfo} ${qualityText} ${shapesText} - ${subcategory} ${diamondType} ${metalName} SKU ${sku}`;
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