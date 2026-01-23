import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Generic Shopify Scraper Template
 * Works with ANY Shopify store - just provide store config
 * 
 * @param {Object} storeConfig - Store-specific configuration
 * @param {string} storeConfig.storeName - Display name (e.g., "Forever 21", "Allbirds")
 * @param {string} storeConfig.storeKey - Unique identifier (e.g., "forever21", "allbirds")
 * @param {string} storeConfig.baseUrl - Store base URL (e.g., "https://www.forever21.com")
 * @param {Object} storeConfig.categories - Category structure with collection handles
 * @param {number} storeConfig.sourcePriority - Priority for deduplication (1-5)
 */

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

// Helper to calculate discount percentage
function calculateDiscount(comparePrice, price) {
  if (!comparePrice || !price) return 0;
  const compare = parseFloat(comparePrice);
  const current = parseFloat(price);
  if (compare <= current) return 0;
  return Math.round(((compare - current) / compare) * 100);
}

// Normalize category path (accept both '.' and ' > ' separators)
function normalizeCategoryPath(categoryPath) {
  return categoryPath.includes(' > ') 
    ? categoryPath.split(' > ') 
    : categoryPath.split('.');
}

// Build category breadcrumb from path
function buildCategoryBreadcrumb(categoryPath, categories) {
  const parts = normalizeCategoryPath(categoryPath);
  const breadcrumb = [];
  let current = categories;

  for (const part of parts) {
    if (current[part]) {
      breadcrumb.push(current[part].name);
      current = current[part].subcategories || {};
    }
  }

  return breadcrumb.join(' > ');
}

// Get collection handle from category path
function getCollectionHandle(categoryPath, categories) {
  const parts = normalizeCategoryPath(categoryPath);
  let current = categories;
  let handle = null;

  for (const part of parts) {
    if (current[part]) {
      handle = current[part].handle;
      current = current[part].subcategories || {};
    }
  }

  return handle;
}

// Transform Shopify product data to database schema
function transformShopifyProduct(shopifyProduct, categoryPath, categoryBreadcrumb, storeConfig) {
  const variant = shopifyProduct.variants?.[0] || {};

  return {
    product_id: `${storeConfig.storeKey}-${shopifyProduct.id}`,
    product_name: shopifyProduct.title || 'Unknown Product',
    brand: storeConfig.storeName,
    category_name: categoryBreadcrumb,
    price: parseFloat(variant.price) || 0,
    currency: 'USD',
    url: `${storeConfig.baseUrl}/products/${shopifyProduct.handle}`,
    description: shopifyProduct.body_html?.replace(/<[^>]*>/g, '').trim() || null,
    availability: variant.available !== false,
    low_on_stock: false,
    source: storeConfig.storeKey,
    source_priority: storeConfig.sourcePriority || 3,
    image: shopifyProduct.images?.map(img => ({ url: normalizeImageUrl(img.src) })) || [],
    images: shopifyProduct.images?.map(img => ({ url: normalizeImageUrl(img.src) })) || null,
    sync_method: `${storeConfig.storeName} Shopify API Scraper`,
    last_synced_by: 'automated_scraper',
    is_active: true,
    size: variant.title || '',
    colour: variant.option1 || variant.option2 || 'Not specified',
    colour_code: ''
  };
}

// Fetch products from Shopify collection
async function fetchShopifyCollection(storeConfig, collectionHandle, page = 1, limit = 250) {
  const url = `${storeConfig.baseUrl}/collections/${collectionHandle}/products.json?limit=${limit}&page=${page}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data.products || [];
  } catch (error) {
    throw new Error(`Failed to fetch ${storeConfig.storeName} collection: ${error.message}`);
  }
}

/**
 * Main Shopify scraping function (Generic Template)
 * 
 * @param {Object} storeConfig - Store configuration
 * @param {string} categoryPath - Category path to scrape
 * @param {Object} options - Scraping options { mode, limit, startIndex, endIndex }
 * @param {number} concurrency - Concurrent operations (not used for API scraping)
 * @param {Function} broadcastProgress - Progress callback
 * @param {Object} currentCronStats - Cron statistics object
 */
export async function scrapeShopifyStore(
  storeConfig,
  categoryPath,
  options = {},
  concurrency = 5,
  broadcastProgress = () => {},
  currentCronStats = null
) {
  const { mode = 'full', limit, startIndex, endIndex } = options;
  const results = { successful: [], failed: [] };

  try {
    const categoryBreadcrumb = buildCategoryBreadcrumb(categoryPath, storeConfig.categories);
    const collectionHandle = getCollectionHandle(categoryPath, storeConfig.categories);

    if (!collectionHandle) {
      throw new Error(`Invalid category path: ${categoryPath}`);
    }

    broadcastProgress({
      type: 'info',
      message: `Starting ${storeConfig.storeName} scrape for: ${categoryBreadcrumb}`
    });

    // Fetch all products from collection (paginated)
    let allProducts = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const products = await fetchShopifyCollection(storeConfig, collectionHandle, page);
      
      if (products.length === 0) {
        hasMore = false;
      } else {
        allProducts = allProducts.concat(products);
        broadcastProgress({
          type: 'info',
          message: `Fetched page ${page}: ${products.length} products (Total: ${allProducts.length})`
        });
        page++;
      }
    }

    broadcastProgress({
      type: 'info',
      message: `Found ${allProducts.length} products in ${storeConfig.storeName} collection`
    });

    // Apply mode filtering
    let productsToScrape = allProducts;
    if (mode === 'limit' && limit) {
      productsToScrape = allProducts.slice(0, limit);
      broadcastProgress({
        type: 'info',
        message: `Mode: Limit - Scraping first ${limit} products`
      });
    } else if (mode === 'range' && startIndex !== undefined && endIndex !== undefined) {
      productsToScrape = allProducts.slice(startIndex, endIndex);
      broadcastProgress({
        type: 'info',
        message: `Mode: Range - Scraping products ${startIndex} to ${endIndex}`
      });
    }

    // Process each product
    for (let i = 0; i < productsToScrape.length; i++) {
      const shopifyProduct = productsToScrape[i];
      
      try {
        const product = transformShopifyProduct(shopifyProduct, categoryPath, categoryBreadcrumb, storeConfig);
        
        // Check if product exists (for update tracking)
        const { data: existingProduct } = await supabase
          .from('zara_cloth_scraper')
          .select('product_id')
          .eq('product_id', product.product_id)
          .single();
        
        const isUpdate = !!existingProduct;
        
        // Upsert to database
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
        
        if (currentCronStats) {
          currentCronStats.productsFailed++;
        }

        broadcastProgress({
          type: 'error',
          message: `Failed to save ${shopifyProduct.title}: ${error.message}`
        });
      }
    }

    broadcastProgress({
      type: 'success',
      message: `${storeConfig.storeName} scraping complete: ${results.successful.length} successful, ${results.failed.length} failed`
    });

    return results;

  } catch (error) {
    broadcastProgress({
      type: 'error',
      message: `${storeConfig.storeName} scraping error: ${error.message}`
    });
    throw error;
  }
}

// Export helper functions for use in store-specific files
export {
  normalizeImageUrl,
  calculateDiscount,
  normalizeCategoryPath,
  buildCategoryBreadcrumb,
  getCollectionHandle,
  transformShopifyProduct,
  fetchShopifyCollection
};
