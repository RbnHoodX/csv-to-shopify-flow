import { trimAll, toNum } from './csv-parser';
import type { RuleSet, NoStonesRuleSet } from './rulebook-parser';
import type { InputRow, GroupSummary } from './input-processor';

export interface VariantSeed {
  handle: string;
  core: string;
  scenario: 'Unique+Center' | 'Unique+NoCenter' | 'Repeating' | 'NoStones';
  metalCode: string;
  centerSize?: string;
  quality?: string; // Diamond quality (GH, IJ, etc.)
  qualityCode?: string; // Legacy field
  inputRowRef: InputRow;
}

export interface ExpansionResult {
  variants: VariantSeed[];
  stats: {
    totalVariants: number;
    uniqueCenterVariants: number;
    uniqueNoCenterVariants: number;
    repeatingVariants: number;
    noStonesVariants: number;
  };
}

/**
 * Check if center carat is present and numeric
 */
function hasCenterCarat(inputRow: InputRow): boolean {
  const centerCt = trimAll(
    inputRow['Center ct'] || 
    inputRow['Center Ct'] || 
    inputRow['CenterCt'] || 
    inputRow['Center Carat'] || 
    inputRow['Center'] || 
    ''
  );
  
  return centerCt !== '' && !isNaN(toNum(centerCt));
}

/**
 * Get subcategory from input row
 */
function getSubcategory(inputRow: InputRow): string {
  return trimAll(
    inputRow['Subcategory'] || 
    inputRow['Sub Category'] || 
    inputRow['Category'] || 
    inputRow['Type'] || 
    'Product'
  );
}

/**
 * Create handle from subcategory and core number
 */
function createHandle(inputRow: InputRow): string {
  const subcategory = getSubcategory(inputRow);
  const core = inputRow.coreNumber;
  return `${subcategory}-${core}`;
}

/**
 * Expand variants for unique items with center carat
 * Use actual G×H×I combinations from rulebook (not cartesian product)
 */
function expandUniqueCenterVariants(
  inputRow: InputRow,
  ruleSet: RuleSet
): VariantSeed[] {
  const variants: VariantSeed[] = [];
  const handle = createHandle(inputRow);
  
  // Debug for Bridal Sets
  const isBridal = handle.toLowerCase().includes('bridal') || 
                   inputRow.coreNumber.toLowerCase().includes('bridal');
  
  if (isBridal) {
    console.log(`🔍 BRIDAL EXPANSION DEBUG - ${handle}:`);
    console.log(`  - Available center combinations: ${ruleSet.centerCombinations.length}`);
    console.log(`  - Sample combinations: ${ruleSet.centerCombinations.slice(0, 3).map(c => `${c.metal}×${c.center}×${c.quality}`).join(', ')}`);
  }

  // Use actual G×H×I combinations from rulebook
  for (const combo of ruleSet.centerCombinations) {
    variants.push({
      handle,
      core: inputRow.coreNumber,
      scenario: 'Unique+Center',
      metalCode: combo.metal,
      centerSize: combo.center,
      quality: combo.quality, // Use quality instead of qualityCode
      qualityCode: combo.quality, // Keep legacy field for backward compatibility
      inputRowRef: inputRow
    });
  }
  
  if (isBridal) {
    console.log(`  ✅ Generated ${variants.length} variants for ${handle} (using actual rulebook combinations)`);
  }

  return variants;
}

/**
 * Expand variants for unique items without center or repeating items
 * Use actual J×K combinations from rulebook (not cartesian product)
 */
function expandNoCenterVariants(
  inputRow: InputRow,
  ruleSet: RuleSet,
  scenario: 'Unique+NoCenter' | 'Repeating'
): VariantSeed[] {
  const variants: VariantSeed[] = [];
  const handle = createHandle(inputRow);

  // Use actual J×K combinations from rulebook
  for (const combo of ruleSet.noCenterCombinations) {
    variants.push({
      handle,
      core: inputRow.coreNumber,
      scenario,
      metalCode: combo.metal,
      quality: combo.quality, // Use quality instead of qualityCode
      qualityCode: combo.quality, // Keep legacy field for backward compatibility
      inputRowRef: inputRow
    });
  }

  return variants;
}

/**
 * Expand variants for no stones items
 * One variant per metal from A
 */
function expandNoStonesVariants(
  inputRow: InputRow,
  ruleSet: NoStonesRuleSet
): VariantSeed[] {
  const variants: VariantSeed[] = [];
  const handle = createHandle(inputRow);

  // One variant per metal in A (preserve array order from CSV)
  for (const metalCode of ruleSet.metalsA) {
    variants.push({
      handle,
      core: inputRow.coreNumber,
      scenario: 'NoStones',
      metalCode,
      inputRowRef: inputRow
    });
  }

  return variants;
}

/**
 * Expand variants for a single group summary
 */
function expandGroupVariants(
  groupSummary: GroupSummary,
  naturalRules?: RuleSet,
  labGrownRules?: RuleSet,
  noStonesRules?: NoStonesRuleSet
): VariantSeed[] {
  const variants: VariantSeed[] = [];

  // Special debugging for Bridal Sets
  const isBridalSet = groupSummary.coreNumber.toLowerCase().includes('bridal') || 
                      groupSummary.rows[0]?.['Subcategory']?.toLowerCase().includes('bridal') ||
                      groupSummary.rows[0]?.['Category']?.toLowerCase().includes('bridal');
  
  if (isBridalSet) {
    console.log(`🔍 BRIDAL SET DEBUG - ${groupSummary.coreNumber}:`);
    console.log(`  - Total input rows: ${groupSummary.count}`);
    console.log(`  - Is unique: ${groupSummary.isUnique}`);
    console.log(`  - Rulebook: ${groupSummary.rulebook}`);
    console.log(`  - First row diamonds type: ${groupSummary.rows[0]?.diamondsType}`);
    console.log(`  - First row category: ${groupSummary.rows[0]?.['Category']}`);
    console.log(`  - First row subcategory: ${groupSummary.rows[0]?.['Subcategory']}`);
  }

  console.log(`🔧 Expanding variants for ${groupSummary.coreNumber}: ${groupSummary.count} rows, ${groupSummary.isUnique ? 'unique' : 'repeating'}`);

  // Determine which rulebook to use
  let ruleSet: RuleSet | NoStonesRuleSet | undefined;
  let isNoStones = false;

  if (groupSummary.rulebook.includes('Natural') && naturalRules) {
    ruleSet = naturalRules;
  } else if (groupSummary.rulebook.includes('LabGrown') && labGrownRules) {
    ruleSet = labGrownRules;
  } else if (groupSummary.rulebook.includes('No Stones') && noStonesRules) {
    ruleSet = noStonesRules;
    isNoStones = true;
  }

  if (!ruleSet) {
    console.warn(`No rulebook available for ${groupSummary.coreNumber}: ${groupSummary.rulebook}`);
    return variants;
  }

  // Handle No Stones scenario
  if (isNoStones) {
    const variantsPerRow = (ruleSet as NoStonesRuleSet).metalsA.length;
    const expectedTotal = groupSummary.count * variantsPerRow;
    console.log(`  📦 No Stones: ${groupSummary.count} rows × ${variantsPerRow} metal variants each = ${expectedTotal} total variants`);
    
    for (const inputRow of groupSummary.rows) {
      const rowVariants = expandNoStonesVariants(inputRow, ruleSet as NoStonesRuleSet);
      variants.push(...rowVariants);
    }
    
    console.log(`  ✅ Generated ${variants.length} No Stones variants for ${groupSummary.coreNumber}`);
    return variants;
  }

  const mainRuleSet = ruleSet as RuleSet;

  // Handle different scenarios
  if (groupSummary.isUnique) {
    const inputRow = groupSummary.rows[0];
    
    if (hasCenterCarat(inputRow)) {
        // Unique + Center: actual G×H×I combinations from rulebook
        const actualCombinations = mainRuleSet.centerCombinations.length;
        console.log(`  💎 Unique+Center: ${actualCombinations} actual combinations from rulebook`);
        return expandUniqueCenterVariants(inputRow, mainRuleSet);
    } else {
        // Unique + No Center: actual J×K combinations from rulebook
        const actualCombinations = mainRuleSet.noCenterCombinations.length;
        console.log(`  🔹 Unique+NoCenter: ${actualCombinations} actual combinations from rulebook`);
        return expandNoCenterVariants(inputRow, mainRuleSet, 'Unique+NoCenter');
    }
  } else {
      // Repeating: actual J×K combinations for each base row
      const variantsPerRow = mainRuleSet.noCenterCombinations.length;
      const expectedTotal = groupSummary.count * variantsPerRow;
      console.log(`  🔄 Repeating: ${groupSummary.count} rows × ${variantsPerRow} actual combinations each = ${expectedTotal} total variants`);
    
    for (const inputRow of groupSummary.rows) {
      const rowVariants = expandNoCenterVariants(inputRow, mainRuleSet, 'Repeating');
      variants.push(...rowVariants);
    }
    
    console.log(`  ✅ Generated ${variants.length} variants for ${groupSummary.coreNumber}`);
  }

  return variants;
}

/**
 * Expand all variants from grouped input summaries
 */
export function expandAllVariants(
  groupSummaries: GroupSummary[],
  naturalRules?: RuleSet,
  labGrownRules?: RuleSet,
  noStonesRules?: NoStonesRuleSet
): ExpansionResult {
  const allVariants: VariantSeed[] = [];
  
  let uniqueCenterVariants = 0;
  let uniqueNoCenterVariants = 0;
  let repeatingVariants = 0;
  let noStonesVariants = 0;

  for (const groupSummary of groupSummaries) {
    const groupVariants = expandGroupVariants(
      groupSummary, 
      naturalRules, 
      labGrownRules, 
      noStonesRules
    );
    
    allVariants.push(...groupVariants);

    // Count variants by scenario
    for (const variant of groupVariants) {
      switch (variant.scenario) {
        case 'Unique+Center':
          uniqueCenterVariants++;
          break;
        case 'Unique+NoCenter':
          uniqueNoCenterVariants++;
          break;
        case 'Repeating':
          repeatingVariants++;
          break;
        case 'NoStones':
          noStonesVariants++;
          break;
      }
    }
  }

  return {
    variants: allVariants,
    stats: {
      totalVariants: allVariants.length,
      uniqueCenterVariants,
      uniqueNoCenterVariants,
      repeatingVariants,
      noStonesVariants
    }
  };
}

/**
 * Calculate expected variant counts for validation
 */
export function calculateExpectedCounts(
  groupSummaries: GroupSummary[],
  naturalRules?: RuleSet,
  labGrownRules?: RuleSet,
  noStonesRules?: NoStonesRuleSet
): Record<string, number> {
  const expected: Record<string, number> = {};

  for (const groupSummary of groupSummaries) {
    let ruleSet: RuleSet | NoStonesRuleSet | undefined;
    let isNoStones = false;

    if (groupSummary.rulebook.includes('Natural') && naturalRules) {
      ruleSet = naturalRules;
    } else if (groupSummary.rulebook.includes('LabGrown') && labGrownRules) {
      ruleSet = labGrownRules;
    } else if (groupSummary.rulebook.includes('No Stones') && noStonesRules) {
      ruleSet = noStonesRules;
      isNoStones = true;
    }

    if (!ruleSet) continue;

    const handle = createHandle(groupSummary.rows[0]);

    if (isNoStones) {
      expected[handle] = groupSummary.count * (ruleSet as NoStonesRuleSet).metalsA.length;
    } else {
      const mainRuleSet = ruleSet as RuleSet;
      
      if (groupSummary.isUnique) {
        const inputRow = groupSummary.rows[0];
        if (hasCenterCarat(inputRow)) {
          // Use actual G×H×I combinations count
          expected[handle] = mainRuleSet.centerCombinations.length;
        } else {
          // Use actual J×K combinations count  
          expected[handle] = mainRuleSet.noCenterCombinations.length;
        }
      } else {
        // Actual J×K combinations per base row
        expected[handle] = groupSummary.count * mainRuleSet.noCenterCombinations.length;
      }
    }
  }

  return expected;
}