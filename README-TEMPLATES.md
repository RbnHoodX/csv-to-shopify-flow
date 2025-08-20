# Deterministic Template Builders

This document describes the implementation of deterministic templates for three item types: NATURAL, LAB-GROWN, and NO-STONES according to client specifications.

## Overview

The new template system provides consistent, deterministic generation of Titles, Body content, and SEO fields for all product types. The system is implemented in `src/lib/template-builders.ts` and replaces the previous ad-hoc title and body generation.

## Configuration Constants

```typescript
export const FIXED_METALS_STRING = "in 14K, 18K, and 950";
export const BODY_TYPE_QUALIFIER = {
  lab: "lab grown",
  natural: "natural"
} as const;
```

## Title Templates

### 1. LAB-GROWN
**Format:** `<caratRange> — <Shapes> Cut <StoneTypes> — <Subcategory>`

**Example:** `0.50-1.25 ct - Round & Princess Cut diamonds - Engagement Rings`

### 2. NATURAL  
**Format:** `<caratRange> — <Shapes> Cut Natural <StoneTypes> — <Subcategory>`

**Example:** `0.35-0.80 ct - Round Cut Natural diamonds - Bridal Set`

### 3. NO-STONES (Plain Bands)
**Format with width:** `<width> MM — <Subcategory> — <FIXED_METALS_STRING>`

**Example:** `2.0 MM - Wedding Band - in 14K, 18K, and 950`

**Format without width:** `<Subcategory> — <FIXED_METALS_STRING>`

**Example:** `Wedding Band - in 14K, 18K, and 950`

## Body Templates (Parent-Level Only)

### Items WITH CENTER (both Natural and Lab-Grown)

```
0.50-1.25 ct - Round & Princess Cut diamonds - Engagement Rings

**Center:** Select center from the options above.
Side Stone 1: 6 Round Cut lab grown diamonds weighing 0.25 carat | Side Stone 2: 4 Princess Cut lab grown diamonds weighing 0.15 carat
```

### Repeating-Core Items WITHOUT CENTER

```
0.35-0.80 ct - Round Cut Natural diamonds - Pendant

At least one Round Cut natural diamonds weighing 0.35 carat.
At least one Round Cut natural diamonds weighing 0.45 carat.
At least one Round Cut natural diamonds weighing 0.55 carat.
```

### NO-STONES Items

```
2.0 MM - Wedding Band - in 14K, 18K, and 950

```

## Key Features

### Shape Ordering
- **Round shape prioritized** - "Round" always comes first when present
- **Remaining shapes A→Z** alphabetical order for all other shapes
- **Proper capitalization** (e.g., "Princess", "Round")

### Carat Range Formatting
- **Single carat:** `0.50 ct`
- **Range:** `0.50-1.25 ct` (hyphen)
- **Fixed "ct" literal** suffix

### Stone Type Handling
- **Pluralization:** "diamond" → "diamonds"
- **Multiple types:** "diamonds and sapphires"
- **Type qualifiers:** 
  - Natural: "natural diamonds"
  - Lab-Grown: "lab grown diamonds"

### Side Stone Grouping
- **Separate groups:** "Side Stone 1: ... | Side Stone 2: ..."
- **Individual details:** quantity, shape, type, carat weight
- **Pipe separator** between groups

## SEO Implementation

### SEO Title
- **Same as Title** (exact copy)

### SEO Description  
- **First 160 characters** of Body content
- **Remove markdown/bold** formatting
- **Preserve "natural/lab grown"** wording
- **Add "..."** if truncated

## Acceptance Check Examples

### ✅ Lab-Grown Ring w/ Center (Princess) + Sides (Round)
- **Title:** `0.50-1.25 ct - Round & Princess Cut diamonds - Engagement Rings`
- **Body:** Includes bold "Center:" line and sides split with " | "
- **Body:** Uses "lab grown diamonds"

### ✅ Natural Pendant (no center, repeating cores 0.35, 0.45, ...)
- **Body:** Lists each core line in ascending order
- **Title:** Contains "Natural Diamonds"

### ✅ No-Stones Wedding Band with width=2
- **Title:** `2.0 MM - Wedding Band - in 14K, 18K, and 950`

## Implementation Details

### Core Functions
- `buildTitle(product)` - Generate deterministic title
- `buildBody(product)` - Generate parent-level body content  
- `buildSeo(product)` - Generate SEO title and description

### Helper Functions
- `getCaratRange(variants)` - Calculate min-max carat range
- `getUniqueShapesOrdered(variants)` - Collect and order shapes
- `getStoneTypesPlural(variants)` - Pluralize and join stone types
- `listSideStoneGroups(variants)` - List side stone details separately
- `listCoreWeightsAscending(variants)` - List core weights in ascending order
- `hasCenter(variants)` - Check if product has center stone

### Product Interface
```typescript
interface Product {
  variants: VariantSeed[];
  diamondType: 'Natural' | 'LabGrown' | 'NoStones';
  hasCenter: boolean;
  isRepeating: boolean;
}
```

## Migration Notes

The new template builders replace:
- `generateBodyHTML()` function
- Ad-hoc title generation in `createProductInfo()`
- Variant-specific SEO generation

All existing functionality is preserved while providing deterministic, consistent output according to client specifications.
