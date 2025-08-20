import {
  trimAll,
  toNum,
  toFixed2,
  ctStr,
  calculateSumSideCt,
} from "./csv-parser";
import type { VariantSeed } from "./variant-expansion";
import type { RuleSet, NoStonesRuleSet } from "./rulebook-parser";
import { calculatePricing, type PricingResult } from "./pricing-calculator";
import type { WeightLookupTable } from "./weight-lookup";
import { getVariantWeight } from "./weight-lookup";

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

/**
 * Get metal family key for weight/price lookup
 * e.g., "14W" -> "14", "18R" -> "18", "PLT" -> "PLT"
 */
function getMetalFamilyKey(metalCode: string): string {
  if (metalCode.startsWith("14")) return "14";
  if (metalCode.startsWith("18")) return "18";
  if (metalCode.startsWith("PLT") || metalCode === "PLT") return "PLT";
  return metalCode;
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
 * Calculate variant grams using weight lookup table by core number and metal
 * This calculates per row per product variant using lookup table
 */
function calculateVariantGrams(
  variant: VariantSeed,
  ruleSet: RuleSet | NoStonesRuleSet
): { grams: number; baseGrams: number; weightMultiplier: number } {
  // Get base grams from input row (F column - Grams Weight)
  const baseGrams = toNum(
    variant.inputRowRef["Grams Weight"] ||
      variant.inputRowRef["Grams Weight 14kt"] ||
      variant.inputRowRef["GramsWeight14kt"] ||
      variant.inputRowRef["Base Grams"] ||
      variant.inputRowRef["BaseGrams"] ||
      variant.inputRowRef["Weight"] ||
      variant.inputRowRef["Grams"] ||
      "5" // Default if missing
  );

  console.log(
    `💎 Calculating grams for ${variant.core} with ${variant.metalCode}:`
  );
  console.log(`   📊 Base grams from input: ${baseGrams}g`);
  console.log(
    `   📋 Available input columns:`,
    Object.keys(variant.inputRowRef)
  );

  if ("weightIndex" in ruleSet) {
    // For Natural/LabGrown rules - apply metal weight multiplier from Weight Index
    const metalFamilyKey = getMetalFamilyKey(variant.metalCode);
    const weightMultiplier = ruleSet.weightIndex.get(metalFamilyKey) || 1;

    console.log(`   🔍 Metal family key: ${metalFamilyKey}`);
    console.log(
      `   📊 Available weight index entries:`,
      Array.from(ruleSet.weightIndex.entries())
    );
    console.log(`   ⚖️ Weight multiplier: ${weightMultiplier}`);

    if (!ruleSet.weightIndex.has(metalFamilyKey)) {
      console.warn(
        `Weight multiplier not found for metal ${metalFamilyKey}, using default 1`
      );
    }

    const finalGrams = Math.round((baseGrams * weightMultiplier) / 0.5) * 0.5; // Round to nearest 0.5g
    console.log(
      `   ✅ Final calculation: ${baseGrams}g × ${weightMultiplier} = ${finalGrams}g`
    );

    return {
      grams: finalGrams,
      baseGrams,
      weightMultiplier,
    };
  } else {
    // No Stones - use base weight (no multiplier)
    console.log(`   ✅ No stones weight: ${baseGrams}g (no multiplier)`);
    return {
      grams: baseGrams,
      baseGrams,
      weightMultiplier: 1,
    };
  }
}

/**
 * Calculate center stone diamond cost
 */
function calculateCenterStoneDiamond(variant: VariantSeed, ruleSet: RuleSet | NoStonesRuleSet): {
  cost: number;
  carats: number;
  pricePerCarat: number;
} {
  if (variant.scenario !== "Unique+Center" || !variant.centerSize) {
    return { cost: 0, carats: 0, pricePerCarat: 0 };
  }

  const centerCt = toNum(variant.centerSize);
  const pricePerCarat = toNum(variant.inputRowRef["Price Per Carat"] || "150");

  return {
    cost: centerCt * pricePerCarat,
    carats: centerCt,
    pricePerCarat,
  };
}

/**
 * Calculate side stones diamond cost
 */
function calculateSideStoneDiamond(variant: VariantSeed, ruleSet: RuleSet | NoStonesRuleSet): {
  cost: number;
  carats: number;
  pricePerCarat: number;
} {
  if (variant.scenario === "NoStones") {
    return { cost: 0, carats: 0, pricePerCarat: 0 };
  }

  const sideCarats = calculateSumSideCt(variant.inputRowRef);
  const pricePerCarat = toNum(variant.inputRowRef["Price Per Carat"] || "150");

  return {
    cost: sideCarats * pricePerCarat,
    carats: sideCarats,
    pricePerCarat,
  };
}

/**
 * Calculate metal cost
 */
function calculateMetalCost(
  variant: VariantSeed,
  variantGrams: number,
  ruleSet: RuleSet | NoStonesRuleSet
): { cost: number; pricePerGram: number } {
  if ("metalPrice" in ruleSet) {
    const metalFamilyKey = getMetalFamilyKey(variant.metalCode);
    const pricePerGram = ruleSet.metalPrice.get(metalFamilyKey) || 2.5; // Default $2.50/gram

    if (!ruleSet.metalPrice.has(metalFamilyKey)) {
      console.warn(
        `Metal price not found for ${metalFamilyKey}, using default $2.50/gram`
      );
    }

    return {
      cost: variantGrams * pricePerGram,
      pricePerGram,
    };
  } else {
    // No Stones - use default metal pricing
    const defaultPricePerGram = 2.5;
    return {
      cost: variantGrams * defaultPricePerGram,
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
  const laborMap = "labor" in ruleSet ? ruleSet.labor : new Map<string, number>();

  // Calculate side stone count for labor
  const sideStoneCount = toNum(
    variant.inputRowRef["Side Stone Count"] ||
      variant.inputRowRef["SideStoneCount"] ||
      variant.inputRowRef["Side Stones"] ||
      "0"
  );
  const perSideStone = laborMap.get("Per side stone") || 1; // $1 per side stone
  const sideStoneLabor = sideStoneCount * perSideStone;

  // Center stone labor
  const hasCenter = variant.scenario === "Unique+Center";
  const perCenter = laborMap.get("Per Center") || 5; // $5 per center
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
 * Calculate complete cost breakdown for a variant
 */
export function calculateCostBreakdown(
  variant: VariantSeed,
  ruleSet: RuleSet | NoStonesRuleSet,
  sku: string
): CostBreakdown {
  // Calculate variant grams
  const gramsCalc = calculateVariantGrams(variant, ruleSet);

  // Calculate diamond costs separately
  const centerDiamondCalc = calculateCenterStoneDiamond(variant, ruleSet);
  const sideDiamondCalc = calculateSideStoneDiamond(variant, ruleSet);

  // Calculate metal cost
  const metalCalc = calculateMetalCost(variant, gramsCalc.grams, ruleSet);

  // Calculate all other costs
  const costsCalc = calculateAllCosts(variant, ruleSet);

  // Total cost
  const totalCost =
    centerDiamondCalc.cost +
    sideDiamondCalc.cost +
    metalCalc.cost +
    costsCalc.centerStoneLabor +
    costsCalc.sideStoneLabor +
    costsCalc.polishCost +
    costsCalc.braceletsCost +
    costsCalc.pendantsCost +
    costsCalc.cadCreationCost +
    costsCalc.additionalCost;

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
    totalCost,
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
