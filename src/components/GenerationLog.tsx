import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { useCSVStore } from '@/store/csvStore';
import type { LogEntry } from '@/store/csvStore';

const LogIcon: React.FC<{ level: LogEntry['level'] }> = ({ level }) => {
  switch (level) {
    case 'error':
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
};

const LogBadge: React.FC<{ level: LogEntry['level'] }> = ({ level }) => {
  const variants = {
    error: 'destructive',
    warning: 'secondary',
    success: 'default',
    info: 'outline',
  } as const;

  return (
    <Badge variant={variants[level]} className="text-xs">
      {level.toUpperCase()}
    </Badge>
  );
};

export const GenerationLog: React.FC = () => {
  const { logs, clearLogs } = useCSVStore();

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Generation Log</CardTitle>
          {logs.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearLogs}>
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-64 px-6 pb-4">
          {logs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No logs yet</p>
              <p className="text-sm">Upload files to see activity</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card/50"
                >
                  <LogIcon level={log.level} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <LogBadge level={log.level} />
                      <span className="text-xs text-muted-foreground">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm break-words">{log.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};