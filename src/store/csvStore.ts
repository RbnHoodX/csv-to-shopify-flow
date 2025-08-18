import { create } from 'zustand';
import { parseCsv, normalizeRow, type ParsedCSV } from '@/lib/csv-parser';
import { extractRuleSets, extractNoStonesRuleSets, logRuleSetStats, type RuleSet, type NoStonesRuleSet } from '@/lib/rulebook-parser';
import { processInputData, type GroupSummary } from '@/lib/input-processor';

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
  logs: LogEntry[];
  generatedCSV: string;
  uploadFile: (fileType: keyof CSVStore['files'], file: File) => Promise<void>;
  removeFile: (fileType: keyof CSVStore['files']) => void;
  addLog: (level: LogEntry['level'], message: string) => void;
  clearLogs: () => void;
  generateShopifyCSV: () => Promise<void>;
  processInputAnalysis: () => void;
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
    const { addLog, processInputAnalysis } = get();
    
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
    
    // Clear input analysis if input test file was removed
    if (fileType === 'inputTest') {
      set({ inputAnalysis: undefined });
    }
  },

  processInputAnalysis: () => {
    const { files, addLog } = get();
    
    if (!files.inputTest.uploaded) {
      set({ inputAnalysis: undefined });
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
      
    } catch (error) {
      addLog('error', `Failed to analyze input data: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    const { files, addLog } = get();
    
    // Check if all required files are uploaded
    const requiredFiles = ['inputTest', 'naturalRules', 'labGrownRules', 'noStonesRules'] as const;
    const missingFiles = requiredFiles.filter(key => !files[key].uploaded);
    
    if (missingFiles.length > 0) {
      addLog('error', `Cannot generate CSV. Missing files: ${missingFiles.map(key => files[key].name).join(', ')}`);
      return;
    }

    try {
      addLog('info', 'Starting Shopify CSV generation...');
      
      // Basic CSV generation logic (Base44 spec placeholder)
      const headers = ['Handle', 'Title', 'Body (HTML)', 'Vendor', 'Product Category', 'Type', 'Tags', 'Published', 'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value', 'Option3 Name', 'Option3 Value', 'Variant SKU', 'Variant Grams', 'Variant Inventory Tracker', 'Variant Inventory Qty', 'Variant Inventory Policy', 'Variant Fulfillment Service', 'Variant Price', 'Variant Compare At Price', 'Variant Requires Shipping', 'Variant Taxable', 'Variant Barcode', 'Image Src', 'Image Position', 'Image Alt Text', 'Gift Card', 'SEO Title', 'SEO Description', 'Google Shopping / Google Product Category', 'Google Shopping / Gender', 'Google Shopping / Age Group', 'Google Shopping / MPN', 'Google Shopping / AdWords Grouping', 'Google Shopping / AdWords Labels', 'Google Shopping / Condition', 'Google Shopping / Custom Product', 'Google Shopping / Custom Label 0', 'Google Shopping / Custom Label 1', 'Google Shopping / Custom Label 2', 'Google Shopping / Custom Label 3', 'Google Shopping / Custom Label 4', 'Variant Image', 'Variant Weight Unit', 'Variant Tax Code', 'Cost per item', 'Price / International', 'Compare At Price / International', 'Status'];
      
      const csvRows = [headers.join(',')];
      
      // Process input test data with rules (simplified for now)
      files.inputTest.parsedRows.forEach((row, index) => {
        const csvRow = headers.map(header => {
          // Basic mapping logic - this would be expanded based on Base44 spec
          switch (header) {
            case 'Handle':
              return `product-${index + 1}`;
            case 'Title':
              return row['Title'] || row['Product Name'] || `Product ${index + 1}`;
            case 'Published':
              return 'TRUE';
            case 'Variant Price':
              return row['Price'] || '0.00';
            default:
              return '';
          }
        });
        csvRows.push(csvRow.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','));
      });
      
      const generatedCSV = csvRows.join('\n');
      
      set({ generatedCSV });
      addLog('success', `Generated Shopify CSV with ${files.inputTest.parsedRows.length} products`);
      
    } catch (error) {
      addLog('error', `Failed to generate CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
}));