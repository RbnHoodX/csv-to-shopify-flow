import React from 'react';
import { FileUpload } from '@/components/FileUpload';
import { GenerationLog } from '@/components/GenerationLog';
import { CSVExport } from '@/components/CSVExport';

const Index = () => {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">CSV to Shopify Converter</h1>
          <p className="text-xl text-muted-foreground">
            Process 4 CSVs into one Shopify-importable CSV following Base44 spec
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* File Uploads Section */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-2xl font-semibold mb-4">1. Upload CSV Files</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FileUpload fileType="inputTest" title="Input test.csv" />
              <FileUpload fileType="naturalRules" title="Natural Rules.csv" />
              <FileUpload fileType="labGrownRules" title="LabGrown Rules.csv" />
              <FileUpload fileType="noStonesRules" title="No Stones Rules.csv" />
            </div>
          </div>

          {/* Generation Log */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mb-4">2. Activity Log</h2>
            <GenerationLog />
          </div>
        </div>

        {/* Export Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold mb-4">3. Generate & Export</h2>
          <CSVExport />
        </div>
      </div>
    </div>
  );
};

export default Index;
