import { trimAll, toNum, toFixed2, ctStr, calculateSumSideCt } from './csv-parser';
import type { VariantSeed } from './variant-expansion';
import type { RuleSet, NoStonesRuleSet } from './rulebook-parser';
import { calculatePricing, type PricingResult } from './pricing-calculator';
import type { WeightLookupTable } from './weight-lookup';
import { getVariantWeight } from './weight-lookup';

export interface CostBreakdown {
  diamondCost: number;
  metalCost: number;
  sideStoneCost: number;
  centerStoneCost: number;
  polishCost: number;
  braceletsCost: number;
  cadCreationCost: number;
  constantCost: number;
  totalCost: number;
  variantGrams: number;
  sku: string;
  pricing: PricingResult;
  details: {
    baseGrams: number;
    weightMultiplier: number;
    metalPricePerGram: number;
    diamondCarats: number;
    diamondPricePerCarat: number;
    sideStoneCount: number;
    hasCenter: boolean;
    isBracelet: boolean;
  };
}

/**
 * Get metal family key for weight/price lookup
 * e.g., "14W" -> "14", "18R" -> "18", "PLT" -> "PLT"
 */
function getMetalFamilyKey(metalCode: string): string {
  if (metalCode.startsWith('14')) return '14';
  if (metalCode.startsWith('18')) return '18';
  if (metalCode.startsWith('PLT') || metalCode === 'PLT') return 'PLT';
  return metalCode;
}

/**
 * Generate SKU with running index starting at 2 within each handle
 */
export function generateSKUWithRunningIndex(
  coreNumber: string, 
  handleVariants: VariantSeed[], 
  variantIndex: number
): string {
  const base = coreNumber.replace(/[^A-Za-z0-9]/g, '');
  const runningIndex = variantIndex + 2; // Start at -2, increment to -3, -4, etc.
  return `${base}-${runningIndex}`;
}

/**
 * Calculate variant grams using weight lookup table by core number and metal
 */
function calculateVariantGrams(
  variant: VariantSeed,
  ruleSet: RuleSet | NoStonesRuleSet,
  weightTable?: WeightLookupTable
): { grams: number; baseGrams: number; weightMultiplier: number } {
  // Get base grams from input (14KT baseline weight) as fallback
  const baseGrams = toNum(
    variant.inputRowRef['Grams Weight'] ||
    variant.inputRowRef['Grams Weight 14kt'] ||
    variant.inputRowRef['GramsWeight14kt'] ||
    variant.inputRowRef['Base Grams'] ||
    variant.inputRowRef['BaseGrams'] ||
    variant.inputRowRef['Weight'] ||
    variant.inputRowRef['Grams'] ||
    '5' // Default if missing
  );

  // If we have a weight lookup table, use it for precise weights
  if (weightTable) {
    const { weight, isLookup } = getVariantWeight(
      weightTable,
      variant.core,
      variant.metalCode,
      baseGrams
    );

    if (isLookup) {
      // Using precise lookup weight
      const weightMultiplier = baseGrams > 0 ? weight / baseGrams : 1;
      return {
        grams: weight,
        baseGrams,
        weightMultiplier
      };
    }
  }

  // Fallback to original multiplier approach
  if ('weightIndex' in ruleSet) {
    // For Natural/LabGrown rules - apply metal weight multiplier
    const metalFamilyKey = getMetalFamilyKey(variant.metalCode);
    const weightMultiplier = ruleSet.weightIndex.get(metalFamilyKey) || 1;
    
    if (!ruleSet.weightIndex.has(metalFamilyKey)) {
      console.warn(`Weight multiplier not found for metal ${metalFamilyKey}, using default 1`);
    }
    
    return {
      grams: baseGrams * weightMultiplier,
      baseGrams,
      weightMultiplier
    };
  } else {
    // No Stones - use base weight
    return {
      grams: baseGrams,
      baseGrams,
      weightMultiplier: 1
    };
  }
}

/**
 * Calculate diamond cost based on scenario
 */
function calculateDiamondCost(variant: VariantSeed): { cost: number; carats: number; pricePerCarat: number } {
  if (variant.scenario === 'NoStones') {
    return { cost: 0, carats: 0, pricePerCarat: 0 };
  }

  let totalCarats = 0;
  let pricePerCarat = 150; // Default price per carat

  if (variant.scenario === 'Unique+Center' && variant.centerSize) {
    // With center: centerSize + sumSideCt (sum all side columns)
    const centerCt = toNum(variant.centerSize);
    const sumSideCt = calculateSumSideCt(variant.inputRowRef);
    totalCarats = centerCt + sumSideCt;
  } else {
    // No center: use TotalCtWeight
    totalCarats = toNum(
      variant.inputRowRef['Total Ct Weight'] ||
      variant.inputRowRef['Total ct'] ||
      variant.inputRowRef['TotalCt'] ||
      variant.inputRowRef['Total Carat'] ||
      '0'
    );
  }

  // Get price per carat from input or use default
  const inputPricePerCarat = toNum(
    variant.inputRowRef['Price Per Carat'] ||
    variant.inputRowRef['PricePerCarat'] ||
    variant.inputRowRef['Diamond Price'] ||
    ''
  );
  if (!isNaN(inputPricePerCarat) && inputPricePerCarat > 0) {
    pricePerCarat = inputPricePerCarat;
  }

  return {
    cost: totalCarats * pricePerCarat,
    carats: totalCarats,
    pricePerCarat
  };
}

/**
 * Calculate metal cost
 */
function calculateMetalCost(
  variant: VariantSeed,
  variantGrams: number,
  ruleSet: RuleSet | NoStonesRuleSet
): { cost: number; pricePerGram: number } {
  if ('metalPrice' in ruleSet) {
    const metalFamilyKey = getMetalFamilyKey(variant.metalCode);
    const pricePerGram = ruleSet.metalPrice.get(metalFamilyKey) || 2.5; // Default $2.50/gram
    
    if (!ruleSet.metalPrice.has(metalFamilyKey)) {
      console.warn(`Metal price not found for ${metalFamilyKey}, using default $2.50/gram`);
    }
    
    return {
      cost: variantGrams * pricePerGram,
      pricePerGram
    };
  } else {
    // No Stones - use default metal pricing
    const defaultPricePerGram = 2.5;
    return {
      cost: variantGrams * defaultPricePerGram,
      pricePerGram: defaultPricePerGram
    };
  }
}

/**
 * Calculate labor costs
 */
function calculateLaborCosts(
  variant: VariantSeed,
  ruleSet: RuleSet | NoStonesRuleSet
): {
  sideStoneCost: number;
  centerStoneCost: number;
  polishCost: number;
  braceletsCost: number;
  cadCreationCost: number;
  sideStoneCount: number;
  hasCenter: boolean;
  isBracelet: boolean;
} {
  const laborMap = 'labor' in ruleSet ? ruleSet.labor : new Map<string, number>();

  // Side stone cost
  const sideStoneCount = toNum(
    variant.inputRowRef['Side Stone Count'] ||
    variant.inputRowRef['SideStoneCount'] ||
    variant.inputRowRef['Side Stones'] ||
    '0'
  );
  const perSideStone = laborMap.get('Per side stone') || 0;
  const sideStoneCost = sideStoneCount * perSideStone;

  // Center stone cost
  const hasCenter = variant.scenario === 'Unique+Center';
  const perCenter = laborMap.get('Per Center') || 0;
  const centerStoneCost = hasCenter ? perCenter : 0;

  // Polish cost
  const polishCost = laborMap.get('Polish') || 25;

  // Bracelets cost
  const category = trimAll(
    variant.inputRowRef['Category'] ||
    variant.inputRowRef['Type'] ||
    variant.inputRowRef['Subcategory'] ||
    ''
  ).toLowerCase();
  const isBracelet = category.includes('bracelet');
  const braceletsCost = isBracelet ? (laborMap.get('Bracelets') || 0) : 0;

  // CAD Creation cost
  const cadCreationCost = laborMap.get('CAD Creation') || 20;

  return {
    sideStoneCost,
    centerStoneCost,
    polishCost,
    braceletsCost,
    cadCreationCost,
    sideStoneCount,
    hasCenter,
    isBracelet
  };
}

/**
 * Calculate complete cost breakdown for a variant
 */
export function calculateCostBreakdown(
  variant: VariantSeed,
  ruleSet: RuleSet | NoStonesRuleSet,
  sku: string,
  weightTable?: WeightLookupTable
): CostBreakdown {
  // Calculate variant grams
  const gramsCalc = calculateVariantGrams(variant, ruleSet, weightTable);
  
  // Calculate diamond cost
  const diamondCalc = calculateDiamondCost(variant);
  
  // Calculate metal cost
  const metalCalc = calculateMetalCost(variant, gramsCalc.grams, ruleSet);
  
  // Calculate labor costs
  const laborCalc = calculateLaborCosts(variant, ruleSet);

  // Constant cost
  const constantCost = 25;

  // Total cost
  const totalCost = 
    diamondCalc.cost +
    metalCalc.cost +
    laborCalc.sideStoneCost +
    laborCalc.centerStoneCost +
    laborCalc.polishCost +
    laborCalc.braceletsCost +
    laborCalc.cadCreationCost +
    constantCost;

  // Calculate pricing
  const pricing = calculatePricing(totalCost, variant.inputRowRef, ruleSet);

  return {
    diamondCost: diamondCalc.cost,
    metalCost: metalCalc.cost,
    sideStoneCost: laborCalc.sideStoneCost,
    centerStoneCost: laborCalc.centerStoneCost,
    polishCost: laborCalc.polishCost,
    braceletsCost: laborCalc.braceletsCost,
    cadCreationCost: laborCalc.cadCreationCost,
    constantCost,
    totalCost,
    variantGrams: gramsCalc.grams,
    sku,
    pricing,
    details: {
      baseGrams: gramsCalc.baseGrams,
      weightMultiplier: gramsCalc.weightMultiplier,
      metalPricePerGram: metalCalc.pricePerGram,
      diamondCarats: diamondCalc.carats,
      diamondPricePerCarat: diamondCalc.pricePerCarat,
      sideStoneCount: laborCalc.sideStoneCount,
      hasCenter: laborCalc.hasCenter,
      isBracelet: laborCalc.isBracelet
    }
  };
}