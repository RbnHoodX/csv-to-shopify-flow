/**
 * Pure helper functions for translations and formatting
 */

import { trimAll, toNum, toFixed2 } from '@/lib/csv-parser';
import type { VariantSeed } from '@/types/core';

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

/**
 * Translate metal code to full metal name
 */
export function translateMetal(metalCode: string): string {
  return METAL_TRANSLATIONS[metalCode] || metalCode;
}

/**
 * Translate quality code to full quality label
 */
export function translateQuality(qualityCode: string): string {
  return QUALITY_TRANSLATIONS[qualityCode] || qualityCode;
}

/**
 * Format carat string
 */
export function formatCaratString(totalCarat: number, centerCarat?: number): string {
  if (centerCarat && centerCarat > 0) {
    return `${totalCarat.toFixed(2)}CT Total (${centerCarat.toFixed(2)}CT Center)`;
  }
  return `${totalCarat.toFixed(2)}CT Total`;
}

/**
 * Calculate total carat weight for a variant
 */
export function calculateTotalCaratWeight(variant: VariantSeed): number {
  if (variant.scenario === 'Unique+Center' && variant.centerSize) {
    const sideCt = toNum(
      variant.inputRowRef['Sum Side Ct'] ||
      variant.inputRowRef['Side ct'] ||
      variant.inputRowRef['Side Ct'] ||
      variant.inputRowRef['SideCt'] ||
      variant.inputRowRef['Side Carat'] ||
      '0'
    );
    const centerCt = toNum(variant.centerSize);
    return sideCt + centerCt;
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
 * Calculate total carat string for display
 */
export function calculateTotalCaratString(variant: VariantSeed): string {
  if (variant.scenario === 'Unique+Center' && variant.centerSize) {
    const sideCt = toNum(
      variant.inputRowRef['Sum Side Ct'] ||
      variant.inputRowRef['Side ct'] ||
      variant.inputRowRef['Side Ct'] ||
      variant.inputRowRef['SideCt'] ||
      variant.inputRowRef['Side Carat'] ||
      '0'
    );
    const centerCt = toNum(variant.centerSize);
    const total = sideCt + centerCt;
    return formatCaratString(total, centerCt);
  } else {
    const totalCt = calculateTotalCaratWeight(variant);
    return formatCaratString(totalCt);
  }
}

/**
 * Collect unique shapes from variants
 */
export function collectShapes(variants: VariantSeed[]): string[] {
  const shapes = new Set<string>();
  
  for (const variant of variants) {
    // Add center shape if present
    if (variant.inputRowRef['Center shape']) {
      shapes.add(trimAll(variant.inputRowRef['Center shape']));
    }
    
    // Add side shapes (may be comma-separated)
    const sideShapes = variant.inputRowRef['Side shapes'] || variant.inputRowRef['Side shape'] || '';
    if (sideShapes) {
      const shapeList = sideShapes.split(',').map((s: string) => trimAll(s)).filter((s: string) => s);
      shapeList.forEach((shape: string) => shapes.add(shape));
    }
  }
  
  return Array.from(shapes).sort();
}

/**
 * Generate SKU with running index
 */
export function generateSKUWithRunningIndex(core: string, variants: VariantSeed[], index: number): string {
  const base = core.replace(/[^A-Za-z0-9]/g, '');
  const runningIndex = index + 2; // Start at 2 per spec
  return `${base}-${runningIndex.toString().padStart(3, '0')}`;
}

/**
 * Format money value to 2 decimals
 */
export function formatMoney(value: number): string {
  return toFixed2(value);
}

/**
 * Format boolean for Shopify
 */
export function formatBoolean(value: boolean): string {
  return value ? 'TRUE' : 'FALSE';
}

/**
 * Generate Google Product Category from type
 */
export function generateGoogleCategory(category: string): string {
  const cat = category.toLowerCase();
  
  if (cat.includes('ring')) {
    return 'Apparel & Accessories > Jewelry > Rings';
  } else if (cat.includes('bracelet')) {
    return 'Apparel & Accessories > Jewelry > Bracelets';
  } else if (cat.includes('pendant') || cat.includes('necklace')) {
    return 'Apparel & Accessories > Jewelry > Necklaces';
  } else if (cat.includes('earring')) {
    return 'Apparel & Accessories > Jewelry > Earrings';
  }
  
  return 'Apparel & Accessories > Jewelry';
}