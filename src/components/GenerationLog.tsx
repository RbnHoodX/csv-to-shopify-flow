import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Trash2,
  AlertCircle,
  Info,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { useCSVStore } from "@/store/csvStore";
import type { LogEntry } from "@/store/csvStore";

const LogIcon: React.FC<{ level: LogEntry["level"] }> = ({ level }) => {
  switch (level) {
    case "error":
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "success":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
};

const LogBadge: React.FC<{ level: LogEntry["level"] }> = ({ level }) => {
  const variants = {
    error: "destructive",
    warning: "secondary",
    success: "default",
    info: "outline",
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
    <Card className="h-full border-2 hover:shadow-lg transition-all duration-200">
      <CardHeader className="pb-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <CardTitle className="text-lg text-green-800">Generation Log</CardTitle>
              <p className="text-sm text-green-600">Real-time processing updates</p>
            </div>
          </div>
          {logs.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearLogs} className="hover:bg-red-50 hover:border-red-200 hover:text-red-600">
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-96 px-6 pb-4">
          {logs.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Info className="h-8 w-8 opacity-50" />
              </div>
              <p className="font-medium mb-1">No logs yet</p>
              <p className="text-sm">Upload files to see real-time processing updates</p>
            </div>
          ) : (
                          <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 p-4 rounded-xl border bg-card/50 hover:bg-card/80 transition-colors group"
                  >
                    <div className="flex-shrink-0">
                      <LogIcon level={log.level} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <LogBadge level={log.level} />
                        <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm break-words leading-relaxed">{log.message}</p>
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
