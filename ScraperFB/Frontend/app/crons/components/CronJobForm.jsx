'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import CategorySummary from './CategorySummary';
import { X, Plus, Loader2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function CronJobForm({ onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    scraperType: 'asos', // Add scraper type - future: 'zara', 'hm', etc.
    categoryPaths: [],
    scheduleType: 'daily',
    scheduleTime: '02:00',
    scrapeMode: 'limit',
    limitValue: 5,
    concurrency: 5,
    emailRecipients: [''],
    notifyOnSuccess: true,
    notifyOnFailure: true,
    autoRetry: true,
    maxRetries: 3,
    retryDelayMinutes: 30,
    isActive: true
  });

  const [expandedCategories, setExpandedCategories] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCategoriesUI, setSelectedCategoriesUI] = useState([]);
  const [categories, setCategories] = useState({});
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [validationMessage, setValidationMessage] = useState('');

  // Fetch categories from server API on component mount and when scraper type changes
  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);
      try {
        let endpoint = '/categories';
        if (formData.scraperType === 'mango') endpoint = '/mango/categories';
        else if (formData.scraperType === 'forever21') endpoint = '/forever21/categories';
        else if (formData.scraperType === 'allbirds') endpoint = '/allbirds/categories';
        
        const response = await fetch(`${API_URL}${endpoint}`);
        const data = await response.json();
        if (data.success && data.categories) {
          setCategories(data.categories);
        }
      } catch (error) {
        console.error('[v0] Failed to fetch categories:', error);
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, [formData.scraperType]);

  const toggleCategoryExpand = (key) => {
    setExpandedCategories(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const removeCategory = (path) => {
    setSelectedCategoriesUI(prev => prev.filter(p => p !== path));
    setFormData(prev => ({
      ...prev,
      categoryPaths: prev.categoryPaths.filter(p => p !== path)
    }));
  };

  // Helper to check if a category has subcategories
  const hasSubcategories = (path) => {
    const pathParts = path.split('.');
    let current = categories;
    
    for (const part of pathParts) {
      if (current[part]) {
        current = current[part];
        if (current.subcategories) {
          current = current.subcategories;
        }
      }
    }
    
    return current.subcategories && Object.keys(current.subcategories).length > 0;
  };

  // Check if any children of a path are selected
  const hasSelectedChildren = (path) => {
    return selectedCategoriesUI.some(p => p.startsWith(path + '.'));
  };

  const toggleCategory = (path, cat) => {
    const isParentCategory = cat.subcategories && Object.keys(cat.subcategories).length > 0;
    const isCurrentlySelected = selectedCategoriesUI.includes(path);
    
    // If selecting a parent category, auto-expand it
    if (isParentCategory && !isCurrentlySelected) {
      setExpandedCategories(prev => ({
        ...prev,
        [path]: true
      }));
      
      // Show warning that they need to select subcategories
      setValidationMessage('Parent categories cannot be selected. Please expand and select specific subcategories.');
      setTimeout(() => setValidationMessage(''), 4000);
      return; // Don't allow selecting parent without children
    }
    
    // If deselecting a parent, also deselect all children
    if (isParentCategory && isCurrentlySelected) {
      const childrenToRemove = selectedCategoriesUI.filter(p => p.startsWith(path + '.'));
      setSelectedCategoriesUI(prev => prev.filter(p => !p.startsWith(path + '.') && p !== path));
      setFormData(prev => ({
        ...prev,
        categoryPaths: prev.categoryPaths.filter(p => !p.startsWith(path + '.') && p !== path)
      }));
      return;
    }
    
    // Toggle leaf category selection
    setSelectedCategoriesUI(prev => {
      if (prev.includes(path)) {
        return prev.filter(p => p !== path);
      } else {
        return [...prev, path];
      }
    });
    
    setFormData(prev => ({
      ...prev,
      categoryPaths: selectedCategoriesUI.includes(path)
        ? prev.categoryPaths.filter(p => p !== path)
        : [...prev.categoryPaths, path]
    }));
  };

  const renderCategoryTree = (categories, parentPath = '') => {
    return Object.entries(categories).map(([key, cat]) => {
      const fullPath = parentPath ? `${parentPath}.${key}` : key;
      const hasSubcats = cat.subcategories && Object.keys(cat.subcategories).length > 0;
      const isSelected = selectedCategoriesUI.includes(fullPath);
      const isExpanded = expandedCategories[fullPath];
      const hasChildren = hasSelectedChildren(fullPath);

      return (
        <div key={fullPath} className="space-y-1">
          <div className="flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded text-xs">
            {hasSubcats ? (
              <button
                onClick={() => toggleCategoryExpand(fullPath)}
                className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground"
                type="button"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            ) : (
              <span className="w-4 h-4" />
            )}
            <input
              type="checkbox"
              id={fullPath}
              checked={isSelected || hasChildren}
              onChange={() => toggleCategory(fullPath, cat)}
              className="w-3 h-3"
              disabled={hasSubcats}
              title={hasSubcats ? 'Parent category - expand to select subcategories' : ''}
            />
            <label 
              htmlFor={fullPath} 
              className={`flex-1 cursor-pointer select-none ${hasSubcats ? 'font-semibold text-foreground' : ''} ${hasChildren ? 'text-primary' : ''}`}
              onClick={(e) => {
                if (hasSubcats) {
                  e.preventDefault();
                  toggleCategoryExpand(fullPath);
                }
              }}
            >
              {cat.name}
              {hasSubcats && <span className="ml-1 text-muted-foreground text-[10px]">(expand to select)</span>}
            </label>
          </div>
          
          {isExpanded && hasSubcats && (
            <div className="ml-4 border-l-2 border-muted pl-2">
              {renderCategoryTree(cat.subcategories, fullPath)}
            </div>
          )}
        </div>
      );
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/api/cron/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          emailRecipients: formData.emailRecipients.filter(e => e.trim()),
          categoryPaths: selectedCategoriesUI
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('Cron job created successfully!');
        onSuccess();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('[v0] Failed to create job:', error);
      alert('Failed to create cron job');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs font-medium">Job Name</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="e.g., Daily Women's Clothing"
            className="h-7 text-xs"
            required
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium">Scraper Type</Label>
          <select
            value={formData.scraperType}
            onChange={(e) => {
              setFormData({...formData, scraperType: e.target.value, categoryPaths: []});
              setSelectedCategoriesUI([]);
              setCategories({});
              setExpandedCategories({});
            }}
            className="w-full px-2 py-1 border rounded text-xs bg-background"
          >
  <option value="asos">ASOS</option>
  <option value="mango">Mango</option>
  <option value="forever21">Forever 21</option>
  <option value="allbirds">Allbirds</option>
  {/* Future scrapers will appear here */}
  {/* <option value="zara">Zara</option> */}
  {/* <option value="hm">H&M</option> */}
  </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs font-medium">Schedule</Label>
          <select
            value={formData.scheduleType}
            onChange={(e) => setFormData({...formData, scheduleType: e.target.value})}
            className="w-full px-2 py-1 border rounded text-xs bg-background"
          >
            <option value="daily">Daily</option>
            <option value="every_3_days">Every 3 Days</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium">Time</Label>
          <Input
            type="time"
            value={formData.scheduleTime}
            onChange={(e) => setFormData({...formData, scheduleTime: e.target.value})}
            className="h-7 text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs font-medium">Concurrency</Label>
          <Input
            type="number"
            min="1"
            max="10"
            value={formData.concurrency}
            onChange={(e) => setFormData({...formData, concurrency: parseInt(e.target.value)})}
            className="h-7 text-xs"
          />
        </div>
      </div>

      {/* Scrape Settings */}
      <div className="bg-muted/30 p-2 rounded border">
        <Label className="text-xs font-semibold mb-2 block">Scrape Settings</Label>
        
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="space-y-1">
            <Label className="text-xs">Mode</Label>
            <select
              value={formData.scrapeMode}
              onChange={(e) => setFormData({...formData, scrapeMode: e.target.value})}
              className="w-full px-2 py-1 border rounded text-xs bg-background"
            >
              <option value="limit">Limit</option>
              <option value="range">Range</option>
              <option value="full">Full</option>
            </select>
          </div>

          {formData.scrapeMode === 'limit' && (
            <div className="space-y-1">
              <Label className="text-xs">Products per Category</Label>
              <Input
                type="number"
                min="1"
                value={formData.limitValue}
                onChange={(e) => setFormData({...formData, limitValue: parseInt(e.target.value)})}
                className="h-7 text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="bg-muted/30 p-2 rounded border space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Categories ({selectedCategoriesUI.length} selected)</Label>
          {selectedCategoriesUI.length === 0 && (
            <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Required</Badge>
          )}
        </div>
        {validationMessage && (
          <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300 px-2 py-1 rounded text-[10px]">
            {validationMessage}
          </div>
        )}
        <div className="max-h-48 overflow-y-auto border bg-background p-2 rounded text-xs space-y-0.5">
          {loadingCategories ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span>Loading categories...</span>
            </div>
          ) : Object.keys(categories).length > 0 ? (
            renderCategoryTree(categories)
          ) : (
            <p className="text-muted-foreground">No categories available</p>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Parent categories are disabled. Please expand and select specific subcategories.
        </p>
        <CategorySummary 
          selectedPaths={selectedCategoriesUI} 
          onRemove={removeCategory}
        />
      </div>

      {/* Email Recipients */}
      <div className="space-y-1">
        <Label className="text-xs font-medium">Email Recipients</Label>
        <div className="space-y-1">
          {formData.emailRecipients.map((email, idx) => (
            <div key={idx} className="flex gap-1">
              <Input
                type="email"
                value={email}
                onChange={(e) => {
                  const newEmails = [...formData.emailRecipients];
                  newEmails[idx] = e.target.value;
                  setFormData({...formData, emailRecipients: newEmails});
                }}
                placeholder="email@example.com"
                className="h-7 text-xs flex-1"
              />
              {formData.emailRecipients.length > 1 && (
                <Button
                  type="button"
                  onClick={() => {
                    setFormData({...formData, emailRecipients: formData.emailRecipients.filter((_, i) => i !== idx)});
                  }}
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))}
          {formData.emailRecipients.length < 2 && (
            <Button
              type="button"
              onClick={() => setFormData({...formData, emailRecipients: [...formData.emailRecipients, '']})}
              size="sm"
              variant="outline"
              className="h-6 text-xs w-full"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Email
            </Button>
          )}
        </div>
      </div>

      {/* Notifications & Retry */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.notifyOnSuccess}
            onChange={(e) => setFormData({...formData, notifyOnSuccess: e.target.checked})}
            className="w-3 h-3"
          />
          <span>Notify on Success</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.autoRetry}
            onChange={(e) => setFormData({...formData, autoRetry: e.target.checked})}
            className="w-3 h-3"
          />
          <span>Auto Retry</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.notifyOnFailure}
            onChange={(e) => setFormData({...formData, notifyOnFailure: e.target.checked})}
            className="w-3 h-3"
          />
          <span>Notify on Failure</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.isActive}
            onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
            className="w-3 h-3"
          />
          <span>Active</span>
        </label>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          type="submit"
          disabled={submitting || selectedCategoriesUI.length === 0 || loadingCategories}
          className="flex-1 h-7 text-xs"
        >
          {submitting ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Schedule'
          )}
        </Button>
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          className="h-7 text-xs bg-transparent"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
