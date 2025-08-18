/**
 * Pure helper functions for variant expansion
 */

import type { InputRow, VariantSeed, CoreGroup } from '@/types/core';
import type { RuleSet, NoStonesRuleSet } from '@/lib/rulebook-parser';
import { extractMetalCodes, extractCenterSizes, extractQualityCodes } from './rules';

/**
 * Expand unique item with center stone
 */
export function expandUniqueWithCenter(
  coreGroup: CoreGroup,
  ruleSet: RuleSet
): VariantSeed[] {
  const variants: VariantSeed[] = [];
  const inputRow = coreGroup.inputRows[0];
  
  const metalCodes = extractMetalCodes(ruleSet, 'Unique+Center');
  const centerSizes = extractCenterSizes(ruleSet);
  const qualityCodes = extractQualityCodes(ruleSet, 'Unique+Center');
  
  for (const metalCode of metalCodes) {
    for (const centerSize of centerSizes) {
      for (const qualityCode of qualityCodes) {
        variants.push({
          handle: coreGroup.handle,
          core: coreGroup.coreNumber,
          scenario: 'Unique+Center',
          metalCode,
          centerSize,
          qualityCode,
          inputRowRef: inputRow
        });
      }
    }
  }
  
  return variants;
}

/**
 * Expand unique item without center stone
 */
export function expandUniqueNoCenter(
  coreGroup: CoreGroup,
  ruleSet: RuleSet
): VariantSeed[] {
  const variants: VariantSeed[] = [];
  const inputRow = coreGroup.inputRows[0];
  
  const metalCodes = extractMetalCodes(ruleSet, 'Unique+NoCenter');
  const qualityCodes = extractQualityCodes(ruleSet, 'Unique+NoCenter');
  
  for (const metalCode of metalCodes) {
    for (const qualityCode of qualityCodes) {
      variants.push({
        handle: coreGroup.handle,
        core: coreGroup.coreNumber,
        scenario: 'Unique+NoCenter',
        metalCode,
        qualityCode,
        inputRowRef: inputRow
      });
    }
  }
  
  return variants;
}

/**
 * Expand repeating items (multiple input rows)
 */
export function expandRepeating(
  coreGroup: CoreGroup,
  ruleSet: RuleSet
): VariantSeed[] {
  const variants: VariantSeed[] = [];
  
  const metalCodes = extractMetalCodes(ruleSet, 'Repeating');
  const qualityCodes = extractQualityCodes(ruleSet, 'Repeating');
  
  for (const inputRow of coreGroup.inputRows) {
    for (const metalCode of metalCodes) {
      for (const qualityCode of qualityCodes) {
        variants.push({
          handle: coreGroup.handle,
          core: coreGroup.coreNumber,
          scenario: 'Repeating',
          metalCode,
          qualityCode,
          inputRowRef: inputRow
        });
      }
    }
  }
  
  return variants;
}

/**
 * Expand no stones items
 */
export function expandNoStones(
  coreGroup: CoreGroup,
  ruleSet: NoStonesRuleSet
): VariantSeed[] {
  const variants: VariantSeed[] = [];
  const inputRow = coreGroup.inputRows[0];
  
  const metalCodes = extractMetalCodes(ruleSet, 'NoStones');
  
  for (const metalCode of metalCodes) {
    variants.push({
      handle: coreGroup.handle,
      core: coreGroup.coreNumber,
      scenario: 'NoStones',
      metalCode,
      inputRowRef: inputRow
    });
  }
  
  return variants;
}

/**
 * Expand all core groups into variants
 */
export function expandAllGroups(
  coreGroups: CoreGroup[],
  naturalRules?: RuleSet,
  labGrownRules?: RuleSet,
  noStonesRules?: NoStonesRuleSet
): VariantSeed[] {
  const allVariants: VariantSeed[] = [];
  
  for (const group of coreGroups) {
    const diamondsType = group.diamondsType.toLowerCase();
    
    // Select appropriate rule set
    let ruleSet: RuleSet | NoStonesRuleSet | undefined;
    if (diamondsType.includes('natural')) ruleSet = naturalRules;
    else if (diamondsType.includes('labgrown')) ruleSet = labGrownRules;
    else if (diamondsType.includes('no stones')) ruleSet = noStonesRules;
    
    if (!ruleSet) continue;
    
    // Expand based on scenario
    let variants: VariantSeed[] = [];
    
    switch (group.scenario) {
      case 'Unique+Center':
        variants = expandUniqueWithCenter(group, ruleSet as RuleSet);
        break;
      case 'Unique+NoCenter':
        variants = expandUniqueNoCenter(group, ruleSet as RuleSet);
        break;
      case 'Repeating':
        variants = expandRepeating(group, ruleSet as RuleSet);
        break;
      case 'NoStones':
        variants = expandNoStones(group, ruleSet as NoStonesRuleSet);
        break;
    }
    
    allVariants.push(...variants);
  }
  
  return allVariants;
}