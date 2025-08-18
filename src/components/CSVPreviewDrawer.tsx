import React from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X } from 'lucide-react';
import type { CSVFile } from '@/store/csvStore';

interface CSVPreviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  file: CSVFile;
}

export const CSVPreviewDrawer: React.FC<CSVPreviewDrawerProps> = ({
  isOpen,
  onClose,
  file,
}) => {
  const previewRows = file.parsedRows.slice(0, 10);

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[80vh]">
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle>{file.name}</DrawerTitle>
              <DrawerDescription>
                Preview of first 10 rows • {file.rowCount} total rows • {file.headers.length} columns
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button variant="outline" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
          
          <div className="flex flex-wrap gap-1 mt-2">
            {file.headers.map((header, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {header}
              </Badge>
            ))}
          </div>
        </DrawerHeader>

        <ScrollArea className="flex-1 p-4">
          {previewRows.length > 0 ? (
            <div className="space-y-4">
              {previewRows.map((row, rowIndex) => (
                <div key={rowIndex} className="border rounded-lg p-3 space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Row {rowIndex + 1}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {file.headers.map((header, colIndex) => (
                      <div key={colIndex} className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">
                          {header}
                        </div>
                        <div className="text-sm bg-muted/50 rounded px-2 py-1 min-h-8 flex items-center">
                          {String(row[header] || '').substring(0, 100)}
                          {String(row[header] || '').length > 100 && '...'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {file.rowCount > 10 && (
                <div className="text-center text-sm text-muted-foreground py-4 border-t">
                  ... and {file.rowCount - 10} more rows
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No data to preview
            </div>
          )}
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
};