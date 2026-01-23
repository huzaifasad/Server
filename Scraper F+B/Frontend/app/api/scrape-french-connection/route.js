// app/api/scrape-french-connection/route.js
// Comprehensive Shopify Scraper for Next.js App Router

import { NextResponse } from 'next/server';

const BASE_URL = 'https://www.frenchconnection.com';
const DELAY_MS = 800; // Respectful rate limiting
const MAX_RETRIES = 3;

// Helper: Delay between requests
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Retry logic for failed requests
async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ShopifyScraper/1.0)',
          'Accept': 'application/json',
        },
      });
      
      if (response.ok) {
        return await response.json();
      }
      
      // If rate limited, wait longer
      if (response.status === 429) {
        await delay(DELAY_MS * (i + 2));
        continue;
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      if (i === retries - 1) throw error;
      await delay(DELAY_MS * (i + 1));
    }
  }
}

// Fetch all collections
async function fetchCollections() {
  try {
    const data = await fetchWithRetry(`${BASE_URL}/collections.json`);
    return data.collections || [];
  } catch (error) {
    console.error('Error fetching collections:', error);
    return [];
  }
}

// Fetch products from a specific collection with pagination
async function fetchCollectionProducts(collectionHandle, page = 1, limit = 250) {
  try {
    const url = `${BASE_URL}/collections/${collectionHandle}/products.json?page=${page}&limit=${limit}`;
    const data = await fetchWithRetry(url);
    return data.products || [];
  } catch (error) {
    console.error(`Error fetching products from collection ${collectionHandle}, page ${page}:`, error);
    return [];
  }
}

// Fetch ALL products from a collection (auto-paginate)
async function fetchAllProductsFromCollection(collectionHandle) {
  let allProducts = [];
  let page = 1;
  let hasMoreProducts = true;

  console.log(`\n📦 Fetching products from: ${collectionHandle}`);

  while (hasMoreProducts) {
    await delay(DELAY_MS);
    const products = await fetchCollectionProducts(collectionHandle, page, 250);
    
    if (products.length === 0) {
      hasMoreProducts = false;
    } else {
      allProducts = [...allProducts, ...products];
      console.log(`   ✓ Page ${page}: ${products.length} products (Total: ${allProducts.length})`);
      page++;
      
      // Less than 250 means last page
      if (products.length < 250) {
        hasMoreProducts = false;
      }
    }
  }

  console.log(`   ✅ Completed: ${allProducts.length} total products from ${collectionHandle}`);
  return allProducts;
}

// Fetch all products from store (global)
async function fetchAllProducts() {
  let allProducts = [];
  let page = 1;
  let hasMoreProducts = true;

  console.log('\n🌐 Fetching all products from store...');

  while (hasMoreProducts) {
    try {
      await delay(DELAY_MS);
      const url = `${BASE_URL}/products.json?page=${page}&limit=250`;
      const data = await fetchWithRetry(url);
      const products = data.products || [];
      
      if (products.length === 0) {
        hasMoreProducts = false;
      } else {
        allProducts = [...allProducts, ...products];
        console.log(`   ✓ Page ${page}: ${products.length} products (Total: ${allProducts.length})`);
        page++;
        
        if (products.length < 250) {
          hasMoreProducts = false;
        }
      }
    } catch (error) {
      console.error(`Error on page ${page}:`, error);
      hasMoreProducts = false;
    }
  }

  console.log(`   ✅ Completed: ${allProducts.length} total products`);
  return allProducts;
}

// Fetch product by handle
async function fetchProductByHandle(handle) {
  try {
    const url = `${BASE_URL}/products/${handle}.js`;
    const data = await fetchWithRetry(url);
    return data;
  } catch (error) {
    console.error(`Error fetching product ${handle}:`, error);
    return null;
  }
}

// Fetch cart info
async function fetchCart() {
  try {
    const data = await fetchWithRetry(`${BASE_URL}/cart.js`);
    return data;
  } catch (error) {
    console.error('Error fetching cart:', error);
    return null;
  }
}

// Search products
async function searchProducts(query) {
  try {
    const url = `${BASE_URL}/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product`;
    const data = await fetchWithRetry(url);
    return data;
  } catch (error) {
    console.error('Error searching products:', error);
    return null;
  }
}

// Format product data (comprehensive)
function formatProduct(product) {
  if (!product) return null;
  
  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    description: product.body_html,
    descriptionPlain: product.body_html?.replace(/<[^>]*>/g, '').trim() || '',
    vendor: product.vendor,
    productType: product.product_type,
    createdAt: product.created_at,
    updatedAt: product.updated_at,
    publishedAt: product.published_at,
    tags: product.tags ? (Array.isArray(product.tags) ? product.tags : product.tags.split(', ')) : [],
    
    // Variants with full details
    variants: (product.variants || []).map(v => ({
      id: v.id,
      title: v.title,
      price: v.price,
      compareAtPrice: v.compare_at_price,
      sku: v.sku,
      barcode: v.barcode,
      available: v.available,
      inventoryQuantity: v.inventory_quantity,
      inventoryManagement: v.inventory_management,
      inventoryPolicy: v.inventory_policy,
      weight: v.weight,
      weightUnit: v.weight_unit,
      requiresShipping: v.requires_shipping,
      taxable: v.taxable,
      option1: v.option1,
      option2: v.option2,
      option3: v.option3,
      featured_image: v.featured_image,
    })),
    
    // Images
    images: (product.images || []).map(img => ({
      id: img.id,
      src: img.src,
      alt: img.alt || product.title,
      width: img.width,
      height: img.height,
      position: img.position,
    })),
    
    // Options (Size, Color, etc.)
    options: (product.options || []).map(opt => ({
      id: opt.id,
      name: opt.name,
      position: opt.position,
      values: opt.values || [],
    })),
    
    // Pricing
    priceRange: {
      min: product.variants?.length > 0 
        ? Math.min(...product.variants.map(v => parseFloat(v.price) || 0))
        : 0,
      max: product.variants?.length > 0
        ? Math.max(...product.variants.map(v => parseFloat(v.price) || 0))
        : 0,
    },
    
    // Availability
    availableForSale: product.variants?.some(v => v.available) || false,
    totalInventory: product.variants?.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0) || 0,
  };
}

// Format collection data
function formatCollection(collection) {
  return {
    id: collection.id,
    handle: collection.handle,
    title: collection.title,
    description: collection.body_html,
    updatedAt: collection.updated_at,
    published_at: collection.published_at,
    sort_order: collection.sort_order,
    image: collection.image,
  };
}

// Main API Handler
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const collection = searchParams.get('collection');
  const handle = searchParams.get('handle');
  const query = searchParams.get('query');
  const limit = parseInt(searchParams.get('limit') || '250');

  console.log(`\n🚀 API Request: action=${action}, collection=${collection}, handle=${handle}`);

  try {
    switch (action) {
      // ==================== COLLECTIONS ====================
      case 'collections':
        const collections = await fetchCollections();
        return NextResponse.json({
          success: true,
          count: collections.length,
          data: collections.map(formatCollection),
          timestamp: new Date().toISOString(),
        });

      // ==================== COLLECTION PRODUCTS ====================
      case 'collection-products':
        if (!collection) {
          return NextResponse.json(
            { success: false, error: 'Collection handle required' },
            { status: 400 }
          );
        }
        const collectionProducts = await fetchAllProductsFromCollection(collection);
        return NextResponse.json({
          success: true,
          collection: collection,
          count: collectionProducts.length,
          data: collectionProducts.map(formatProduct).filter(Boolean),
          timestamp: new Date().toISOString(),
        });

      // ==================== ALL PRODUCTS ====================
      case 'all-products':
        const allProducts = await fetchAllProducts();
        return NextResponse.json({
          success: true,
          count: allProducts.length,
          data: allProducts.map(formatProduct).filter(Boolean),
          timestamp: new Date().toISOString(),
        });

      // ==================== SINGLE PRODUCT ====================
      case 'product':
        if (!handle) {
          return NextResponse.json(
            { success: false, error: 'Product handle required' },
            { status: 400 }
          );
        }
        const product = await fetchProductByHandle(handle);
        return NextResponse.json({
          success: !!product,
          data: product ? formatProduct(product) : null,
          timestamp: new Date().toISOString(),
        });

      // ==================== SEARCH ====================
      case 'search':
        if (!query) {
          return NextResponse.json(
            { success: false, error: 'Search query required' },
            { status: 400 }
          );
        }
        const searchResults = await searchProducts(query);
        return NextResponse.json({
          success: !!searchResults,
          query: query,
          data: searchResults,
          timestamp: new Date().toISOString(),
        });

      // ==================== CART ====================
      case 'cart':
        const cart = await fetchCart();
        return NextResponse.json({
          success: !!cart,
          data: cart,
          timestamp: new Date().toISOString(),
        });

      // ==================== FULL SCRAPE ====================
      case 'full-scrape':
        console.log('\n🔥 Starting FULL SCRAPE...');
        const allCollections = await fetchCollections();
        const fullData = {};
        let totalProducts = 0;
        
        for (const col of allCollections) {
          const products = await fetchAllProductsFromCollection(col.handle);
          fullData[col.handle] = {
            collection: formatCollection(col),
            productsCount: products.length,
            products: products.map(formatProduct).filter(Boolean),
          };
          totalProducts += products.length;
        }

        console.log(`\n🎉 Full scrape completed!`);
        console.log(`   📚 Collections: ${allCollections.length}`);
        console.log(`   📦 Total Products: ${totalProducts}`);

        return NextResponse.json({
          success: true,
          collectionsCount: allCollections.length,
          totalProducts: totalProducts,
          data: fullData,
          timestamp: new Date().toISOString(),
        });

      // ==================== STATS ====================
      case 'stats':
        const statsCollections = await fetchCollections();
        const statsProducts = await fetchAllProducts();
        
        return NextResponse.json({
          success: true,
          stats: {
            totalCollections: statsCollections.length,
            totalProducts: statsProducts.length,
            collections: statsCollections.map(c => ({
              handle: c.handle,
              title: c.title,
            })),
          },
          timestamp: new Date().toISOString(),
        });

      // ==================== DEFAULT (Help) ====================
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
          availableActions: {
            collections: 'Get all collections',
            'collection-products': 'Get products from specific collection (requires collection param)',
            'all-products': 'Get all products from store',
            product: 'Get single product (requires handle param)',
            search: 'Search products (requires query param)',
            cart: 'Get cart info',
            'full-scrape': 'Scrape everything (collections + all products)',
            stats: 'Get store statistics',
          },
          examples: [
            '/api/scrape-french-connection?action=collections',
            '/api/scrape-french-connection?action=collection-products&collection=womens-clothing',
            '/api/scrape-french-connection?action=all-products',
            '/api/scrape-french-connection?action=product&handle=product-name',
            '/api/scrape-french-connection?action=search&query=dress',
            '/api/scrape-french-connection?action=cart',
            '/api/scrape-french-connection?action=full-scrape',
            '/api/scrape-french-connection?action=stats',
          ],
        }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}