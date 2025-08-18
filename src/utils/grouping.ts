/**
 * Pure helper functions for grouping and analyzing input data
 */

import type { InputRow, CoreGroup, VariantSeed } from '@/types/core';
import { trimAll } from '@/lib/csv-parser';

/**
 * Group input rows by core number
 */
export function groupByCoreNumber(inputRows: InputRow[]): Map<string, InputRow[]> {
  const groups = new Map<string, InputRow[]>();
  
  for (const row of inputRows) {
    const coreNumber = row.coreNumber;
    if (!coreNumber) continue;
    
    if (!groups.has(coreNumber)) {
      groups.set(coreNumber, []);
    }
    groups.get(coreNumber)!.push(row);
  }
  
  return groups;
}

/**
 * Determine if a core group represents a unique item (single row)
 */
export function isUnique(rows: InputRow[]): boolean {
  return rows.length === 1;
}

/**
 * Determine scenario for a core group
 */
export function determineScenario(rows: InputRow[]): VariantSeed['scenario'] {
  if (rows.length === 0) throw new Error('Cannot determine scenario for empty rows');
  
  const firstRow = rows[0];
  const diamondsType = (firstRow.diamondsType || '').toLowerCase();
  
  // No stones scenario
  if (diamondsType.includes('no stones')) {
    return 'NoStones';
  }
  
  // Unique items
  if (rows.length === 1) {
    const hasCenter = (firstRow['Center ct'] || firstRow['Center Ct'] || firstRow['CenterCt'] || '') !== '';
    return hasCenter ? 'Unique+Center' : 'Unique+NoCenter';
  }
  
  // Multiple rows = Repeating
  return 'Repeating';
}

/**
 * Generate handle for a core group
 */
export function generateHandle(coreNumber: string, scenario: VariantSeed['scenario']): string {
  const cleanCore = coreNumber.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const scenarioSuffix = scenario === 'NoStones' ? '-nostones' : '';
  return `${cleanCore}${scenarioSuffix}`;
}

/**
 * Create core groups from input rows
 */
export function createCoreGroups(inputRows: InputRow[]): CoreGroup[] {
  const groupMap = groupByCoreNumber(inputRows);
  const coreGroups: CoreGroup[] = [];
  
  for (const [coreNumber, rows] of groupMap.entries()) {
    if (rows.length === 0) continue;
    
    const firstRow = rows[0];
    const scenario = determineScenario(rows);
    const handle = generateHandle(coreNumber, scenario);
    const diamondsType = firstRow.diamondsType || '';
    
    coreGroups.push({
      coreNumber,
      scenario,
      inputRows: rows,
      handle,
      isUnique: isUnique(rows),
      diamondsType
    });
  }
  
  return coreGroups;
}

/**
 * Calculate statistics from core groups
 */
export function calculateGroupStats(coreGroups: CoreGroup[]) {
  const stats = {
    totalGroups: coreGroups.length,
    uniqueGroups: 0,
    repeatingGroups: 0,
    naturalItems: 0,
    labGrownItems: 0,
    noStonesItems: 0,
    totalRows: 0
  };
  
  for (const group of coreGroups) {
    stats.totalRows += group.inputRows.length;
    
    if (group.isUnique) {
      stats.uniqueGroups++;
    } else {
      stats.repeatingGroups++;
    }
    
    const diamondsType = group.diamondsType.toLowerCase();
    if (diamondsType.includes('natural')) {
      stats.naturalItems += group.inputRows.length;
    } else if (diamondsType.includes('labgrown')) {
      stats.labGrownItems += group.inputRows.length;
    } else if (diamondsType.includes('no stones')) {
      stats.noStonesItems += group.inputRows.length;
    }
  }
  
  return stats;
}