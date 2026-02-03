import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// MANGO US Women's Category Taxonomy (Verified 2025/2026)
const MANGO_CATEGORIES = {
  women: {
    name: "Women",
    url: "/us/en/women/",
    subcategories: {
      clothing: {
        name: "Clothing",
        url: "/us/en/c/women/clothing_e38a534b",
        subcategories: {
          tops: {
            name: "Tops",
            url: "/us/en/c/women/tops_227371cd",
            subcategories: {
              "shirts-&-blouses": { name: "Shirts & Blouses", url: "/us/en/c/women/shirts---blouses_b8003173" },
              "t-shirts": { name: "T-Shirts", url: "/us/en/c/women/t-shirts_8e23bdfb" },
              "tops": { name: "Tops", url: "/us/en/c/women/tops_227371cd" },
              "sweatshirts": { name: "Sweatshirts", url: "/us/en/c/women/sweatshirts_f6d1a951" },
              "sweaters-&-cardigans": { name: "Sweaters & Cardigans", url: "/us/en/c/women/sweaters-and-cardigans_f9a8c868" },
              "jackets-&-blazers": { name: "Jackets & Blazers", url: "/us/en/c/women/jackets_5ef3ad3b" }
            }
          },
          bottoms: {
            name: "Bottoms",
            url: "/us/en/c/women/pants_0bf28b3b",
            subcategories: {
              "pants-&-trousers": { name: "Pants", url: "/us/en/c/women/pants_0bf28b3b" },
              jeans: {
                name: "Jeans",
                url: "/us/en/c/women/jeans_164d8c42",
                subcategories: {
                  "wide-leg": { name: "Wide-Leg", url: "/us/en/c/women/jeans/wide-leg_wideleg" },
                  "straight": { name: "Straight", url: "/us/en/c/women/jeans/straight_straight" },
                  "mom": { name: "Mom", url: "/us/en/c/women/jeans/mom_mom" },
                  "balloon": { name: "Balloon", url: "/us/en/c/women/jeans/balloon_balloon" },
                  "flare-bootcut": { name: "Flare / Bootcut", url: "/us/en/c/women/jeans/flare-bootcut_flare" },
                  "skinny-slim": { name: "Skinny / Slim", url: "/us/en/c/women/jeans/skinny-slim_skinny" },
                  "maternity": { name: "Maternity", url: "/us/en/c/women/jeans/maternity_maternity" }
                }
              },
              "skirts": { name: "Skirts", url: "/us/en/c/women/skirts_a1a0d939" },
              "shorts": { name: "Shorts", url: "/us/en/c/women/shorts_151e18f1" }
            }
          },
          "one-piece": {
            name: "One-Piece Outfits",
            url: "/us/en/c/women/dresses-and-jumpsuits_e6bb8705",
            subcategories: {
              "dresses": { name: "Dresses", url: "/us/en/c/women/dresses-and-jumpsuits/dresses_b4864b2e" },
              "jumpsuits": { name: "Jumpsuits", url: "/us/en/c/women/dresses-and-jumpsuits/jumpsuits_12759734" }
            }
          }
        }
      },
      shoes: {
        name: "Shoes",
        url: "/us/en/c/women/shoes_826dba0a",
        subcategories: {
          "heels": { name: "Heels", url: "/us/en/c/women/shoes/heeled-shoes_48804552" },
          "boots-&-ankle-boots": { name: "Boots & Ankle Boots", url: "/us/en/c/women/shoes/boots-and-ankle-boots_8f9601f5" },
          "sandals": { name: "Sandals", url: "/us/en/c/women/shoes/sandals_142df485" },
          "sneakers": { name: "Sneakers", url: "/us/en/c/women/shoes/sneakers_c12f407e" },
          "flat-shoes": { name: "Flat Shoes", url: "/us/en/c/women/shoes/flat-shoes_4ff26acc" }
        }
      },
      collections: {
        name: "Collections",
        subcategories: {
          "performance": { name: "Performance", url: "/us/en/c/women/performance_61331" },
          "selection": { name: "Selection", url: "/us/en/c/women/selection_62de1770" },
          "office-looks": { name: "Office Looks", url: "/us/en/c/women/office-looks_6e2257e3" }
        }
      }
    }
  }
};

export { MANGO_CATEGORIES };

function randomDelay(min, max) {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function simulateHumanBehavior(page) {
  try {
    await page.mouse.move(Math.random() * 800, Math.random() * 600);
    await randomDelay(500, 1500);
    await page.evaluate(() => window.scrollBy(0, Math.random() * 300));
    await randomDelay(300, 700);
  } catch (e) {
    // Ignore errors
  }
}

export function buildMangoCategoryBreadcrumb(categoryPath) {
  const parts = categoryPath.split('.');
  const breadcrumb = [];
  
  let current = MANGO_CATEGORIES;
  for (const part of parts) {
    if (current[part]) {
      current = current[part];
      breadcrumb.push(current.name || part);
      if (current.subcategories) {
        current = current.subcategories;
      }
    }
  }
  
  return breadcrumb.join(' > ');
}

export function getCategoryPath(categories, path) {
  const parts = path.split('.');
  let current = categories;
  
  for (const part of parts) {
    if (!current[part]) return null;
    current = current[part];
    if (current.subcategories) {
      current = current.subcategories;
    }
  }
  
  return current;
}

// CRITICAL: Handle cookies popup (appears FIRST)
async function handleCookiesPopup(page, broadcastProgress) {
  try {
    broadcastProgress({
      type: 'info',
      message: '🍪 Checking for cookies popup...'
    });
    
    await randomDelay(2000, 3000);
    
    // Click "Accept all" cookies button
    const cookiesAccepted = await page.evaluate(() => {
      const acceptAllButton = document.querySelector('button#cookies\\.button\\.acceptAll');
      if (acceptAllButton) {
        acceptAllButton.click();
        return true;
      }
      return false;
    });
    
    if (cookiesAccepted) {
      broadcastProgress({
        type: 'success',
        message: '✓ Accepted cookies'
      });
      await randomDelay(2000, 3000);
    }
  } catch (e) {
    // Cookies popup might not appear
  }
}

// CRITICAL: Handle country/language popup (appears SECOND)
async function handleCountryPopup(page, broadcastProgress) {
  try {
    broadcastProgress({
      type: 'info',
      message: '🌍 Checking for country popup...'
    });
    
    await randomDelay(2000, 3000);
    
    // Check if country popup exists and click Accept
    const acceptButtonClicked = await page.evaluate(() => {
      const acceptButton = document.querySelector('button#changeCountryAccept');
      if (acceptButton) {
        acceptButton.click();
        return true;
      }
      return false;
    });
    
    if (acceptButtonClicked) {
      broadcastProgress({
        type: 'success',
        message: '✓ Accepted country popup'
      });
      await randomDelay(2000, 3000);
    }
  } catch (e) {
    // Popup might not appear, continue
  }
}

// Click "Show maximum items" view
async function enableMaximumItemsView(page, broadcastProgress) {
  try {
    broadcastProgress({
      type: 'info',
      message: '🔄 Switching to maximum items view...'
    });
    
    const clicked = await page.evaluate(() => {
      const radio = document.querySelector('input#view-overview[type="radio"]');
      if (radio && !radio.checked) {
        radio.click();
        return true;
      }
      return false;
    });
    
    if (clicked) {
      await randomDelay(2000, 3000);
      broadcastProgress({
        type: 'success',
        message: '✓ Enabled maximum items view'
      });
    }
  } catch (e) {
    broadcastProgress({
      type: 'warning',
      message: 'Could not switch view, continuing...'
    });
  }
}

// Infinite scroll to load ALL products (scroll BEFORE footer to trigger lazy load)
async function loadAllMangoProducts(page, broadcastProgress) {
  let lastCount = 0;
  let stableCount = 0;
  let scrollAttempts = 0;
  const maxStableAttempts = 5;
  const maxScrollAttempts = 100;
  
  broadcastProgress({
    type: 'info',
    message: '📜 Starting infinite scroll...'
  });
  
  while (scrollAttempts < maxScrollAttempts) {
    const currentCount = await page.evaluate(() => {
      const productLinks = document.querySelectorAll('a[href*="/p/women/"][href*="_"]');
      const uniqueUrls = new Set();
      
      productLinks.forEach(link => {
        if (link.href && link.href.includes('/p/')) {
          const cleanUrl = link.href.split('?')[0].split('#')[0];
          uniqueUrls.add(cleanUrl);
        }
      });
      
      return uniqueUrls.size;
    });

    if (currentCount === lastCount) {
      stableCount++;
      if (stableCount >= maxStableAttempts) {
        broadcastProgress({
          type: 'success',
          message: `✓ Scroll complete - ${currentCount} products`
        });
        break;
      }
    } else {
      stableCount = 0;
    }
    
    lastCount = currentCount;

    // FIXED: Scroll by VIEWPORT HEIGHT to cover more distance
    // This ensures we scroll enough to reach the lazy load trigger point
    await page.evaluate(async () => {
      const viewportHeight = window.innerHeight;
      
      // Get current scroll position
      const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
      
      // Scroll down by 2 viewport heights (big scroll for large pages)
      const scrollDistance = viewportHeight * 2;
      
      window.scrollTo({
        top: currentScroll + scrollDistance,
        behavior: 'smooth'
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Scroll up a bit to trigger intersection observer
      window.scrollBy({
        top: -300,
        behavior: 'smooth'
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Scroll back down to trigger more loading
      window.scrollBy({
        top: 400,
        behavior: 'smooth'
      });
    });

    broadcastProgress({
      type: 'progress',
      message: `Scrolling ${scrollAttempts + 1} | Products: ${currentCount} | Stable: ${stableCount}/${maxStableAttempts}`
    });

    await randomDelay(3000, 4500);
    scrollAttempts++;
    
    if (scrollAttempts % 10 === 0) {
      broadcastProgress({
        type: 'info',
        message: `Checkpoint: ${scrollAttempts} scrolls, ${currentCount} products loaded...`
      });
      await sleep(5000);
    }
  }
  
  return lastCount;
}

// Scrape single product
async function scrapeMangoProduct(browser, link, index, total, categoryInfo, broadcastProgress, currentCronStats) {
  const page = await browser.newPage();
  
  try {
    broadcastProgress({
      type: 'progress',
      message: `[${index + 1}/${total}] Scraping...`,
      progress: {
        current: index + 1,
        total: total,
        percentage: Math.round(((index + 1) / total) * 100)
      }
    });
    
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
    });

    await page.goto(link, { waitUntil: "domcontentloaded", timeout: 60000 });
    await randomDelay(2000, 4000);
    
    // Handle popups on product page too
    await handleCookiesPopup(page, () => {});
    await handleCountryPopup(page, () => {});

    const data = await page.evaluate(() => {
      const safeText = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        return el.innerText?.trim() || el.textContent?.trim() || null;
      };

      const name = safeText('h1[itemprop="name"]') || safeText('h1') || document.title.split('|')[0].trim();
      
      // Extract price from meta tag or visible text
      const priceMetaEl = document.querySelector('meta[itemprop="price"]');
      const priceText = priceMetaEl ? priceMetaEl.getAttribute('content') : 
        (safeText('[data-testid="current-price"]') || safeText('.current-price') || safeText('[itemprop="offers"]'));
      
      const currencyMetaEl = document.querySelector('meta[itemprop="priceCurrency"]');
      const currencyCode = currencyMetaEl ? currencyMetaEl.getAttribute('content') : null;
      const currency = currencyCode === 'USD' ? '$' : (priceText?.match(/[£$€]/)?.[0] || '$');
      const priceValue = priceText ? parseFloat(priceText.replace(/[^\d.]/g, "")) : null;

      const images = Array.from(document.querySelectorAll('img[src*="mango.com/assets/rcs/pics"]'))
        .map((img) => {
          let src = img.src || img.getAttribute('data-src');
          if (src && src.includes('mango.com/assets/rcs/pics/static')) {
            if (img.width < 100 || img.height < 100) return null;
            src = src.split('?')[0];
            return `${src}?im=SmartCrop,width=2048,height=2867&imdensity=1`;
          }
          return null;
        })
        .filter(src => src !== null)
        .filter((v, i, a) => a.indexOf(v) === i);

      // Extract sizes from the size selector buttons
      const sizeButtons = Array.from(document.querySelectorAll('.SizeItem_sizeItem__7ViPk span.textActionM_className__8McJk, button[class*="SizeItem"] span[class*="textAction"]'));
      const sizes = sizeButtons
        .map(el => el.textContent?.trim())
        .filter(Boolean)
        .filter(s => s.length <= 5 && !s.includes('Not available'))
        .filter((v, i, a) => a.indexOf(v) === i);

      const colorElements = document.querySelectorAll('[class*="Color"] button img, [data-testid*="color"] img');
      const colors = Array.from(colorElements)
        .map(img => img.getAttribute('alt') || img.getAttribute('title'))
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i);

      const selectedColorEl = document.querySelector('[class*="Color"] button[class*="selected"] img');
      const colour = selectedColorEl?.getAttribute('alt') || selectedColorEl?.getAttribute('title') || (colors.length > 0 ? colors[0] : null);

      // Extract description from multiple possible locations
      let description = null;
      const descriptionEl = document.querySelector('[data-testid="product-description"]') || 
        document.querySelector('.Description_descriptionContent__pCRwU') ||
        document.querySelector('[class*="Description_description"]');
      
      if (descriptionEl) {
        description = descriptionEl.textContent
          .replace('DESCRIPTION', '')
          .replace('Description', '')
          .trim();
      }

      const compositionText = Array.from(document.querySelectorAll('*'))
        .find(el => el.textContent.includes('Composition:'))?.textContent;
      const composition = compositionText ? 
        compositionText.split('Composition:')[1]?.split('Care')[0]?.trim() : null;

      const outOfStock = !!document.querySelector('[class*="unavailable"], [class*="out-of-stock"]');
      const availability = !outOfStock;
      const lowOnStock = !!document.querySelector('[class*="low-stock"], [class*="few-left"]');

      const product_id = window.location.pathname.match(/_(\d+)$/)?.[1];
      const sku = product_id;

      console.log('=== MANGO PRODUCT ===');
      console.log('ID:', product_id);
      console.log('Name:', name);
      console.log('Price:', priceValue, currency);
      console.log('Images:', images.length);
      console.log('Sizes:', sizes);
      console.log('Colors:', colors);
      console.log('==================');

      return {
        product_id,
        name,
        price: priceValue,
        currency,
        images,
        sizes,
        colors,
        colour,
        description,
        composition,
        availability,
        low_on_stock: lowOnStock,
        sku,
        product_url: window.location.href
      };
    });

    if (!data.product_id) {
      throw new Error('Could not extract product ID');
    }

    if (categoryInfo) {
      data.category_name = categoryInfo.breadcrumb;
    }

    // Get outfit category using breadcrumb (matching ASOS logic)
    const outfitCategory = getOutfitCategoryFromBreadcrumb(categoryInfo?.breadcrumb || 'Women', categoryInfo?.url || '');

    try {
      // Transform to ASOS format for clean_scraper table
      const insertData = {
        product_id: data.product_id,
        product_name: data.name,
        brand: 'Mango',
        category_name: categoryInfo?.breadcrumb || 'Uncategorized',
        outfit_category: outfitCategory,
        category_id: '',
        section: 'women',
        product_family: outfitCategory.toUpperCase(),
        product_subfamily: '',
        product_family_en: categoryInfo?.breadcrumb?.split(' > ')[1] || outfitCategory,
        clothing_category: '',
        
        price: data.price,
        currency: data.currency?.match(/[£$€]/)?.[0] || '$',
        colour: data.colour,
        colour_code: '',
        size: data.sizes && data.sizes.length > 0 ? data.sizes.join(', ') : '',
        description: data.description,
        materials_description: data.composition,
        dimension: '',
        
        low_on_stock: data.low_on_stock || false,
        availability: data.availability || false,
        sku: data.product_id,
        
        url: data.product_url,
        image: data.images && data.images.length > 0 ? data.images.map(url => ({ url })) : [],
        images: data.images && data.images.length > 0 ? data.images : [],
        
        source: 'mango',
        source_priority: 2,
        sync_method: 'Mango Category Scraper',
        last_synced_by: 'automated_scraper',
        is_active: true
      };

      const { data: existingProduct } = await supabase
        .from('clean_scraper')
        .select('id, product_id, price')
        .eq('product_id', insertData.product_id)
        .single();

      const isUpdate = !!existingProduct;
      
      const { error } = await supabase
        .from('clean_scraper')
        .upsert(insertData, { 
          onConflict: 'product_id',
          ignoreDuplicates: false 
        });
      
      if (error) {
        if (currentCronStats) currentCronStats.productsFailed++;
        broadcastProgress({
          type: 'error',
          message: `❌ "${data.name}": ${error.message}`
        });
      } else {
        if (isUpdate) {
          if (currentCronStats) currentCronStats.productsUpdated++;
          broadcastProgress({
            type: 'success',
            message: `♻ Updated "${data.name}" | ${data.sizes?.length || 0} sizes`
          });
        } else {
          if (currentCronStats) currentCronStats.productsAdded++;
          broadcastProgress({
            type: 'success',
            message: `✓ Added "${data.name}" | ${data.sizes?.length || 0} sizes`
          });
        }
      }
    } catch (insertError) {
      broadcastProgress({
        type: 'error',
        message: `DB Error "${data.name}": ${insertError.message}`
      });
    }

    return data;
  } catch (err) {
    broadcastProgress({
      type: 'error',
      message: `Failed [${index + 1}/${total}]: ${err.message}`
    });
    return null;
  } finally {
    await page.close();
  }
}

export async function scrapeMango(
  searchTerm = null,
  categoryPath = null,
  options = { mode: "limit", limit: 5 },
  concurrency = 5,
  broadcastProgress = () => {},
  currentCronStats = null
) {
  const isSearchMode = !!searchTerm;
  const isCategoryMode = !!categoryPath;
  
  if (!isSearchMode && !isCategoryMode) {
    throw new Error('Either searchTerm or categoryPath must be provided');
  }

  if (isSearchMode) {
    broadcastProgress({
      type: 'info',
      message: `🔍 Mango search: "${searchTerm}" (${options.mode})`
    });
  } else {
    const breadcrumb = buildMangoCategoryBreadcrumb(categoryPath);
    broadcastProgress({
      type: 'info',
      message: `🏷️ Mango: "${breadcrumb}" (${options.mode})`
    });
  }

  const browser = await puppeteer.launch({

    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-infobars',
      '--disable-blink-features=AutomationControlled',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-popup-blocking',
      '--disable-translate',
      '--disable-background-media-track',
      '--disable-ipc-flooding-protection',
      '--window-size=1920,1080'
    ],
    ignoreHTTPSErrors: true,
    ignoreDefaultArgs: ['--enable-automation']
  });

  broadcastProgress({
    type: 'success',
    message: '✓ Browser launched'
  });

  const page = await browser.newPage();
  
  try {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    });

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
    });

    let targetUrl;
    let categoryInfo = null;
    
    if (isSearchMode) {
      targetUrl = `https://shop.mango.com/us/en/search/women?q=${encodeURIComponent(searchTerm)}`;
    } else {
      const category = getCategoryPath(MANGO_CATEGORIES, categoryPath);
      
      if (!category || !category.url) {
        throw new Error(`Invalid category path: ${categoryPath}`);
      }
      
      targetUrl = `https://shop.mango.com${category.url}`;
      const breadcrumb = buildMangoCategoryBreadcrumb(categoryPath);
      categoryInfo = { breadcrumb, path: categoryPath };
    }
    
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        await page.goto(targetUrl, {
          waitUntil: "networkidle2",
          timeout: 60000
        });
        break;
      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) throw error;
        await randomDelay(2000, 3000);
      }
    }

    await randomDelay(3000, 5000);
    
    // STEP 1: Handle cookies popup (appears FIRST)
    await handleCookiesPopup(page, broadcastProgress);
    
    // STEP 2: Handle country popup (appears SECOND)
    await handleCountryPopup(page, broadcastProgress);

    broadcastProgress({
      type: 'success',
      message: `✓ Page ready`
    });

    const selectors = [
      'a[href*="/p/women/"][href*="_"]',
      'article[data-testid="plp-product"]'
    ];

    let productSelector = null;
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 15000 });
        productSelector = selector;
        break;
      } catch (e) {
        continue;
      }
    }

    if (!productSelector) {
      throw new Error('No products found');
    }

    broadcastProgress({
      type: 'success',
      message: `✓ Products detected`
    });

    // STEP 3: Enable maximum items view BEFORE scrolling
    await enableMaximumItemsView(page, broadcastProgress);
    await randomDelay(2000, 3000);

    // STEP 4: Load all products for full/range mode (infinite scroll)
    if (options.mode === "full" || options.mode === "range") {
      await loadAllMangoProducts(page, broadcastProgress);
    }

    // STEP 5: Extract ALL product URLs
    const productLinks = await page.evaluate(() => {
      const uniqueUrls = new Set();
      const productElements = document.querySelectorAll('a[href*="/p/women/"][href*="_"]');
      productElements.forEach(el => {
        if (el.href && el.href.includes('/p/')) {
          const cleanUrl = el.href.split('?')[0].split('#')[0];
          uniqueUrls.add(cleanUrl);
        }
      });
      return Array.from(uniqueUrls);
    });

    if (productLinks.length === 0) {
      throw new Error('No product links found');
    }

    broadcastProgress({
      type: 'success',
      message: `✓ Found ${productLinks.length} unique products`
    });

    let finalLinks = productLinks;
    if (options.mode === "limit" && options.limit) {
      finalLinks = productLinks.slice(0, options.limit);
      broadcastProgress({
        type: 'info',
        message: `📊 Limiting to ${finalLinks.length} products`
      });
    } else if (options.mode === "range" && options.startIndex !== undefined && options.endIndex !== undefined) {
      finalLinks = productLinks.slice(options.startIndex, options.endIndex + 1);
      broadcastProgress({
        type: 'info',
        message: `📊 Range: ${options.startIndex + 1} to ${options.endIndex + 1}`
      });
    } else {
      broadcastProgress({
        type: 'info',
        message: `📊 Processing ALL ${finalLinks.length} products`
      });
    }

    broadcastProgress({
      type: 'info',
      message: `🚀 Starting scrape (concurrency: ${concurrency})`
    });

    const results = [];
    for (let i = 0; i < finalLinks.length; i += concurrency) {
      const batch = finalLinks.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map((link, idx) => scrapeMangoProduct(browser, link, i + idx, finalLinks.length, categoryInfo, broadcastProgress, currentCronStats))
      );
      results.push(...batchResults.filter(r => r !== null));
      await sleep(2000);
    }

    await browser.close();
    
    broadcastProgress({
      type: 'success',
      message: `🎉 Completed! ${results.length}/${finalLinks.length} products scraped`
    });

    return results;
  } catch (err) {
    await browser.close();
    broadcastProgress({
      type: 'error',
      message: `Scraping failed: ${err.message}`
    });
    throw err;
  }
}

function getOutfitCategoryFromBreadcrumb(scrapedCategoryName, url) {
  // Normalization logic: "Women > Clothing > Sweaters and cardigans" -> "women>clothing>sweaters-and-cardigans"
  const normalized = scrapedCategoryName
    .split(" > ")
    .map(part => part.toLowerCase().trim().replace(/\s+/g, "-"))
    .join(">");
  
  const categoryMapping = {
    // TOPS (Torso-only, knitwear, and performance tops)
    "women>clothing>tops": "tops",
    "women>clothing>tops>shirts": "tops",
    "women>clothing>tops>shirts-&-blouses": "tops",
    "women>clothing>tops>t-shirts": "tops",
    "women>clothing>tops>sweaters-&-cardigans": "tops",
    "women>clothing>tops>sweatshirts": "tops",
    "women>clothing>tops>jackets-&-blazers": "tops",
    "women>clothing>shirts": "tops",
    "women>clothing>shirts-&-blouses": "tops",
    "women>clothing>t-shirts": "tops",
    "women>clothing>t-shirts-&-tops": "tops",
    "women>clothing>sweaters-&-cardigans": "tops",
    "women>clothing>knitwear": "tops",
    "women>clothing>sweatshirts": "tops",
    "women>clothing>jackets-&-blazers": "tops",
    "women>clothing>blazers": "tops",
    "women>performance>tops": "tops",
    "women>performance>jackets": "tops",
    "women>selection>tops": "tops",
    "women>office-looks>blazers": "tops",

    // BOTTOMS (Waist-down only)
    "women>clothing>bottoms": "bottoms",
    "women>clothing>bottoms>pants": "bottoms",
    "women>clothing>bottoms>pants-&-trousers": "bottoms",
    "women>clothing>bottoms>trousers": "bottoms",
    "women>clothing>bottoms>jeans": "bottoms",
    "women>clothing>bottoms>jeans>wide-leg": "bottoms",
    "women>clothing>bottoms>jeans>straight": "bottoms",
    "women>clothing>bottoms>jeans>mom": "bottoms",
    "women>clothing>bottoms>jeans>balloon": "bottoms",
    "women>clothing>bottoms>jeans>flare-bootcut": "bottoms",
    "women>clothing>bottoms>jeans>flare-/-bootcut": "bottoms",
    "women>clothing>bottoms>jeans>skinny-slim": "bottoms",
    "women>clothing>bottoms>jeans>skinny-/-slim": "bottoms",
    "women>clothing>bottoms>jeans>maternity": "bottoms",
    "women>clothing>bottoms>skirts": "bottoms",
    "women>clothing>bottoms>shorts": "bottoms",
    "women>clothing>pants": "bottoms",
    "women>clothing>trousers": "bottoms",
    "women>clothing>jeans": "bottoms",
    "women>clothing>skirts": "bottoms",
    "women>clothing>shorts": "bottoms",
    "women>clothing>leggings-&-joggers": "bottoms",
    "women>performance>leggings": "bottoms",
    "women>performance>shorts": "bottoms",

    // ONE-PIECE (Standalone garments)
    "women>clothing>one-piece-outfits": "one-piece",
    "women>clothing>one-piece-outfits>dresses": "one-piece",
    "women>clothing>one-piece-outfits>jumpsuits": "one-piece",
    "women>clothing>dresses": "one-piece",
    "women>clothing>dresses-&-jumpsuits": "one-piece",
    "women>clothing>dresses-&-jumpsuits>dresses": "one-piece",
    "women>clothing>dresses-&-jumpsuits>jumpsuits": "one-piece",
    "women>clothing>jumpsuits": "one-piece",
    "women>clothing>jumpsuits-&-playsuits": "one-piece",
    "women>clothing>dresses/rompers": "one-piece",

    // SHOES
    "women>shoes": "shoes",
    "women>shoes>heels": "shoes",
    "women>shoes>boots-&-ankle-boots": "shoes",
    "women>shoes>sandals": "shoes",
    "women>shoes>sneakers": "shoes",
    "women>shoes>flat-shoes": "shoes",
    "women>shoes>loafers": "shoes",
    "women>shoes>leather-shoes": "shoes"
  };
  
  // Return mapped category or default to 'tops'
  return categoryMapping[normalized] || 'tops';
}
