import React from "react";
import { FileUpload } from "@/components/FileUpload";
import { GenerationLog } from "@/components/GenerationLog";
import { CSVExport } from "@/components/CSVExport";
import { DebugPanel } from "@/components/DebugPanel";
import { InputSummaryTable } from "@/components/InputSummaryTable";
import { VariantExpansionTable } from "@/components/VariantExpansionTable";
import { useCSVStore } from "@/store/csvStore";

const Index = () => {
  const { inputAnalysis, variantExpansion } = useCSVStore();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Enhanced Header with Visual Elements */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-6">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            CSV to Shopify Converter
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Transform your jewelry data into Shopify-ready CSV format with our intelligent 4-stage processing pipeline
          </p>
          <div className="flex items-center justify-center gap-4 mt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Fast Processing</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Smart Validation</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>Shopify Ready</span>
            </div>
          </div>
        </header>

        {/* Main Content Grid with Enhanced Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* File Uploads Section - Enhanced */}
          <div className="xl:col-span-7 space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 font-semibold text-sm">1</span>
              </div>
              <h2 className="text-2xl font-semibold">Upload CSV Files</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FileUpload fileType="inputTest" title="Input test.csv" />
              <FileUpload fileType="naturalRules" title="Natural Rules.csv" />
              <FileUpload fileType="labGrownRules" title="LabGrown Rules.csv" />
              <FileUpload
                fileType="noStonesRules"
                title="No Stones Rules.csv"
              />
            </div>
          </div>

          {/* Right Sidebar - Enhanced */}
          <div className="xl:col-span-5 space-y-6">
            {/* Generation Log - Enhanced */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <span className="text-green-600 font-semibold text-sm">2</span>
                </div>
                <h2 className="text-2xl font-semibold">Activity Log</h2>
              </div>
              <GenerationLog />
            </div>

            {/* Debug Panel - Enhanced */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center">
                  <span className="text-orange-600 font-semibold text-sm">3</span>
                </div>
                <h2 className="text-2xl font-semibold">Debug Tools</h2>
              </div>
              <DebugPanel />
            </div>
          </div>
        </div>

        {/* Analysis Sections - Enhanced */}
        {inputAnalysis && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <span className="text-purple-600 font-semibold text-sm">4</span>
              </div>
              <h2 className="text-2xl font-semibold">Input Analysis</h2>
            </div>
            <InputSummaryTable
              summary={inputAnalysis.summary}
              stats={inputAnalysis.stats}
            />
          </div>
        )}

        {/* Variant Expansion Section - Enhanced */}
        {variantExpansion && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                <span className="text-indigo-600 font-semibold text-sm">5</span>
              </div>
              <h2 className="text-2xl font-semibold">Variant Expansion</h2>
            </div>
            <VariantExpansionTable
              expansionResult={variantExpansion.result}
              expectedCounts={variantExpansion.expectedCounts}
            />
          </div>
        )}

        {/* Export Section - Enhanced */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <span className="text-emerald-600 font-semibold text-sm">6</span>
            </div>
            <h2 className="text-2xl font-semibold">Generate & Export</h2>
          </div>
          <CSVExport />
        </div>
      </div>
    </div>
  );
};

export default Index;
