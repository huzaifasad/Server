'use client';

import Link from "next/link"

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import AppHeader from '@/components/app-header';
import { 
  PlayCircle, 
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Package,
  Clock,
  Database
} from 'lucide-react';

export default function ScraperDashboard() {
  const [store, setStore] = useState('asos'); // 'asos' or 'mango'
  const [categories, setCategories] = useState({});
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [explicitSelections, setExplicitSelections] = useState([]); // Only user-clicked categories
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState('limit');
  const [limit, setLimit] = useState(5);
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(10);
  const [concurrency, setConcurrency] = useState(5);
  const [logs, setLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [stats, setStats] = useState({
    totalProducts: 0,
    successfulProducts: 0,
    failedProducts: 0,
    categoriesScraped: 0
  });

  const wsRef = useRef(null);
  const logsEndRef = useRef(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

  useEffect(() => {
    fetchCategories();
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    // Reload categories when store changes
    fetchCategories();
    setSelectedCategories([]);
    setExplicitSelections([]);
  }, [store]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket(WS_URL);
      
      ws.onopen = () => {
        setIsConnected(true);
        addLog('Connected to server', 'success');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('[v0] WebSocket message error:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('[v0] WebSocket error:', error);
        setIsConnected(false);
      };
      
      ws.onclose = () => {
        setIsConnected(false);
        addLog('Disconnected from server', 'error');
        setTimeout(connectWebSocket, 3000);
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('[v0] WebSocket connection failed:', error);
      setIsConnected(false);
    }
  };

  const handleWebSocketMessage = (data) => {
    if (data.type === 'connection') {
      return;
    }
    
    addLog(data.message, data.type);
    
    if (data.type === 'success' && data.productData) {
      setStats(prev => ({
        ...prev,
        successfulProducts: prev.successfulProducts + 1,
        totalProducts: prev.totalProducts + 1
      }));
    }
    
    if (data.type === 'error' && data.message.includes('Failed to save')) {
      setStats(prev => ({
        ...prev,
        failedProducts: prev.failedProducts + 1
      }));
    }
    
    if (data.finalStats) {
      setIsScraping(false);
      setStats(prev => ({
        ...prev,
        totalProducts: data.finalStats.totalSuccessful,
        categoriesScraped: prev.categoriesScraped + 1
      }));
    }
  };

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, {
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      let endpoint = '/categories';
      if (store === 'mango') endpoint = '/mango/categories';
      else if (store === 'forever21') endpoint = '/forever21/categories';
      
      const response = await fetch(`${API_URL}${endpoint}`);
      const data = await response.json();
      if (data.success && data.categories) {
        setCategories(data.categories);
        addLog(`Loaded ${store.toUpperCase()} categories (${Object.keys(data.categories).length} main)`, 'success');
      }
    } catch (error) {
      console.error('[v0] Failed to fetch categories:', error);
      addLog(`Failed to fetch ${store.toUpperCase()} categories: ${error.message}`, 'error');
    } finally {
      setLoadingCategories(false);
    }
  };

  const toggleCategory = (categoryPath) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryPath)) {
        // Deselect this category and all its children
        setExplicitSelections(prevExplicit => 
          prevExplicit.filter(c => !c.startsWith(categoryPath))
        );
        return prev.filter(c => !c.startsWith(categoryPath));
      }
      
      // Add to explicit selections (what user actually clicked)
      setExplicitSelections(prevExplicit => 
        prevExplicit.includes(categoryPath) ? prevExplicit : [...prevExplicit, categoryPath]
      );
      
      // Select this category and ensure all parent categories are also selected for UI
      const pathParts = categoryPath.split('.');
      const allParentPaths = [];
      
      // Build all parent paths (e.g., "women", "women.clothing", "women.clothing.shorts")
      for (let i = 1; i <= pathParts.length; i++) {
        allParentPaths.push(pathParts.slice(0, i).join('.'));
      }
      
      // Add all parent paths that aren't already selected
      const newSelected = [...prev];
      allParentPaths.forEach(path => {
        if (!newSelected.includes(path)) {
          newSelected.push(path);
        }
      });
      
      return newSelected;
    });
  };

  const renderCategoryTree = (cats, parentPath = '', depth = 0) => {
    return Object.entries(cats).map(([key, value]) => {
      const currentPath = parentPath ? `${parentPath}.${key}` : key;
      const hasSubcategories = value.subcategories && Object.keys(value.subcategories).length > 0;
      const isSelected = selectedCategories.includes(currentPath);

      return (
        <div key={currentPath} style={{ marginLeft: `${depth * 12}px` }}>
          <div className="flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded text-xs transition-colors">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleCategory(currentPath)}
              className="w-3 h-3 rounded border-input cursor-pointer"
              id={currentPath}
            />
            <label 
              htmlFor={currentPath}
              className="cursor-pointer flex-1 select-none"
            >
              {value.name}
            </label>
            {isSelected && <CheckCircle2 className="w-3 h-3 text-primary" />}
          </div>
          {hasSubcategories && renderCategoryTree(value.subcategories, currentPath, depth + 1)}
        </div>
      );
    });
  };

  const startCategoryScraping = async () => {
    if (explicitSelections.length === 0) {
      addLog('Please select at least one category', 'error');
      return;
    }

    setIsScraping(true);
    setStats({ totalProducts: 0, successfulProducts: 0, failedProducts: 0, categoriesScraped: 0 });
    setLogs([]);
    
    addLog(`Starting scrape for ${explicitSelections.length} categories...`, 'info');

    for (const categoryPath of explicitSelections) {
      try {
        let endpoint = '/scrape/category';
        if (store === 'mango') endpoint = '/mango/scrape/category';
        else if (store === 'forever21') endpoint = '/forever21/scrape/category';
        
        const url = `${API_URL}${endpoint}`;
        console.log('[v0] API_URL:', API_URL);
        console.log('[v0] Full URL:', url);
        console.log('[v0] Sending scrape request for:', categoryPath, 'Store:', store);
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoryPath,
            mode,
            limit: mode === 'limit' ? parseInt(limit) : undefined,
            startIndex: mode === 'range' ? parseInt(startIndex) : undefined,
            endIndex: mode === 'range' ? parseInt(endIndex) : undefined,
            concurrency: parseInt(concurrency),
            email: email || undefined
          })
        });

        console.log('[v0] Response status:', response.status);
        console.log('[v0] Response ok:', response.ok);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[v0] Error response:', errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('[v0] Scrape started:', result);
      } catch (error) {
        console.error('[v0] Scrape request failed:', error);
        addLog(`Failed to scrape ${categoryPath}: ${error.message}`, 'error');
      }
    }
  };

  const getLogIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="w-3 h-3 text-green-600" />;
      case 'error': return <XCircle className="w-3 h-3 text-red-600" />;
      case 'warning': return <AlertCircle className="w-3 h-3 text-yellow-600" />;
      case 'progress': return <Loader2 className="w-3 h-3 animate-spin" />;
      default: return <Activity className="w-3 h-3 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader isConnected={isConnected} />

      <div className="container mx-auto p-4">
        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Total</p>
                <p className="text-lg font-bold">{stats.totalProducts}</p>
              </div>
              <Package className="w-4 h-4 text-muted-foreground" />
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Success</p>
                <p className="text-lg font-bold text-green-600">{stats.successfulProducts}</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Failed</p>
                <p className="text-lg font-bold text-red-600">{stats.failedProducts}</p>
              </div>
              <XCircle className="w-4 h-4 text-red-600" />
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Categories</p>
                <p className="text-lg font-bold">{stats.categoriesScraped}</p>
              </div>
              <Database className="w-4 h-4 text-muted-foreground" />
            </div>
          </Card>
        </div>

        {/* Main Content - Side by Side */}
        <div className="grid grid-cols-3 gap-4">
          {/* Left: Configuration */}
          <Card className="col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Store Selection */}
              <div className="space-y-1">
                <Label htmlFor="store" className="text-xs font-medium">Store</Label>
                <select
                  id="store"
                  value={store}
                  onChange={(e) => setStore(e.target.value)}
                  className="w-full h-7 px-2 text-xs border border-input rounded bg-background"
                  disabled={isScraping}
                >
                  <option value="asos">ASOS</option>
                  <option value="mango">Mango</option>
                  <option value="forever21">Forever 21 (Shopify)</option>
                </select>
                <p className="text-xs text-muted-foreground">Select which store to scrape</p>
              </div>

              <Separator />

              {/* Categories */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Categories</Label>
                  {explicitSelections.length > 0 && (
                    <Badge variant="secondary" className="text-xs h-5">
                      {explicitSelections.length}
                    </Badge>
                  )}
                </div>
                <ScrollArea className="h-64 border rounded p-2 bg-muted/30">
                  {loadingCategories ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-2">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Loading...</p>
                    </div>
                  ) : Object.keys(categories).length > 0 ? (
                    renderCategoryTree(categories)
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 space-y-2">
                      <AlertCircle className="w-5 h-5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">No categories</p>
                      <Button onClick={fetchCategories} size="sm" variant="outline" className="h-6 text-xs bg-transparent">
                        Retry
                      </Button>
                    </div>
                  )}
                </ScrollArea>
              </div>

              <Separator />

              {/* Mode Selection */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="mode" className="text-xs">Mode</Label>
                  <select
                    id="mode"
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    className="w-full h-7 px-2 text-xs border border-input rounded bg-background"
                  >
                    <option value="limit">Limit</option>
                    <option value="range">Range</option>
                    <option value="full">Full</option>
                  </select>
                </div>

                {mode === 'limit' && (
                  <div className="space-y-1">
                    <Label htmlFor="limit" className="text-xs">Limit</Label>
                    <Input
                      id="limit"
                      type="number"
                      value={limit}
                      onChange={(e) => setLimit(e.target.value)}
                      className="h-7 text-xs"
                      min="1"
                    />
                  </div>
                )}

                {mode === 'range' && (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="startIndex" className="text-xs">Start</Label>
                      <Input
                        id="startIndex"
                        type="number"
                        value={startIndex}
                        onChange={(e) => setStartIndex(e.target.value)}
                        className="h-7 text-xs"
                        min="0"
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label htmlFor="endIndex" className="text-xs">End</Label>
                      <Input
                        id="endIndex"
                        type="number"
                        value={endIndex}
                        onChange={(e) => setEndIndex(e.target.value)}
                        className="h-7 text-xs"
                        min="1"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-1 col-span-2">
                  <Label htmlFor="concurrency" className="text-xs">Concurrency</Label>
                  <Input
                    id="concurrency"
                    type="number"
                    value={concurrency}
                    onChange={(e) => setConcurrency(e.target.value)}
                    className="h-7 text-xs"
                    min="1"
                    max="10"
                  />
                </div>
              </div>

              <Separator />

              {/* Email */}
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs">Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="h-7 text-xs"
                />
                <p className="text-xs text-muted-foreground">Get email when complete</p>
              </div>

              {/* Start Button */}
              <Button
                onClick={startCategoryScraping}
                disabled={isScraping || !isConnected || explicitSelections.length === 0}
                className="w-full h-8 text-xs font-medium"
              >
                {isScraping ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-1.5 h-3 w-3" />
                    Start Scraping
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Right: Activity Log */}
          <Card className="col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Activity Log
                </CardTitle>
                {logs.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{logs.length} entries</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[560px]">
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="rounded-full bg-muted p-3 mb-2">
                      <Clock className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-xs font-medium">No activity yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Logs will appear when scraping starts
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 pr-3">
                    {logs.map((log, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 p-2 rounded border bg-card hover:bg-muted/30 transition-colors"
                      >
                        <div className="mt-0.5">{getLogIcon(log.type)}</div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="text-xs leading-relaxed break-words">{log.message}</p>
                          <p className="text-xs text-muted-foreground">{log.timestamp}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
