# Cost Calculator Refactor - New Architecture

## Overview

The Cost Calculator module has been completely refactored to fix center-stone pricing issues for NATURAL and LAB-GROWN items. The new system implements correct rules table selection, inclusive size brackets, proper quality handling, and metal cost decoupling.

## Key Changes

### 🔧 **Fixed Issues**
- **Incorrect table selection**: Now properly selects NATURAL vs LAB-GROWN rules
- **Wrong lookup order**: Implements canonical lookup sequence
- **Inclusive bounds**: Size brackets now use `min <= weight <= max`
- **Metal cost coupling**: Metal costs are now additive only, not multiplied by carat weight
- **Fallback removal**: No more default fallbacks that mask lookup failures

### 🏗️ **New Architecture**

#### **Canonical Lookup Order**
1. **Determine stone type**: "natural" or "lab" from product metadata
2. **Extract center shape**: From center stone data, NEVER infer from sides
3. **Match size bracket**: Using inclusive bounds (`min <= weight <= max`)
4. **Handle quality**: Required for natural, ignored for lab-grown
5. **Calculate price**: `price_per_carat = rules[type][shape][bracket][quality?]`
6. **Compute cost**: `center_cost = round2(weight * price_per_carat)`

#### **Metal Cost Separation**
- **Stone costs**: Based on carat weight × price per carat
- **Metal costs**: Based on grams × price per gram
- **Total cost**: `stone_costs + metal_cost + labor_costs`
- **No multiplication**: Metal cost is never multiplied by carat weight

## Core Functions

### **`getPricePerCarat(params, rules)`**
Main pricing lookup function that handles both natural and lab-grown diamonds.

```typescript
const pricePerCarat = getPricePerCarat({
  type: 'natural',        // 'natural' or 'lab'
  shape: 'Princess',      // Stone shape
  weight: 0.50,          // Carat weight
  quality: 'GH'           // Quality (required for natural)
}, ruleSet);
```

### **`priceCenter(stone, rules)`**
Pricing function specifically for center stones with debug logging.

```typescript
const centerCost = priceCenter({
  type: 'natural',
  shape: 'Princess',
  weight: 0.45,
  quality: 'GH'
}, ruleSet);
```

### **`computeTotals(params, rules)`**
Computes total costs with proper separation of concerns.

```typescript
const totals = computeTotals({
  center: 270,    // Center stone cost
  sides: 50,      // Side stone cost
  metal: 150      // Metal cost
}, ruleSet);
```

### **`calculateCostBreakdown(variant, ruleSet, sku)`**
Main function that calculates complete cost breakdown for a variant.

## Input Normalization

### **Shape Normalization**
- **Input**: "round", "PRINCESS", "emerald"
- **Output**: "Round", "Princess", "Emerald"
- **Purpose**: Consistent title-case formatting

### **Quality Normalization**
- **Input**: "gh", "fg", "ij"
- **Output**: "GH", "FG", "IJ"
- **Purpose**: Uppercase quality codes

### **Weight Normalization**
- **Input**: "0.5 ct", "1.25-2.00", "Weight: 3.5g"
- **Output**: 0.5, 1.25, 3.5
- **Purpose**: Strip non-numeric characters, parse floats

## Error Handling

### **`CostLookupError`**
Custom error class with detailed context for debugging.

```typescript
throw new CostLookupError('No matching diamond price found', {
  type: 'natural',
  shape: 'Princess',
  weight: 0.50,
  quality: 'GH',
  productId: 'PRODUCT123'
});
```

### **Validation Guards**
- **Missing shape**: Throws error immediately
- **Natural without quality**: Throws error immediately
- **No matching price**: Throws error with lookup details
- **Invalid weight**: Throws error during parsing

## Test Cases

### **✅ Test Case 1: Natural Princess 0.45ct GH**
- **Expected**: 0.45 × 600 = $270
- **Previous Wrong**: $1700
- **Status**: ✅ Fixed

### **✅ Test Case 2: Natural Princess 0.80ct GH**
- **Expected**: 0.80 × 1150 = $920
- **Previous Wrong**: $1500
- **Status**: ✅ Fixed

### **✅ Test Case 3: Natural Round 0.55ct GH**
- **Expected**: 0.55 × 950 = $522.50
- **Metal Cost**: Additive only (not multiplied by carat)
- **Status**: ✅ Fixed

### **✅ Test Case 4: Lab-Grown Princess 3.00ct**
- **Expected**: 3.00 × 150 = $450
- **Previous Wrong**: $95
- **Status**: ✅ Fixed

### **✅ Test Case 5: Bracket Boundaries**
- **Weight at min/max**: Should match bracket exactly
- **Inclusive bounds**: `min <= weight <= max`
- **Status**: ✅ Fixed

### **✅ Test Case 6: Table Selection**
- **Natural items**: Must use NATURAL rules table
- **Lab-grown items**: Must use LAB-GROWN rules table
- **Quality handling**: Required for natural, ignored for lab
- **Status**: ✅ Fixed

## Migration Process

### **1. Backup Current System**
```bash
# Backup current cost calculator
cp src/lib/cost-calculator.ts src/lib/cost-calculator-backup.ts
```

### **2. Deploy New System**
```bash
# Deploy new cost calculator
cp src/lib/cost-calculator-new.ts src/lib/cost-calculator.ts
```

### **3. Run Validation**
```bash
# Run migration validation
npm run migrate:cost-calculator
```

### **4. Monitor Results**
- Review migration report
- Verify cost changes are expected
- Check for any errors or warnings

### **5. Rollback if Needed**
```bash
# Rollback to previous version
cp src/lib/cost-calculator-backup.ts src/lib/cost-calculator.ts
```

## Debug Logging

### **Center Stone Pricing**
```typescript
console.log(`💎 Center stone pricing:`, {
  type: stone.type,
  shape: stone.shape,
  weight: stone.weight,
  quality: stone.quality,
  pricePerCarat,
  totalCost: toFixed2(totalCost)
});
```

### **Price Lookup Details**
```typescript
console.log(`🔍 Looking up diamond price for:`, {
  shape: normalizedShape,
  size: weight,
  quality: normalizedQuality
});
```

## Performance Considerations

### **Optimizations**
- **Passive scroll listeners**: Better performance for scroll events
- **Efficient lookups**: Direct array iteration over complex data structures
- **Minimal allocations**: Reuse objects where possible

### **Memory Usage**
- **No caching**: Each lookup is fresh to prevent stale data
- **Cleanup**: Proper event listener cleanup in components
- **Garbage collection**: Minimal object creation during calculations

## Troubleshooting

### **Common Issues**

#### **"No matching diamond price found"**
- Check if rules table is loaded correctly
- Verify shape spelling matches rules exactly
- Confirm weight falls within bracket ranges
- Ensure quality codes match for natural diamonds

#### **"Missing center stone shape"**
- Check input data for center shape column
- Verify column names: "Center Shape", "CenterShape", "Center shape"
- Ensure shape value is not empty or whitespace

#### **"Natural diamonds require quality specification"**
- Check if quality is being passed correctly
- Verify variant.quality is set
- Ensure diamondsType indicates "natural"

### **Debug Steps**
1. **Check console logs**: Look for debug output
2. **Verify rule sets**: Ensure correct tables are loaded
3. **Validate input data**: Check variant data structure
4. **Test lookup logic**: Use unit tests to isolate issues

## Future Enhancements

### **Planned Features**
- **Caching layer**: For frequently accessed price lookups
- **Batch processing**: Process multiple variants simultaneously
- **Real-time updates**: Dynamic rule set updates
- **Advanced analytics**: Cost trend analysis and reporting

### **Integration Points**
- **Database layer**: Direct rule set loading
- **API endpoints**: Cost calculation as a service
- **Monitoring**: Cost calculation performance metrics
- **Alerting**: Cost calculation failure notifications

## Support

### **Getting Help**
- **Documentation**: This README and inline code comments
- **Unit Tests**: Comprehensive test coverage in `cost-calculator-new.test.ts`
- **Migration Script**: Automated validation in `migrate-cost-calculator.ts`
- **Error Messages**: Detailed error context in `CostLookupError`

### **Contributing**
- **Code Style**: Follow existing patterns
- **Testing**: Add tests for new functionality
- **Documentation**: Update this README for changes
- **Validation**: Run migration script before deploying

---

**Commit Message**: `fix(cost): correct center lookup by type-shape-bracket-quality, inclusive bounds, metal decoupling, and unit tests`

**Status**: ✅ **Ready for Production**

