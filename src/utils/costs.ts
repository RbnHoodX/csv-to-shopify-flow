/**
 * Pure helper functions for cost and pricing calculations
 */

import type { VariantSeed, CostDetails, PricingResult } from '@/types/core';
import type { RuleSet, NoStonesRuleSet } from '@/lib/rulebook-parser';
import { toNum } from '@/lib/csv-parser';
import { getWeightMultiplier, getMetalPrice, getLaborCost, findMarginMultiplier, getDefaultMultiplier } from './rules';
import { calculateTotalCaratWeight } from './translations';

/**
 * Compute variant grams based on base weight and metal multiplier
 */
export function computeVariantGrams(
  variant: VariantSeed,
  ruleSet: RuleSet | NoStonesRuleSet
): number {
  const baseGrams = toNum(variant.inputRowRef['Grams Weight'] || '5');
  const weightMultiplier = getWeightMultiplier(ruleSet, variant.metalCode);
  return baseGrams * weightMultiplier;
}

/**
 * Compute diamond cost for variant
 */
export function computeDiamondCost(
  variant: VariantSeed,
  ruleSet: RuleSet | NoStonesRuleSet
): number {
  if (variant.scenario === 'NoStones') return 0;
  
  const totalCarats = calculateTotalCaratWeight(variant);
  
  // Get price per carat from rules (simplified - in real implementation would use price bands)
  const pricePerCarat = getLaborCost(ruleSet, 'Diamond Price Per Carat') || 1000;
  
  return totalCarats * pricePerCarat;
}

/**
 * Compute metal cost for variant
 */
export function computeMetalCost(
  variant: VariantSeed,
  ruleSet: RuleSet | NoStonesRuleSet,
  variantGrams: number
): number {
  const metalPrice = getMetalPrice(ruleSet, variant.metalCode);
  return variantGrams * metalPrice;
}

/**
 * Compute side stone cost
 */
export function computeSideStoneCost(
  variant: VariantSeed,
  ruleSet: RuleSet | NoStonesRuleSet
): number {
  const sideStoneCount = toNum(variant.inputRowRef['Side Stone Count'] || '0');
  const costPerSideStone = getLaborCost(ruleSet, 'Per side stone') || 0;
  return sideStoneCount * costPerSideStone;
}

/**
 * Compute center stone cost
 */
export function computeCenterStoneCost(
  variant: VariantSeed,
  ruleSet: RuleSet | NoStonesRuleSet
): number {
  const hasCenter = variant.scenario === 'Unique+Center';
  if (!hasCenter) return 0;
  
  const costPerCenter = getLaborCost(ruleSet, 'Per Center') || 0;
  return costPerCenter;
}

/**
 * Compute total cost for variant
 */
export function computeTotalCost(
  variant: VariantSeed,
  ruleSet: RuleSet | NoStonesRuleSet
): {
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
  details: CostDetails;
} {
  const variantGrams = computeVariantGrams(variant, ruleSet);
  const diamondCost = computeDiamondCost(variant, ruleSet);
  const metalCost = computeMetalCost(variant, ruleSet, variantGrams);
  const sideStoneCost = computeSideStoneCost(variant, ruleSet);
  const centerStoneCost = computeCenterStoneCost(variant, ruleSet);
  
  // Fixed costs
  const polishCost = getLaborCost(ruleSet, 'Polish') || 25;
  const cadCreationCost = getLaborCost(ruleSet, 'CAD Creation') || 20;
  const constantCost = 25; // Always $25
  
  // Bracelets cost (if category includes "Bracelet")
  const category = variant.inputRowRef.Category || '';
  const isBracelet = category.toLowerCase().includes('bracelet');
  const braceletsCost = isBracelet ? (getLaborCost(ruleSet, 'Bracelets') || 0) : 0;
  
  const totalCost = diamondCost + metalCost + sideStoneCost + centerStoneCost + 
                   polishCost + braceletsCost + cadCreationCost + constantCost;
  
  const details: CostDetails = {
    baseGrams: toNum(variant.inputRowRef['Grams Weight'] || '5'),
    weightMultiplier: getWeightMultiplier(ruleSet, variant.metalCode),
    metalPricePerGram: getMetalPrice(ruleSet, variant.metalCode),
    diamondCarats: calculateTotalCaratWeight(variant),
    diamondPricePerCarat: getLaborCost(ruleSet, 'Diamond Price Per Carat') || 1000,
    sideStoneCount: toNum(variant.inputRowRef['Side Stone Count'] || '0'),
    hasCenter: variant.scenario === 'Unique+Center',
    isBracelet
  };
  
  return {
    diamondCost,
    metalCost,
    sideStoneCost,
    centerStoneCost,
    polishCost,
    braceletsCost,
    cadCreationCost,
    constantCost,
    totalCost,
    variantGrams,
    details
  };
}

/**
 * Pick margin multiplier based on cost and rules
 */
export function pickMarginMultiplier(
  cost: number,
  ruleSet: RuleSet | NoStonesRuleSet,
  productType: string
): { multiplier: number; source: PricingResult['marginSource'] } {
  // Try to find multiplier from rules
  const ruleMultiplier = findMarginMultiplier(ruleSet, cost);
  if (ruleMultiplier > 0) {
    const source: PricingResult['marginSource'] = 
      'margins' in ruleSet ? 
        (ruleSet === ruleSet ? 'natural' : 'labgrown') : 
        'nostones';
    return { multiplier: ruleMultiplier, source };
  }
  
  // Fall back to default by type
  const defaultMultiplier = getDefaultMultiplier(productType);
  return { multiplier: defaultMultiplier, source: 'fallback' };
}

/**
 * Calculate pricing from cost
 */
export function calculatePricing(
  cost: number,
  ruleSet: RuleSet | NoStonesRuleSet,
  productType: string
): PricingResult {
  const { multiplier, source } = pickMarginMultiplier(cost, ruleSet, productType);
  
  const variantPrice = (cost * multiplier) - 0.01;
  const compareAtPrice = cost * 4; // Fixed multiplier of 4
  
  return {
    cost,
    multiplier,
    variantPrice,
    compareAtPrice,
    marginSource: source
  };
}