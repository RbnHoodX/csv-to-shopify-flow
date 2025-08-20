import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Package, Crown, Users, Calculator } from 'lucide-react';
import { CostBreakdownDrawer } from './CostBreakdownDrawer';
import type { CostBreakdown } from '@/lib/cost-calculator';

interface ShopifyPreviewProps {
  csvContent: string;
}

interface ParsedRow {
  [key: string]: string;
}

// Mock cost breakdown for preview (in real implementation this would come from the generator)
const createMockCostBreakdown = (sku: string, price: string): CostBreakdown => {
  const totalCost = parseFloat(price) || 500;
  const variantPrice = (totalCost * 2.5) - 0.01;
  const compareAtPrice = totalCost * 4;
  
  return {
    centerStoneDiamond: totalCost * 0.3,
    sideStoneDiamond: totalCost * 0.1,
    metalCost: totalCost * 0.3,
    centerStoneLabor: 5,
    sideStoneLabor: totalCost * 0.05,
    polishCost: 25,
    braceletsCost: 0,
    pendantsCost: 0,
    cadCreationCost: 20,
    additionalCost: 25,
    totalCost,
    variantGrams: 5.5,
    sku,
    published: true,
    pricing: {
      cost: totalCost,
      multiplier: 2.5,
      variantPrice,
      compareAtPrice,
      marginSource: 'type_default' as const
    },
    details: {
      baseGrams: 5.0,
      weightMultiplier: 1.1,
      metalPricePerGram: 2.5,
      centerCarats: 1.0,
      sideCarats: 0.25,
      centerPricePerCarat: 150,
      sidePricePerCarat: 150,
      sideStoneCount: 4,
      hasCenter: true,
      isBracelet: false,
      isPendant: false
    }
  };
};

export const ShopifyPreview: React.FC<ShopifyPreviewProps> = ({ csvContent }) => {
  const [selectedCostBreakdown, setSelectedCostBreakdown] = useState<CostBreakdown | undefined>();
  const [selectedProductTitle, setSelectedProductTitle] = useState<string>('');
  
  // Parse CSV content
  const lines = csvContent.split('\n').filter(line => line.trim());
  const headers = lines[0]?.split(',').map(h => h.replace(/"/g, ''));
  const dataRows = lines.slice(1, 11).map(line => {
    // Simple CSV parsing (assumes no commas in values for preview)
    const values = line.split(',').map(v => v.replace(/"/g, ''));
    const row: ParsedRow = {};
    headers?.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });

  // Group rows by handle to show parent-child structure
  const rowsByHandle: Record<string, ParsedRow[]> = {};
  dataRows.forEach(row => {
    const handle = row.Handle;
    if (!rowsByHandle[handle]) {
      rowsByHandle[handle] = [];
    }
    rowsByHandle[handle].push(row);
  });

  const totalLines = lines.length - 1; // Exclude header
  const totalHandles = Object.keys(rowsByHandle).length;

  const handleShowCostBreakdown = (row: ParsedRow) => {
    const costBreakdown = createMockCostBreakdown(row['Variant SKU'], row['Cost per item']);
    setSelectedCostBreakdown(costBreakdown);
    setSelectedProductTitle(row.Title || row.Handle);
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Shopify CSV Preview with Costs
          </CardTitle>
          
          <div className="flex gap-4">
            <Badge variant="outline" className="text-xs">
              {totalLines} rows
            </Badge>
            <Badge variant="outline" className="text-xs">
              {totalHandles} products
            </Badge>
            <Badge variant="outline" className="text-xs">
              {headers?.length || 0} columns
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <ScrollArea className="h-96">
            <div className="px-6 pb-4">
              {Object.entries(rowsByHandle).slice(0, 5).map(([handle, handleRows]) => (
                <div key={handle} className="mb-6 last:mb-0">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-medium text-sm">{handle}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {handleRows.length} variants
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {handleRows.map((row, index) => {
                      const isParent = row.Title !== '';
                      return (
                        <div key={index} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {isParent ? (
                                <Crown className="h-3 w-3 text-blue-600" />
                              ) : (
                                <Users className="h-3 w-3 text-gray-500" />
                              )}
                              <span className="text-xs font-medium">
                                {isParent ? 'Parent Row' : 'Child Row'}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                SKU: {row['Variant SKU']}
                              </Badge>
                            </div>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleShowCostBreakdown(row)}
                              className="h-6 px-2 text-xs"
                            >
                              <Calculator className="h-3 w-3 mr-1" />
                              Costs
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                            {/* Key product fields */}
                            {isParent && (
                              <>
                                <div>
                                  <span className="font-medium text-muted-foreground">Title:</span>
                                  <div className="truncate">{row.Title}</div>
                                </div>
                                <div>
                                  <span className="font-medium text-muted-foreground">Vendor:</span>
                                  <div>{row.Vendor}</div>
                                </div>
                                <div>
                                  <span className="font-medium text-muted-foreground">Type:</span>
                                  <div>{row.Type}</div>
                                </div>
                              </>
                            )}
                            
                            {/* Option fields */}
                            {(row['Option1 Value'] || row['Option2 Value'] || row['Option3 Value']) && (
                              <>
                                {row['Option1 Value'] && (
                                  <div>
                                    <span className="font-medium text-muted-foreground">
                                      {isParent ? row['Option1 Name'] : 'Metal'}:
                                    </span>
                                    <div>{row['Option1 Value']}</div>
                                  </div>
                                )}
                                {row['Option2 Value'] && (
                                  <div>
                                    <span className="font-medium text-muted-foreground">
                                      {isParent ? row['Option2 Name'] : 'Carat'}:
                                    </span>
                                    <div>{row['Option2 Value']}</div>
                                  </div>
                                )}
                                {row['Option3 Value'] && (
                                  <div>
                                    <span className="font-medium text-muted-foreground">
                                      {isParent ? row['Option3 Name'] : 'Quality'}:
                                    </span>
                                    <div>{row['Option3 Value']}</div>
                                  </div>
                                )}
                              </>
                            )}
                            
                            {/* Cost and weight fields */}
                            <div>
                              <span className="font-medium text-muted-foreground">Weight:</span>
                              <div>{row['Variant Grams']}g</div>
                            </div>
                            <div>
                              <span className="font-medium text-muted-foreground">Cost:</span>
                              <div>${row['Cost per item']}</div>
                            </div>
                            <div>
                              <span className="font-medium text-muted-foreground">Price:</span>
                              <div>${row['Variant Price']}</div>
                            </div>
                            <div>
                              <span className="font-medium text-muted-foreground">Inventory:</span>
                              <div>{row['Variant Inventory Qty']} units</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {Object.keys(rowsByHandle).length > 1 && (
                    <Separator className="mt-4" />
                  )}
                </div>
              ))}
              
              {Object.keys(rowsByHandle).length > 5 && (
                <div className="text-center text-sm text-muted-foreground py-4 border-t">
                  ... and {Object.keys(rowsByHandle).length - 5} more products
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <CostBreakdownDrawer
        isOpen={!!selectedCostBreakdown}
        onClose={() => setSelectedCostBreakdown(undefined)}
        costBreakdown={selectedCostBreakdown}
        productTitle={selectedProductTitle}
      />
    </>
  );
};