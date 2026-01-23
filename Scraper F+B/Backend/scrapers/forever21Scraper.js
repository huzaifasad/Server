import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Forever 21 Collections Structure (Shopify-based)
const FOREVER21_CATEGORIES = {
  women: {
    name: "Women",
    handle: "womens-clothing",
    subcategories: {
      "new-arrivals": { name: "New Arrivals", handle: "womens-new-arrivals" },
      "bestsellers": { name: "Bestsellers", handle: "womens-bestsellers" },
      "tops": { name: "Tops", handle: "womens-tops" },
      "dresses": { name: "Dresses", handle: "womens-dresses" },
      "bottoms": { name: "Bottoms", handle: "womens-bottoms" },
      "jeans": { name: "Jeans", handle: "womens-jeans" },
      "activewear": { name: "Activewear", handle: "womens-activewear" },
      "swimwear": { name: "Swimwear", handle: "womens-swimwear" },
      "intimates": { name: "Intimates", handle: "womens-intimates" },
      "sleepwear": { name: "Sleepwear", handle: "womens-sleepwear" },
      "outerwear": { name: "Outerwear", handle: "womens-outerwear" },
      "shoes": { name: "Shoes", handle: "womens-shoes" },
      "accessories": { name: "Accessories", handle: "womens-accessories" },
      "plus-size": { name: "Plus Size", handle: "womens-plus-size-clothing" }
    }
  },
  men: {
    name: "Men",
    handle: "mens-clothing",
    subcategories: {
      "new-arrivals": { name: "New Arrivals", handle: "mens-new-arrivals" },
      "tees": { name: "T-Shirts", handle: "mens-tees" },
      "shirts": { name: "Shirts", handle: "mens-shirts" },
      "bottoms": { name: "Bottoms", handle: "mens-bottoms" },
      "jeans": { name: "Jeans", handle: "mens-jeans" },
      "activewear": { name: "Activewear", handle: "mens-activewear" },
      "outerwear": { name: "Outerwear", handle: "mens-outerwear" },
      "shoes": { name: "Shoes", handle: "mens-shoes" },
      "accessories": { name: "Accessories", handle: "mens-accessories" }
    }
  }
};

// Normalize category path (accept both '.' and ' > ' separators)
function normalizeCategoryPath(categoryPath) {
  // Convert dot notation to array: 'women.new-arrivals' -> ['women', 'new-arrivals']
  // Or split space-arrow notation: 'women > new-arrivals' -> ['women', 'new-arrivals']
  return categoryPath.includes(' > ') 
    ? categoryPath.split(' > ') 
    : categoryPath.split('.');
}

// Build category breadcrumb from path
function buildForever21CategoryBreadcrumb(categoryPath) {
  const parts = normalizeCategoryPath(categoryPath);
  const breadcrumb = [];
  let current = FOREVER21_CATEGORIES;

  for (const part of parts) {
    if (current[part]) {
      breadcrumb.push(current[part].name);
      current = current[part].subcategories || {};
    }
  }

  return breadcrumb.join(' > ');
}

// Get collection handle from category path
function getCollectionHandle(categoryPath) {
  const parts = normalizeCategoryPath(categoryPath);
  let current = FOREVER21_CATEGORIES;
  let handle = null;

  for (const part of parts) {
    if (current[part]) {
      handle = current[part].handle;
      current = current[part].subcategories || {};
    }
  }

  return handle;
}

// Fetch products from Shopify products.json API
async function fetchShopifyProducts(collectionHandle, page = 1, limit = 250) {
  const url = `https://www.forever21.com/collections/${collectionHandle}/products.json?limit=${limit}&page=${page}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.products || [];
  } catch (error) {
    console.error(`[Forever21] Error fetching products from ${url}:`, error.message);
    return [];
  }
}

// Helper function to normalize image URLs
function normalizeImageUrl(src) {
  if (!src) return null;
  // If already has http/https, return as-is
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  // If starts with //, prepend https:
  if (src.startsWith('//')) {
    return `https:${src}`;
  }
  // Otherwise, prepend https://
  return `https://${src}`;
}

// Transform Shopify product data to match our database schema
function transformShopifyProduct(shopifyProduct, categoryPath, categoryBreadcrumb) {
  const variant = shopifyProduct.variants?.[0] || {};
  const image = shopifyProduct.images?.[0];

  return {
    product_id: shopifyProduct.id?.toString() || `f21-${Date.now()}`,
    product_name: shopifyProduct.title || 'Unknown Product',
    brand: 'Forever 21',
    category_name: categoryBreadcrumb,
    price: parseFloat(variant.price) || 0,
    currency: 'USD',
    url: `https://www.forever21.com/products/${shopifyProduct.handle}`,
    description: shopifyProduct.body_html?.replace(/<[^>]*>/g, '').trim() || null,
    availability: variant.available !== false,
    low_on_stock: false,
    source: 'forever21',
    source_priority: 3,
    image: shopifyProduct.images?.map(img => ({ url: normalizeImageUrl(img.src) })) || [],
    images: shopifyProduct.images?.map(img => ({ url: normalizeImageUrl(img.src) })) || null,
    sync_method: 'Forever21 Shopify API Scraper',
    last_synced_by: 'automated_scraper',
    is_active: true,
    size: variant.title || '',
    colour: variant.option1 || variant.option2 || 'Not specified',
    colour_code: ''
  };
}

// Calculate discount percentage
function calculateDiscount(comparePrice, currentPrice) {
  if (!comparePrice || !currentPrice) return '0%';
  
  const compare = parseFloat(comparePrice);
  const current = parseFloat(currentPrice);
  
  if (compare <= current) return '0%';
  
  const discount = ((compare - current) / compare * 100).toFixed(0);
  return `${discount}%`;
}

// Main scraping function for Forever 21
export async function scrapeForever21(
  browser = null, // Not needed for Shopify API
  categoryPath,
  options = {},
  concurrency = 5,
  broadcastProgress = () => {},
  currentCronStats = null // Match ASOS/Mango signature
) {
  const { mode = 'full', limit = 10, startIndex = 0, endIndex = 20 } = options;
  const statsObj = {}; // Declare statsObj variable
  const cronStats = currentCronStats || {}; // Declare cronStats variable
  
  broadcastProgress({
    type: 'info',
    message: `Starting Forever 21 scrape for: ${categoryPath}`,
    category: categoryPath
  });

  try {
    // Get collection handle from category path
    const collectionHandle = getCollectionHandle(categoryPath);
    if (!collectionHandle) {
      throw new Error(`Invalid category path: ${categoryPath}`);
    }

    const categoryBreadcrumb = buildForever21CategoryBreadcrumb(categoryPath);
    
    broadcastProgress({
      type: 'info',
      message: `Fetching products from collection: ${collectionHandle}`,
      category: categoryPath
    });

    // Fetch all products from Shopify API (paginated)
    let allProducts = [];
    let page = 1;
    let hasMoreProducts = true;

    while (hasMoreProducts && (mode === 'full' || allProducts.length < (mode === 'limit' ? limit : endIndex))) {
      const products = await fetchShopifyProducts(collectionHandle, page);
      
      if (products.length === 0) {
        hasMoreProducts = false;
      } else {
        allProducts = allProducts.concat(products);
        broadcastProgress({
          type: 'info',
          message: `Fetched page ${page}: ${products.length} products (Total: ${allProducts.length})`,
          category: categoryPath
        });
        page++;
      }
    }

    broadcastProgress({
      type: 'success',
      message: `Total products found: ${allProducts.length}`,
      category: categoryPath
    });

    // Apply mode filtering
    let productsToScrape = allProducts;
    if (mode === 'limit') {
      productsToScrape = allProducts.slice(0, limit);
      broadcastProgress({
        type: 'info',
        message: `Mode: Limit - Processing first ${limit} products`,
        category: categoryPath
      });
    } else if (mode === 'range') {
      productsToScrape = allProducts.slice(startIndex, endIndex);
      broadcastProgress({
        type: 'info',
        message: `Mode: Range - Processing products ${startIndex} to ${endIndex}`,
        category: categoryPath
      });
    }

    broadcastProgress({
      type: 'info',
      message: `Processing ${productsToScrape.length} products...`,
      category: categoryPath
    });

    // Transform and save products
    const results = {
      successful: [],
      failed: []
    };

    for (let i = 0; i < productsToScrape.length; i++) {
      const shopifyProduct = productsToScrape[i];
      
      try {
        const product = transformShopifyProduct(shopifyProduct, categoryPath, categoryBreadcrumb);
        
        // Check if product already exists to track updates vs new adds
        const { data: existingProduct } = await supabase
          .from('zara_cloth_scraper')
          .select('product_id')
          .eq('product_id', product.product_id)
          .single();
        
        const isUpdate = !!existingProduct;
        
        // Save to database using UPSERT (prevents duplicates by product_id)
        const { data, error } = await supabase
          .from('zara_cloth_scraper')
          .upsert(product, { 
            onConflict: 'product_id',
            ignoreDuplicates: false 
          })
          .select()
          .single();

        if (error) throw error;

        results.successful.push(product);
        
        if (currentCronStats) {
          if (isUpdate) {
            currentCronStats.productsUpdated++;
          } else {
            currentCronStats.productsAdded++;
          }
        }

        broadcastProgress({
          type: 'info',
          message: `${isUpdate ? 'Updated' : 'Saved'}: ${product.product_name} (${i + 1}/${productsToScrape.length})`
        });

      } catch (error) {
        results.failed.push({
          product: shopifyProduct.title,
          error: error.message
        });

        if (statsObj) {
          statsObj.failedProducts++;
          statsObj.totalProducts++;
        }

        broadcastProgress({
          type: 'error',
          message: `Failed to save: ${shopifyProduct.title} - ${error.message}`,
          category: categoryPath
        });
      }
    }

    broadcastProgress({
      type: 'complete',
      message: `Completed: ${results.successful.length} successful, ${results.failed.length} failed`,
      category: categoryPath,
      results: {
        total: productsToScrape.length,
        successful: results.successful.length,
        failed: results.failed.length
      }
    });

    return results;

  } catch (error) {
    broadcastProgress({
      type: 'error',
      message: `Scraping error: ${error.message}`,
      category: categoryPath
    });
    
    throw error;
  }
}

export { FOREVER21_CATEGORIES };
