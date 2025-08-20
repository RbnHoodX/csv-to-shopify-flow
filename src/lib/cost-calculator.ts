import { trimAll, toNum, toFixed2 } from "./csv-parser";
import type { VariantSeed } from "./variant-expansion";
import type { RuleSet, NoStonesRuleSet } from "./rulebook-parser";
import { calculatePricing, type PricingResult } from "./pricing-calculator";
import type { WeightLookupTable } from "./weight-lookup";
import { getVariantWeight } from "./weight-lookup";

// Error types for better debugging
export class CostLookupError extends Error {
  constructor(
    message: string,
    public details: {
      type: string;
      shape: string;
      weight: number;
      quality?: string;
      productId: string;
    }
  ) {
    super(message);
    this.name = 'CostLookupError';
  }
}

export interface CostBreakdown {
  centerStoneDiamond: number;
  sideStoneDiamond: number;
  metalCost: number;
  centerStoneLabor: number;
  sideStoneLabor: number;
  polishCost: number;
  braceletsCost: number;
  pendantsCost: number;
  cadCreationCost: number;
  additionalCost: number;
  totalCost: number;
  variantGrams: number;
  sku: string;
  pricing: PricingResult;
  published: boolean;
  details: {
    baseGrams: number;
    weightMultiplier: number;
    metalPricePerGram: number;
    centerCarats: number;
    sideCarats: number;
    centerPricePerCarat: number;
    sidePricePerCarat: number;
    sideStoneCount: number;
    hasCenter: boolean;
    isBracelet: boolean;
    isPendant: boolean;
  };
}

// Utility functions for input normalization
function normalizeString(value: string): string {
  return trimAll(value || '');
}

function normalizeShape(shape: string): string {
  const normalized = normalizeString(shape);
  if (!normalized) return '';
  
  // Title case the shape (e.g., "round" -> "Round", "PRINCESS" -> "Princess")
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function normalizeQuality(quality: string): string {
  const normalized = normalizeString(quality);
  if (!normalized) return '';
  
  // Uppercase quality codes (e.g., "gh" -> "GH", "fg" -> "FG")
  return normalized.toUpperCase();
}

function normalizeWeight(weight: string | number): number {
  if (typeof weight === 'number') return weight;
  
  // Strip non-numeric characters except decimal point
  const cleanWeight = weight.replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleanWeight);
  
  if (isNaN(parsed)) {
    throw new CostLookupError('Invalid weight value', {
      type: 'unknown',
      shape: 'unknown',
      weight: 0,
      productId: 'unknown'
    });
  }
  
  return parsed;
}

/**
 * Match weight to bracket using inclusive bounds
 * Returns the bracket row that contains the weight
 */
function matchBracket(weight: number, brackets: Array<{ minSize: number; maxSize: number }>): { minSize: number; maxSize: number } | null {
  for (const bracket of brackets) {
    // Inclusive bounds: minSize <= weight <= maxSize
    if (weight >= bracket.minSize && weight <= bracket.maxSize) {
      return bracket;
    }
  }
  return null;
}

/**
 * Get price per carat from rules based on type, shape, weight, and quality
 * Natural items require quality, lab-grown items ignore quality
 */
function getPricePerCarat(
  params: { type: string; shape: string; weight: number; quality?: string },
  rules: RuleSet
): number {
  const { type, shape, weight, quality } = params;
  
  // Normalize inputs
  const normalizedType = type.toLowerCase();
  const normalizedShape = normalizeShape(shape);
  const normalizedWeight = normalizeWeight(weight);
  const normalizedQuality = quality ? normalizeQuality(quality) : undefined;
  
  if (!normalizedShape) {
    throw new CostLookupError('Missing or invalid shape', {
      type: normalizedType,
      shape: shape,
      weight: normalizedWeight,
      quality: normalizedQuality,
      productId: 'unknown'
    });
  }
  
  if (normalizedType === 'natural' && !normalizedQuality) {
    throw new CostLookupError('Natural diamonds require quality specification', {
      type: normalizedType,
      shape: normalizedShape,
      weight: normalizedWeight,
      productId: 'unknown'
    });
  }
  
  // Find matching diamond price entry
  console.log(`🔍 Looking for diamond price:`, {
    type: normalizedType,
    shape: normalizedShape,
    weight: normalizedWeight,
    quality: normalizedQuality,
    availableEntries: rules.diamondPrices.length
  });
  
  // Log all available entries for debugging
  if (rules.diamondPrices.length === 0) {
    console.log(`🔍 WARNING: No diamond prices available in rules!`);
  } else {
    console.log(`🔍 Available diamond price entries:`, rules.diamondPrices.map(entry => ({
      shape: entry.shape,
      minSize: entry.minSize,
      maxSize: entry.maxSize,
      quality: entry.quality,
      price: entry.pricePerCarat
    })));
  }
  
  // EMERGENCY: Log the exact lookup parameters
  console.log(`🔍 EMERGENCY LOOKUP PARAMS:`, {
    type: normalizedType,
    shape: normalizedShape,
    weight: normalizedWeight,
    quality: normalizedQuality,
    availableEntries: rules.diamondPrices.length
  });
  
  for (const entry of rules.diamondPrices) {
    const shapeMatch = entry.shape.toLowerCase() === normalizedShape.toLowerCase();
    const sizeMatch = normalizedWeight >= entry.minSize && normalizedWeight <= entry.maxSize;
    
    console.log(`🔍 Checking entry:`, {
      entryShape: entry.shape,
      entryMin: entry.minSize,
      entryMax: entry.maxSize,
      entryQuality: entry.quality,
      entryPrice: entry.pricePerCarat,
      shapeMatch,
      sizeMatch,
      qualityMatch: normalizedType === 'natural' ? entry.quality === normalizedQuality : 'N/A'
    });
    
    // Add detailed size matching debug
    if (shapeMatch) {
      console.log(`🔍 Size bracket check for ${entry.shape}:`);
      console.log(`   - Looking for weight: ${normalizedWeight} ct`);
      console.log(`   - Bracket range: ${entry.minSize} - ${entry.maxSize} ct`);
      console.log(`   - Weight >= min: ${normalizedWeight >= entry.minSize}`);
      console.log(`   - Weight <= max: ${normalizedWeight <= entry.maxSize}`);
      console.log(`   - Size match: ${sizeMatch}`);
    }
    
    if (normalizedType === 'natural') {
      // Natural diamonds: must match shape, size, AND quality
      const qualityMatch = entry.quality === normalizedQuality;
      if (shapeMatch && sizeMatch && qualityMatch) {
        console.log(`✅ Found matching natural diamond price: $${entry.pricePerCarat}/ct`);
        return entry.pricePerCarat;
      }
    } else {
      // Lab-grown diamonds: match shape and size, ignore quality
      if (shapeMatch && sizeMatch) {
        console.log(`✅ Found matching lab-grown diamond price: $${entry.pricePerCarat}/ct`);
        return entry.pricePerCarat;
      }
    }
  }
  
  // No match found - throw error with details
  throw new CostLookupError('No matching diamond price found', {
    type: normalizedType,
    shape: normalizedShape,
    weight: normalizedWeight,
    quality: normalizedQuality,
    productId: 'unknown'
  });
}

/**
 * Price center stone using correct rules table and lookup logic
 */
function priceCenter(
  stone: { type: string; shape: string; weight: number; quality?: string },
  rules: RuleSet
): number {
  const pricePerCarat = getPricePerCarat(stone, rules);
  const totalCost = stone.weight * pricePerCarat;
  
  // Debug logging
  console.log(`💎 Center stone pricing:`, {
    type: stone.type,
    shape: stone.shape,
    weight: stone.weight,
    quality: stone.quality,
    pricePerCarat,
    totalCost: toFixed2(totalCost)
  });
  
  return parseFloat(toFixed2(totalCost));
}

/**
 * Compute total costs with proper separation of concerns
 */
function computeTotals(
  params: { center?: number; sides?: number; metal: number },
  rules: RuleSet
): { center_cost: number; sides_cost: number; metal_cost: number; total_cost: number } {
  const center_cost = params.center || 0;
  const sides_cost = params.sides || 0;
  const metal_cost = params.metal;
  
  // Metal cost is additive only - not multiplied by carat weight
  const total_cost = center_cost + sides_cost + metal_cost;
  
  // DETAILED TOTALS CALCULATION LOGGING
  console.log(`💎💎💎💎💎 COMPUTE TOTALS BREAKDOWN:`);
  console.log(`💎 Input costs:`);
  console.log(`   - Center stone cost: $${center_cost}`);
  console.log(`   - Side stones cost: $${sides_cost}`);
  console.log(`   - Metal cost: $${metal_cost}`);
  console.log(`💎 Calculation:`);
  console.log(`   - Formula: $${center_cost} + $${sides_cost} + $${metal_cost}`);
  console.log(`   - Raw total: $${total_cost}`);
  console.log(`💎 After toFixed2 and parseFloat:`);
  console.log(`   - Center cost: $${parseFloat(toFixed2(center_cost))}`);
  console.log(`   - Sides cost: $${parseFloat(toFixed2(sides_cost))}`);
  console.log(`   - Metal cost: $${parseFloat(toFixed2(metal_cost))}`);
  console.log(`   - Total cost: $${parseFloat(toFixed2(total_cost))}`);
  
  return {
    center_cost: parseFloat(toFixed2(center_cost)),
    sides_cost: parseFloat(toFixed2(sides_cost)),
    metal_cost: parseFloat(toFixed2(metal_cost)),
    total_cost: parseFloat(toFixed2(total_cost))
  };
}

/**
 * Generate SKU with running index starting at 2 within each handle
 */
export function generateSKUWithRunningIndex(
  coreNumber: string,
  handleVariants: VariantSeed[],
  variantIndex: number
): string {
  const base = coreNumber.replace(/[^A-Za-z0-9]/g, "");
  const runningIndex = variantIndex + 2; // Start at -2, increment to -3, -4, etc.
  return `${base}-${runningIndex}`;
}

/**
 * Get metal family key for weight/price lookup
 */
function getMetalFamilyKey(metalCode: string): string {
  if (!metalCode) return "14"; // Default to 14K
  
  // Extract base metal family (e.g., "14W" -> "14", "18R" -> "18", "PLT" -> "PLT")
  const match = metalCode.match(/^(\d+|[A-Z]+)/);
  return match ? match[1] : "14";
}

/**
 * Calculate variant grams using weight lookup table
 */
function calculateVariantGrams(
  variant: VariantSeed,
  ruleSet: RuleSet | NoStonesRuleSet
): { grams: number; baseGrams: number; weightMultiplier: number } {
  const baseGrams = toNum(
    variant.inputRowRef["Grams Weight"] ||
      variant.inputRowRef["Grams Weight 14kt"] ||
      variant.inputRowRef["GramsWeight14kt"] ||
      variant.inputRowRef["Base Grams"] ||
      variant.inputRowRef["BaseGrams"] ||
      variant.inputRowRef["Weight"] ||
      variant.inputRowRef["Grams"] ||
    "5"
  );

  if ("weightIndex" in ruleSet) {
    // For Natural/LabGrown rules - apply metal weight multiplier
    const metalFamilyKey = getMetalFamilyKey(variant.metalCode);
    const weightMultiplier = ruleSet.weightIndex.get(metalFamilyKey) || 1;

    const finalGrams = Math.round((baseGrams * weightMultiplier) / 0.5) * 0.5;

    return {
      grams: finalGrams,
      baseGrams,
      weightMultiplier,
    };
  } else {
    // No Stones - use base weight (no multiplier)
    return {
      grams: baseGrams,
      baseGrams,
      weightMultiplier: 1,
    };
  }
}

/**
 * Calculate center stone diamond cost using new pricing logic
 */
function calculateCenterStoneDiamond(
  variant: VariantSeed, 
  ruleSet: RuleSet | NoStonesRuleSet
): { cost: number; carats: number; pricePerCarat: number } {
  // No Stones rules don't have center stones
  if (!("diamondPrices" in ruleSet)) {
    return { cost: 0, carats: 0, pricePerCarat: 0 };
  }

  // Get center carat weight - prioritize variant.centerSize over input table
  let centerCt = 0;
  
  // First, try to use the variant's centerSize (this comes from the rulebook combinations)
  if (variant.centerSize) {
    centerCt = toNum(variant.centerSize);
    console.log(`💎 Using center carat from variant.centerSize: ${centerCt} ct`);
  }
  
  // If not found in centerSize, fall back to input table columns
  if (centerCt <= 0) {
    centerCt = toNum(
      variant.inputRowRef["Center ct"] ||
      variant.inputRowRef["Center Ct"] ||
      variant.inputRowRef["CenterCt"] ||
      variant.inputRowRef["Center Carat"] ||
      variant.inputRowRef["Center"] ||
      "0"
    );
    console.log(`💎 Using center carat from input table: ${centerCt} ct`);
  }
  
  // Log what we're using for debugging
  console.log(`💎 Final center carat weight: ${centerCt} ct`);
  console.log(`💎 Variant centerSize: "${variant.centerSize}"`);
  console.log(`💎 Input table center ct: ${variant.inputRowRef["Center ct"] || variant.inputRowRef["Center Ct"] || variant.inputRowRef["CenterCt"] || "not found"}`);
  
  if (centerCt <= 0) {
    return { cost: 0, carats: 0, pricePerCarat: 0 };
  }
  
  // Get center stone shape - NEVER infer from sides
  const shape = normalizeShape(
    variant.inputRowRef["Center Shape"] ||
    variant.inputRowRef["CenterShape"] ||
    variant.inputRowRef["Center shape"] ||
    variant.inputRowRef["Shape"] ||
    ""
  );
  
  if (!shape) {
    throw new CostLookupError('Missing center stone shape', {
      type: 'unknown',
      shape: 'missing',
      weight: centerCt,
      productId: variant.core || 'unknown'
    });
  }
  
  // Determine stone type from variant metadata
  const stoneType = variant.inputRowRef.diamondsType?.toLowerCase().includes('natural') 
    ? 'natural' 
    : 'lab';
  
  // Get quality for natural diamonds
  const quality = stoneType === 'natural' ? (variant.quality || 'GH') : undefined;
  
  try {
    // Debug: Log what we're looking for and what's available
    console.log(`💎💎💎💎💎 Center stone calculation for ${variant.core}:`);
    console.log(`- Center carat: ${centerCt}`);
    console.log(`- Center shape: ${shape}`);
    console.log(`- Quality: ${quality}`);
    console.log(`- Stone type: ${stoneType}`);
    console.log(`- Available diamond prices in rules: ${ruleSet.diamondPrices.length}`);
    
    if (ruleSet.diamondPrices.length > 0) {
      console.log(`- Sample diamond price entries:`, ruleSet.diamondPrices.slice(0, 3));
    }
    
    const pricePerCarat = getPricePerCarat(
      { type: stoneType, shape, weight: centerCt, quality },
      ruleSet
    );
    
    // DETAILED CALCULATION LOGGING
    console.log(`💎💎💎💎💎 CENTER STONE CALCULATION BREAKDOWN:`);
    console.log(`💎 Input values:`);
    console.log(`   - Shape: "${shape}"`);
    console.log(`   - Weight: ${centerCt} ct`);
    console.log(`   - Quality: "${quality}"`);
    console.log(`   - Type: "${stoneType}"`);
    console.log(`💎 Lookup result:`);
    console.log(`   - Price per carat: $${pricePerCarat}/ct`);
    console.log(`💎 Calculation:`);
    console.log(`   - Formula: ${centerCt} ct × $${pricePerCarat}/ct`);
    console.log(`   - Raw result: ${centerCt * pricePerCarat}`);
    
    const totalCost = centerCt * pricePerCarat;
    
    console.log(`💎 Final result:`);
    console.log(`   - Total cost: $${totalCost}`);
    console.log(`   - After toFixed2: $${toFixed2(totalCost)}`);
    console.log(`   - After parseFloat: $${parseFloat(toFixed2(totalCost))}`);
    
    return {
      cost: parseFloat(toFixed2(totalCost)),
      carats: centerCt,
      pricePerCarat,
    };
  } catch (error) {
    if (error instanceof CostLookupError) {
      // Re-throw with product context
      error.details.productId = variant.core || 'unknown';
      
      // Add more context to the error
      console.error(`💎 Center stone pricing failed for ${variant.core}:`, {
        shape,
        weight: centerCt,
        quality,
        stoneType,
        availablePrices: ruleSet.diamondPrices.length,
        samplePrices: ruleSet.diamondPrices.slice(0, 3)
      });
      
      throw error;
    }
    throw error;
  }
}

/**
 * Calculate side stones diamond cost
 */
function calculateSideStoneDiamond(
  variant: VariantSeed, 
  ruleSet: RuleSet | NoStonesRuleSet
): { cost: number; carats: number; pricePerCarat: number } {
  // No Stones rules don't have side stones
  if (!("diamondPrices" in ruleSet)) {
    return { cost: 0, carats: 0, pricePerCarat: 0 };
  }

  // Calculate total side stone carats - prioritize variant data over input table
  let totalSideCarats = 0;
  
  // First, try to calculate side stone carats from the difference between total and center
  // This is more accurate than using potentially incorrect input table values
  const totalCtWeight = toNum(variant.inputRowRef["Total Ct Weight"] || "0");
  const centerCt = toNum(variant.centerSize || "0");
  
  if (totalCtWeight > 0 && centerCt > 0) {
    totalSideCarats = totalCtWeight - centerCt;
    console.log(`💎 Calculated side stone carats from total - center: ${totalCtWeight} - ${centerCt} = ${totalSideCarats} ct`);
  }
  
  // If not found in variant data, fall back to input table columns
  if (totalSideCarats <= 0) {
    for (let i = 1; i <= 10; i++) {
      const sideCt = toNum(variant.inputRowRef[`Side ${i} Ct`] || '0');
      totalSideCarats += sideCt;
    }
    console.log(`💎 Using side stone carats from input table: ${totalSideCarats} ct`);
  }
  
  // Log what we're using for debugging
  console.log(`💎 Final side stone carats: ${totalSideCarats} ct`);
  console.log(`💎 Total carat weight: ${totalCtWeight} ct`);
  console.log(`💎 Center carat weight: ${centerCt} ct`);
  console.log(`💎 Input table side carats sum: ${Array.from({length: 10}, (_, i) => toNum(variant.inputRowRef[`Side ${i+1} Ct`] || '0')).reduce((a, b) => a + b, 0)}`);
  
  if (totalSideCarats <= 0) {
    return { cost: 0, carats: 0, pricePerCarat: 0 };
  }
    
    // Get side stone shape (usually round unless specified)
  const sideShape = normalizeShape(
      variant.inputRowRef["Side Shape"] ||
      variant.inputRowRef["SideShape"] ||
    "Round"
  );
  
  // Determine stone type
  const stoneType = variant.inputRowRef.diamondsType?.toLowerCase().includes('natural') 
    ? 'natural' 
    : 'lab';
  
  // Get quality for natural diamonds
  const quality = stoneType === 'natural' ? (variant.quality || 'GH') : undefined;
  
  try {
    // For side stones, we need to find a price that matches the shape and type
    // but we'll use a more flexible approach since side stones are typically smaller
    
    let pricePerCarat = 0;
    let foundPrice = false;
    
    // First try to find an exact match
    try {
      pricePerCarat = getPricePerCarat(
        { type: stoneType, shape: sideShape, weight: totalSideCarats, quality },
        ruleSet
      );
      foundPrice = true;
    } catch (error) {
      // If exact match fails, try to find a price for the same shape and type
      // but with a reasonable default weight range
      for (const entry of ruleSet.diamondPrices) {
        const shapeMatch = entry.shape.toLowerCase() === sideShape.toLowerCase();
        const typeMatch = stoneType === 'natural' 
          ? entry.quality === quality 
          : true; // Lab-grown ignores quality
        
        if (shapeMatch && typeMatch) {
          // Use the first matching entry's price per carat
          pricePerCarat = entry.pricePerCarat;
          foundPrice = true;
          console.log(`💎 Side stone pricing fallback: using ${entry.shape} ${entry.quality || 'lab'} price for ${sideShape} side stones`);
          break;
        }
      }
    }
    
    if (!foundPrice) {
      // Last resort: use a default price based on stone type
      if (stoneType === 'natural') {
        pricePerCarat = 150; // Default natural diamond price
  } else {
        pricePerCarat = 100; // Default lab-grown diamond price
      }
      console.log(`💎 Side stone pricing: using default ${stoneType} price of $${pricePerCarat}/ct for ${sideShape} side stones`);
    }
    
    const totalCost = totalSideCarats * pricePerCarat;
    
    // DETAILED SIDE STONE CALCULATION LOGGING
    console.log(`💎💎💎💎💎 SIDE STONE CALCULATION BREAKDOWN:`);
    console.log(`💎 Input values:`);
    console.log(`   - Total side carats: ${totalSideCarats} ct`);
    console.log(`   - Side shape: "${sideShape}"`);
    console.log(`   - Stone type: "${stoneType}"`);
    console.log(`   - Quality: "${quality}"`);
    console.log(`💎 Pricing result:`);
    console.log(`   - Price per carat: $${pricePerCarat}/ct`);
    console.log(`   - Found price: ${foundPrice}`);
    console.log(`💎 Calculation:`);
    console.log(`   - Formula: ${totalSideCarats} ct × $${pricePerCarat}/ct`);
    console.log(`   - Raw result: ${totalCost}`);
    console.log(`💎 Final result:`);
    console.log(`   - Total cost: $${totalCost}`);
    console.log(`   - After toFixed2: $${toFixed2(totalCost)}`);
    console.log(`   - After parseFloat: $${parseFloat(toFixed2(totalCost))}`);

    return {
      cost: parseFloat(toFixed2(totalCost)),
      carats: totalSideCarats,
      pricePerCarat,
    };
  } catch (error) {
    if (error instanceof CostLookupError) {
      error.details.productId = variant.core || 'unknown';
      throw error;
    }
    throw error;
  }
}

/**
 * Calculate metal cost (separate from stone costs)
 */
function calculateMetalCost(
  variant: VariantSeed,
  variantGrams: number,
  ruleSet: RuleSet | NoStonesRuleSet
): { cost: number; pricePerGram: number } {
  if ("metalPrice" in ruleSet) {
    const metalFamilyKey = getMetalFamilyKey(variant.metalCode);
    const pricePerGram = ruleSet.metalPrice.get(metalFamilyKey) || 2.5;
    
    const totalCost = variantGrams * pricePerGram;
    
    // DETAILED METAL COST CALCULATION LOGGING
    console.log(`💎💎💎💎💎 METAL COST CALCULATION BREAKDOWN:`);
    console.log(`💎 Input values:`);
    console.log(`   - Variant grams: ${variantGrams} g`);
    console.log(`   - Metal code: "${variant.metalCode}"`);
    console.log(`   - Metal family key: "${metalFamilyKey}"`);
    console.log(`💎 Pricing result:`);
    console.log(`   - Price per gram: $${pricePerGram}/g`);
    console.log(`   - Found in rules: ${ruleSet.metalPrice.has(metalFamilyKey)}`);
    console.log(`💎 Calculation:`);
    console.log(`   - Formula: ${variantGrams} g × $${pricePerGram}/g`);
    console.log(`   - Raw result: ${totalCost}`);
    console.log(`💎 Final result:`);
    console.log(`   - Total metal cost: $${totalCost}`);

    return {
      cost: totalCost,
      pricePerGram,
    };
  } else {
    // No Stones - use default metal pricing
    const defaultPricePerGram = 2.5;
    const totalCost = variantGrams * defaultPricePerGram;
    
    // DETAILED DEFAULT METAL COST LOGGING
    console.log(`💎💎💎💎💎 DEFAULT METAL COST CALCULATION:`);
    console.log(`💎 Input values:`);
    console.log(`   - Variant grams: ${variantGrams} g`);
    console.log(`   - Default price per gram: $${defaultPricePerGram}/g`);
    console.log(`💎 Calculation:`);
    console.log(`   - Formula: ${variantGrams} g × $${defaultPricePerGram}/g`);
    console.log(`   - Raw result: ${totalCost}`);
    console.log(`💎 Final result:`);
    console.log(`   - Total metal cost: $${totalCost}`);
    
    return {
      cost: totalCost,
      pricePerGram: defaultPricePerGram,
    };
  }
}

/**
 * Calculate all fixed and labor costs
 */
function calculateAllCosts(
  variant: VariantSeed,
  ruleSet: RuleSet | NoStonesRuleSet
): {
  centerStoneLabor: number;
  sideStoneLabor: number;
  polishCost: number;
  braceletsCost: number;
  pendantsCost: number;
  cadCreationCost: number;
  additionalCost: number;
  sideStoneCount: number;
  hasCenter: boolean;
  isBracelet: boolean;
  isPendant: boolean;
} {
  if (!("labor" in ruleSet)) {
    // No Stones - return default costs
    return {
      centerStoneLabor: 0,
      sideStoneLabor: 0,
      polishCost: 25,
      braceletsCost: 0,
      pendantsCost: 0,
      cadCreationCost: 20,
      additionalCost: 25,
      sideStoneCount: 0,
      hasCenter: false,
      isBracelet: false,
      isPendant: false,
    };
  }

  const laborMap = ruleSet.labor;

  // Calculate side stone count for labor
  let sideStoneCount = 0;
  for (let i = 1; i <= 10; i++) {
    const sideStones = toNum(variant.inputRowRef[`Side ${i} Stones`] || '0');
    sideStoneCount += sideStones;
  }
  
  const perSideStone = laborMap.get("Per side stone") || 1;
  const sideStoneLabor = sideStoneCount * perSideStone;

  // Center stone labor
  const hasCenter = variant.scenario === "Unique+Center";
  const perCenter = laborMap.get("Per Center") || 5;
  const centerStoneLabor = hasCenter ? perCenter : 0;

  // Category checks
  const category = trimAll(
    variant.inputRowRef["Category"] ||
      variant.inputRowRef["Type"] ||
      ""
  ).toLowerCase();
  
  const subcategory = trimAll(
    variant.inputRowRef["Subcategory"] ||
      variant.inputRowRef["Sub Category"] ||
      ""
  ).toLowerCase();

  const isBracelet = category.includes("bracelet");
  const isPendant = category.includes("pendants") || category.includes("pendant");

  // Polish cost: $25 default, $50 for Bridal Sets
  let polishCost = laborMap.get("Polish") || 25;
  if (subcategory.includes("bridal")) {
    polishCost = 50;
  }

  // Bracelets cost: $125 if Category = "Bracelet"
  const braceletsCost = isBracelet ? (laborMap.get("Bracelets") || 125) : 0;

  // Pendants cost: $80 if Category = "Pendants"
  const pendantsCost = isPendant ? 80 : 0;

  // CAD Creation: $20 default
  const cadCreationCost = laborMap.get("CAD Creation") || 20;

  // Additional: $25 default
  const additionalCost = laborMap.get("Additional") || 25;

  return {
    centerStoneLabor,
    sideStoneLabor,
    polishCost,
    braceletsCost,
    pendantsCost,
    cadCreationCost,
    additionalCost,
    sideStoneCount,
    hasCenter,
    isBracelet,
    isPendant,
  };
}

/**
 * Calculate complete cost breakdown for a variant using new pricing logic
 */
export function calculateCostBreakdown(
  variant: VariantSeed,
  ruleSet: RuleSet | NoStonesRuleSet,
  sku: string
): CostBreakdown {
  const gramsCalc = calculateVariantGrams(variant, ruleSet);

  // Calculate diamond costs using new logic
  const centerDiamondCalc = calculateCenterStoneDiamond(variant, ruleSet);
  const sideDiamondCalc = calculateSideStoneDiamond(variant, ruleSet);

  // Calculate metal cost (separate from stone costs)
  const metalCalc = calculateMetalCost(variant, gramsCalc.grams, ruleSet);

  // Calculate all other costs
  const costsCalc = calculateAllCosts(variant, ruleSet);

  // Compute totals with proper separation
  const totals = computeTotals(
    {
      center: centerDiamondCalc.cost,
      sides: sideDiamondCalc.cost,
      metal: metalCalc.cost
    },
    ruleSet as RuleSet
  );

  // Add labor and other costs to total
  const totalCost = totals.total_cost +
    costsCalc.centerStoneLabor +
    costsCalc.sideStoneLabor +
    costsCalc.polishCost +
    costsCalc.braceletsCost +
    costsCalc.pendantsCost +
    costsCalc.cadCreationCost +
    costsCalc.additionalCost;
    
  // DETAILED FINAL COST BREAKDOWN LOGGING
  console.log(`💎💎💎💎💎 FINAL COST BREAKDOWN FOR ${variant.core}:`);
  console.log(`💎 Stone costs:`);
  console.log(`   - Center stone: $${centerDiamondCalc.cost} (${centerDiamondCalc.carats} ct × $${centerDiamondCalc.pricePerCarat}/ct)`);
  console.log(`   - Side stones: $${sideDiamondCalc.cost} (${sideDiamondCalc.carats} ct × $${sideDiamondCalc.pricePerCarat}/ct)`);
  console.log(`💎 Metal costs:`);
  console.log(`   - Metal cost: $${metalCalc.cost} (${gramsCalc.grams} g × $${metalCalc.pricePerGram}/g)`);
  console.log(`💎 Labor costs:`);
  console.log(`   - Center stone labor: $${costsCalc.centerStoneLabor}`);
  console.log(`   - Side stone labor: $${costsCalc.sideStoneLabor}`);
  console.log(`   - Polish cost: $${costsCalc.polishCost}`);
  console.log(`   - Bracelets cost: $${costsCalc.braceletsCost}`);
  console.log(`   - Pendants cost: $${costsCalc.pendantsCost}`);
  console.log(`   - CAD creation: $${costsCalc.cadCreationCost}`);
  console.log(`   - Additional: $${costsCalc.additionalCost}`);
  console.log(`💎 Totals:`);
  console.log(`   - Stone + metal subtotal: $${totals.total_cost}`);
  console.log(`   - Labor + other costs: $${costsCalc.centerStoneLabor + costsCalc.sideStoneLabor + costsCalc.polishCost + costsCalc.braceletsCost + costsCalc.pendantsCost + costsCalc.cadCreationCost + costsCalc.additionalCost}`);
  console.log(`   - FINAL TOTAL: $${totalCost}`);
  console.log(`   - After toFixed2: $${toFixed2(totalCost)}`);
  console.log(`   - After parseFloat: $${parseFloat(toFixed2(totalCost))}`);

  // Calculate pricing
  const pricing = calculatePricing(totalCost, variant.inputRowRef, ruleSet);

  return {
    centerStoneDiamond: centerDiamondCalc.cost,
    sideStoneDiamond: sideDiamondCalc.cost,
    metalCost: metalCalc.cost,
    centerStoneLabor: costsCalc.centerStoneLabor,
    sideStoneLabor: costsCalc.sideStoneLabor,
    polishCost: costsCalc.polishCost,
    braceletsCost: costsCalc.braceletsCost,
    pendantsCost: costsCalc.pendantsCost,
    cadCreationCost: costsCalc.cadCreationCost,
    additionalCost: costsCalc.additionalCost,
    totalCost: parseFloat(toFixed2(totalCost)),
    variantGrams: gramsCalc.grams,
    sku,
    pricing,
    published: true, // TRUE for every row
    details: {
      baseGrams: gramsCalc.baseGrams,
      weightMultiplier: gramsCalc.weightMultiplier,
      metalPricePerGram: metalCalc.pricePerGram,
      centerCarats: centerDiamondCalc.carats,
      sideCarats: sideDiamondCalc.carats,
      centerPricePerCarat: centerDiamondCalc.pricePerCarat,
      sidePricePerCarat: sideDiamondCalc.pricePerCarat,
      sideStoneCount: costsCalc.sideStoneCount,
      hasCenter: costsCalc.hasCenter,
      isBracelet: costsCalc.isBracelet,
      isPendant: costsCalc.isPendant,
    },
  };
}

// Export utility functions for testing
export {
  normalizeString,
  normalizeShape,
  normalizeQuality,
  normalizeWeight,
  matchBracket,
  getPricePerCarat,
  priceCenter,
  computeTotals,
  getMetalFamilyKey,
  calculateVariantGrams,
  calculateCenterStoneDiamond,
  calculateSideStoneDiamond,
  calculateMetalCost,
  calculateAllCosts
};
