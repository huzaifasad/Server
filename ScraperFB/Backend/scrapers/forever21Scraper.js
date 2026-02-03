import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Forever 21 Collections Structure (Real Forever21.com taxonomy)
const FOREVER21_CATEGORIES = {
  women: {
    name: "Women",
    handle: "womens-clothing",
    subcategories: {
      tops: {
        name: "Tops",
        handle: "womens-tops",
        subcategories: {
          "shirts-&-blouses": { name: "Shirts + Blouses", handle: "womens-shirts" },
          "tees": { name: "Tees", handle: "womens-tees" },
          "tanks-&-camis": { name: "Tanks + Camis", handle: "womens-tanks-camis" },
          "sweaters-&-cardigans": { name: "Sweaters + Cardigans", handle: "womens-sweaters" },
          "hoodies-&-sweatshirts": { name: "Sweatshirts + Hoodies", handle: "womens-hoodies" },
          "bodysuits": { name: "Bodysuits", handle: "womens-bodysuits" }
        }
      },
      bottoms: {
        name: "Bottoms",
        handle: "women-bottoms",
        subcategories: {
          "jeans": { name: "Denim + Jeans", handle: "womens-jeans" },
          "shorts": { name: "Shorts", handle: "womens-shorts" },
          "skirts-&-skorts": { name: "Skirts + Skorts", handle: "womens-skirts-skorts" },
          "pants": { name: "Pants", handle: "womens-pants" }
        }
      },
      "one-piece": {
        name: "Dresses",
        handle: "women-dresses",
        subcategories: {
          "mini-dresses": { name: "Mini Dresses", handle: "womens-mini-dresses" },
          "midi-dresses": { name: "Midi Dresses", handle: "womens-midi-dresses" },
          "maxi-dresses": { name: "Maxi Dresses", handle: "womens-maxi-dresses" },
          "jumpsuits-&-rompers": { name: "Rompers + Jumpsuits", handle: "womens-rompers-jumpsuits" }
        }
      },
      activewear: {
        name: "Activewear",
        handle: "women-activewear",
        subcategories: {
          "sports-bras": { name: "Sports Bras", handle: "sports-bras" },
          "active-tops": { name: "Active Tops", handle: "active-tops" },
          "active-leggings": { name: "Leggings", handle: "active-leggings" },
          "active-shorts": { name: "Active Shorts", handle: "active-shorts" }
        }
      },
      shoes: {
        name: "Shoes",
        handle: "shoes",
        subcategories: {
          "boots-&-booties": { name: "Boots + Booties", handle: "boots-booties" },
          "heels-&-wedges": { name: "Heels + Wedges", handle: "heels-wedges" },
          "sandals-&-flip-flops": { name: "Sandals + Flip Flops", handle: "sandals-flip-flops" },
          "sneakers": { name: "Sneakers", handle: "sneakers" },
          "flats": { name: "Flats", handle: "shoes-flats" }
        }
      },
      "plus-size": {
        name: "Plus Size",
        handle: "womens-plus-size-clothing",
        subcategories: {
          "plus-tops": { name: "Plus Tops", handle: "womens-plus-size-tops" },
          "plus-dresses": { name: "Plus Dresses", handle: "womens-plus-size-dresses" },
          "plus-bottoms": { name: "Plus Bottoms", handle: "womens-plus-size-bottoms" }
        }
      }
    }
  }
};

// URL-based category mapping (handles real Forever21 collection URLs)
const URL_TO_OUTFIT_CATEGORY = {
  // SHOES
  "/collections/shoes": "shoes",
  "/collections/boots-booties": "shoes",
  "/collections/heels-wedges": "shoes",
  "/collections/sandals-flip-flops": "shoes",
  "/collections/sneakers": "shoes",
  "/collections/shoes-flats": "shoes",
  "/collections/slippers": "shoes",

  // ONE-PIECE
  "/collections/women-dresses": "one-piece",
  "/collections/womens-mini-dresses": "one-piece",
  "/collections/womens-midi-dresses": "one-piece",
  "/collections/womens-maxi-dresses": "one-piece",
  "/collections/womens-rompers-jumpsuits": "one-piece",
  "/collections/womens-plus-size-dresses": "one-piece",

  // BOTTOMS
  "/collections/women-bottoms": "bottoms",
  "/collections/womens-jeans": "bottoms",
  "/collections/womens-shorts": "bottoms",
  "/collections/womens-skirts-skorts": "bottoms",
  "/collections/womens-pants": "bottoms",
  "/collections/womens-plus-size-bottoms": "bottoms",

  // TOPS
  "/collections/womens-tops": "tops",
  "/collections/womens-shirts": "tops",
  "/collections/womens-tees": "tops",
  "/collections/womens-sweaters": "tops",
  "/collections/womens-hoodies": "tops",
  "/collections/womens-bodysuits": "tops",
  "/collections/womens-tanks-camis": "tops",
  "/collections/womens-plus-size-tops": "tops",

  // ACTIVEWEAR (Dual mapping based on specific handle)
  "/collections/women-activewear": "tops",
  "active-tops": "tops",
  "sports-bras": "tops",
  "active-leggings": "bottoms",
  "active-shorts": "bottoms"
};

// Normalize category path (accept both '.' and ' > ' separators)
function normalizeCategoryPath(categoryPath) {
  return categoryPath.includes(' > ') 
    ? categoryPath.split(' > ') 
    : categoryPath.split('.');
}

// Build category breadcrumb from path (matching ASOS format)
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

// Get outfit category from breadcrumb using dual mapping (URL + breadcrumb)
function getOutfitCategoryFromBreadcrumb(breadcrumb, collectionHandle = '') {
  // FIRST: Try URL-based mapping (most accurate for Forever21)
  const collectionUrl = `/collections/${collectionHandle}`;
  if (URL_TO_OUTFIT_CATEGORY[collectionUrl]) {
    return URL_TO_OUTFIT_CATEGORY[collectionUrl];
  }
  
  // Check if collection handle contains activewear subcategories
  if (collectionHandle) {
    if (collectionHandle.includes('sports-bras') || collectionHandle.includes('active-tops')) {
      return 'tops';
    }
    if (collectionHandle.includes('active-leggings') || collectionHandle.includes('active-shorts')) {
      return 'bottoms';
    }
  }
  
  // SECOND: Breadcrumb normalization (matching ASOS format)
  const normalized = breadcrumb
    .split(' > ')
    .map(part => part.toLowerCase().trim().replace(/\s+/g, '-'))
    .join('>');
  
  const breadcrumbMapping = {
    // TOPS
    "women>tops": "tops",
    "women>tops>shirts-+-blouses": "tops",
    "women>tops>tees": "tops",
    "women>tops>sweaters-+-cardigans": "tops",
    "women>tops>sweatshirts-+-hoodies": "tops",
    "women>tops>bodysuits": "tops",
    "women>tops>tanks-+-camis": "tops",
    "women>activewear>sports-bras": "tops",
    "women>activewear>active-tops": "tops",

    // BOTTOMS
    "women>bottoms": "bottoms",
    "women>bottoms>denim-+-jeans": "bottoms",
    "women>bottoms>shorts": "bottoms",
    "women>bottoms>skirts-+-skorts": "bottoms",
    "women>bottoms>pants": "bottoms",
    "women>activewear>leggings": "bottoms",
    "women>activewear>active-shorts": "bottoms",

    // ONE-PIECE
    "women>dresses": "one-piece",
    "women>dresses>mini-dresses": "one-piece",
    "women>dresses>midi-dresses": "one-piece",
    "women>dresses>maxi-dresses": "one-piece",
    "women>rompers-+-jumpsuits": "one-piece",

    // SHOES
    "women>shoes": "shoes",
    "women>shoes>boots-+-booties": "shoes",
    "women>shoes>flats": "shoes",
    "women>shoes>heels-+-wedges": "shoes",
    "women>shoes>sandals-+-flip-flops": "shoes",
    "women>shoes>sneakers": "shoes"
  };
  
  if (breadcrumbMapping[normalized]) {
    return breadcrumbMapping[normalized];
  }
  
  // THIRD: Fallback to keyword matching (ASOS-style)
  const breadcrumbLower = breadcrumb.toLowerCase();
  
  // One-piece items
  if (breadcrumbLower.includes('dresses') || 
      breadcrumbLower.includes('rompers') || 
      breadcrumbLower.includes('jumpsuits')) {
    return 'one-piece';
  }
  
  // Shoes
  if (breadcrumbLower.includes('shoes') || 
      breadcrumbLower.includes('boots') ||
      breadcrumbLower.includes('sandals') ||
      breadcrumbLower.includes('sneakers') ||
      breadcrumbLower.includes('heels') ||
      breadcrumbLower.includes('flats')) {
    return 'shoes';
  }
  
  // Bottoms (including activewear leggings)
  if (breadcrumbLower.includes('bottoms') || 
      breadcrumbLower.includes('jeans') ||
      breadcrumbLower.includes('pants') ||
      breadcrumbLower.includes('shorts') ||
      breadcrumbLower.includes('skirts') ||
      breadcrumbLower.includes('leggings')) {
    return 'bottoms';
  }
  
  // Tops (default for most clothing)
  return 'tops';
}

// Fetch products from Shopify products.json API with fallback handles
async function fetchShopifyProducts(collectionHandle, page = 1, limit = 250) {
  // Try multiple collection handle patterns
  const handleVariations = [
    collectionHandle,                                    // womens-shirts
    collectionHandle.replace('womens-', 'women-'),      // women-shirts
    collectionHandle.replace('womens-', ''),            // shirts
    `womens-clothing-${collectionHandle.replace('womens-', '')}` // womens-clothing-shirts
  ];
  
  for (const handle of handleVariations) {
    const url = `https://www.forever21.com/collections/${handle}/products.json?limit=${limit}&page=${page}`;
    
    try {
      console.log(`[v0] Trying collection URL: ${url}`);
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
  
  console.error(`[Forever21] No products found for any variation of: ${collectionHandle}`);
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

// Extract all sizes from variants
function extractSizes(variants) {
  if (!variants || variants.length === 0) return '';
  
  const sizes = variants
    .map(v => {
      // Check for size in option1, option2, or option3
      return v.option1 || v.option2 || v.option3 || v.title;
    })
    .filter(Boolean)
    .filter(size => {
      // Filter out color values, keep actual sizes
      const sizeLower = size.toLowerCase();
      return !sizeLower.includes('black') && 
             !sizeLower.includes('white') && 
             !sizeLower.includes('blue') &&
             !sizeLower.includes('red') &&
             !sizeLower.includes('green');
    });
  
  // Remove duplicates and join
  return [...new Set(sizes)].join(', ');
}

// Extract colors from variants and options
function extractColors(shopifyProduct) {
  const colors = new Set();
  
  // Check product options for color
  if (shopifyProduct.options) {
    shopifyProduct.options.forEach(option => {
      if (option.name && option.name.toLowerCase().includes('color')) {
        if (option.values) {
          option.values.forEach(val => colors.add(val));
        }
      }
    });
  }
  
  // Check variants
  if (shopifyProduct.variants) {
    shopifyProduct.variants.forEach(variant => {
      const colorOption = variant.option1 || variant.option2 || variant.option3;
      if (colorOption) {
        const colorLower = colorOption.toLowerCase();
        // Add if it looks like a color
        if (colorLower.includes('black') || colorLower.includes('white') || 
            colorLower.includes('blue') || colorLower.includes('red') ||
            colorLower.includes('pink') || colorLower.includes('green') ||
            colorLower.includes('grey') || colorLower.includes('gray') ||
            colorLower.includes('beige') || colorLower.includes('brown')) {
          colors.add(colorOption);
        }
      }
    });
  }
  
  return colors.size > 0 ? [...colors].join(', ') : 'Not specified';
}

// Extract materials from description or tags
function extractMaterials(shopifyProduct) {
  const description = shopifyProduct.body_html || '';
  const tags = shopifyProduct.tags || [];
  
  // Common material keywords
  const materialKeywords = ['cotton', 'polyester', 'spandex', 'rayon', 'nylon', 
                           'silk', 'wool', 'leather', 'denim', 'linen', 'viscose'];
  
  const materials = new Set();
  
  // Check tags
  tags.forEach(tag => {
    const tagLower = tag.toLowerCase();
    materialKeywords.forEach(keyword => {
      if (tagLower.includes(keyword)) {
        materials.add(keyword.charAt(0).toUpperCase() + keyword.slice(1));
      }
    });
  });
  
  // Check description
  const descLower = description.toLowerCase();
  materialKeywords.forEach(keyword => {
    if (descLower.includes(keyword)) {
      materials.add(keyword.charAt(0).toUpperCase() + keyword.slice(1));
    }
  });
  
  return materials.size > 0 ? [...materials].join(', ') : null;
}

// Transform Shopify product data to match ASOS database schema EXACTLY
function transformShopifyProduct(shopifyProduct, categoryPath, categoryBreadcrumb, collectionHandle) {
  const variant = shopifyProduct.variants?.[0] || {};
  const allVariants = shopifyProduct.variants || [];
  
  // Get outfit category using dual mapping (URL + breadcrumb)
  const outfitCategory = getOutfitCategoryFromBreadcrumb(categoryBreadcrumb, collectionHandle);
  
  // Extract gender from category path
  const pathParts = normalizeCategoryPath(categoryPath);
  const section = pathParts[0] === 'women' ? 'Women' : 
                  pathParts[0] === 'men' ? 'Men' : 
                  pathParts[0] === 'plus' ? 'Women' : 'Women';
  
  // Get product family from breadcrumb (last part)
  const breadcrumbParts = categoryBreadcrumb.split(' > ');
  const productFamily = breadcrumbParts[breadcrumbParts.length - 1]?.toUpperCase() || 'GENERAL';
  const productFamilyEn = breadcrumbParts[breadcrumbParts.length - 1] || 'General';
  
  // Clean description (remove HTML tags)
  const cleanDescription = shopifyProduct.body_html
    ? shopifyProduct.body_html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    : null;
  
  // Extract materials
  const materials = extractMaterials(shopifyProduct);
  
  // Get all colors
  const colors = extractColors(shopifyProduct);
  
  // Get all sizes
  const sizes = extractSizes(allVariants);
  
  // Check stock status
  const availability = allVariants.some(v => v.available !== false);
  const totalInventory = allVariants.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0);
  const lowOnStock = totalInventory > 0 && totalInventory < 10;
  
  return {
    // Product identification
    product_id: shopifyProduct.id?.toString() || `f21-${Date.now()}`,
    product_name: shopifyProduct.title || 'Unknown Product',
    brand: 'Forever 21',
    
    // Category information (matching ASOS structure)
    category_name: categoryBreadcrumb,
    outfit_category: outfitCategory,
    category_id: shopifyProduct.product_type || null,
    section: section,
    product_family: productFamily,
    product_subfamily: null,
    product_family_en: productFamilyEn,
    clothing_category: shopifyProduct.product_type || null,
    
    // Pricing
    price: parseFloat(variant.price) || 0,
    currency: '$',
    
    // Product details
    colour: colors,
    colour_code: variant.id?.toString() || '',
    size: sizes,
    description: cleanDescription,
    materials_description: materials,
    dimension: null,
    
    // Availability
    low_on_stock: lowOnStock,
    availability: availability,
    sku: variant.sku || null,
    
    // URLs and images
    url: `https://www.forever21.com/products/${shopifyProduct.handle}`,
    image: shopifyProduct.images?.map(img => ({ url: normalizeImageUrl(img.src) })) || [],
    images: shopifyProduct.images?.map(img => ({ url: normalizeImageUrl(img.src) })) || [],
    
    // Source information
    source: 'forever21',
    source_priority: 3,
    sync_method: 'Forever21 Shopify API',
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

// Main scraping function for Forever 21
export async function scrapeForever21(
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
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
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
        const product = transformShopifyProduct(shopifyProduct, categoryPath, categoryBreadcrumb, collectionHandle);
        
        // Validate product (matching ASOS validation)
        if (!isValidProduct(product)) {
          console.log(`[v0] Skipping invalid product: ${product.product_name}`);
          broadcastProgress({
            type: 'warning',
            message: `Skipped invalid product: ${product.product_name}`,
            category: categoryPath
          });
          continue;
        }
        
        // Check if product already exists to track updates vs new adds
        const { data: existingProduct } = await supabase
          .from('clean_scraper')
          .select('product_id')
          .eq('product_id', product.product_id)
          .single();
        
        const isUpdate = !!existingProduct;
        
        // Save to database using UPSERT (same as ASOS - prevents duplicates by product_id)
        const { data, error } = await supabase
          .from('clean_scraper')
          .upsert(product, { 
            onConflict: 'product_id',
            ignoreDuplicates: false 
          })
          .select()
          .single();

        if (error) throw error;

        results.successful.push(product);
        
        // Update cron stats (matching ASOS logic)
        if (currentCronStats) {
          if (isUpdate) {
            currentCronStats.productsUpdated = (currentCronStats.productsUpdated || 0) + 1;
          } else {
            currentCronStats.productsAdded = (currentCronStats.productsAdded || 0) + 1;
          }
        }

        broadcastProgress({
          type: 'info',
          message: `${isUpdate ? 'Updated' : 'Saved'}: ${product.product_name} (${i + 1}/${productsToScrape.length})`,
          category: categoryPath
        });

      } catch (error) {
        results.failed.push({
          product: shopifyProduct.title,
          error: error.message
        });

        // Update failed count in cron stats
        if (currentCronStats) {
          currentCronStats.productsFailed = (currentCronStats.productsFailed || 0) + 1;
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

export { FOREVER21_CATEGORIES, getOutfitCategoryFromBreadcrumb, buildForever21CategoryBreadcrumb };
