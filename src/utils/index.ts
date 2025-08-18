/**
 * Central exports for all utility functions and types
 */

// Types
export type * from '@/types/core';

// Grouping utilities
export {
  groupByCoreNumber,
  isUnique,
  determineScenario,
  generateHandle,
  createCoreGroups,
  calculateGroupStats
} from './grouping';

// Rule utilities
export {
  pickRulebook,
  extractMetalCodes,
  extractCenterSizes,
  extractQualityCodes,
  getWeightMultiplier,
  getMetalPrice,
  getLaborCost,
  findMarginMultiplier,
  getDefaultMultiplier
} from './rules';

// Expansion utilities
export {
  expandUniqueWithCenter,
  expandUniqueNoCenter,
  expandRepeating,
  expandNoStones,
  expandAllGroups
} from './expansion';

// Translation utilities
export {
  METAL_TRANSLATIONS,
  QUALITY_TRANSLATIONS,
  translateMetal,
  translateQuality,
  formatCaratString,
  calculateTotalCaratWeight,
  calculateTotalCaratString,
  collectShapes,
  generateSKUWithRunningIndex,
  formatMoney,
  formatBoolean,
  generateGoogleCategory
} from './translations';

// Cost utilities
export {
  computeVariantGrams,
  computeDiamondCost,
  computeMetalCost,
  computeSideStoneCost,
  computeCenterStoneCost,
  computeTotalCost,
  pickMarginMultiplier,
  calculatePricing
} from './costs';

// Row building utilities
export {
  buildProductMetadata,
  buildParentChildRows
} from './rowBuilding';

// Serialization utilities
export {
  SHOPIFY_HEADERS,
  escapeCsvCell,
  rowToCsvLine,
  serializeShopifyRows,
  validateShopifyRow,
  validateShopifyRows
} from './serialization';