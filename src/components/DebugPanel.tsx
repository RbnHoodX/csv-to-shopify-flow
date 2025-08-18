import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Bug, Code } from 'lucide-react';
import { useCSVStore } from '@/store/csvStore';
import { normalizeRow, trimAll, toNum, toFixed2, ctStr, DiamondsType } from '@/lib/csv-parser';

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
          Normalized examples and parsing validation
        </p>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-96 px-6 pb-4">
          <div className="space-y-4">
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

            {/* Parsed Files */}
            {fileEntries.map(([fileKey, file]) => (
              <Collapsible 
                key={fileKey}
                open={openSections[fileKey]} 
                onOpenChange={() => toggleSection(fileKey)}
              >
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>{file.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {file.rowCount} rows
                      </Badge>
                    </div>
                    {openSections[fileKey] ? 
                      <ChevronDown className="h-4 w-4" /> : 
                      <ChevronRight className="h-4 w-4" />
                    }
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="space-y-2 mt-2">
                  <div className="text-xs text-muted-foreground mb-2">
                    Headers: {file.headers.join(', ')}
                  </div>
                  
                  {file.parsedRows.slice(0, 3).map((row, idx) => {
                    const normalized = normalizeRow(row);
                    return (
                      <div key={idx} className="border rounded-lg p-3 space-y-2">
                        <div className="text-xs font-medium">Row {idx + 1} (Sample)</div>
                        
                        <div className="grid grid-cols-1 gap-2">
                          {Object.entries(normalized).slice(0, 3).map(([key, data]) => (
                            <div key={key} className="bg-muted/30 rounded p-2">
                              <div className="text-xs font-medium text-muted-foreground mb-1">
                                {key}
                              </div>
                              <div className="space-y-1 text-xs font-mono">
                                <div>
                                  <span className="text-muted-foreground">Raw:</span>{' '}
                                  "{data.raw}"
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Trimmed:</span>{' '}
                                  "{data.trimmed}"
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Numeric:</span>{' '}
                                  {isNaN(data.numeric) ? 'NaN' : data.numeric}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Valid:</span>{' '}
                                  {data.isValid ? 'true' : 'false'}
                                </div>
                              </div>
                            </div>
                          ))}
                          {Object.keys(normalized).length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              ... and {Object.keys(normalized).length - 3} more columns
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  {file.rowCount > 3 && (
                    <div className="text-xs text-muted-foreground text-center py-2">
                      ... and {file.rowCount - 3} more rows
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            ))}

            {fileEntries.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <Bug className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Upload CSV files to see normalization</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};