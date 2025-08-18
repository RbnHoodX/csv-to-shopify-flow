import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Table, Settings } from 'lucide-react';
import { useCSVStore } from '@/store/csvStore';
import type { RuleSet, NoStonesRuleSet } from '@/lib/rulebook-parser';

interface RuleSetDebugProps {
  fileKey: 'naturalRules' | 'labGrownRules' | 'noStonesRules';
  ruleSet: RuleSet | NoStonesRuleSet;
  isOpen: boolean;
  onToggle: () => void;
}

export const RuleSetDebug: React.FC<RuleSetDebugProps> = ({
  fileKey,
  ruleSet,
  isOpen,
  onToggle,
}) => {
  const fileName = fileKey === 'naturalRules' ? 'Natural Rules' : 
                  fileKey === 'labGrownRules' ? 'LabGrown Rules' : 'No Stones Rules';

  const isNoStones = 'metalsA' in ruleSet;

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-2">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>{fileName} Extracted</span>
          </div>
          {isOpen ? 
            <ChevronDown className="h-4 w-4" /> : 
            <ChevronRight className="h-4 w-4" />
          }
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="space-y-3 mt-2">
        {isNoStones ? (
          <div className="border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Table className="h-4 w-4" />
              <h4 className="font-medium text-sm">Metals A</h4>
              <Badge variant="secondary" className="text-xs">
                {ruleSet.metalsA.length} items
              </Badge>
            </div>
            <ScrollArea className="h-20">
              <div className="flex flex-wrap gap-1">
                {ruleSet.metalsA.slice(0, 20).map((metal, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {metal}
                  </Badge>
                ))}
                {ruleSet.metalsA.length > 20 && (
                  <Badge variant="outline" className="text-xs">
                    +{ruleSet.metalsA.length - 20} more
                  </Badge>
                )}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Arrays */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium text-xs">Metals G (Center+)</h4>
                  <Badge variant="secondary" className="text-xs">
                    {ruleSet.metalsG.length}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {ruleSet.metalsG.slice(0, 6).map((metal, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {metal}
                    </Badge>
                  ))}
                  {ruleSet.metalsG.length > 6 && (
                    <span className="text-xs text-muted-foreground">+{ruleSet.metalsG.length - 6}</span>
                  )}
                </div>
              </div>

              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium text-xs">Centers H</h4>
                  <Badge variant="secondary" className="text-xs">
                    {ruleSet.centersH.length}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {ruleSet.centersH.slice(0, 6).map((center, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {center}
                    </Badge>
                  ))}
                  {ruleSet.centersH.length > 6 && (
                    <span className="text-xs text-muted-foreground">+{ruleSet.centersH.length - 6}</span>
                  )}
                </div>
              </div>

              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium text-xs">Qualities I (Center+)</h4>
                  <Badge variant="secondary" className="text-xs">
                    {ruleSet.qualitiesI.length}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {ruleSet.qualitiesI.slice(0, 4).map((quality, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {quality}
                    </Badge>
                  ))}
                  {ruleSet.qualitiesI.length > 4 && (
                    <span className="text-xs text-muted-foreground">+{ruleSet.qualitiesI.length - 4}</span>
                  )}
                </div>
              </div>

              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium text-xs">Metals J (No Center)</h4>
                  <Badge variant="secondary" className="text-xs">
                    {ruleSet.metalsJ.length}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {ruleSet.metalsJ.slice(0, 6).map((metal, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {metal}
                    </Badge>
                  ))}
                  {ruleSet.metalsJ.length > 6 && (
                    <span className="text-xs text-muted-foreground">+{ruleSet.metalsJ.length - 6}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Lookup Tables */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="border rounded-lg p-2 text-center">
                <div className="text-xs font-medium">Weight Index</div>
                <Badge variant="secondary" className="text-xs mt-1">
                  {ruleSet.weightIndex.size} entries
                </Badge>
              </div>

              <div className="border rounded-lg p-2 text-center">
                <div className="text-xs font-medium">Metal Price</div>
                <Badge variant="secondary" className="text-xs mt-1">
                  {ruleSet.metalPrice.size} entries
                </Badge>
              </div>

              <div className="border rounded-lg p-2 text-center">
                <div className="text-xs font-medium">Labor</div>
                <Badge variant="secondary" className="text-xs mt-1">
                  {ruleSet.labor.size} entries
                </Badge>
              </div>

              <div className="border rounded-lg p-2 text-center">
                <div className="text-xs font-medium">Margins</div>
                <Badge variant="secondary" className="text-xs mt-1">
                  {ruleSet.margins.length} ranges
                </Badge>
              </div>
            </div>

            {/* Sample lookup data */}
            {ruleSet.weightIndex.size > 0 && (
              <div className="border rounded-lg p-3">
                <h4 className="font-medium text-xs mb-2">Sample Weight Index</h4>
                <div className="text-xs font-mono space-y-1">
                  {Array.from(ruleSet.weightIndex.entries()).slice(0, 3).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span>{key}:</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};