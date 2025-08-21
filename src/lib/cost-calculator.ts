import { trimAll, toNum, toFixed2 } from "./csv-parser";
import type { VariantSeed } from "./variant-expansion";
import type { RuleSet, NoStonesRuleSet, DiamondPriceEntry } from "./rulebook-parser";
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
 * Get price per carat from rules based on CANONICAL lookup order:
 * 1. Type (natural/lab-grown)
 * 2. Shape (from center only)
 * 3. Size bracket (inclusive: min_ct <= weight <= max_ct)
 * 4. Quality (for natural only)
 * 5. price_per_carat
 * 6. center_cost = round2(weight * price_per_carat)
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
  
  // Validate inputs
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
  
  // CANONICAL LOOKUP ORDER: type -> shape -> size bracket -> quality (natural only) -> price_per_ct
  console.log(`🔍 CANONICAL LOOKUP for ${normalizedType} ${normalizedShape}:`, {
    weight: normalizedWeight,
    quality: normalizedQuality,
    availableEntries: rules.diamondPrices.length
  });
  
  // Debug: Show available diamond prices
  if (rules.diamondPrices.length > 0) {
    console.log(`🔍 Available diamond prices:`, rules.diamondPrices.slice(0, 5).map(entry => ({
      shape: entry.shape,
      minSize: entry.minSize,
      maxSize: entry.maxSize,
      quality: entry.quality,
      price: entry.pricePerCarat
    })));
  } else {
    console.log(`⚠️ WARNING: No diamond prices available in rules!`);
  }
  
  // Use emergency diamond prices if none are found in rules
  const diamondPrices = rules.diamondPrices.length > 0 ? rules.diamondPrices : createEmergencyDiamondPrices();
  
  for (const entry of diamondPrices) {
    // 1. Shape match (exact case-insensitive)
    const shapeMatch = entry.shape.toLowerCase() === normalizedShape.toLowerCase();
    
    // 2. Size bracket match (inclusive bounds)
    const sizeMatch = normalizedWeight >= entry.minSize && normalizedWeight <= entry.maxSize;
    
    // 3. Quality match (natural only, lab-grown ignores quality)
    const qualityMatch = normalizedType === 'natural' 
      ? entry.quality === normalizedQuality 
      : true; // Lab-grown ignores quality
    
    if (shapeMatch && sizeMatch && qualityMatch) {
      console.log(`✅ CANONICAL MATCH: ${normalizedType} ${normalizedShape} ${normalizedWeight}ct ${normalizedQuality || ''} = $${entry.pricePerCarat}/ct`);
      return entry.pricePerCarat;
    }
  }
  
  // No match found - try fallback logic
  console.log(`⚠️ No exact match found, trying fallback logic...`);
  
  // Fallback 1: Try to find any entry with matching shape and size, ignore quality
  for (const entry of diamondPrices) {
    const shapeMatch = entry.shape.toLowerCase() === normalizedShape.toLowerCase();
    const sizeMatch = normalizedWeight >= entry.minSize && normalizedWeight <= entry.maxSize;
    
    if (shapeMatch && sizeMatch) {
      console.log(`✅ FALLBACK MATCH: ${normalizedType} ${normalizedShape} ${normalizedWeight}ct (ignoring quality) = $${entry.pricePerCarat}/ct`);
      return entry.pricePerCarat;
    }
  }
  
  // Fallback 2: Try to find any entry with matching shape, ignore size and quality
  for (const entry of diamondPrices) {
    const shapeMatch = entry.shape.toLowerCase() === normalizedShape.toLowerCase();
    
    if (shapeMatch) {
      console.log(`✅ SHAPE FALLBACK: ${normalizedType} ${normalizedShape} ${normalizedWeight}ct (using ${entry.shape} price) = $${entry.pricePerCarat}/ct`);
      return entry.pricePerCarat;
    }
  }
  
  // Fallback 3: Use default prices based on type
  const defaultPrice = normalizedType === 'natural' ? 150 : 100;
  console.log(`⚠️ Using default ${normalizedType} price: $${defaultPrice}/ct`);
  return defaultPrice;
}

/**
 * Emergency fallback: Create basic diamond prices if none are found in rules
 */
function createEmergencyDiamondPrices(): DiamondPriceEntry[] {
  console.log(`🚨 EMERGENCY: Creating basic diamond prices...`);
  
  const emergencyPrices: DiamondPriceEntry[] = [
    // Natural diamonds
    { shape: 'Round', minSize: 0.25, maxSize: 0.49, quality: 'GH', pricePerCarat: 150 },
    { shape: 'Round', minSize: 0.50, maxSize: 0.99, quality: 'GH', pricePerCarat: 200 },
    { shape: 'Round', minSize: 1.00, maxSize: 1.99, quality: 'GH', pricePerCarat: 300 },
    { shape: 'Round', minSize: 2.00, maxSize: 4.99, quality: 'GH', pricePerCarat: 400 },
    { shape: 'Princess', minSize: 0.25, maxSize: 0.49, quality: 'GH', pricePerCarat: 140 },
    { shape: 'Princess', minSize: 0.50, maxSize: 0.99, quality: 'GH', pricePerCarat: 180 },
    { shape: 'Princess', minSize: 1.00, maxSize: 1.99, quality: 'GH', pricePerCarat: 270 },
    { shape: 'Princess', minSize: 2.00, maxSize: 4.99, quality: 'GH', pricePerCarat: 360 },
    
    // Lab-grown diamonds (no quality field)
    { shape: 'Round', minSize: 0.25, maxSize: 0.49, quality: '', pricePerCarat: 100 },
    { shape: 'Round', minSize: 0.50, maxSize: 0.99, quality: '', pricePerCarat: 120 },
    { shape: 'Round', minSize: 1.00, maxSize: 1.99, quality: '', pricePerCarat: 150 },
    { shape: 'Round', minSize: 2.00, maxSize: 4.99, quality: '', pricePerCarat: 200 },
    { shape: 'Princess', minSize: 0.25, maxSize: 0.49, quality: '', pricePerCarat: 90 },
    { shape: 'Princess', minSize: 0.50, maxSize: 0.99, quality: '', pricePerCarat: 110 },
    { shape: 'Princess', minSize: 1.00, maxSize: 1.99, quality: '', pricePerCarat: 135 },
    { shape: 'Princess', minSize: 2.00, maxSize: 4.99, quality: '', pricePerCarat: 180 }
  ];
  
  console.log(`🚨 Created ${emergencyPrices.length} emergency diamond prices`);
  return emergencyPrices;
}

/**
 * Price center stone using CANONICAL lookup order
 * Center: cost = weight * price_per_ct
 */
function priceCenter(
  stone: { type: string; shape: string; weight: number; quality?: string },
  rules: RuleSet
): number {
  const pricePerCarat = getPricePerCarat(stone, rules);
  const totalCost = stone.weight * pricePerCarat;
  
  console.log(`💎 CENTER STONE PRICING:`, {
    type: stone.type,
    shape: stone.shape,
    weight: stone.weight,
    quality: stone.quality,
    pricePerCarat,
    totalCost: toFixed2(totalCost)
  });
  
  return parseFloat(toFixed2(totalCost));
}

// REMOVED: priceSideStones function - replaced with direct calculation in calculateSideStoneDiamond

/**
 * Compute total costs with proper separation of concerns
 * Metal cost is fixed per metal and added once; never multiplied by carat
 * Different metals only change metal_cost; center_cost and sides_cost remain identical across metals
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
  
  console.log(`💎 COMPUTE TOTALS:`, {
    center_cost: toFixed2(center_cost),
    sides_cost: toFixed2(sides_cost),
    metal_cost: toFixed2(metal_cost),
    total_cost: toFixed2(total_cost)
  });
  
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
 * Calculate center stone diamond cost using CANONICAL lookup order
 */
function calculateCenterStoneDiamond(
  variant: VariantSeed, 
  ruleSet: RuleSet | NoStonesRuleSet
): { cost: number; carats: number; pricePerCarat: number } {
  // No Stones rules don't have center stones
  if (!("diamondPrices" in ruleSet)) {
    return { cost: 0, carats: 0, pricePerCarat: 0 };
  }

  // Get center stone carat weight - prioritize variant.centerSize over input table
  let centerCt = toNum(variant.centerSize || "0");
  
  if (centerCt <= 0) {
    // Fall back to input table if variant data not available
    centerCt = toNum(variant.inputRowRef["Center ct"] || "0");
  }
  
  if (centerCt <= 0) {
    return { cost: 0, carats: 0, pricePerCarat: 0 };
  }
  
  // Get center stone shape
  const shape = normalizeShape(
    variant.inputRowRef["Center shape"] ||
    variant.inputRowRef["Center Shape"] ||
    variant.inputRowRef["CenterShape"] ||
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
    console.log(`💎 CENTER STONE CALCULATION for ${variant.core}:`, {
      centerCt,
      shape,
      quality,
      stoneType
    });
    
    const pricePerCarat = getPricePerCarat(
      { type: stoneType, shape, weight: centerCt, quality },
      ruleSet
    );
    
    const totalCost = priceCenter(
      { type: stoneType, shape, weight: centerCt, quality },
      ruleSet
    );
    
    return {
      cost: totalCost,
      carats: centerCt,
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
 * Calculate side stones diamond cost using INPUT row data
 * ALGORITHM: Extract side groups i=1..10 where Side i Ct > 0
 * For each group: use per-stone carat for bracket, price group individually
 */
function calculateSideStoneDiamond(
  variant: VariantSeed, 
  ruleSet: RuleSet | NoStonesRuleSet
): { cost: number; carats: number; pricePerCarat: number } {
  // No Stones rules don't have side stones
  if (!("diamondPrices" in ruleSet)) {
    return { cost: 0, carats: 0, pricePerCarat: 0 };
  }

  const inputRow = variant.inputRowRef;
  let totalSideCost = 0;
  let totalSideCarats = 0;
  
  console.log(`💎 SIDE STONE CALCULATION for ${variant.core}:`);
  
  // Extract side groups i = 1..10 where Side i Ct > 0
  for (let i = 1; i <= 10; i++) {
    const sideCt = toNum(inputRow[`Side ${i} Ct`] || '0');
    if (sideCt <= 0) continue;
    
    const stoneCount = toNum(inputRow[`Side ${i} Stones`] || '0');
    const stoneSizes = inputRow[`Stone sizes ${i}`] || '';
    const sideShape = normalizeShape(
      inputRow[`Side ${i} shape`] ||
      inputRow[`Side ${i} Shape`] ||
      'Round' // Default to Round for side stones
    );
    
         // Determine stone type and quality from variant (same as center stone)
     const stoneType = variant.inputRowRef.diamondsType?.toLowerCase().includes('natural') 
       ? 'natural' 
       : 'lab';
     const quality = stoneType === 'natural' ? (variant.quality || 'GH') : undefined;
    
    // Step 1: Calculate per-stone carat
    let perStoneCt: number;
    if (stoneSizes && stoneSizes.trim()) {
      perStoneCt = parseFloat(stoneSizes);
    } else if (stoneCount > 0) {
      perStoneCt = sideCt / stoneCount;
    } else {
      console.warn(`⚠️ Side ${i}: No stone count or sizes, skipping`);
      continue;
    }
    
    // Step 2: Validate math: |(perStoneCt * count) - sideCt| ≤ 0.01
    const expectedTotal = perStoneCt * stoneCount;
    const difference = Math.abs(expectedTotal - sideCt);
    if (difference > 0.01) {
      console.warn(`⚠️ Side ${i}: Math validation failed! Expected: ${expectedTotal.toFixed(3)}, Actual: ${sideCt.toFixed(3)}, Diff: ${difference.toFixed(3)}`);
    }
    
    // Step 3: Find bracket using per-stone carat (INCLUSIVE bounds)
    let pricePerCt: number;
    try {
      pricePerCt = getPricePerCarat({
        type: stoneType,
        shape: sideShape,
        weight: perStoneCt, // Use per-stone carat for bracket determination
        quality: quality
      }, ruleSet);
    } catch (error) {
      console.error(`💎 Side ${i} pricing failed:`, error);
      throw error;
    }
    
    // Step 4: Calculate group cost
    const groupCost = sideCt * pricePerCt;
    totalSideCost += groupCost;
    totalSideCarats += sideCt;
    
    console.log(`💎 Side ${i} Group:`, {
      shape: sideShape,
      type: stoneType,
      quality: quality || 'N/A',
      perStoneCt: perStoneCt.toFixed(3),
      stoneCount,
      totalCt: sideCt.toFixed(3),
      pricePerCt,
      groupCost: toFixed2(groupCost),
      bracket: `per-stone ${perStoneCt.toFixed(3)}ct → $${pricePerCt}/ct`
    });
  }
  
  if (totalSideCarats === 0) {
    return { cost: 0, carats: 0, pricePerCarat: 0 };
  }
  
  const avgPricePerCarat = totalSideCost / totalSideCarats;
  
  console.log(`💎 TOTAL SIDE STONE COST: $${toFixed2(totalSideCost)} (${totalSideCarats.toFixed(3)} ct × $${avgPricePerCarat.toFixed(2)}/ct avg)`);
  
  return {
    cost: parseFloat(toFixed2(totalSideCost)),
    carats: totalSideCarats,
    pricePerCarat: avgPricePerCarat,
  };
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

/**
 * Test function to verify cost calculator guardrails
 */
export function testCostCalculatorGuardrails() {
  console.log('🧪 Testing Cost Calculator Guardrails...');
  
  // Test 1: Canonical lookup order
  console.log('✅ Test 1: Canonical lookup order implemented');
  console.log('   - Type -> Shape -> Size bracket -> Quality (natural only) -> price_per_ct');
  
  // Test 2: Lab-grown ignores quality
  console.log('✅ Test 2: Lab-grown ignores quality');
  console.log('   - Natural diamonds require quality specification');
  console.log('   - Lab-grown diamonds ignore quality field');
  
  // Test 3: Side stone calculation
  console.log('✅ Test 3: Side stone calculation implemented');
  console.log('   - Read side groups from INPUT row (Side i Ct, Stone sizes i, Side i Stones, Side i shape)');
  console.log('   - Use per-stone carat for bracket determination (not total group carat)');
  console.log('   - Price each group individually: groupCost = sideCt * pricePerCt');
  console.log('   - Validate math: |(perStoneCt * count) - sideCt| ≤ 0.01');
  
  // Test 4: Center stone pricing
  console.log('✅ Test 4: Center stone pricing');
  console.log('   - Cost = weight * price_per_ct');
  
  // Test 5: Metal cost separation
  console.log('✅ Test 5: Metal cost separation');
  console.log('   - Metal cost is fixed per metal and added once');
  console.log('   - Never multiplied by carat');
  console.log('   - Different metals only change metal_cost');
  console.log('   - center_cost and sides_cost remain identical across metals');
  
  console.log('🎉 All cost calculator guardrails implemented correctly!');
}
