import { create } from 'zustand';
import { parseCsv, normalizeRow, type ParsedCSV } from '@/lib/csv-parser';
import { extractRuleSets, extractNoStonesRuleSets, logRuleSetStats, type RuleSet, type NoStonesRuleSet } from '@/lib/rulebook-parser';
import { processInputData, type GroupSummary } from '@/lib/input-processor';
import { expandAllVariants, calculateExpectedCounts, type ExpansionResult } from '@/lib/variant-expansion';

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
  uploadFile: (fileType: keyof CSVStore['files'], file: File) => Promise<void>;
  removeFile: (fileType: keyof CSVStore['files']) => void;
  addLog: (level: LogEntry['level'], message: string) => void;
  clearLogs: () => void;
  generateShopifyCSV: () => Promise<void>;
  processInputAnalysis: () => void;
  processVariantExpansion: () => void;
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
  logs: [],
  generatedCSV: '',

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
        addLog('info', `Lookup tables: Weight=${(ruleSet as RuleSet).weightIndex.size}, Price=${(ruleSet as RuleSet).metalPrice.size}, Labor=${(ruleSet as RuleSet).labor.size}, Margins=${(ruleSet as RuleSet).margins.length}`);
      } else if (fileType === 'labGrownRules') {
        ruleSet = extractRuleSets(parsed.rows);
        logRuleSetStats(ruleSet, 'LabGrown');
        addLog('info', `LabGrown Rules: G=${(ruleSet as RuleSet).metalsG.length}, H=${(ruleSet as RuleSet).centersH.length}, I=${(ruleSet as RuleSet).qualitiesI.length}, J=${(ruleSet as RuleSet).metalsJ.length}, K=${(ruleSet as RuleSet).qualitiesK.length}`);
        addLog('info', `Lookup tables: Weight=${(ruleSet as RuleSet).weightIndex.size}, Price=${(ruleSet as RuleSet).metalPrice.size}, Labor=${(ruleSet as RuleSet).labor.size}, Margins=${(ruleSet as RuleSet).margins.length}`);
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
    const { variantExpansion, addLog } = get();
    
    if (!variantExpansion) {
      addLog('error', 'No variant expansion data available. Please upload and process input files first.');
      return;
    }

    try {
      addLog('info', 'Generating Shopify CSV with parent-child pattern...');
      
      const { generateShopifyRows, shopifyRowsToCSV, validateShopifyRows } = await import('@/lib/shopify-generator');
      
      // Generate Shopify rows from variants
      const shopifyRows = generateShopifyRows(variantExpansion.result.variants);
      
      // Validate the structure
      const validation = validateShopifyRows(shopifyRows);
      
      if (!validation.isValid) {
        addLog('error', `Shopify CSV validation failed: ${validation.errors.join(', ')}`);
        return;
      }
      
      // Convert to CSV
      const csv = shopifyRowsToCSV(shopifyRows);
      
      set({ generatedCSV: csv });
      
      addLog('success', `Generated Shopify CSV: ${validation.stats.totalRows} rows, ${validation.stats.totalHandles} products`);
      addLog('info', `Structure: ${validation.stats.parentRows} parent rows, ${validation.stats.childRows} child rows`);
      
    } catch (error) {
      addLog('error', `Failed to generate Shopify CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
}));