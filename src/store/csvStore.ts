import { create } from 'zustand';
import { parseCsv, normalizeRow, type ParsedCSV } from '@/lib/csv-parser';

export type CSVFile = {
  name: string;
  rawText: string;
  parsedRows: any[];
  normalizedRows: Record<string, any>[];
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
  logs: LogEntry[];
  generatedCSV: string;
  uploadFile: (fileType: keyof CSVStore['files'], file: File) => Promise<void>;
  removeFile: (fileType: keyof CSVStore['files']) => void;
  addLog: (level: LogEntry['level'], message: string) => void;
  clearLogs: () => void;
  generateShopifyCSV: () => Promise<void>;
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
    const { addLog } = get();
    
    try {
      const text = await file.text();
      const parsed: ParsedCSV = parseCsv(text);
      
      // Normalize all rows (preserve originals, don't mutate source)
      const normalizedRows = parsed.rows.map(row => normalizeRow(row));

      set(state => ({
        files: {
          ...state.files,
          [fileType]: {
            name: file.name,
            rawText: text,
            parsedRows: parsed.rows,
            normalizedRows,
            rowCount: parsed.rows.length,
            headers: parsed.headers,
            uploaded: true,
          }
        }
      }));

      addLog('success', `Successfully parsed ${file.name}: ${parsed.rows.length} rows, ${parsed.headers.length} columns`);
      addLog('info', `Normalized ${normalizedRows.length} rows with validation`);
      
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