import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Download, Play, Eye, FileText } from 'lucide-react';
import { useCSVStore } from '@/store/csvStore';
import { ShopifyPreview } from './ShopifyPreview';

export const CSVExport: React.FC = () => {
  const { files, variantExpansion, generatedCSV, generateShopifyCSV } = useCSVStore();
  
  const uploadedFiles = Object.values(files).filter(f => f.uploaded);
  const allFilesUploaded = uploadedFiles.length === 4;
  const hasVariantExpansion = !!variantExpansion;
  
  const handleGenerate = () => {
    generateShopifyCSV();
  };

  const handleDownload = () => {
    if (!generatedCSV) return;
    
    const blob = new Blob([generatedCSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shopify_import.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const previewLines = generatedCSV.split('\n').slice(0, 5);

  return (
    <div className="space-y-4">
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Generate & Export</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Generate Shopify-importable CSV with parent-child pattern and proper options
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={allFilesUploaded ? "default" : "secondary"}>
                {uploadedFiles.length}/4 files
              </Badge>
              {hasVariantExpansion && (
                <Badge variant="default">
                  {variantExpansion.result.stats.totalVariants} variants
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={handleGenerate}
              disabled={!hasVariantExpansion}
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-2" />
              Generate Shopify CSV
            </Button>
            
            {generatedCSV && (
              <Button onClick={handleDownload} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            )}
          </div>

          {!hasVariantExpansion && (
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
              <FileText className="h-4 w-4 inline mr-1" />
              Upload all files and process variants to enable CSV generation
            </div>
          )}

          {generatedCSV && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span className="text-sm font-medium">Quick Preview (first 5 lines)</span>
              </div>
              
              <Textarea
                value={previewLines.join('\n')}
                readOnly
                className="font-mono text-xs"
                rows={6}
              />
              
              <div className="text-xs text-muted-foreground">
                Total lines: {generatedCSV.split('\n').length}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Detailed Shopify Preview */}
      {generatedCSV && (
        <ShopifyPreview csvContent={generatedCSV} />
      )}
    </div>
  );
};