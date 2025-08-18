import React from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { X, Calculator, DollarSign, TrendingUp } from 'lucide-react';
import type { CostBreakdown } from '@/lib/cost-calculator';
import { toFixed2 } from '@/lib/csv-parser';
import { formatPricingResult } from '@/lib/pricing-calculator';

interface CostBreakdownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  costBreakdown?: CostBreakdown;
  productTitle?: string;
}

export const CostBreakdownDrawer: React.FC<CostBreakdownDrawerProps> = ({
  isOpen,
  onClose,
  costBreakdown,
  productTitle = 'Product'
}) => {
  if (!costBreakdown) return null;

  const costItems = [
    {
      label: 'Diamond Cost',
      value: costBreakdown.diamondCost,
      description: `${toFixed2(costBreakdown.details.diamondCarats)} carats × $${toFixed2(costBreakdown.details.diamondPricePerCarat)}/ct`,
      color: 'text-blue-600'
    },
    {
      label: 'Metal Cost',
      value: costBreakdown.metalCost,
      description: `${toFixed2(costBreakdown.variantGrams)}g × $${toFixed2(costBreakdown.details.metalPricePerGram)}/g`,
      color: 'text-yellow-600'
    },
    {
      label: 'Side Stone Labor',
      value: costBreakdown.sideStoneCost,
      description: `${costBreakdown.details.sideStoneCount} stones`,
      color: 'text-green-600'
    },
    {
      label: 'Center Stone Labor',
      value: costBreakdown.centerStoneCost,
      description: costBreakdown.details.hasCenter ? 'Has center stone' : 'No center stone',
      color: 'text-purple-600'
    },
    {
      label: 'Polish',
      value: costBreakdown.polishCost,
      description: 'Standard polish labor',
      color: 'text-indigo-600'
    },
    {
      label: 'Bracelets',
      value: costBreakdown.braceletsCost,
      description: costBreakdown.details.isBracelet ? 'Bracelet category' : 'Not a bracelet',
      color: 'text-pink-600'
    },
    {
      label: 'CAD Creation',
      value: costBreakdown.cadCreationCost,
      description: 'Design and modeling',
      color: 'text-cyan-600'
    },
    {
      label: 'Fixed Cost',
      value: costBreakdown.constantCost,
      description: 'Standard $25 fee',
      color: 'text-gray-600'
    }
  ];

  const pricingFormatted = formatPricingResult(costBreakdown.pricing);

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[80vh]">
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Cost Breakdown & Pricing
              </DrawerTitle>
              <DrawerDescription>
                Detailed analysis for {productTitle} (SKU: {costBreakdown.sku})
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button variant="outline" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <ScrollArea className="flex-1 p-6">
          <div className="space-y-6">
            {/* Weight Calculation */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                Weight Calculation
              </h3>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Base Grams (14KT):</span>
                  <span className="font-mono">{toFixed2(costBreakdown.details.baseGrams)}g</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Weight Multiplier:</span>
                  <span className="font-mono">{costBreakdown.details.weightMultiplier}×</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-medium">
                  <span>Final Weight:</span>
                  <span className="font-mono">{toFixed2(costBreakdown.variantGrams)}g</span>
                </div>
              </div>
            </div>

            {/* Cost Components */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Cost Components
              </h3>
              <div className="space-y-3">
                {costItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{item.label}</span>
                        {item.value > 0 && (
                          <Badge variant="outline" className="text-xs">
                            ${toFixed2(item.value)}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {item.description}
                      </div>
                    </div>
                    <div className={`text-right ${item.color}`}>
                      <div className="font-mono text-sm font-medium">
                        ${toFixed2(item.value)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Cost */}
            <div className="border-t pt-4">
              <div className="bg-muted/50 border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">Total Cost per Item</span>
                  <span className="text-2xl font-bold font-mono">
                    ${toFixed2(costBreakdown.totalCost)}
                  </span>
                </div>
              </div>
            </div>

            {/* Pricing Calculation */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Pricing Calculation
              </h3>
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Cost:</span>
                    <span className="font-mono">${toFixed2(costBreakdown.pricing.cost)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Multiplier:</span>
                    <span className="font-mono">{pricingFormatted.multiplierDisplay}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Formula:</span>
                    <span className="font-mono text-xs">({toFixed2(costBreakdown.pricing.cost)} × {costBreakdown.pricing.multiplier}) - 0.01</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-medium text-green-700">
                    <span>Sell Price:</span>
                    <span className="font-mono">${pricingFormatted.variantPrice}</span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Compare-At Price:</span>
                    <span className="font-mono text-xs">{toFixed2(costBreakdown.pricing.cost)} × 4</span>
                  </div>
                  <div className="flex justify-between text-lg font-medium text-blue-700">
                    <span>Compare Price:</span>
                    <span className="font-mono">${pricingFormatted.compareAtPrice}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Formula Summary */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Cost Calculation Formula</h4>
              <div className="text-xs font-mono bg-muted/50 rounded p-3 space-y-1">
                <div>Diamond + Metal + Labor + Fixed Cost</div>
                <div className="text-muted-foreground">
                  = {toFixed2(costBreakdown.diamondCost)} + {toFixed2(costBreakdown.metalCost)} + {toFixed2(
                    costBreakdown.sideStoneCost + 
                    costBreakdown.centerStoneCost + 
                    costBreakdown.polishCost + 
                    costBreakdown.braceletsCost + 
                    costBreakdown.cadCreationCost
                  )} + {toFixed2(costBreakdown.constantCost)}
                </div>
                <div className="font-medium">= ${toFixed2(costBreakdown.totalCost)}</div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
};