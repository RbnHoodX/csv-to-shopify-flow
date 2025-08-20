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
    generateShopifyCSV,
    isGenerating
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
    if (isGenerating) return <Badge variant="outline" className="text-blue-600 border-blue-600 animate-pulse">✓ {file.rowCount} rows</Badge>;
    return <Badge variant="outline" className="text-green-600 border-green-600">✓ {file.rowCount} rows</Badge>;
  };

  const previewLines = hasGeneratedCSV ? generatedCSV.split('\n').slice(0, 6) : [];
  const totalRows = hasGeneratedCSV ? generatedCSV.split('\n').length - 1 : 0;

  return (
    <div className="space-y-6">
      {/* Main Generation Control Panel */}
      <Card className="w-full">
        <CardHeader className="pb-6 bg-gradient-to-r from-emerald-50 to-green-50 border-b">
          <div className="flex items-center justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                  <Play className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2 text-emerald-800">
                    Generate Shopify CSV Pipeline
                  </CardTitle>
                  <p className="text-sm text-emerald-600 mt-1">
                    Complete 7-stage pipeline: Validate → Build Rules → Expand → Compute Costs → Assemble → Fill Meta → Export
                  </p>
                </div>
              </div>
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
              {isGenerating && (
                <Badge variant="default" className="animate-pulse">
                  🔄 Generating...
                </Badge>
              )}
              {!isGenerating && hasGeneratedCSV && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <Badge variant="outline" className="text-green-600 border-green-600 bg-green-50">
                    ✓ CSV Ready
                  </Badge>
                </div>
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
              {isGenerating && (
                <Badge variant="default" className="ml-auto animate-pulse">
                  🔄 In Progress
                </Badge>
              )}
            </div>
            
            {/* Progress Indicator */}
            {isGenerating && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">Processing Stage</span>
                  <span className="text-sm font-medium text-primary">Stage 4 of 7</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full transition-all duration-500 ease-out" style={{ width: '57%' }}></div>
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>Validate</span>
                  <span>Build Rules</span>
                  <span>Expand</span>
                  <span className="text-primary font-medium">Compute Costs</span>
                  <span>Assemble</span>
                  <span>Fill Meta</span>
                  <span>Export</span>
                </div>
              </div>
            )}
            
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
                <Badge variant={hasGeneratedCSV ? "default" : isGenerating ? "default" : "secondary"}>
                  {hasGeneratedCSV ? `✓ ${totalRows} rows` : isGenerating ? '🔄 Generating...' : 'Pending'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              size="lg"
              className="flex items-center gap-3 px-8 py-6 text-lg font-semibold hover-lift bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {isGenerating ? (
                <>
                  <div className="relative">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30"></div>
                    <div className="absolute inset-0 animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  </div>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                    <Play className="h-4 w-4 text-white" />
                  </div>
                  <span>Generate Shopify CSV</span>
                </>
              )}
            </Button>
            
            {hasGeneratedCSV && !isGenerating && (
              <Button 
                onClick={handleDownload} 
                variant="outline" 
                size="lg"
                className="px-8 py-6 text-lg font-semibold hover-lift border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200"
              >
                <Download className="h-5 w-5 mr-3 text-primary" />
                <span>Download CSV ({totalRows} rows)</span>
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
      {isGenerating && (
        <Card className="border-2 border-primary/20 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
            <CardTitle className="flex items-center gap-3 text-primary">
              <div className="relative">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary/30"></div>
                <div className="absolute inset-0 animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
              </div>
              <span className="text-xl">Generating CSV...</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-12 text-center">
            <div className="space-y-8">
              {/* Animated Loading Spinner */}
              <div className="relative mx-auto w-24 h-24">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                <div className="absolute inset-2 rounded-full bg-primary/10 flex items-center justify-center">
                  <div className="w-8 h-8 bg-primary rounded-full animate-pulse"></div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="text-2xl font-bold text-foreground">Processing CSV Generation Pipeline</div>
                <div className="text-lg text-muted-foreground max-w-md mx-auto">
                  This may take a few moments depending on the size of your data...
                </div>
              </div>
              
              {/* Enhanced Pipeline Stages Progress */}
              <div className="space-y-4 max-w-2xl mx-auto">
                <div className="text-lg font-semibold text-foreground">Pipeline Stages:</div>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { stage: 1, name: 'Validating input files', status: 'completed', color: 'bg-green-500' },
                    { stage: 2, name: 'Building rule sets and lookups', status: 'completed', color: 'bg-green-500' },
                    { stage: 3, name: 'Validating variant expansion data', status: 'completed', color: 'bg-green-500' },
                    { stage: 4, name: 'Computing costs and pricing', status: 'active', color: 'bg-blue-500' },
                    { stage: 5, name: 'Assembling parent-child rows with metadata', status: 'pending', color: 'bg-gray-300' },
                    { stage: 6, name: 'Serializing CSV with spec-compliant headers', status: 'pending', color: 'bg-gray-300' },
                    { stage: 7, name: 'Final validation and statistics', status: 'pending', color: 'bg-gray-300' }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                      <div className={`w-3 h-3 rounded-full ${item.color} ${item.status === 'active' ? 'animate-pulse' : ''}`}></div>
                      <span className="text-sm font-medium">
                        Stage {item.stage}: {item.name}
                      </span>
                      {item.status === 'completed' && (
                        <div className="ml-auto">
                          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {!isGenerating && hasGeneratedCSV && (
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