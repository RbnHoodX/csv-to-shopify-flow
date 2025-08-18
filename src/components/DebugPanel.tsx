import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Bug, Code } from 'lucide-react';
import { useCSVStore } from '@/store/csvStore';
import { normalizeRow, trimAll, toNum, toFixed2, ctStr, DiamondsType } from '@/lib/csv-parser';
import { RuleSetDebug } from './RuleSetDebug';
import type { RuleSet, NoStonesRuleSet } from '@/lib/rulebook-parser';

export const DebugPanel: React.FC = () => {
  const { files } = useCSVStore();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  
  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const fileEntries = Object.entries(files).filter(([_, file]) => file.uploaded);
  const ruleFiles = fileEntries.filter(([key]) => key.endsWith('Rules'));
  
  // Demo normalization examples
  const demoExamples = {
    trimAll: [
      { input: '  Hello   World  ', output: trimAll('  Hello   World  ') },
      { input: '\tDiamond\n', output: trimAll('\tDiamond\n') },
      { input: '   Multiple    Spaces   ', output: trimAll('   Multiple    Spaces   ') },
    ],
    toNum: [
      { input: '1,234.56', output: toNum('1,234.56') },
      { input: '  42  ', output: toNum('  42  ') },
      { input: 'invalid', output: toNum('invalid') },
    ],
    toFixed2: [
      { input: 123.456, output: toFixed2(123.456) },
      { input: '42', output: toFixed2('42') },
      { input: 'invalid', output: toFixed2('invalid') },
    ],
    ctStr: [
      { input: { total: 2.5 }, output: ctStr(2.5) },
      { input: { total: 2.5, center: 1.25 }, output: ctStr(2.5, 1.25) },
      { input: { total: '3.456', center: '1.789' }, output: ctStr('3.456', '1.789') },
    ],
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bug className="h-5 w-5" />
          Debug Panel
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Normalized examples and rulebook extraction
        </p>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-96 px-6 pb-4">
          <div className="space-y-4">
            {/* Rule Sets */}
            {ruleFiles.map(([fileKey, file]) => {
              if (!file.ruleSet) return null;
              return (
                <RuleSetDebug
                  key={fileKey}
                  fileKey={fileKey as 'naturalRules' | 'labGrownRules' | 'noStonesRules'}
                  ruleSet={file.ruleSet}
                  isOpen={openSections[fileKey]}
                  onToggle={() => toggleSection(fileKey)}
                />
              );
            })}

            {/* Normalization Functions Demo */}
            <Collapsible 
              open={openSections.functions} 
              onOpenChange={() => toggleSection('functions')}
            >
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-2">
                  <div className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    <span>Normalization Functions</span>
                  </div>
                  {openSections.functions ? 
                    <ChevronDown className="h-4 w-4" /> : 
                    <ChevronRight className="h-4 w-4" />
                  }
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-3 mt-2">
                {Object.entries(demoExamples).map(([funcName, examples]) => (
                  <div key={funcName} className="border rounded-lg p-3">
                    <h4 className="font-medium text-sm mb-2">{funcName}()</h4>
                    <div className="space-y-1">
                      {examples.map((example, idx) => (
                        <div key={idx} className="text-xs bg-muted/50 rounded p-2">
                          <div className="font-mono">
                            <span className="text-muted-foreground">Input:</span>{' '}
                            {typeof example.input === 'object' 
                              ? JSON.stringify(example.input)
                              : JSON.stringify(example.input)
                            }
                          </div>
                          <div className="font-mono">
                            <span className="text-muted-foreground">Output:</span>{' '}
                            <span className="text-green-600">{JSON.stringify(example.output)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {/* Diamond Types Enum */}
                <div className="border rounded-lg p-3">
                  <h4 className="font-medium text-sm mb-2">DiamondsType Enum</h4>
                  <div className="flex gap-1 flex-wrap">
                    {Object.values(DiamondsType).map(type => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {fileEntries.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <Bug className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Upload CSV files to see extraction</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};