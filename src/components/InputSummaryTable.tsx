import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Users, Repeat, Crown } from 'lucide-react';
import type { GroupSummary } from '@/lib/input-processor';

interface InputSummaryTableProps {
  summary: GroupSummary[];
  stats: {
    totalRows: number;
    totalGroups: number;
    uniqueGroups: number;
    repeatingGroups: number;
    naturalItems: number;
    labGrownItems: number;
    noStonesItems: number;
  };
}

export const InputSummaryTable: React.FC<InputSummaryTableProps> = ({ summary, stats }) => {
  const getRulebookBadge = (rulebook: string) => {
    if (rulebook.includes('Natural')) {
      return <Badge variant="default" className="text-xs">Natural</Badge>;
    } else if (rulebook.includes('LabGrown')) {
      return <Badge variant="secondary" className="text-xs">LabGrown</Badge>;
    } else if (rulebook.includes('No Stones')) {
      return <Badge variant="outline" className="text-xs">No Stones</Badge>;
    } else {
      return <Badge variant="destructive" className="text-xs">Unknown</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Input Analysis Summary
        </CardTitle>
        
        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{stats.totalRows}</div>
            <div className="text-xs text-muted-foreground">Total Rows</div>
          </div>
          
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{stats.totalGroups}</div>
            <div className="text-xs text-muted-foreground">Core Numbers</div>
          </div>
          
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.uniqueGroups}</div>
            <div className="text-xs text-muted-foreground">Unique</div>
          </div>
          
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{stats.repeatingGroups}</div>
            <div className="text-xs text-muted-foreground">Repeating</div>
          </div>
        </div>

        {/* Rulebook Distribution */}
        <div className="flex gap-2 mt-2">
          <Badge variant="default" className="text-xs">
            Natural: {stats.naturalItems}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            LabGrown: {stats.labGrownItems}
          </Badge>
          <Badge variant="outline" className="text-xs">
            No Stones: {stats.noStonesItems}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-64">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-32">Core Number</TableHead>
                <TableHead className="w-16 text-center">Count</TableHead>
                <TableHead className="w-20 text-center">Type</TableHead>
                <TableHead className="w-32">Diamonds Type</TableHead>
                <TableHead className="w-32">Rulebook</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.map((item) => (
                <TableRow key={item.coreNumber} className="hover:bg-muted/50">
                  <TableCell className="font-mono text-sm">
                    {item.coreNumber}
                  </TableCell>
                  
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-xs">
                      {item.count}
                    </Badge>
                  </TableCell>
                  
                  <TableCell className="text-center">
                    {item.isUnique ? (
                      <div className="flex items-center justify-center gap-1">
                        <Crown className="h-3 w-3 text-green-600" />
                        <span className="text-xs text-green-600">Unique</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <Repeat className="h-3 w-3 text-orange-600" />
                        <span className="text-xs text-orange-600">Repeat</span>
                      </div>
                    )}
                  </TableCell>
                  
                  <TableCell className="text-sm">
                    {item.diamondsType || 'N/A'}
                  </TableCell>
                  
                  <TableCell>
                    {getRulebookBadge(item.rulebook)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {summary.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No input data to analyze</p>
              <p className="text-sm">Upload Input test.csv to see grouping</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};