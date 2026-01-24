'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ExecutionLogs({ jobId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch(`${API_URL}/api/cron/jobs/${jobId}/logs`);
        const data = await response.json();
        
        if (data.success) {
          setLogs(data.logs || []);
        }
      } catch (error) {
        console.error('[v0] Failed to fetch logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [jobId]);

  if (loading) {
    return <div className="text-xs text-muted-foreground text-center py-4">Loading logs...</div>;
  }

  if (logs.length === 0) {
    return <div className="text-xs text-muted-foreground text-center py-4">No execution logs yet</div>;
  }

  return (
    <div className="space-y-2">
      {logs.map(log => {
        const startDate = new Date(log.started_at);
        const duration = log.duration_seconds ? `${Math.floor(log.duration_seconds / 60)}m ${log.duration_seconds % 60}s` : '-';
        const successRate = log.total_products_scraped > 0 
          ? ((log.products_added + log.products_updated) / log.total_products_scraped * 100).toFixed(0)
          : 0;

        return (
          <div key={log.id} className="border rounded p-2 bg-muted/20 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {log.status === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : log.status === 'failed' ? (
                  <XCircle className="w-4 h-4 text-red-600" />
                ) : (
                  <Clock className="w-4 h-4 text-blue-600 animate-spin" />
                )}
                <span className="font-medium">{startDate.toLocaleString()}</span>
              </div>
              <Badge 
                variant={log.status === 'completed' ? 'default' : 'destructive'}
                className="text-xs h-5"
              >
                {log.status}
              </Badge>
            </div>

            <div className="grid grid-cols-4 gap-2 pl-6">
              <div>
                <div className="text-muted-foreground">Total</div>
                <div className="font-semibold">{log.total_products_scraped}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Added</div>
                <div className="font-semibold text-green-600">{log.products_added}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Updated</div>
                <div className="font-semibold text-blue-600">{log.products_updated}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Duration</div>
                <div className="font-semibold">{duration}</div>
              </div>
            </div>

            {log.categories_processed && log.categories_processed.length > 0 && (
              <details className="pl-6">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  View categories ({log.categories_processed.length})
                </summary>
                <div className="mt-1 space-y-0.5 text-muted-foreground">
                  {log.categories_processed.map((cat, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{cat.name}</span>
                      <span className={cat.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                        {cat.products} products
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {log.error_message && (
              <div className="pl-6 text-red-600 bg-red-50 p-1 rounded border border-red-200">
                Error: {log.error_message}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
