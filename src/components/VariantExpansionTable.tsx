import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Zap, Package, CheckCircle } from 'lucide-react';
import type { VariantSeed, ExpansionResult } from '@/lib/variant-expansion';

interface VariantExpansionTableProps {
  expansionResult: ExpansionResult;
  expectedCounts: Record<string, number>;
}

export const VariantExpansionTable: React.FC<VariantExpansionTableProps> = ({
  expansionResult,
  expectedCounts
}) => {
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Group variants by handle
  const variantsByHandle = expansionResult.variants.reduce((acc, variant) => {
    if (!acc[variant.handle]) {
      acc[variant.handle] = [];
    }
    acc[variant.handle].push(variant);
    return acc;
  }, {} as Record<string, VariantSeed[]>);

  const getScenarioBadge = (scenario: VariantSeed['scenario']) => {
    switch (scenario) {
      case 'Unique+Center':
        return <Badge variant="default" className="text-xs">Unique+Center</Badge>;
      case 'Unique+NoCenter':
        return <Badge variant="secondary" className="text-xs">Unique+NoCenter</Badge>;
      case 'Repeating':
        return <Badge className="text-xs bg-orange-100 text-orange-800 border-orange-200">Repeating</Badge>;
      case 'NoStones':
        return <Badge variant="outline" className="text-xs">NoStones</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Variant Expansion
        </CardTitle>
        
        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{expansionResult.stats.totalVariants}</div>
            <div className="text-xs text-muted-foreground">Total Variants</div>
          </div>
          
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{expansionResult.stats.uniqueCenterVariants}</div>
            <div className="text-xs text-muted-foreground">Unique+Center</div>
          </div>
          
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{expansionResult.stats.uniqueNoCenterVariants}</div>
            <div className="text-xs text-muted-foreground">Unique+NoCenter</div>
          </div>
          
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{expansionResult.stats.repeatingVariants}</div>
            <div className="text-xs text-muted-foreground">Repeating</div>
          </div>

          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-600">{expansionResult.stats.noStonesVariants}</div>
            <div className="text-xs text-muted-foreground">NoStones</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-96">
          <div className="px-6 pb-4 space-y-2">
            {Object.entries(variantsByHandle).map(([handle, variants]) => {
              const expected = expectedCounts[handle] || 0;
              const actual = variants.length;
              const isValid = expected === actual;
              
              return (
                <Collapsible 
                  key={handle}
                  open={openSections[handle]}
                  onOpenChange={() => toggleSection(handle)}
                >
                  <CollapsibleTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-between p-3 h-auto border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3 text-left">
                        <Package className="h-4 w-4" />
                        <div>
                          <div className="font-medium text-sm">{handle}</div>
                          <div className="text-xs text-muted-foreground">
                            Core: {variants[0]?.core}
                          </div>
                        </div>
                        {getScenarioBadge(variants[0]?.scenario)}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className={`text-sm font-medium ${isValid ? 'text-green-600' : 'text-red-600'}`}>
                            {actual} variants
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Expected: {expected}
                          </div>
                        </div>
                        {isValid ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <div className="h-4 w-4 rounded-full bg-red-100 border border-red-300" />
                        )}
                        {openSections[handle] ? 
                          <ChevronDown className="h-4 w-4" /> : 
                          <ChevronRight className="h-4 w-4" />
                        }
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="mt-2">
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-24">Metal</TableHead>
                            <TableHead className="w-24">Center Size</TableHead>
                            <TableHead className="w-24">Quality</TableHead>
                            <TableHead>Input Row</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {variants.map((variant, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-xs">
                                {variant.metalCode}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {variant.centerSize || 'N/A'}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {variant.qualityCode || 'N/A'}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {variant.inputRowRef.diamondsType || 'N/A'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
            
            {Object.keys(variantsByHandle).length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No variants to display</p>
                <p className="text-sm">Upload input data and rules to see expansion</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};