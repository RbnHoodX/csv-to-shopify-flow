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
 * Group input rows by Core Number, preserving original input order
 */
export function groupByCore(inputRows: Record<string, string>[]): { groups: Map<string, InputRow[]>; coreOrder: string[] } {
  const groups = new Map<string, InputRow[]>();
  const coreOrder: string[] = [];
  const seenCores = new Set<string>();

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
      // Track order of first appearance
      if (!seenCores.has(coreNumber)) {
        coreOrder.push(coreNumber);
        seenCores.add(coreNumber);
      }
    }
    groups.get(coreNumber)!.push(inputRow);
  }

  return { groups, coreOrder };
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
 * Create summary from grouped input rows preserving original input order
 */
export function createGroupSummary(
  groups: Map<string, InputRow[]>,
  coreOrder: string[],
  naturalRules?: RuleSet,
  labGrownRules?: RuleSet,
  noStonesRules?: NoStonesRuleSet
): GroupSummary[] {
  const summary: GroupSummary[] = [];

  // Create summaries in the order cores first appeared in input
  for (const coreNumber of coreOrder) {
    const rows = groups.get(coreNumber)!;
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

  // Preserve original input order - DO NOT SORT
  return summary;
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
  const { groups, coreOrder } = groupByCore(inputRows);
  const summary = createGroupSummary(groups, coreOrder, naturalRules, labGrownRules, noStonesRules);
  
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