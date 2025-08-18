/**
 * Pure helper functions for rule extraction and selection
 */

import type { RuleSet, NoStonesRuleSet } from '@/lib/rulebook-parser';
import type { InputRow, VariantSeed } from '@/types/core';
import { trimAll } from '@/lib/csv-parser';

/**
 * Pick the appropriate rulebook based on diamonds type
 */
export function pickRulebook(
  diamondsType: string,
  naturalRules?: RuleSet,
  labGrownRules?: RuleSet,
  noStonesRules?: NoStonesRuleSet
): RuleSet | NoStonesRuleSet | undefined {
  const type = trimAll(diamondsType).toLowerCase();
  
  if (type.includes('natural')) return naturalRules;
  if (type.includes('labgrown') || type.includes('lab grown')) return labGrownRules;
  if (type.includes('no stones')) return noStonesRules;
  
  return undefined;
}

/**
 * Extract metal codes from rulebook based on scenario
 */
export function extractMetalCodes(ruleSet: RuleSet | NoStonesRuleSet, scenario: VariantSeed['scenario']): string[] {
  if (scenario === 'NoStones') {
    return (ruleSet as NoStonesRuleSet).metalsA || [];
  }
  
  const rules = ruleSet as RuleSet;
  if (scenario === 'Unique+Center') {
    return rules.metalsG || [];
  } else {
    return rules.metalsJ || [];
  }
}

/**
 * Extract center sizes from rulebook
 */
export function extractCenterSizes(ruleSet: RuleSet): string[] {
  return ruleSet.centersH || [];
}

/**
 * Extract quality codes from rulebook based on scenario
 */
export function extractQualityCodes(ruleSet: RuleSet, scenario: VariantSeed['scenario']): string[] {
  if (scenario === 'Unique+Center') {
    return ruleSet.qualitiesI || [];
  } else if (scenario === 'Unique+NoCenter' || scenario === 'Repeating') {
    return ruleSet.qualitiesK || [];
  }
  return [];
}

/**
 * Get weight multiplier from rules
 */
export function getWeightMultiplier(ruleSet: RuleSet | NoStonesRuleSet, metalCode: string): number {
  if ('weightIndex' in ruleSet && ruleSet.weightIndex) {
    return ruleSet.weightIndex.get(metalCode) || 1;
  }
  return 1;
}

/**
 * Get metal price per gram from rules
 */
export function getMetalPrice(ruleSet: RuleSet | NoStonesRuleSet, metalCode: string): number {
  if ('metalPrice' in ruleSet && ruleSet.metalPrice) {
    return ruleSet.metalPrice.get(metalCode) || 2.5;
  }
  return 2.5;
}

/**
 * Get labor cost by type from rules
 */
export function getLaborCost(ruleSet: RuleSet | NoStonesRuleSet, laborType: string): number {
  if ('labor' in ruleSet && ruleSet.labor) {
    return ruleSet.labor.get(laborType) || 0;
  }
  return 0;
}

/**
 * Find margin multiplier for a given cost
 */
export function findMarginMultiplier(ruleSet: RuleSet | NoStonesRuleSet, cost: number): number {
  if ('margins' in ruleSet && ruleSet.margins) {
    for (const margin of ruleSet.margins) {
      const inRange = cost >= margin.begin && (margin.end === undefined || cost < margin.end);
      if (inRange) return margin.m;
    }
  }
  return 2.0; // Default fallback
}

/**
 * Get default multiplier by product type
 */
export function getDefaultMultiplier(productType: string): number {
  const type = trimAll(productType).toLowerCase();
  
  if (type.includes('ring')) return 2.0;
  if (type.includes('bracelet')) return 2.0;
  if (type.includes('pendant')) return 2.5;
  
  return 2.0;
}