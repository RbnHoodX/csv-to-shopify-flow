/**
 * Core type definitions for the CSV to Shopify converter
 */

// Base input row structure from uploaded CSV
export interface InputRow {
  'Core Number': string;
  'Diamonds Type': string;
  Category: string;
  Subcategory: string;
  'Grams Weight': string;
  'Total Ct Weight': string;
  'Center ct'?: string;
  'Sum Side Ct': string;
  'Side Stone Count': string;
  'Center shape'?: string;
  'Side shapes'?: string;
  Title?: string;
  Tags?: string;
  Vendor?: string;
  Type?: string;
  
  // Flexible indexer for additional fields
  [key: string]: string | undefined;
}

// Variant seed generated during expansion
export interface VariantSeed {
  handle: string;
  core: string;
  scenario: 'Unique+Center' | 'Unique+NoCenter' | 'Repeating' | 'NoStones';
  metalCode: string;
  centerSize?: string;
  qualityCode?: string;
  inputRowRef: InputRow;
}

// Shopify row structure (all string values for CSV compatibility)
export interface ShopifyRow {
  Handle: string;
  Title: string;
  'Body (HTML)': string;
  Vendor: string;
  Type: string;
  Tags: string;
  Published: string;
  'Option1 Name': string;
  'Option1 Value': string;
  'Option2 Name': string;
  'Option2 Value': string;
  'Option3 Name': string;
  'Option3 Value': string;
  'Variant SKU': string;
  'Variant Grams': string;
  'Variant Inventory Tracker': string;
  'Variant Inventory Qty': string;
  'Variant Inventory Policy': string;
  'Variant Fulfillment Service': string;
  'Variant Price': string;
  'Variant Compare At Price': string;
  'Variant Requires Shipping': string;
  'Variant Taxable': string;
  'Variant Barcode': string;
  'Image Src': string;
  'Image Position': string;
  'Image Alt Text': string;
  'Gift Card': string;
  'SEO Title': string;
  'SEO Description': string;
  'Google Shopping / Google Product Category': string;
  'Google Shopping / Gender': string;
  'Google Shopping / Age Group': string;
  'Google Shopping / MPN': string;
  'Google Shopping / AdWords Grouping': string;
  'Google Shopping / AdWords Labels': string;
  'Google Shopping / Condition': string;
  'Google Shopping / Custom Product': string;
  'Google Shopping / Custom Label 0': string;
  'Google Shopping / Custom Label 1': string;
  'Google Shopping / Custom Label 2': string;
  'Google Shopping / Custom Label 3': string;
  'Google Shopping / Custom Label 4': string;
  'Variant Image': string;
  'Variant Weight Unit': string;
  'Variant Tax Code': string;
  'Cost per item': string;
  'Product Type': string;
  'Core Number': string;
  Category: string;
  'Diamond Cost': string;
  'Metal Cost': string;
  'Side Stone': string;
  'Center Stone': string;
  Polish: string;
  Bracelets: string;
  'CAD Creation': string;
  '25$': string;
  'Title (duplicate)': string;
  'Description (duplicate)': string;
}

// Core group for analysis
export interface CoreGroup {
  coreNumber: string;
  scenario: VariantSeed['scenario'];
  inputRows: InputRow[];
  handle: string;
  isUnique: boolean;
  diamondsType: string;
}

// Cost calculation details
export interface CostDetails {
  baseGrams: number;
  weightMultiplier: number;
  metalPricePerGram: number;
  diamondCarats: number;
  diamondPricePerCarat: number;
  sideStoneCount: number;
  hasCenter: boolean;
  isBracelet: boolean;
}

// Pricing result
export interface PricingResult {
  cost: number;
  multiplier: number;
  variantPrice: number;
  compareAtPrice: number;
  marginSource: 'natural' | 'labgrown' | 'nostones' | 'fallback';
}

// Product metadata
export interface ProductMetadata {
  title: string;
  vendor: string;
  type: string;
  tags: string;
  bodyHTML: string;
  googleCategory: string;
  diamondType: string;
  qualities: string[];
  metals: string[];
  seoTitle: string;
  seoDescription: string;
}

// Expansion statistics
export interface ExpansionStats {
  totalVariants: number;
  uniqueWithCenter: number;
  uniqueNoCenter: number;
  repeating: number;
  noStones: number;
  totalGroups: number;
}