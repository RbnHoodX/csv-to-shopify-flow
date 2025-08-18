/**
 * Pure helper functions for serializing Shopify rows to CSV
 */

import type { ShopifyRow } from '@/types/core';

/**
 * Exact header order per specification
 */
export const SHOPIFY_HEADERS = [
  'Handle',
  'Title',
  'Body (HTML)',
  'Vendor',
  'Type',
  'Tags',
  'Published',
  'Option1 Name',
  'Option1 Value',
  'Option2 Name',
  'Option2 Value',
  'Option3 Name',
  'Option3 Value',
  'Variant SKU',
  'Variant Grams',
  'Variant Inventory Tracker',
  'Variant Inventory Qty',
  'Variant Inventory Policy',
  'Variant Fulfillment Service',
  'Variant Price',
  'Variant Compare At Price',
  'Variant Requires Shipping',
  'Variant Taxable',
  'Variant Barcode',
  'Image Src',
  'Image Position',
  'Image Alt Text',
  'Gift Card',
  'SEO Title',
  'SEO Description',
  'Google Shopping / Google Product Category',
  'Google Shopping / Gender',
  'Google Shopping / Age Group',
  'Google Shopping / MPN',
  'Google Shopping / AdWords Grouping',
  'Google Shopping / AdWords Labels',
  'Google Shopping / Condition',
  'Google Shopping / Custom Product',
  'Google Shopping / Custom Label 0',
  'Google Shopping / Custom Label 1',
  'Google Shopping / Custom Label 2',
  'Google Shopping / Custom Label 3',
  'Google Shopping / Custom Label 4',
  'Variant Image',
  'Variant Weight Unit',
  'Variant Tax Code',
  'Cost per item',
  'Product Type',
  'Core Number',
  'Category',
  'Diamond Cost',
  'Metal Cost',
  'Side Stone',
  'Center Stone',
  'Polish',
  'Bracelets',
  'CAD Creation',
  '25$',
  'Title (duplicate)',
  'Description (duplicate)'
] as const;

/**
 * Escape CSV cell value
 */
export function escapeCsvCell(value: string): string {
  if (!value) return '';
  
  const escaped = String(value).replace(/"/g, '""');
  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

/**
 * Convert single row to CSV line
 */
export function rowToCsvLine(row: ShopifyRow): string {
  const values = SHOPIFY_HEADERS.map(header => {
    const value = row[header] || '';
    return escapeCsvCell(value);
  });
  return values.join(',');
}

/**
 * Serialize Shopify rows to CSV string with deterministic ordering
 */
export function serializeShopifyRows(rows: ShopifyRow[]): string {
  if (rows.length === 0) return '';
  
  // Sort deterministically by Handle, then by SKU suffix
  const sortedRows = [...rows].sort((a, b) => {
    if (a.Handle !== b.Handle) {
      return a.Handle.localeCompare(b.Handle);
    }
    
    // Extract numeric suffix from SKU for sorting
    const extractSKUSuffix = (sku: string): number => {
      const match = sku.match(/-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    };
    
    return extractSKUSuffix(a['Variant SKU']) - extractSKUSuffix(b['Variant SKU']);
  });
  
  // Build CSV with header
  const csvLines = [SHOPIFY_HEADERS.join(',')];
  
  for (const row of sortedRows) {
    csvLines.push(rowToCsvLine(row));
  }
  
  return csvLines.join('\n');
}

/**
 * Validate Shopify row structure
 */
export function validateShopifyRow(row: ShopifyRow): string[] {
  const errors: string[] = [];
  
  if (!row.Handle) {
    errors.push('Missing Handle');
  }
  
  if (!row['Variant SKU']) {
    errors.push('Missing Variant SKU'); 
  }
  
  if (!row['Variant Price']) {
    errors.push('Missing Variant Price');
  }
  
  if (!row['Cost per item']) {
    errors.push('Missing Cost per item');
  }
  
  return errors;
}

/**
 * Validate array of Shopify rows
 */
export function validateShopifyRows(rows: ShopifyRow[]): {
  isValid: boolean;
  errors: string[];
  stats: {
    totalRows: number;
    totalHandles: number;
    parentRows: number;
    childRows: number;
  };
} {
  const errors: string[] = [];
  const handles = new Set<string>();
  let parentRows = 0;
  let childRows = 0;
  
  const handleParentSeen = new Set<string>();
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowErrors = validateShopifyRow(row);
    
    if (rowErrors.length > 0) {
      errors.push(`Row ${i + 1}: ${rowErrors.join(', ')}`);
    }
    
    handles.add(row.Handle);
    
    // Check if this is a parent row (has Title)
    if (row.Title) {
      parentRows++;
      if (handleParentSeen.has(row.Handle)) {
        errors.push(`Multiple parent rows found for handle: ${row.Handle}`);
      }
      handleParentSeen.add(row.Handle);
    } else {
      childRows++;
      if (!handleParentSeen.has(row.Handle)) {
        errors.push(`Child row without parent for handle: ${row.Handle}`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    stats: {
      totalRows: rows.length,
      totalHandles: handles.size,
      parentRows,
      childRows
    }
  };
}