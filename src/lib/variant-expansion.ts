import { trimAll, toNum } from './csv-parser';
import type { RuleSet, NoStonesRuleSet } from './rulebook-parser';
import type { InputRow, GroupSummary } from './input-processor';

export interface VariantSeed {
  handle: string;
  core: string;
  scenario: 'Unique+Center' | 'Unique+NoCenter' | 'Repeating' | 'NoStones';
  metalCode: string;
  centerSize?: string;
  qualityCode?: string;
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
 * G × H × I combinations
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
    console.log(`  - Metals G: ${ruleSet.metalsG.length} (${ruleSet.metalsG.slice(0, 3).join(', ')}, ...)`);
    console.log(`  - Centers H: ${ruleSet.centersH.length} (${ruleSet.centersH.slice(0, 3).join(', ')}, ...)`);
    console.log(`  - Qualities I: ${ruleSet.qualitiesI.length} (${ruleSet.qualitiesI.join(', ')})`);
    console.log(`  - Expected total: ${ruleSet.metalsG.length} × ${ruleSet.centersH.length} × ${ruleSet.qualitiesI.length} = ${ruleSet.metalsG.length * ruleSet.centersH.length * ruleSet.qualitiesI.length}`);
  }

  // Cartesian product G × H × I in rulebook order (preserve array order from CSV)
  for (const metalCode of ruleSet.metalsG) {
    for (const centerSize of ruleSet.centersH) {
      for (const qualityCode of ruleSet.qualitiesI) {
        variants.push({
          handle,
          core: inputRow.coreNumber,
          scenario: 'Unique+Center',
          metalCode,
          centerSize,
          qualityCode,
          inputRowRef: inputRow
        });
      }
    }
  }
  
  if (isBridal) {
    console.log(`  ✅ Generated ${variants.length} variants for ${handle}`);
  }

  return variants;
}

/**
 * Expand variants for unique items without center or repeating items
 * J × K combinations
 */
function expandNoCenterVariants(
  inputRow: InputRow,
  ruleSet: RuleSet,
  scenario: 'Unique+NoCenter' | 'Repeating'
): VariantSeed[] {
  const variants: VariantSeed[] = [];
  const handle = createHandle(inputRow);

  // Cartesian product J × K in rulebook order (preserve array order from CSV)
  for (const metalCode of ruleSet.metalsJ) {
    for (const qualityCode of ruleSet.qualitiesK) {
      variants.push({
        handle,
        core: inputRow.coreNumber,
        scenario,
        metalCode,
        qualityCode,
        inputRowRef: inputRow
      });
    }
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
      // Unique + Center: G × H × I
      const expectedVariants = mainRuleSet.metalsG.length * mainRuleSet.centersH.length * mainRuleSet.qualitiesI.length;
      console.log(`  💎 Unique+Center: ${mainRuleSet.metalsG.length} × ${mainRuleSet.centersH.length} × ${mainRuleSet.qualitiesI.length} = ${expectedVariants} variants`);
      return expandUniqueCenterVariants(inputRow, mainRuleSet);
    } else {
      // Unique + No Center: J × K
      const expectedVariants = mainRuleSet.metalsJ.length * mainRuleSet.qualitiesK.length;
      console.log(`  🔹 Unique+NoCenter: ${mainRuleSet.metalsJ.length} × ${mainRuleSet.qualitiesK.length} = ${expectedVariants} variants`);
      return expandNoCenterVariants(inputRow, mainRuleSet, 'Unique+NoCenter');
    }
  } else {
    // Repeating: J × K for each base row
    const variantsPerRow = mainRuleSet.metalsJ.length * mainRuleSet.qualitiesK.length;
    const expectedTotal = groupSummary.count * variantsPerRow;
    console.log(`  🔄 Repeating: ${groupSummary.count} rows × ${variantsPerRow} variants each = ${expectedTotal} total variants`);
    
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
          // |G| × |H| × |I|
          expected[handle] = mainRuleSet.metalsG.length * mainRuleSet.centersH.length * mainRuleSet.qualitiesI.length;
        } else {
          // |J| × |K|
          expected[handle] = mainRuleSet.metalsJ.length * mainRuleSet.qualitiesK.length;
        }
      } else {
        // |J| × |K| per base row
        expected[handle] = groupSummary.count * mainRuleSet.metalsJ.length * mainRuleSet.qualitiesK.length;
      }
    }
  }

  return expected;
}