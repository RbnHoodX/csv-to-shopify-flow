import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Download, Play, Eye, FileText, AlertTriangle } from 'lucide-react';
import { useCSVStore } from '@/store/csvStore';
import { ShopifyPreview } from './ShopifyPreview';

export const CSVExport: React.FC = () => {
  const { 
    files, 
    variantExpansion, 
    generatedCSV, 
    shopifyRowsWithCosts,
    generateShopifyCSV 
  } = useCSVStore();
  
  // Check pipeline prerequisites
  const allFilesUploaded = Object.values(files).every(file => file.uploaded);
  const hasVariantExpansion = !!variantExpansion;
  const hasGeneratedCSV = !!generatedCSV;
  const canGenerate = allFilesUploaded && hasVariantExpansion;
  
  const handleGenerate = async () => {
    await generateShopifyCSV();
  };

  const handleDownload = () => {
    if (!generatedCSV) return;
    
    const blob = new Blob([generatedCSV], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'shopify-import.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getFileStatus = (file: any) => {
    if (!file.uploaded) return <Badge variant="secondary">Missing</Badge>;
    return <Badge variant="outline" className="text-green-600 border-green-600">✓ {file.rowCount} rows</Badge>;
  };

  const previewLines = hasGeneratedCSV ? generatedCSV.split('\n').slice(0, 6) : [];
  const totalRows = hasGeneratedCSV ? generatedCSV.split('\n').length - 1 : 0;

  return (
    <div className="space-y-6">
      {/* Main Generation Control Panel */}
      <Card className="w-full">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Play className="h-5 w-5" />
                Generate Shopify CSV Pipeline
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Complete 7-stage pipeline: Validate → Build Rules → Expand → Compute Costs → Assemble → Fill Meta → Export
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={allFilesUploaded ? "default" : "destructive"}>
                Files: {Object.values(files).filter(f => f.uploaded).length}/4
              </Badge>
              {hasVariantExpansion && (
                <Badge variant="default">
                  {variantExpansion.result.stats.totalVariants} variants
                </Badge>
              )}
              {hasGeneratedCSV && (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  ✓ CSV Ready
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* File Status Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="text-sm font-medium">Input Test</div>
              {getFileStatus(files.inputTest)}
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium">Natural Rules</div>
              {getFileStatus(files.naturalRules)}
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium">Lab Grown Rules</div>
              {getFileStatus(files.labGrownRules)}
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium">No Stones Rules</div>
              {getFileStatus(files.noStonesRules)}
            </div>
          </div>

          {/* Pipeline Status */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4" />
              <span className="font-medium">Pipeline Status</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span>Files Uploaded:</span>
                <Badge variant={allFilesUploaded ? "default" : "secondary"}>
                  {allFilesUploaded ? '✓ Complete' : `${Object.values(files).filter(f => f.uploaded).length}/4`}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Variants Expanded:</span>
                <Badge variant={hasVariantExpansion ? "default" : "secondary"}>
                  {hasVariantExpansion ? `✓ ${variantExpansion.result.variants.length}` : 'Pending'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>CSV Generated:</span>
                <Badge variant={hasGeneratedCSV ? "default" : "secondary"}>
                  {hasGeneratedCSV ? `✓ ${totalRows} rows` : 'Pending'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate}
              size="lg"
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Generate Shopify CSV
            </Button>
            
            {hasGeneratedCSV && (
              <Button onClick={handleDownload} variant="outline" size="lg">
                <Download className="h-4 w-4 mr-2" />
                Download CSV ({totalRows} rows)
              </Button>
            )}
          </div>

          {/* Prerequisites Warning */}
          {!canGenerate && (
            <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <div className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                  Pipeline Prerequisites Not Met
                </div>
                <div className="text-yellow-700 dark:text-yellow-300 space-y-1">
                  {!allFilesUploaded && <div>• Upload all 4 required CSV files</div>}
                  {allFilesUploaded && !hasVariantExpansion && <div>• Process input files to generate variant expansion</div>}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CSV Preview */}
      {hasGeneratedCSV && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Generated CSV Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-muted/30 rounded-lg text-sm">
              <div>
                <div className="font-medium">Total Rows</div>
                <div className="text-muted-foreground">{totalRows}</div>
              </div>
              <div>
                <div className="font-medium">Products</div>
                <div className="text-muted-foreground">
                  {shopifyRowsWithCosts ? new Set(shopifyRowsWithCosts.map(r => r.Handle)).size : '—'}
                </div>
              </div>
              <div>
                <div className="font-medium">Parent Rows</div>
                <div className="text-muted-foreground">
                  {shopifyRowsWithCosts ? shopifyRowsWithCosts.filter(r => r.Title).length : '—'}
                </div>
              </div>
              <div>
                <div className="font-medium">Child Rows</div>
                <div className="text-muted-foreground">
                  {shopifyRowsWithCosts ? shopifyRowsWithCosts.filter(r => !r.Title).length : '—'}
                </div>
              </div>
            </div>
            
            {/* Raw CSV Preview */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Raw CSV (First 5 Lines)</div>
              <Textarea
                value={previewLines.join('\n')}
                readOnly
                className="font-mono text-xs h-32"
                placeholder="Generated CSV content will appear here..."
              />
            </div>
            
            {/* Detailed Preview Table (First 200 Rows) */}
            <div className="space-y-2">
              <div className="text-sm font-medium">
                Detailed Preview (Showing first 200 of {totalRows} rows)
              </div>
              <ShopifyPreview csvContent={generatedCSV} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};