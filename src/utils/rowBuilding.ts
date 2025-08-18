/**
 * Pure helper functions for building Shopify rows
 */

import type { VariantSeed, ShopifyRow, ProductMetadata } from '@/types/core';
import type { RuleSet, NoStonesRuleSet } from '@/lib/rulebook-parser';
import { trimAll } from '@/lib/csv-parser';
import { 
  translateMetal, 
  translateQuality, 
  calculateTotalCaratString, 
  calculateTotalCaratWeight,
  collectShapes,
  generateSKUWithRunningIndex,
  formatMoney,
  formatBoolean,
  generateGoogleCategory
} from './translations';
import { computeTotalCost, calculatePricing } from './costs';

/**
 * Generate body HTML based on scenario
 */
function generateBodyHTML(variants: VariantSeed[], title: string, scenario: string): string {
  const firstVariant = variants[0];
  const diamondType = firstVariant.inputRowRef['Diamonds Type'] || 'diamonds';
  
  if (scenario === 'NoStones') {
    return `<p><strong>${title}</strong></p>
<p>Expertly crafted jewelry piece from Primestyle.com. Made with precision and attention to detail.</p>
<p>Perfect for everyday wear or special occasions.</p>`;
  }
  
  if (scenario === 'Unique+Center') {
    const centerShape = firstVariant.inputRowRef['Center shape'] || 'round';
    const centerSize = firstVariant.centerSize || '1.00';
    const sideShapes = firstVariant.inputRowRef['Side shapes'] || firstVariant.inputRowRef['Side shape'] || '';
    
    return `<p><strong>${title}</strong></p>
<p>Stunning ${diamondType} jewelry featuring a ${centerSize}CT ${centerShape} center stone${sideShapes ? ` with ${sideShapes} side stones` : ''}.</p>
<p>Expertly crafted with premium materials and exceptional attention to detail.</p>
<p>Perfect for engagements, anniversaries, or any special occasion.</p>`;
  }
  
  // Repeating scenario
  const totalCtRange = variants.length > 1 ? 
    `${Math.min(...variants.map(calculateTotalCaratWeight)).toFixed(2)}-${Math.max(...variants.map(calculateTotalCaratWeight)).toFixed(2)}CT` :
    `${calculateTotalCaratWeight(variants[0]).toFixed(2)}CT`;
    
  return `<p><strong>${title}</strong></p>
<p>Beautiful ${diamondType} jewelry collection featuring ${totalCtRange} total carat weight.</p>
<p>Available in multiple configurations to suit your preferences.</p>
<p>Expertly crafted with premium materials and exceptional attention to detail.</p>`;
}

/**
 * Build product metadata from variants
 */
export function buildProductMetadata(variants: VariantSeed[]): ProductMetadata {
  const firstVariant = variants[0];
  const inputRow = firstVariant.inputRowRef;
  
  // Calculate carat range for title
  const caratWeights = variants.map(calculateTotalCaratWeight);
  const minTCW = Math.min(...caratWeights);
  const maxTCW = Math.max(...caratWeights);
  
  // Collect unique shapes
  const shapes = collectShapes(variants);
  const shapesStr = shapes.length > 0 ? shapes.join('/') : 'Mixed';
  
  // Get category and subcategory
  const category = trimAll(inputRow.Category || 'Jewelry');
  const subcategory = trimAll(inputRow.Subcategory || inputRow.Type || 'Piece');
  
  // Generate title based on spec: "{MinTCW}-{MaxTCW} CT {Shapes} Cut - {Subcategory}"
  const title = firstVariant.scenario === 'NoStones' 
    ? `${subcategory} - Premium ${category}`
    : minTCW === maxTCW 
      ? `${minTCW.toFixed(2)} CT ${shapesStr} Cut - ${subcategory}`
      : `${minTCW.toFixed(2)}-${maxTCW.toFixed(2)} CT ${shapesStr} Cut - ${subcategory}`;
  
  // Vendor is always "Primestyle.com"
  const vendor = 'Primestyle.com';
  
  // Type format: "{Category}_{Subcategory}"
  const type = `${category}_${subcategory}`;
  
  // Build tags: Category, Subcategory, input Tags, and "tcw_{Min} CT - {Max} CT"
  const inputTags = trimAll(inputRow.Tags || '');
  const tcwTag = firstVariant.scenario === 'NoStones' 
    ? '' 
    : `tcw_${minTCW.toFixed(2)} CT - ${maxTCW.toFixed(2)} CT`;
  
  const tagParts = [category, subcategory, inputTags, tcwTag].filter(Boolean);
  const tags = tagParts.join(', ');
  
  // Generate body HTML
  const bodyHTML = generateBodyHTML(variants, title, firstVariant.scenario);
  
  // Generate Google Product Category
  const googleCategory = generateGoogleCategory(category);
  
  // Collect unique qualities and metals
  const qualities = [...new Set(variants.map(v => v.qualityCode).filter(Boolean))];
  const metals = [...new Set(variants.map(v => v.metalCode))];
  
  // Generate SEO fields
  const diamondType = inputRow['Diamonds Type'] || 'diamonds';
  const seoTitle = `${title} | ${qualities.join('/')} ${diamondType} | ${metals.join('/')} | ${vendor}`;
  const seoDescription = `Shop ${title} featuring ${diamondType} in ${metals.join('/')} metal. Premium quality ${qualities.join('/')} diamonds. Free shipping available.`;
  
  return {
    title,
    vendor,
    type,
    tags,
    bodyHTML,
    googleCategory,
    diamondType,
    qualities,
    metals,
    seoTitle,
    seoDescription
  };
}

/**
 * Build parent-child rows for a group of variants
 */
export function buildParentChildRows(
  variants: VariantSeed[],
  naturalRules?: RuleSet,
  labGrownRules?: RuleSet,
  noStonesRules?: NoStonesRuleSet
): ShopifyRow[] {
  if (variants.length === 0) return [];
  
  // Sort variants for consistent ordering
  const sortedVariants = [...variants].sort((a, b) => {
    if (a.metalCode !== b.metalCode) return a.metalCode.localeCompare(b.metalCode);
    if (a.centerSize && b.centerSize && a.centerSize !== b.centerSize) {
      return parseFloat(a.centerSize) - parseFloat(b.centerSize);
    }
    if (a.qualityCode && b.qualityCode) return a.qualityCode.localeCompare(b.qualityCode);
    return 0;
  });
  
  const firstVariant = sortedVariants[0];
  const productMetadata = buildProductMetadata(sortedVariants);
  const isNoStones = firstVariant.scenario === 'NoStones';
  
  // Get appropriate rule set
  let ruleSet: RuleSet | NoStonesRuleSet | undefined;
  const diamondsType = firstVariant.inputRowRef['Diamonds Type']?.toLowerCase() || '';
  if (diamondsType.includes('natural')) ruleSet = naturalRules;
  else if (diamondsType.includes('labgrown')) ruleSet = labGrownRules;
  else if (diamondsType.includes('no stones')) ruleSet = noStonesRules;
  
  const rows: ShopifyRow[] = [];
  
  sortedVariants.forEach((variant, index) => {
    const isParent = index === 0;
    const sku = generateSKUWithRunningIndex(variant.core, sortedVariants, index);
    
    // Calculate costs and pricing
    const costData = ruleSet ? computeTotalCost(variant, ruleSet) : {
      diamondCost: 0, metalCost: 0, sideStoneCost: 0, centerStoneCost: 0,
      polishCost: 25, braceletsCost: 0, cadCreationCost: 20, constantCost: 25,
      totalCost: 70, variantGrams: 5,
      details: {
        baseGrams: 5, weightMultiplier: 1, metalPricePerGram: 2.5,
        diamondCarats: 0, diamondPricePerCarat: 0, sideStoneCount: 0,
        hasCenter: false, isBracelet: false
      }
    };
    
    const pricing = ruleSet ? 
      calculatePricing(costData.totalCost, ruleSet, productMetadata.type) :
      { cost: 70, multiplier: 2.5, variantPrice: 174.99, compareAtPrice: 280, marginSource: 'fallback' as const };
    
    const row: ShopifyRow = {
      Handle: variant.handle,
      
      // Parent-only fields (blank for children)
      Title: isParent ? productMetadata.title : '',
      'Body (HTML)': isParent ? productMetadata.bodyHTML : '',
      Vendor: isParent ? productMetadata.vendor : '',
      Type: isParent ? productMetadata.type : '',
      Tags: isParent ? productMetadata.tags : '',
      Published: isParent ? formatBoolean(true) : '',
      
      // Option Names (parent-only, blank for No Stones)
      'Option1 Name': isParent && !isNoStones ? 'Metal/Color' : '',
      'Option1 Value': isNoStones ? '' : translateMetal(variant.metalCode),
      'Option2 Name': isParent && !isNoStones ? 'Total Carat' : '',
      'Option2 Value': isNoStones ? '' : calculateTotalCaratString(variant),
      'Option3 Name': isParent && !isNoStones ? 'Diamond Quality' : '',
      'Option3 Value': isNoStones || !variant.qualityCode ? '' : translateQuality(variant.qualityCode),
      
      // Variant-specific fields
      'Variant SKU': sku,
      'Variant Grams': formatMoney(costData.variantGrams),
      'Variant Inventory Tracker': 'shopify',
      'Variant Inventory Qty': '10',
      'Variant Inventory Policy': 'deny',
      'Variant Fulfillment Service': 'manual',
      'Variant Price': formatMoney(pricing.variantPrice),
      'Variant Compare At Price': formatMoney(pricing.compareAtPrice),
      'Variant Requires Shipping': formatBoolean(true),
      'Variant Taxable': formatBoolean(true),
      'Variant Barcode': '',
      
      // Image fields
      'Image Src': isParent ? '' : '',
      'Image Position': isParent ? '1' : '',
      'Image Alt Text': isParent ? productMetadata.title : '',
      'Gift Card': formatBoolean(false),
      
      // SEO fields (parent-only)
      'SEO Title': isParent ? productMetadata.seoTitle : '',
      'SEO Description': isParent ? productMetadata.seoDescription : '',
      
      // Google Shopping fields (parent-only)
      'Google Shopping / Google Product Category': isParent ? productMetadata.googleCategory : '',
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
      'Cost per item': formatMoney(costData.totalCost),
      
      // New spec fields
      'Product Type': isParent ? productMetadata.type : '',
      'Core Number': variant.core,
      Category: isParent ? trimAll(firstVariant.inputRowRef.Category || 'Jewelry') : '',
      
      // Cost breakdown fields
      'Diamond Cost': formatMoney(costData.diamondCost),
      'Metal Cost': formatMoney(costData.metalCost),
      'Side Stone': formatMoney(costData.sideStoneCost),
      'Center Stone': formatMoney(costData.centerStoneCost),
      Polish: formatMoney(costData.polishCost),
      Bracelets: formatMoney(costData.braceletsCost),
      'CAD Creation': formatMoney(costData.cadCreationCost),
      '25$': formatMoney(costData.constantCost),
      
      // Duplicate fields per spec
      'Title (duplicate)': isParent ? productMetadata.title : '',
      'Description (duplicate)': isParent ? productMetadata.bodyHTML : ''
    };
    
    rows.push(row);
  });
  
  return rows;
}