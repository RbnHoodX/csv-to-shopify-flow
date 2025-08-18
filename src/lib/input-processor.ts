import { trimAll } from './csv-parser';
import type { RuleSet, NoStonesRuleSet } from './rulebook-parser';

export interface InputRow {
  coreNumber: string;
  diamondsType: string;
  [key: string]: any; // Other columns from the input CSV
}

export interface GroupSummary {
  coreNumber: string;
  count: number;
  isUnique: boolean;
  diamondsType: string;
  rulebook: string;
  rows: InputRow[];
}

/**
 * Group input rows by Core Number
 */
export function groupByCore(inputRows: Record<string, string>[]): Map<string, InputRow[]> {
  const groups = new Map<string, InputRow[]>();

  for (const row of inputRows) {
    // Find Core Number column (try various common names)
    const coreNumber = trimAll(
      row['Core Number'] || 
      row['CoreNumber'] || 
      row['Core'] || 
      row['SKU'] || 
      row['Item Number'] || 
      ''
    );

    // Find Diamonds Type column
    const diamondsType = trimAll(
      row['Diamonds Type'] || 
      row['DiamondsType'] || 
      row['Diamond Type'] || 
      row['Type'] || 
      ''
    );

    if (!coreNumber) continue;

    const inputRow: InputRow = {
      coreNumber,
      diamondsType,
      ...row // Include all original columns
    };

    if (!groups.has(coreNumber)) {
      groups.set(coreNumber, []);
    }
    groups.get(coreNumber)!.push(inputRow);
  }

  return groups;
}

/**
 * Check if a group is unique (only one item)
 */
export function isUnique(group: InputRow[]): boolean {
  return group.length === 1;
}

/**
 * Pick appropriate rulebook based on Diamonds Type
 */
export function pickRulebook(
  diamondsType: string,
  naturalRules?: RuleSet,
  labGrownRules?: RuleSet,
  noStonesRules?: NoStonesRuleSet
): string {
  const type = trimAll(diamondsType).toLowerCase();
  
  if (type.includes('natural')) {
    return naturalRules ? 'Natural Rules' : 'Natural Rules (missing)';
  } else if (type.includes('labgrown') || type.includes('lab grown') || type.includes('lab-grown')) {
    return labGrownRules ? 'LabGrown Rules' : 'LabGrown Rules (missing)';
  } else if (type.includes('no stones') || type.includes('nostones') || type === '') {
    return noStonesRules ? 'No Stones Rules' : 'No Stones Rules (missing)';
  }
  
  // Default fallback
  return `Unknown (${diamondsType})`;
}

/**
 * Create summary from grouped input rows
 */
export function createGroupSummary(
  groups: Map<string, InputRow[]>,
  naturalRules?: RuleSet,
  labGrownRules?: RuleSet,
  noStonesRules?: NoStonesRuleSet
): GroupSummary[] {
  const summary: GroupSummary[] = [];

  for (const [coreNumber, rows] of groups) {
    // Use the first row's diamonds type for the group
    const diamondsType = rows[0]?.diamondsType || '';
    
    summary.push({
      coreNumber,
      count: rows.length,
      isUnique: isUnique(rows),
      diamondsType,
      rulebook: pickRulebook(diamondsType, naturalRules, labGrownRules, noStonesRules),
      rows
    });
  }

  // Sort by core number for consistent display
  return summary.sort((a, b) => a.coreNumber.localeCompare(b.coreNumber));
}

/**
 * Process input data and create complete analysis
 */
export function processInputData(
  inputRows: Record<string, string>[],
  naturalRules?: RuleSet,
  labGrownRules?: RuleSet,
  noStonesRules?: NoStonesRuleSet
) {
  const groups = groupByCore(inputRows);
  const summary = createGroupSummary(groups, naturalRules, labGrownRules, noStonesRules);
  
  const stats = {
    totalRows: inputRows.length,
    totalGroups: groups.size,
    uniqueGroups: summary.filter(s => s.isUnique).length,
    repeatingGroups: summary.filter(s => !s.isUnique).length,
    naturalItems: summary.filter(s => s.rulebook.includes('Natural')).length,
    labGrownItems: summary.filter(s => s.rulebook.includes('LabGrown')).length,
    noStonesItems: summary.filter(s => s.rulebook.includes('No Stones')).length,
  };

  return {
    groups,
    summary,
    stats
  };
}