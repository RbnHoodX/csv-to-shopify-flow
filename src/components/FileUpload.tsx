import React, { useRef } from 'react';
import { Upload, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useCSVStore } from '@/store/csvStore';
import { CSVPreviewDrawer } from './CSVPreviewDrawer';

interface FileUploadProps {
  fileType: 'inputTest' | 'naturalRules' | 'labGrownRules' | 'noStonesRules';
  title: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ fileType, title }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPreview, setShowPreview] = React.useState(false);
  
  const { files, uploadFile, removeFile } = useCSVStore();
  const file = files[fileType];

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv'))) {
      await uploadFile(fileType, selectedFile);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    removeFile(fileType);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="p-6 hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-base">{title}</h3>
            <p className="text-sm text-muted-foreground">Required file</p>
          </div>
        </div>
        {file.uploaded && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs px-2 py-1">
              {file.rowCount} rows
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(true)}
              className="h-8 w-8 p-0 hover:bg-blue-50 hover:border-blue-200"
            >
              <Eye className="h-4 w-4 text-blue-600" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemove}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-red-50 hover:border-red-200"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!file.uploaded ? (
        <div
          onClick={handleUploadClick}
          className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 group"
        >
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
            <Upload className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-base font-medium text-foreground mb-2">Click to upload CSV</p>
          <p className="text-sm text-muted-foreground mb-3">Drag and drop or click to browse</p>
          <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full inline-block">{file.name}</p>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-semibold text-green-800">{file.name}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-3 bg-white rounded-lg border border-green-200">
              <p className="text-2xl font-bold text-green-600">{file.rowCount}</p>
              <p className="text-xs text-green-700">Rows</p>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border border-green-200">
              <p className="text-2xl font-bold text-green-600">{file.headers.length}</p>
              <p className="text-xs text-green-700">Columns</p>
            </div>
          </div>
          {file.headers.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2 text-green-800">Sample Columns:</p>
              <div className="flex flex-wrap gap-1">
                {file.headers.slice(0, 4).map((header, index) => (
                  <Badge key={index} variant="outline" className="text-xs bg-white border-green-300 text-green-700">
                    {header}
                  </Badge>
                ))}
                {file.headers.length > 4 && (
                  <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700">
                    +{file.headers.length - 4} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <CSVPreviewDrawer
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        file={file}
      />
    </Card>
  );
};