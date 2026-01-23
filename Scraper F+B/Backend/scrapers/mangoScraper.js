import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// MANGO Category Structure
const MANGO_CATEGORIES = {
  women: {
    name: "Women",
    url: "/us/en/h/brandid_she",
    subcategories: {
      clothing: {
        name: "Clothing",
        subcategories: {
          "new-now": { name: "New Now", url: "/us/en/c/women/new-now_56b5c5ed" },
          "coats": { name: "Coats", url: "/us/en/c/women/coats_d1b967bc" },
          "sweaters-cardigans": { name: "Sweaters and Cardigans", url: "/us/en/c/women/sweaters-and-cardigans_f9a8c868" },
          "dresses-jumpsuits": { name: "Dresses and Jumpsuits", url: "/us/en/c/women/dresses-and-jumpsuits_e6bb8705" },
          "jackets": { name: "Jackets", url: "/us/en/c/women/jackets_5ef3ad3b" },
          "jeans": { name: "Jeans", url: "/us/en/c/women/jeans_164d8c42" },
          "pants": { name: "Pants", url: "/us/en/c/women/pants_0bf28b3b" },
          "blazers": { name: "Blazers", url: "/us/en/c/women/blazers_193c791e" },
          "shirts-blouses": { name: "Shirts & Blouses", url: "/us/en/c/women/shirts---blouses_b8003173" },
          "skirts": { name: "Skirts", url: "/us/en/c/women/skirts_a1a0d939" },
          "tops": { name: "Tops", url: "/us/en/c/women/tops_227371cd" },
          "t-shirts": { name: "T-shirts", url: "/us/en/c/women/t-shirts_8e23bdfb" },
          "trench-parkas": { name: "Trench Coats and Parkas", url: "/us/en/c/women/trench-coats-and-parkas_f899ebfd" },
          "leather": { name: "Leather", url: "/us/en/c/women/leather_59141c0c" },
          "vests": { name: "Vests", url: "/us/en/c/women/vests_1fdfca93" },
          "pajamas": { name: "Pajamas", url: "/us/en/c/women/pajamas_1ca642a2" },
          "sweatshirts": { name: "Sweatshirts", url: "/us/en/c/women/sweatshirts_f6d1a951" },
          "shorts": { name: "Shorts", url: "/us/en/c/women/shorts_151e18f1" },
          "bikinis-swimsuits": { name: "Bikinis and Swimsuits", url: "/us/en/c/women/bikinis-and-swimsuits_54542b54" }
        }
      },
      shoes: {
        name: "Shoes",
        url: "/us/en/c/women/shoes_826dba0a",
        subcategories: {
          "all-shoes": { name: "All Shoes", url: "/us/en/c/women/shoes_826dba0a" }
        }
      },
      accessories: {
        name: "Accessories",
        subcategories: {
          "bags": { name: "Bags", url: "/us/en/c/women/bags_8dff98e6" },
          "jewellery": { name: "Jewellery", url: "/us/en/c/women/jewellery_d5323adc" },
          "belts": { name: "Belts", url: "/us/en/c/women/belts_7bbff880" },
          "wallets-cases": { name: "Wallets and Cases", url: "/us/en/c/women/wallets-and-cases_65858faa" },
          "scarves-foulards": { name: "Scarves and Foulards", url: "/us/en/c/women/scarves-and-foulards_749513e4" },
          "caps-gloves": { name: "Caps and Gloves", url: "/us/en/c/women/caps-and-gloves_c21b0bc6" },
          "sunglasses": { name: "Sunglasses", url: "/us/en/c/women/sunglasses_e4a8aa59" },
          "more-accessories": { name: "More Accessories", url: "/us/en/c/women/more-accessories_eaeb913d" },
          "leather-accessories": { name: "Leather Accessories", url: "/us/en/c/women/leather-accessories_bdae6b40" }
        }
      },
      collections: {
        name: "Collections",
        subcategories: {
          "office-looks": { name: "Office Looks", url: "/us/en/c/women/office-looks_6e2257e3" },
          "party-events": { name: "Party and Events", url: "/us/en/c/women/party-and-events_398c749c" },
          "selection": { name: "Selection", url: "/us/en/c/women/selection_62de1770" },
          "maternity-wear": { name: "Maternity Wear", url: "/us/en/c/women/maternity-wear_b8271280" },
          "basics": { name: "Basics", url: "/us/en/c/women/basics_8bd7a852" }
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
      
      const priceText = safeText('[data-testid="current-price"]') || safeText('.current-price');
      const currency = priceText?.match(/[£$€]/)?.[0] || 'USD';
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

      const sizes = Array.from(document.querySelectorAll('button[data-testid*="size"], [class*="Size"] button'))
        .map(el => el.textContent?.trim())
        .filter(Boolean)
        .filter(s => s.length <= 5)
        .filter((v, i, a) => a.indexOf(v) === i);

      const colorElements = document.querySelectorAll('[class*="Color"] button img, [data-testid*="color"] img');
      const colors = Array.from(colorElements)
        .map(img => img.getAttribute('alt') || img.getAttribute('title'))
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i);

      const selectedColorEl = document.querySelector('[class*="Color"] button[class*="selected"] img');
      const colour = selectedColorEl?.getAttribute('alt') || selectedColorEl?.getAttribute('title') || (colors.length > 0 ? colors[0] : null);

      const descriptionEl = document.querySelector('[data-testid="product-description"]');
      const description = descriptionEl ? 
        descriptionEl.textContent.replace('DESCRIPTION', '').trim() : null;

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

    try {
      const insertData = {
        product_id: parseInt(data.product_id),
        size: data.sizes && data.sizes.length > 0 ? data.sizes[0] : '',
        colour_code: '',
        product_name: data.name,
        brand: 'Mango',
        category_name: categoryInfo?.breadcrumb || 'Uncategorized',
        price: data.price,
        currency: data.currency || 'USD',
        colour: data.colour,
        description: data.description,
        materials_description: data.composition,
        low_on_stock: data.low_on_stock || false,
        availability: data.availability || false,
        sku: data.sku,
        url: data.product_url,
        source: 'mango',
        source_priority: 2,
        image: data.images && data.images.length > 0 ? data.images.map(url => ({ url })) : [],
        images: data.images && data.images.length > 0 ? data.images : null,
        care: {},
        materials: data.composition ? [{ type: 'composition', value: data.composition }] : [],
        sync_method: 'Mango Category Scraper',
        last_synced_by: 'automated_scraper',
        is_active: true
      };

      const { data: existingProduct } = await supabase
        .from('zara_cloth_scraper')
        .select('id, product_id, price')
        .eq('product_id', insertData.product_id)
        .single();

      const isUpdate = !!existingProduct;
      
      const { error } = await supabase
        .from('zara_cloth_scraper')
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
    headless: false,
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