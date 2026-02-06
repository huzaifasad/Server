import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Allbirds Collections Structure (Verified from allbirds.com)
const ALLBIRDS_CATEGORIES = {
  women: {
    name: "Women",
    handle: "womens",
    subcategories: {
      shoes: {
        name: "Shoes",
        handle: "womens-shoes",
        subcategories: {
          "everyday-sneakers": { name: "Sneakers", handle: "womens-sneakers" },
          "active-shoes": { name: "Active Shoes", handle: "running-shop" },
          "high-tops": { name: "High Tops", handle: "womens-high-tops" },
          "slip-ons": { name: "Slip-Ons", handle: "womens-slip-ons" },
          "loungers": { name: "Loungers", handle: "womens-loungers" },
          "sandals": { name: "Sandals", handle: "womens-sandals" },
          "bestsellers": { name: "Bestsellers", handle: "womens-bestsellers" }
        }
      },
      apparel: {
        name: "Apparel",
        handle: "womens-apparel",
        subcategories: {
          "socks": { name: "Socks", handle: "womens-socks" },
          "tees": { name: "T-Shirts & Vests", handle: "womens-tees" },
          "sweatshirts": { name: "Sweatshirts & Hoodies", handle: "womens-sweatshirts" },
          "hats": { name: "Hats", handle: "womens-hats" }
        }
      }
    }
  }
};

// URL-based category mapping for Allbirds
const URL_TO_OUTFIT_CATEGORY = {
  // SHOES (All shoe collections)
  "/collections/womens-shoes": "shoes",
  "/collections/womens-sneakers": "shoes",
  "/collections/running-shop": "shoes",
  "/collections/womens-high-tops": "shoes",
  "/collections/womens-slip-ons": "shoes",
  "/collections/womens-loungers": "shoes",
  "/collections/womens-sandals": "shoes",
  "/collections/womens-bestsellers": "shoes",

  // TOPS (Apparel items)
  "/collections/womens-apparel": "tops",
  "/collections/womens-tees": "tops",
  "/collections/womens-sweatshirts": "tops",

};

// Normalize category path
function normalizeCategoryPath(categoryPath) {
  return categoryPath.includes(' > ') 
    ? categoryPath.split(' > ') 
    : categoryPath.split('.');
}

// Build category breadcrumb from path (matching ASOS format)
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

// Get outfit category from breadcrumb using dual mapping (URL + breadcrumb)
function getOutfitCategoryFromBreadcrumb(breadcrumb, collectionHandle = '') {
  // FIRST: Try URL-based mapping (most accurate for Allbirds)
  const collectionUrl = `/collections/${collectionHandle}`;
  if (URL_TO_OUTFIT_CATEGORY[collectionUrl]) {
    return URL_TO_OUTFIT_CATEGORY[collectionUrl];
  }
  
  // SECOND: Breadcrumb normalization (matching ASOS format)
  const normalized = breadcrumb
    .split(' > ')
    .map(part => part.toLowerCase().trim().replace(/\s+/g, '-'))
    .join('>');
  
  const breadcrumbMapping = {
    // SHOES
    "women>shoes": "shoes",
    "women>shoes>sneakers": "shoes",
    "women>shoes>active-shoes": "shoes",
    "women>shoes>high-tops": "shoes",
    "women>shoes>slip-ons": "shoes",
    "women>shoes>loungers": "shoes",
    "women>shoes>sandals": "shoes",
    "women>shoes>bestsellers": "shoes",

    // TOPS (Apparel)
    "women>apparel": "tops",
    "women>apparel>socks": "tops",
    "women>apparel>t-shirts-&-vests": "tops",
    "women>apparel>sweatshirts-&-hoodies": "tops",
    "women>apparel>hats": "tops"
  };
  
  if (breadcrumbMapping[normalized]) {
    return breadcrumbMapping[normalized];
  }
  
  // THIRD: Keyword-based fallback (ONLY return valid values)
  const breadcrumbLower = breadcrumb.toLowerCase();
  
  // Shoes (default for Allbirds as it's a shoe company)
  if (breadcrumbLower.includes('shoe') || breadcrumbLower.includes('sneaker') || 
      breadcrumbLower.includes('sandal') || breadcrumbLower.includes('slipper') ||
      breadcrumbLower.includes('lounger') || breadcrumbLower.includes('runner')) {
    return 'shoes';
  }
  
  // Tops (apparel items)
  if (breadcrumbLower.includes('apparel') || breadcrumbLower.includes('tee') ||
      breadcrumbLower.includes('sweatshirt') || breadcrumbLower.includes('hoodie') ||
      breadcrumbLower.includes('shirt') || breadcrumbLower.includes('hat') ||
      breadcrumbLower.includes('sock')) {
    return 'tops';
  }
  
  // Default to shoes (Allbirds is primarily a shoe company)
  return 'shoes';
}

// Fetch products from Shopify products.json API with fallback handles
async function fetchShopifyProducts(collectionHandle, page = 1, limit = 250) {
  // Try multiple collection handle patterns
  const handleVariations = [
    collectionHandle,
    collectionHandle.replace('womens-', 'women-'),
    collectionHandle.replace('womens-', ''),
    `womens-${collectionHandle}`
  ];
  
  for (const handle of handleVariations) {
    const url = `https://www.allbirds.com/collections/${handle}/products.json?limit=${limit}&page=${page}`;
    
    try {
      console.log(`[v0] Trying Allbirds collection URL: ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.log(`[v0] HTTP ${response.status} for ${handle}, trying next variant...`);
        continue;
      }

      const data = await response.json();
      const products = data.products || [];
      
      if (products.length > 0) {
        console.log(`[v0] Success! Found ${products.length} products with handle: ${handle}`);
        return products;
      }
      console.log(`[v0] Handle ${handle} returned 0 products, trying next...`);
    } catch (error) {
      console.log(`[v0] Error with ${handle}: ${error.message}, trying next...`);
      continue;
    }
  }
  
  console.error(`[Allbirds] No products found for any variation of: ${collectionHandle}`);
  return [];
}

// Helper to normalize image URLs
function normalizeImageUrl(src) {
  if (!src) return null;
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  if (src.startsWith('//')) return `https:${src}`;
  return `https://${src}`;
}

// Transform Shopify product data to match ASOS database schema EXACTLY
function transformShopifyProduct(shopifyProduct, categoryPath, categoryBreadcrumb, collectionHandle) {
  const variant = shopifyProduct.variants?.[0] || {};
  const allVariants = shopifyProduct.variants || [];
  
  // Get outfit category using dual mapping (URL + breadcrumb)
  const outfitCategory = getOutfitCategoryFromBreadcrumb(categoryBreadcrumb, collectionHandle);
  
  // Extract color from product title (Allbirds format: "Product Name - Color")
  // Example: "Women's Dasher NZ - Anthracite (Dark Anthracite Sole)"
  let productColor = 'Not specified';
  const titleParts = shopifyProduct.title?.split(' - ');
  if (titleParts && titleParts.length > 1) {
    productColor = titleParts[1].split('(')[0].trim();
  } else if (variant.option1) {
    productColor = variant.option1;
  }
  
  // Extract sizes from variants (typically option2 for Allbirds shoes)
  const sizes = [...new Set(allVariants
    .map(v => v.option2 || v.option1)
    .filter(Boolean)
    .filter(s => /^\d/.test(s) || s.match(/^(XS|S|M|L|XL|XXL)$/i)))];
  
  // Check if low on stock (inventory quantity < 10)
  const lowOnStock = allVariants.some(v => 
    v.inventory_quantity != null && v.inventory_quantity > 0 && v.inventory_quantity < 10
  );
  
  // Product is available if at least one variant is available
  const availability = allVariants.some(v => v.available === true);
  
  return {
    // Basic Product Info (ASOS format)
    product_id: shopifyProduct.id?.toString() || `allbirds-${Date.now()}-${Math.random()}`,
    product_name: shopifyProduct.title || 'Unknown Product',
    brand: 'Allbirds',
    category_name: categoryBreadcrumb,
    outfit_category: outfitCategory,
    category_id: '',
    section: 'women',
    product_family: outfitCategory.toUpperCase(),
    product_subfamily: '',
    product_family_en: categoryBreadcrumb.split(' > ')[1] || outfitCategory,
    clothing_category: '',
    
    // Pricing & Availability (ASOS format)
    price: parseFloat(variant.price) || 0,
    currency: '$',
    colour: productColor,
    colour_code: '',
    size: sizes.length > 0 ? sizes.join(', ') : '',
    description: shopifyProduct.body_html?.replace(/<[^>]*>/g, '').trim() || null,
    materials_description: '',
    dimension: '',
    
    // Stock Status (ASOS format)
    low_on_stock: lowOnStock,
    availability: availability,
    sku: shopifyProduct.id?.toString() || '',
    
    // URLs & Images (ASOS format)
    url: `https://www.allbirds.com/products/${shopifyProduct.handle}`,
    image: shopifyProduct.images?.map(img => ({ url: normalizeImageUrl(img.src) })) || [],
    images: shopifyProduct.images?.map(img => normalizeImageUrl(img.src)) || [],
    
    // Source metadata (ASOS format)
    source: 'allbirds',
    source_priority: 4,
    sync_method: 'Allbirds Shopify Scraper',
    last_synced_by: 'automated_scraper',
    is_active: true
  };
}

// Validate product data (matching ASOS validation logic)
function isValidProduct(product) {
  // Must have product name
  if (!product.product_name || product.product_name === 'Unknown Product') {
    return false;
  }
  
  // Must have at least one image
  if (!product.images || product.images.length === 0) {
    return false;
  }
  
  // Must have valid price
  if (!product.price || product.price <= 0) {
    return false;
  }
  
  // Must have product_id
  if (!product.product_id) {
    return false;
  }
  
  // Skip out of stock products
  if (!product.availability || product.availability === false) {
    return false;
  }
  
  // Skip error pages or invalid products
  if (product.product_name.toLowerCase().includes('error') || 
      product.product_name.toLowerCase().includes('not found')) {
    return false;
  }
  
  return true;
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
      message: `Collection: "${collectionHandle}" | Category: "${categoryBreadcrumb}"`,
      category: categoryPath
    });

    // Fetch products from Shopify
    const allProducts = await fetchShopifyProducts(collectionHandle);

    if (allProducts.length === 0) {
      broadcastProgress({
        type: 'error',
        message: `NO PRODUCTS FOUND for "${collectionHandle}"`,
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
      message: `Found ${allProducts.length} products total`,
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
        const product = transformShopifyProduct(shopifyProduct, categoryPath, categoryBreadcrumb, collectionHandle);
        
        // Validate product
        if (!isValidProduct(product)) {
          results.failed.push({
            product: shopifyProduct.title,
            error: 'Validation failed (missing data, out of stock, or invalid)'
          });
          
          broadcastProgress({
            type: 'warning',
            message: `Skipped "${shopifyProduct.title}" (validation failed)`
          });
          
          if (currentCronStats) {
            currentCronStats.productsFailed++;
          }
          
          continue;
        }
        
        // Check if product already exists in clean_scraper table
        const { data: existingProduct } = await supabase
          .from('clean_scraper')
          .select('id, product_id, price')
          .eq('product_id', product.product_id)
          .single();
        
        const isUpdate = !!existingProduct;
        
        // Save to database using UPSERT with clean_scraper table
        const { error } = await supabase
          .from('clean_scraper')
          .upsert(product, { 
            onConflict: 'product_id',
            ignoreDuplicates: false 
          });

        if (error) throw error;

        results.successful.push(product);
        
        // Update cron stats
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
          message: `Failed: ${shopifyProduct.title} - ${error.message}`,
          category: categoryPath
        });
      }
    }

    broadcastProgress({
      type: 'complete',
      message: `Done! ${results.successful.length} saved, ${results.failed.length} failed`,
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
      message: `Error: ${error.message}`,
      category: categoryPath
    });
    
    throw error;
  }
}

export { ALLBIRDS_CATEGORIES };
