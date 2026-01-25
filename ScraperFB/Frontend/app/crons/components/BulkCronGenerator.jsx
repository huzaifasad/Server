'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Zap, Clock, CheckCircle2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function BulkCronGenerator({ onComplete }) {
  const [scraperType, setScraperType] = useState('asos');
  const [categories, setCategories] = useState([]);
  const [startTime, setStartTime] = useState('02:00');
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(null);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/${scraperType}/categories`);
      const data = await response.json();
      
      if (data.success) {
        const flatCategories = flattenCategories(data.categories);
        setCategories(flatCategories);
      }
    } catch (error) {
      console.error('[v0] Failed to fetch categories:', error);
    }
  };

  const flattenCategories = (cats, prefix = '') => {
    let result = [];
    
    for (const [key, value] of Object.entries(cats)) {
      const path = prefix ? `${prefix}.${key}` : key;
      
      if (value.subcategories) {
        result = result.concat(flattenCategories(value.subcategories, path));
      } else {
        result.push({ path, name: value.name || key });
      }
    }
    
    return result;
  };

  const generateCrons = async () => {
    if (categories.length === 0) {
      alert('Please select a scraper type to load categories');
      return;
    }

    setGenerating(true);
    setProgress({ current: 0, total: categories.length, created: [] });

    try {
      // Parse start time
      const [hours, minutes] = startTime.split(':').map(Number);
      
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        
        // Calculate staggered start time
        const categoryStartTime = new Date();
        categoryStartTime.setHours(hours, minutes + (i * intervalMinutes), 0, 0);
        
        const scheduleTime = `${String(categoryStartTime.getHours()).padStart(2, '0')}:${String(categoryStartTime.getMinutes()).padStart(2, '0')}`;

        // Create individual cron job
        const response = await fetch(`${API_URL}/api/cron/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${scraperType.toUpperCase()} - ${category.name}`,
            scraper_type: scraperType,
            category_paths: [category.path],
            schedule_type: 'daily',
            schedule_time: scheduleTime,
            scrape_mode: 'full',
            concurrency: 5,
            is_active: true
          })
        });

        const data = await response.json();
        
        if (data.success) {
          setProgress(prev => ({
            ...prev,
            current: i + 1,
            created: [...prev.created, { category: category.name, time: scheduleTime }]
          }));
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      alert(`✅ Successfully created ${categories.length} cron jobs!`);
      
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('[v0] Failed to generate cron jobs:', error);
      alert('❌ Failed to generate cron jobs');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Bulk Cron Generator</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Create individual cron jobs for each category - prevents blocking and allows independent execution
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="scraperType">Scraper Type</Label>
          <select
            id="scraperType"
            className="w-full px-3 py-2 border rounded-md"
            value={scraperType}
            onChange={(e) => {
              setScraperType(e.target.value);
              setCategories([]);
            }}
          >
            <option value="asos">ASOS</option>
            <option value="mango">Mango</option>
            <option value="forever21">Forever 21</option>
            <option value="allbirds">Allbirds</option>
          </select>
        </div>

        <Button onClick={fetchCategories} variant="outline" className="w-full bg-transparent">
          Load Categories ({categories.length} loaded)
        </Button>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startTime">
              <Clock className="w-4 h-4 inline mr-1" />
              First Job Start Time
            </Label>
            <Input
              id="startTime"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interval">Interval (minutes)</Label>
            <Input
              id="interval"
              type="number"
              min="15"
              max="120"
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Number(e.target.value))}
            />
          </div>
        </div>

        {categories.length > 0 && (
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="text-sm font-medium">Preview:</div>
            <div className="text-xs space-y-1">
              <div>{'• '}{categories.length} cron jobs will be created</div>
              <div>{'• '}Starting at {startTime} (Pakistan Time)</div>
              <div>{'• '}Each job runs {intervalMinutes} minutes apart</div>
              <div>{'• '}Total duration: ~{Math.ceil((categories.length * intervalMinutes) / 60)} hours to complete all</div>
            </div>
          </div>
        )}

        <Button
          onClick={generateCrons}
          disabled={generating || categories.length === 0}
          className="w-full"
        >
          {generating ? `Generating... (${progress?.current}/${progress?.total})` : `Generate ${categories.length} Cron Jobs`}
        </Button>

        {progress && progress.created.length > 0 && (
          <div className="max-h-48 overflow-y-auto space-y-1 p-3 bg-muted rounded-lg">
            {progress.created.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <span className="font-medium">{item.category}</span>
                <Badge variant="secondary" className="text-xs">{item.time}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
