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
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-sm">{title}</h3>
        {file.uploaded && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {file.rowCount} rows
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(true)}
              className="h-6 w-6 p-0"
            >
              <Eye className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemove}
              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            >
              <X className="h-3 w-3" />
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
          className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-1">Click to upload CSV</p>
          <p className="text-xs text-muted-foreground">{file.name}</p>
        </div>
      ) : (
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span className="text-sm font-medium">{file.name}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {file.headers.length} columns • {file.rowCount} rows
          </p>
          {file.headers.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium mb-1">Columns:</p>
              <div className="flex flex-wrap gap-1">
                {file.headers.slice(0, 3).map((header, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {header}
                  </Badge>
                ))}
                {file.headers.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{file.headers.length - 3} more
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