import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Allbirds Collections Structure (Shopify-based)
const ALLBIRDS_CATEGORIES = {
  men: {
    name: "Men",
    handle: "mens",
    subcategories: {
      "shoes": {
        name: "Shoes",
        handle: "mens-shoes",
        subcategories: {
          "everyday-sneakers": { name: "Everyday Sneakers", handle: "mens-everyday-sneakers" },
          "active-shoes": { name: "Active Shoes", handle: "mens-active-shoes" },
          "high-tops": { name: "High Tops", handle: "mens-high-tops" },
          "slip-ons": { name: "Slip-Ons", handle: "mens-slip-ons" },
          "loungers": { name: "Loungers", handle: "mens-loungers" },
          "sandals": { name: "Sandals", handle: "mens-sandals" }
        }
      },
      "apparel": {
        name: "Apparel",
        handle: "mens-apparel",
        subcategories: {
          "socks": { name: "Socks", handle: "mens-socks" },
          "tees": { name: "T-Shirts", handle: "mens-tees" },
          "sweatshirts": { name: "Sweatshirts", handle: "mens-sweatshirts" },
          "hats": { name: "Hats", handle: "mens-hats" }
        }
      }
    }
  },
  women: {
    name: "Women",
    handle: "womens",
    subcategories: {
      "shoes": {
        name: "Shoes",
        handle: "womens-shoes",
        subcategories: {
          "everyday-sneakers": { name: "Everyday Sneakers", handle: "womens-everyday-sneakers" },
          "active-shoes": { name: "Active Shoes", handle: "womens-active-shoes" },
          "high-tops": { name: "High Tops", handle: "womens-high-tops" },
          "slip-ons": { name: "Slip-Ons", handle: "womens-slip-ons" },
          "loungers": { name: "Loungers", handle: "womens-loungers" },
          "sandals": { name: "Sandals", handle: "womens-sandals" }
        }
      },
      "apparel": {
        name: "Apparel",
        handle: "womens-apparel",
        subcategories: {
          "socks": { name: "Socks", handle: "womens-socks" },
          "tees": { name: "T-Shirts", handle: "womens-tees" },
          "sweatshirts": { name: "Sweatshirts", handle: "womens-sweatshirts" },
          "hats": { name: "Hats", handle: "womens-hats" }
        }
      }
    }
  }
};

// Normalize category path
function normalizeCategoryPath(categoryPath) {
  return categoryPath.includes(' > ') 
    ? categoryPath.split(' > ') 
    : categoryPath.split('.');
}

// Build category breadcrumb from path
function buildAllbirdsCategoryBreadcrumb(categoryPath) {
  const parts = normalizeCategoryPath(categoryPath);
  const breadcrumb = [];
  let current = ALLBIRDS_CATEGORIES;

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
  let current = ALLBIRDS_CATEGORIES;
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
  const url = `https://www.allbirds.com/collections/${collectionHandle}/products.json?limit=${limit}&page=${page}`;
  
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
    console.error(`[Allbirds] Error fetching products from ${url}:`, error.message);
    return [];
  }
}

// Helper function to normalize image URLs
function normalizeImageUrl(src) {
  if (!src) return null;
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  if (src.startsWith('//')) {
    return `https:${src}`;
  }
  return `https://${src}`;
}

// Transform Shopify product data to match database schema
function transformShopifyProduct(shopifyProduct, categoryPath, categoryBreadcrumb) {
  const variant = shopifyProduct.variants?.[0] || {};

  return {
    product_id: shopifyProduct.id?.toString() || `allbirds-${Date.now()}`,
    product_name: shopifyProduct.title || 'Unknown Product',
    brand: 'Allbirds',
    category_name: categoryBreadcrumb,
    price: parseFloat(variant.price) || 0,
    currency: 'USD',
    url: `https://www.allbirds.com/products/${shopifyProduct.handle}`,
    description: shopifyProduct.body_html?.replace(/<[^>]*>/g, '').trim() || null,
    availability: variant.available !== false,
    low_on_stock: false,
    source: 'allbirds',
    source_priority: 4,
    image: shopifyProduct.images?.map(img => ({ url: normalizeImageUrl(img.src) })) || [],
    images: shopifyProduct.images?.map(img => ({ url: normalizeImageUrl(img.src) })) || null,
    sync_method: 'Allbirds Shopify API Scraper',
    last_synced_by: 'automated_scraper',
    is_active: true,
    size: variant.title || '',
    colour: variant.option1 || variant.option2 || 'Not specified',
    colour_code: ''
  };
}

// Main scraping function for Allbirds
export async function scrapeAllbirds(
  browser = null,
  categoryPath,
  options = {},
  concurrency = 5,
  broadcastProgress = () => {},
  currentCronStats = null
) {
  const { mode = 'full', limit = 10, startIndex = 0, endIndex = 20 } = options;
  
  broadcastProgress({
    type: 'info',
    message: `Starting Allbirds scrape for: ${categoryPath}`,
    category: categoryPath
  });

  try {
    const collectionHandle = getCollectionHandle(categoryPath);
    if (!collectionHandle) {
      throw new Error(`Invalid category path: ${categoryPath}`);
    }

    const categoryBreadcrumb = buildAllbirdsCategoryBreadcrumb(categoryPath);
    
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
    } else if (mode === 'range') {
      productsToScrape = allProducts.slice(startIndex, endIndex);
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
        
        // Check if product already exists
        const { data: existingProduct } = await supabase
          .from('zara_cloth_scraper')
          .select('product_id')
          .eq('product_id', product.product_id)
          .single();
        
        const isUpdate = !!existingProduct;
        
        // Save to database using UPSERT
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

export { ALLBIRDS_CATEGORIES };
