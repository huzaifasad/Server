'use client';

import Link from "next/link"
import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import AppHeader from '@/components/app-header';
import { 
  ChevronLeft,
  ChevronRight,
  Search,
  Package,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
const Loading =()=>{
    return(<></>)
}

const supabase = createClient(
  'https://aqkeprwxxsryropnhfvm.supabase.co/',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxa2Vwcnd4eHNyeXJvcG5oZnZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU0MDkzNDgsImV4cCI6MjA1MDk4NTM0OH0.aWBLwn75nnRzKQ20gKx_9rBQqPQJzx9vT2t_MBXsLEg'
);

function ProductsPageContent() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedImage, setSelectedImage] = useState({});
  const itemsPerPage = 12;
  const searchParams = useSearchParams();

  useEffect(() => {
    fetchProducts();
  }, [currentPage, searchTerm]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from('zara_cloth_scraper')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (searchTerm) {
        query = query.or(`product_name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%,category_name.ilike.%${searchTerm}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      setProducts(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('[v0] Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseImages = (imageData) => {
    if (!imageData) return [];
    try {
      if (typeof imageData === 'string') {
        const parsed = JSON.parse(imageData);
        return Array.isArray(parsed) ? parsed : [];
      }
      return Array.isArray(imageData) ? imageData : [];
    } catch {
      return [];
    }
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(
        <Button
          key={i}
          onClick={() => setCurrentPage(i)}
          variant={currentPage === i ? 'default' : 'outline'}
          size="sm"
          className="h-6 w-6 p-0 text-xs"
        >
          {i}
        </Button>
      );
    }
    return pages;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <AppHeader isConnected={false} />
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search products, brands, categories..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8 pr-3 h-7 w-80 text-xs border-input"
                />
              </div>
              <Badge variant="outline" className="text-xs font-medium px-2.5 py-0.5">
                {totalCount} items
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-4">

        {/* Products Grid */}
        {loading ? (
          <Loading />
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Package className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No products found</p>
            <p className="text-xs text-muted-foreground">Try a different search term</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {products.map((product) => {
                const images = parseImages(product.image || product.images);
                const currentImageIndex = selectedImage[product.id] || 0;
                const currentImage = images[currentImageIndex];

                return (
                  <Card key={product.id} className="overflow-hidden hover:shadow-md transition-shadow group">
                    <div className="relative bg-muted/20 aspect-[3/4] overflow-hidden">
                      {currentImage ? (
                        <img
                          src={currentImage.url || currentImage}
                          alt={product.product_name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted/30">
                          <Package className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      
                      {/* Image navigation dots */}
                      {images.length > 1 && (
                        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1 bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm">
                          {images.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedImage({ ...selectedImage, [product.id]: idx })}
                              className={`w-1.5 h-1.5 rounded-full transition-all ${
                                idx === currentImageIndex ? 'bg-white w-4' : 'bg-white/60 hover:bg-white/80'
                              }`}
                            />
                          ))}
                        </div>
                      )}

                      {/* External link button */}
                      {product.url && (
                        <a
                          href={product.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute top-2 right-2 w-6 h-6 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      {/* Stock badge */}
                      {product.low_on_stock && (
                        <div className="absolute top-2 left-2">
                          <Badge variant="destructive" className="text-xs h-5 px-2">Low Stock</Badge>
                        </div>
                      )}
                    </div>

                    <CardContent className="p-3 space-y-1.5">
                      <div className="space-y-1">
                        {product.brand && (
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{product.brand}</p>
                        )}
                        <h3 className="text-xs font-medium line-clamp-2 leading-tight">
                          {product.product_name}
                        </h3>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <p className="text-sm font-bold">
                          {product.currency || '£'}{product.price}
                        </p>
                        {product.availability ? (
                          <Badge variant="outline" className="text-xs h-5 px-2 border-green-600 text-green-600">In Stock</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs h-5 px-2 border-red-600 text-red-600">Out</Badge>
                        )}
                      </div>

                      {product.colour && (
                        <p className="text-xs text-muted-foreground truncate">{product.colour}</p>
                      )}

                      {product.category_name && (
                        <p className="text-xs text-muted-foreground truncate">{product.category_name}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1">
                <Button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                  className="h-6 w-6 p-0"
                >
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                {renderPageNumbers()}
                <Button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  size="sm"
                  className="h-6 w-6 p-0"
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ProductsPageContent />
    </Suspense>
  );
}
