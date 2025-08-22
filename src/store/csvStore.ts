import { create } from 'zustand';
import { parseCsv, normalizeRow, type ParsedCSV } from '@/lib/csv-parser';
import { extractRuleSets, extractNoStonesRuleSets, logRuleSetStats, type RuleSet, type NoStonesRuleSet } from '@/lib/rulebook-parser';
import { processInputData, type GroupSummary } from '@/lib/input-processor';
import { expandAllVariants, calculateExpectedCounts, type ExpansionResult } from '@/lib/variant-expansion';
import type { WeightLookupTable } from '@/lib/weight-lookup';
import { getDefaultWeightLookup } from '@/lib/weight-lookup';

export type CSVFile = {
  name: string;
  rawText: string;
  parsedRows: any[];
  normalizedRows: Record<string, any>[];
  ruleSet?: RuleSet | NoStonesRuleSet;
  rowCount: number;
  headers: string[];
  uploaded: boolean;
};

export type LogEntry = {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
};

interface CSVStore {
  files: {
    inputTest: CSVFile;
    naturalRules: CSVFile;
    labGrownRules: CSVFile;
    noStonesRules: CSVFile;
  };
  weightTable?: WeightLookupTable;
  inputAnalysis?: {
    summary: GroupSummary[];
    stats: {
      totalRows: number;
      totalGroups: number;
      uniqueGroups: number;
      repeatingGroups: number;
      naturalItems: number;
      labGrownItems: number;
      noStonesItems: number;
    };
  };
  variantExpansion?: {
    result: ExpansionResult;
    expectedCounts: Record<string, number>;
  };
  logs: LogEntry[];
  generatedCSV: string;
  shopifyRowsWithCosts?: any[]; // For preview functionality
  isGenerating: boolean; // Loading state for CSV generation
  uploadFile: (fileType: keyof CSVStore['files'], file: File) => Promise<void>;
  removeFile: (fileType: keyof CSVStore['files']) => void;
  addLog: (level: LogEntry['level'], message: string) => void;
  clearLogs: () => void;
  generateShopifyCSV: () => Promise<void>;
  processInputAnalysis: () => void;
  processVariantExpansion: () => void;
  setWeightTable: (weightTable: WeightLookupTable) => void;
}

const createEmptyFile = (name: string): CSVFile => ({
  name,
  rawText: '',
  parsedRows: [],
  normalizedRows: [],
  rowCount: 0,
  headers: [],
  uploaded: false,
});

export const useCSVStore = create<CSVStore>((set, get) => ({
  files: {
    inputTest: createEmptyFile('Input test.csv'),
    naturalRules: createEmptyFile('Natural Rules.csv'),
    labGrownRules: createEmptyFile('LabGrown Rules.csv'),
    noStonesRules: createEmptyFile('No Stones Rules.csv'),
  },
  weightTable: getDefaultWeightLookup(),
  logs: [],
  generatedCSV: '',
  isGenerating: false,

  uploadFile: async (fileType, file) => {
    const { addLog, processInputAnalysis, processVariantExpansion } = get();
    
    try {
      const text = await file.text();
      const parsed: ParsedCSV = parseCsv(text);
      
      // Normalize all rows (preserve originals, don't mutate source)
      const normalizedRows = parsed.rows.map(row => normalizeRow(row));

      // Extract rule sets based on file type
      let ruleSet: RuleSet | NoStonesRuleSet | undefined;
      
      if (fileType === 'naturalRules') {
        ruleSet = extractRuleSets(parsed.rows);
        logRuleSetStats(ruleSet, 'Natural');
        addLog('info', `Natural Rules: G=${(ruleSet as RuleSet).metalsG.length}, H=${(ruleSet as RuleSet).centersH.length}, I=${(ruleSet as RuleSet).qualitiesI.length}, J=${(ruleSet as RuleSet).metalsJ.length}, K=${(ruleSet as RuleSet).qualitiesK.length}`);
        addLog('info', `Expected Natural G×H×I combinations: ${(ruleSet as RuleSet).metalsG.length} × ${(ruleSet as RuleSet).centersH.length} × ${(ruleSet as RuleSet).qualitiesI.length} = ${(ruleSet as RuleSet).metalsG.length * (ruleSet as RuleSet).centersH.length * (ruleSet as RuleSet).qualitiesI.length}`);
        addLog('info', `Lookup tables: Weight=${(ruleSet as RuleSet).weightIndex.size}, Price=${(ruleSet as RuleSet).metalPrice.size}, Labor=${(ruleSet as RuleSet).labor.size}, Margins=${(ruleSet as RuleSet).margins.length}, Diamonds=${(ruleSet as RuleSet).diamondPrices.length}`);
      } else if (fileType === 'labGrownRules') {
        ruleSet = extractRuleSets(parsed.rows);
        logRuleSetStats(ruleSet, 'LabGrown');
        addLog('info', `LabGrown Rules: G=${(ruleSet as RuleSet).metalsG.length}, H=${(ruleSet as RuleSet).centersH.length}, I=${(ruleSet as RuleSet).qualitiesI.length}, J=${(ruleSet as RuleSet).metalsJ.length}, K=${(ruleSet as RuleSet).qualitiesK.length}`);
        addLog('info', `Expected LabGrown G×H×I combinations: ${(ruleSet as RuleSet).metalsG.length} × ${(ruleSet as RuleSet).centersH.length} × ${(ruleSet as RuleSet).qualitiesI.length} = ${(ruleSet as RuleSet).metalsG.length * (ruleSet as RuleSet).centersH.length * (ruleSet as RuleSet).qualitiesI.length}`);
        addLog('info', `Lookup tables: Weight=${(ruleSet as RuleSet).weightIndex.size}, Price=${(ruleSet as RuleSet).metalPrice.size}, Labor=${(ruleSet as RuleSet).labor.size}, Margins=${(ruleSet as RuleSet).margins.length}, Diamonds=${(ruleSet as RuleSet).diamondPrices.length}`);
      } else if (fileType === 'noStonesRules') {
        ruleSet = extractNoStonesRuleSets(parsed.rows);
        logRuleSetStats(ruleSet, 'NoStones');
        addLog('info', `No Stones Rules: Metals A=${(ruleSet as NoStonesRuleSet).metalsA.length}`);
      }

      set(state => ({
        files: {
          ...state.files,
          [fileType]: {
            name: file.name,
            rawText: text,
            parsedRows: parsed.rows,
            normalizedRows,
            ruleSet,
            rowCount: parsed.rows.length,
            headers: parsed.headers,
            uploaded: true,
          }
        }
      }));

      addLog('success', `Successfully parsed ${file.name}: ${parsed.rows.length} rows, ${parsed.headers.length} columns`);
      addLog('info', `Normalized ${normalizedRows.length} rows with validation`);
      
      // Process input analysis if this was the input file or if input file exists
      if (fileType === 'inputTest' || get().files.inputTest.uploaded) {
        processInputAnalysis();
      }

      // Process variant expansion if we have input analysis and this affects rules
      const state = get();
      if (state.inputAnalysis && (fileType !== 'inputTest')) {
        processVariantExpansion();
      }
      
    } catch (error) {
      addLog('error', `Failed to parse ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  removeFile: (fileType) => {
    const fileName = get().files[fileType].name;
    
    set(state => ({
      files: {
        ...state.files,
        [fileType]: createEmptyFile(state.files[fileType].name.split('.')[0] + '.csv')
      }
    }));

    get().addLog('info', `Removed ${fileName}`);
    
    // Clear analyses if key files are removed
    if (fileType === 'inputTest') {
      set({ inputAnalysis: undefined, variantExpansion: undefined });
    } else {
      // Reprocess variant expansion if rules changed
      const state = get();
      if (state.inputAnalysis) {
        get().processVariantExpansion();
      }
    }
  },

  processInputAnalysis: () => {
    const { files, addLog, processVariantExpansion } = get();
    
    if (!files.inputTest.uploaded) {
      set({ inputAnalysis: undefined, variantExpansion: undefined });
      return;
    }

    try {
      const naturalRules = files.naturalRules.ruleSet as RuleSet | undefined;
      const labGrownRules = files.labGrownRules.ruleSet as RuleSet | undefined;
      const noStonesRules = files.noStonesRules.ruleSet as NoStonesRuleSet | undefined;
      
      const analysis = processInputData(
        files.inputTest.parsedRows,
        naturalRules,
        labGrownRules,
        noStonesRules
      );

      set({ inputAnalysis: analysis });
      
      addLog('success', `Input analysis complete: ${analysis.stats.totalGroups} core numbers, ${analysis.stats.uniqueGroups} unique, ${analysis.stats.repeatingGroups} repeating`);
      addLog('info', `Rulebook distribution: Natural=${analysis.stats.naturalItems}, LabGrown=${analysis.stats.labGrownItems}, NoStones=${analysis.stats.noStonesItems}`);
      
      // Trigger variant expansion
      processVariantExpansion();
      
    } catch (error) {
      addLog('error', `Failed to analyze input data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  processVariantExpansion: () => {
    const { files, inputAnalysis, addLog } = get();
    
    if (!inputAnalysis) {
      set({ variantExpansion: undefined });
      return;
    }

    try {
      const naturalRules = files.naturalRules.ruleSet as RuleSet | undefined;
      const labGrownRules = files.labGrownRules.ruleSet as RuleSet | undefined;
      const noStonesRules = files.noStonesRules.ruleSet as NoStonesRuleSet | undefined;
      
      const result = expandAllVariants(
        inputAnalysis.summary,
        naturalRules,
        labGrownRules,
        noStonesRules
      );

      const expectedCounts = calculateExpectedCounts(
        inputAnalysis.summary,
        naturalRules,
        labGrownRules,
        noStonesRules
      );

      set({ variantExpansion: { result, expectedCounts } });
      
      addLog('success', `Variant expansion complete: ${result.stats.totalVariants} total variants`);
      addLog('info', `Breakdown: Center=${result.stats.uniqueCenterVariants}, NoCenter=${result.stats.uniqueNoCenterVariants}, Repeating=${result.stats.repeatingVariants}, NoStones=${result.stats.noStonesVariants}`);
      
    } catch (error) {
      addLog('error', `Failed to expand variants: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  addLog: (level, message) => {
    set(state => ({
      logs: [{
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
        level,
        message,
      }, ...state.logs].slice(0, 100) // Keep only last 100 logs
    }));
  },

  clearLogs: () => {
    set({ logs: [] });
  },

  generateShopifyCSV: async () => {
    const { variantExpansion, files, addLog, clearLogs } = get();
    
    // Set loading state
    set({ isGenerating: true });
    
    // Clear previous logs for new generation
    clearLogs();
    
    addLog('info', '🚀 Starting Shopify CSV generation pipeline...');
    
    // Stage 1: Validate 4 files present
    addLog('info', '📋 Stage 1: Validating input files...');
    const requiredFiles = ['inputTest', 'naturalRules', 'labGrownRules', 'noStonesRules'] as const;
    const missingFiles = requiredFiles.filter(fileType => !files[fileType].rawText);
    
    if (missingFiles.length > 0) {
      addLog('error', `❌ Missing required files: ${missingFiles.join(', ')}`);
      return;
    }
    
    addLog('success', '✅ All 4 files validated successfully');
    
    // Stage 2: Build rule sets and lookups
    addLog('info', '🔧 Stage 2: Building rule sets and lookups...');
    const naturalRules = files.naturalRules.ruleSet as RuleSet | undefined;
    const labGrownRules = files.labGrownRules.ruleSet as RuleSet | undefined;
    const noStonesRules = files.noStonesRules.ruleSet as NoStonesRuleSet | undefined;
    
    let ruleSetWarnings = 0;
    if (!naturalRules?.labor) {
      addLog('warning', '⚠️ Natural rules labor table missing - using defaults');
      ruleSetWarnings++;
    }
    if (!labGrownRules?.labor) {
      addLog('warning', '⚠️ Lab grown rules labor table missing - using defaults');
      ruleSetWarnings++;
    }
    if (!noStonesRules?.metalsA) {
      addLog('warning', '⚠️ No stones rules metals table missing - using defaults');
      ruleSetWarnings++;
    }
    
    addLog('info', `📊 Rule sets built - ${ruleSetWarnings} warnings for missing lookups`);
    
    // Stage 3: Validate variant expansion
    addLog('info', '🔄 Stage 3: Validating variant expansion data...');
    if (!variantExpansion) {
      addLog('error', '❌ No variant expansion data available. Please process input files first.');
      return;
    }
    
    const variantCount = variantExpansion.result.variants.length;
    const handleCount = new Set(variantExpansion.result.variants.map(v => v.handle)).size;
    addLog('success', `✅ Variant expansion validated: ${variantCount} variants across ${handleCount} products`);

    try {
      // Stage 4: Compute grams/costs/prices
      addLog('info', '💰 Stage 4: Computing costs and pricing...');
      
      const { generateShopifyRowsWithCosts, shopifyRowsToCSV, validateShopifyRows } = await import('@/lib/shopify-generator');
      
      // Generate Shopify rows with costs
      const shopifyRowsWithCosts = generateShopifyRowsWithCosts(
        variantExpansion.result.variants,
        naturalRules,
        labGrownRules,
        noStonesRules,
        get().weightTable,
        (warning) => {
          addLog('warning', warning);
        }
      );
      
      // Calculate cost statistics
      const totalCost = shopifyRowsWithCosts.reduce((sum, row) => sum + row.costBreakdown.totalCost, 0);
      const avgCost = totalCost / shopifyRowsWithCosts.length;
      const minCost = Math.min(...shopifyRowsWithCosts.map(row => row.costBreakdown.totalCost));
      const maxCost = Math.max(...shopifyRowsWithCosts.map(row => row.costBreakdown.totalCost));
      
      addLog('success', `✅ Cost calculations complete - Average: $${avgCost.toFixed(2)}, Range: $${minCost.toFixed(2)}-$${maxCost.toFixed(2)}`);
      
      // Stage 5: Assemble parent/child rows with meta/SEO/Google
      addLog('info', '🏗️ Stage 5: Assembling parent-child rows with metadata...');
      const parentRows = shopifyRowsWithCosts.filter(row => row.Title).length;
      const childRows = shopifyRowsWithCosts.filter(row => !row.Title).length;
      
      addLog('success', `✅ Row assembly complete - ${parentRows} parent rows, ${childRows} child rows`);
      
      // Stage 6: Serialize CSV with locked header order
      addLog('info', '📄 Stage 6: Serializing CSV with spec-compliant headers...');
      
      // Strip cost breakdown for CSV export
      const shopifyRows = shopifyRowsWithCosts.map(({ costBreakdown, ...row }) => row);
      
      // Validate the structure
      const validation = validateShopifyRows(shopifyRows);
      
      if (!validation.isValid) {
        addLog('error', `❌ Shopify CSV validation failed: ${validation.errors.join(', ')}`);
        return;
      }
      
      // Convert to CSV with exact header order
      const csv = shopifyRowsToCSV(shopifyRows);
      
      addLog('success', `✅ CSV serialization complete - ${csv.split('\n').length - 1} data rows`);
      
      // Stage 7: Final validation and stats
      addLog('info', '📊 Stage 7: Final validation and statistics...');
      
      set({ 
        generatedCSV: csv,
        shopifyRowsWithCosts // Store for preview
      });
      
      addLog('success', `🎉 Pipeline complete! Generated Shopify CSV ready for import`);
      addLog('info', `📈 Final stats: ${validation.stats.totalRows} total rows, ${validation.stats.totalHandles} unique products`);
      addLog('info', `💎 Cost summary: Total $${totalCost.toFixed(2)} across all variants`);
      
      // Check for any data quality issues
      const noSKURows = shopifyRows.filter(row => !row['Variant SKU']).length;
      const noPriceRows = shopifyRows.filter(row => !row['Variant Price'] || row['Variant Price'] === '0.00').length;
      
      if (noSKURows > 0) addLog('warning', `⚠️ ${noSKURows} rows missing SKU`);
      if (noPriceRows > 0) addLog('warning', `⚠️ ${noPriceRows} rows with zero/missing price`);
      
    } catch (error) {
      addLog('error', `❌ Pipeline failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Generation pipeline error:', error);
    } finally {
      // Always reset loading state
      set({ isGenerating: false });
    }
  },

  setWeightTable: (weightTable) => {
    set({ weightTable });
    get().addLog('success', `Weight lookup table loaded: ${weightTable.size} core numbers`);
  },
}));