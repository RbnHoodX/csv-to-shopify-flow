import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Upload, Download, FileSpreadsheet } from 'lucide-react';
import { parseWeightLookupCSV, type WeightLookupTable } from '../lib/weight-lookup';
import Papa from 'papaparse';

interface WeightLookupUploadProps {
  onWeightTableLoaded: (weightTable: WeightLookupTable) => void;
  currentTable?: WeightLookupTable;
}

export function WeightLookupUpload({ onWeightTableLoaded, currentTable }: WeightLookupUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const text = await file.text();
      
      Papa.parse(text, {
        complete: (results) => {
          try {
            const weightTable = parseWeightLookupCSV(results.data as string[][]);
            onWeightTableLoaded(weightTable);
            setSuccess(`Weight lookup loaded: ${weightTable.size} core numbers`);
          } catch (err) {
            setError(`Error parsing weight lookup: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
          setIsLoading(false);
        },
        error: (err) => {
          setError(`CSV parsing error: ${err.message}`);
          setIsLoading(false);
        }
      });
    } catch (err) {
      setError(`File reading error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  const downloadSampleCSV = () => {
    const sampleData = [
      ['Core Number', '14KT', '18KT', 'PLT'],
      ['15686LB', '6.5', '8.0', '11.5'],
      ['WB001', '4.2', '5.1', '7.8'],
      ['RG1234', '3.8', '4.6', '6.9']
    ];
    
    const csv = Papa.unparse(sampleData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'weight-lookup-sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const tableStats = currentTable ? {
    coreCount: currentTable.size,
    sampleEntries: Array.from(currentTable.entries()).slice(0, 3)
  } : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Weight Lookup Upload
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="weight-file">Upload Weight Lookup CSV</Label>
          <div className="flex gap-2">
            <Input
              id="weight-file"
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={isLoading}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={downloadSampleCSV}
              className="shrink-0"
            >
              <Download className="h-4 w-4 mr-1" />
              Sample
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            CSV format: Core Number, 14KT, 18KT, PLT (weights in grams)
          </p>
        </div>

        {isLoading && (
          <Alert>
            <Upload className="h-4 w-4" />
            <AlertDescription>Loading weight lookup table...</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {tableStats && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">Current Weight Table</h4>
            <p className="text-sm text-muted-foreground mb-2">
              {tableStats.coreCount} core numbers loaded
            </p>
            {tableStats.sampleEntries.length > 0 && (
              <div className="text-xs">
                <p className="font-medium">Sample entries:</p>
                {tableStats.sampleEntries.map(([core, weights]) => (
                  <div key={core} className="ml-2">
                    {core}: {Array.from(weights.entries()).map(([metal, weight]) => 
                      `${metal}=${weight}g`
                    ).join(', ')}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}