'use client';

import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

export default function CategorySummary({ selectedPaths, onRemove }) {
  if (selectedPaths.length === 0) return null;

  // Build breadcrumbs from paths
  const buildBreadcrumb = (path) => {
    return path.split('.').map(p => 
      p.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    ).join(' > ');
  };

  return (
    <div className="mt-2 p-2 bg-primary/5 border border-primary/20 rounded space-y-1.5">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase">
        Selected Categories
      </div>
      <div className="flex flex-wrap gap-1.5">
        {selectedPaths.map(path => (
          <Badge 
            key={path} 
            variant="secondary" 
            className="text-[10px] h-5 px-2 py-0 flex items-center gap-1 hover:bg-destructive/10"
          >
            <span className="max-w-[200px] truncate" title={buildBreadcrumb(path)}>
              {buildBreadcrumb(path)}
            </span>
            <button
              type="button"
              onClick={() => onRemove(path)}
              className="hover:text-destructive transition-colors"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}
