import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// CORRECT Allbirds Collections - VERIFIED from allbirds.com
const ALLBIRDS_CATEGORIES = {
  men: {
    name: "Men",
    handle: "mens",
    subcategories: {
      "shoes": {
        name: "Shoes",
        handle: "mens-shoes",
        subcategories: {
          "everyday-sneakers": { name: "Everyday Sneakers", handle: "mens-sneakers" },
          "active-shoes": { name: "Active Shoes", handle: "running-shop" },
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
          "everyday-sneakers": { name: "Everyday Sneakers", handle: "womens-sneakers" },
          "active-shoes": { name: "Active Shoes", handle: "running-shop" },
          "high-tops": { name: "High Tops", handle: "womens-high-tops" },
          "slip-ons": { name: "Slip-Ons", handle: "womens-slip-ons" },
          "loungers": { name: "Loungers", handle: "womens-loungers" },
          "sandals": { name: "Sandals", handle: "womens-sandals" },
          "bestsellers": { name: "Bestsellers", handle: "womens-bestsellers" }
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

// CRITICAL: Fetch with delay to avoid rate limiting
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch products from Shopify with retry
async function fetchWithRetry(url, retries = 3, broadcastProgress) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await delay(500 * attempt); // Progressive delay
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.allbirds.com/',
          'Origin': 'https://www.allbirds.com',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin'
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          broadcastProgress({
            type: 'warning',
            message: `Rate limited (429). Waiting ${attempt * 2}s before retry ${attempt}/${retries}...`
          });
          await delay(attempt * 2000);
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      
      if (!text || text.trim() === '') {
        throw new Error('Empty response body');
      }

      const data = JSON.parse(text);
      return { success: true, data, url };

    } catch (error) {
      broadcastProgress({
        type: 'warning',
        message: `Attempt ${attempt}/${retries} failed: ${error.message}`
      });

      if (attempt === retries) {
        return { success: false, error: error.message, url };
      }
    }
  }
  return { success: false, error: 'Max retries exceeded' };
}

// Main fetch function - tries multiple strategies
async function fetchShopifyProducts(collectionHandle, broadcastProgress) {
  
  // Strategy: Try products.json with different approaches
  const strategies = [
    {
      name: 'Standard products.json',
      url: `https://www.allbirds.com/collections/${collectionHandle}/products.json?limit=250`
    },
    {
      name: 'No limit parameter',
      url: `https://www.allbirds.com/collections/${collectionHandle}/products.json`
    },
    {
      name: 'Parent collection fallback',
      url: collectionHandle.includes('-') 
        ? `https://www.allbirds.com/collections/${collectionHandle.split('-')[0]}/products.json?limit=250`
        : null
    },
    {
      name: 'All products fallback',
      url: `https://www.allbirds.com/collections/all/products.json?limit=250`
    }
  ].filter(s => s.url !== null);

  broadcastProgress({
    type: 'info',
    message: `🔍 Trying ${strategies.length} strategies for: ${collectionHandle}`
  });

  // Try each strategy
  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    
    broadcastProgress({
      type: 'info',
      message: `📡 Strategy ${i + 1}/${strategies.length}: ${strategy.name}`
    });

    const result = await fetchWithRetry(strategy.url, 3, broadcastProgress);
    
    if (result.success && result.data) {
      const products = result.data.products || [];
      
      if (products.length > 0) {
        broadcastProgress({
          type: 'success',
          message: `✅ SUCCESS! Found ${products.length} products using: ${strategy.name}`
        });
        
        // If using fallback (all products), filter by collection if possible
        if (strategy.name.includes('fallback') && collectionHandle !== 'all') {
          const filtered = products.filter(p => {
            const tags = p.tags?.toLowerCase() || '';
            const type = p.product_type?.toLowerCase() || '';
            const handle = p.handle?.toLowerCase() || '';
            const searchTerm = collectionHandle.replace(/^(mens|womens)-/, '').toLowerCase();
            
            return tags.includes(searchTerm) || 
                   type.includes(searchTerm) || 
                   handle.includes(searchTerm);
          });
          
          if (filtered.length > 0) {
            broadcastProgress({
              type: 'info',
              message: `🔍 Filtered ${products.length} → ${filtered.length} products matching "${collectionHandle}"`
            });
            return filtered;
          }
        }
        
        return products;
      } else {
        broadcastProgress({
          type: 'warning',
          message: `⚠️ ${strategy.name} returned 0 products`
        });
      }
    }
  }

  broadcastProgress({
    type: 'error',
    message: `❌ All strategies failed for: ${collectionHandle}`
  });

  return [];
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
    product_id: shopifyProduct.id?.toString() || `allbirds-${Date.now()}-${Math.random()}`,
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
    message: `🚀 Starting Allbirds scrape for: ${categoryPath}`,
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
      message: `📦 Collection: "${collectionHandle}" | Category: "${categoryBreadcrumb}"`,
      category: categoryPath
    });

    // Fetch products with multiple fallback strategies
    const allProducts = await fetchShopifyProducts(collectionHandle, broadcastProgress);

    if (allProducts.length === 0) {
      broadcastProgress({
        type: 'error',
        message: `⚠️ NO PRODUCTS FOUND for "${collectionHandle}"

This collection either:
• Doesn't exist on allbirds.com
• Is currently empty
• Requires different access method

Try checking: https://www.allbirds.com/collections/${collectionHandle}`,
        category: categoryPath
      });
      
      return {
        successful: [],
        failed: [],
        total: 0
      };
    }

    broadcastProgress({
      type: 'success',
      message: `✅ Found ${allProducts.length} products total`,
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
      message: `⚙️ Processing ${productsToScrape.length} products...`,
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
        
        // Save to database using UPSERT (keeping as requested)
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
          message: `${isUpdate ? '🔄 Updated' : '✨ Saved'}: ${product.product_name} (${i + 1}/${productsToScrape.length})`
        });

      } catch (error) {
        results.failed.push({
          product: shopifyProduct.title,
          error: error.message
        });

        broadcastProgress({
          type: 'error',
          message: `❌ Failed: ${shopifyProduct.title} - ${error.message}`,
          category: categoryPath
        });
      }
    }

    broadcastProgress({
      type: 'complete',
      message: `🎉 Done! ${results.successful.length} saved, ${results.failed.length} failed`,
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
      message: `💥 Error: ${error.message}`,
      category: categoryPath
    });
    
    throw error;
  }
}

export { ALLBIRDS_CATEGORIES };