import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ASOS Category Structure
const ASOS_CATEGORIES = {
  women: {
    name: "Women",
    url: "/women/",
    subcategories: {
      clothing: {
        name: "Clothing",
        url: "/women/ctas/clothing/cat/?cid=3934",
        subcategories: {
          "t-shirts": { name: "T-Shirts", url: "/women/t-shirts-vests/cat/?cid=4718" },
          "shirts": { name: "Shirts", url: "/women/shirts/cat/?cid=15200" },
          "shirts-blouses": { name: "Blouses", url: "/women/blouses/cat/?cid=15199" },
          "crop-tops": { name: "Crop Tops", url: "/women/top/cat/?cid=15196" },
          "bodysuits": { name: "Bodysuits", url: "/women/top/bodysuits/cat/?cid=11323" },
          "printed-graphic-t-shirts": { name: "Printed & Graphic T-Shirts", url: "/women/tops/printed-graphic-t-shirts/cat/?cid=19825" },
          "crochet-tops": { name: "Crochet Tops", url: "/women/tops/crochet-tops/cat/?cid=51078" },
          "tie-front-tops": { name: "Tie Front Tops", url: "/women/tops/tie-front-tops/cat/?cid=51707" },
          "sequin-tops": { name: "Sequin Tops", url: "/women/tops/sequin-tops/cat/?cid=28014" },
          "evening-tops": { name: "Evening Tops", url: "/women/tops/evening-tops/cat/?cid=11320" },
          "camis": { name: "Camis", url: "/women/tops/camis/cat/?cid=15202" },
          "long-sleeve-tops": { name: "Long Sleeve Tops", url: "/women/tops/long-sleeve-tops/cat/?cid=17334" },
          "lace-tops": { name: "Lace Tops", url: "/women/tops/lace-tops/cat/?cid=20980" },
          "corset-tops": { name: "Corset Tops", url: "/women/tops/corset-tops/cat/?cid=50070" }
        }
      },
      outerwear: {
        name: "Outerwear",
        url: "/women/jackets-coats/cat/?cid=2641",
        subcategories: {
          "blazers": { name: "Blazers", url: "/women/suits-separates/blazers/cat/?cid=11896" },
          "jackets": { name: "Jackets & Coats", url: "/women/jackets-coats/cat/?cid=2641" },
          "knitwear": { name: "Knitwear", url: "/women/knitwear/cat/?cid=2637" }
        }
      },
      bottoms: {
        name: "Bottoms",
        url: "/women/trousers-leggings/cat/?cid=2640",
        subcategories: {
          "jeans": { name: "Jeans & Leggings", url: "/women/jeans/cat/?cid=3630" },
          "trousers": { name: "Trousers", url: "/women/trousers-leggings/cat/?cid=2640" },
          "skirts": { name: "Skirts", url: "/women/skirts/cat/?cid=2639" },
          "shorts": { name: "Shorts", url: "/women/shorts/cat/?cid=9263" }
        }
      },
      dresses: {
        name: "Dresses",
        url: "/women/dresses/cat/?cid=8799",
        subcategories: {
          "casual-dresses": { name: "Casual Dresses", url: "/women/day-dresses/cat/?cid=8799" },
          "party-dresses": { name: "Party Dresses", url: "/women/dresses/party-dresses/cat/?cid=11057" },
          "evening-dresses": { name: "Evening Dresses", url: "/women/going-out-dresses/cat/?cid=8799" },
          "midi-dresses": { name: "Midi Dresses", url: "/women/midi-dresses/cat/?cid=15210" },
          "maxi-dresses": { name: "Maxi Dresses", url: "/women/maxi-dresses/cat/?cid=15156" },
          "mini-dresses": { name: "Mini Dresses", url: "/women/mini-dresses/cat/?cid=15947" }
        }
      }
    }
  },
  shoes: {
    name: "Shoes",
    url: "/women/shoes/cat/?cid=4172",
    subcategories: {
      "trainers": { name: "Trainers", url: "/women/shoes/trainers/cat/?cid=6456" },
      "heels": { name: "Heels", url: "/women/shoes/heels/cat/?cid=6461" },
      "flats": { name: "Flats", url: "/women/shoes/flat-shoes/cat/?cid=6459" },
      "boots": { name: "Boots", url: "/women/shoes/boots/cat/?cid=6455" },
      "sandals": { name: "Sandals", url: "/women/sandals/heeled-sandals/cat/?cid=17169" },
      "wedges": { name: "Wedges", url: "/women/sandals/wedges/cat/?cid=10266" }
    }
  },
  accessories: {
    name: "Accessories",
    url: "/women/accessories/cat/?cid=4210",
    subcategories: {
      "bags": { name: "Bags & Handbags", url: "/women/bags-purses/cat/?cid=8730" },
      "sunglasses": { name: "Sunglasses", url: "/women/sunglasses/cat/?cid=6519" },
      "hair-accessories": { name: "Hair Accessories", url: "/women/accessories/hair-accessories/cat/?cid=11412" },
      "hats-alt": { name: "Hats", url: "/women/accessories/hats/cat/?cid=6449" },
      "gifts": { name: "Gifts", url: "/women/gifts-for-her/cat/?cid=16095" },
      "belts-alt": { name: "Belts", url: "/women/accessories/belts/cat/?cid=6448" },
      "caps": { name: "Caps", url: "/women/accessories/hats/caps/cat/?cid=25407" },
      "scarves-alt": { name: "Scarves", url: "/women/accessories/scarves/cat/?cid=6452" },
      "socks-tights": { name: "Socks & Tights", url: "/women/socks-tights/cat/?cid=7657" }
    }
  },
  men: {
    name: "Men",
    url: "/men/",
    subcategories: {
      clothing: {
        name: "Clothing",
        url: "/men/ctas/clothing/cat/?cid=1059",
        subcategories: {
          tops: {
            name: "Tops",
            url: "/men/t-shirts-vests/cat/?cid=7616",
            subcategories: {
              "t-shirts": { name: "T-Shirts & Vests", url: "/men/t-shirts-vests/cat/?cid=7616" },
              "shirts": { name: "Shirts", url: "/men/shirts/cat/?cid=3602" },
              "polo-shirts": { name: "Polo Shirts", url: "/men/polo-shirts/cat/?cid=4616" },
              "hoodies": { name: "Hoodies & Sweatshirts", url: "/men/hoodies-sweatshirts/cat/?cid=5668" },
              "knitwear": { name: "Knitwear", url: "/men/knitwear/cat/?cid=7617" },
              "tank-tops": { name: "Tank Tops", url: "/men/vest-tops/cat/?cid=13210" }
            }
          },
          bottoms: {
            name: "Bottoms",
            url: "/men/trousers-chinos/cat/?cid=4910",
            subcategories: {
              "jeans": { name: "Jeans", url: "/men/jeans/cat/?cid=4208" },
              "trousers": { name: "Trousers & Chinos", url: "/men/trousers-chinos/cat/?cid=4910" },
              "shorts": { name: "Shorts", url: "/men/shorts/cat/?cid=7078" },
              "joggers": { name: "Joggers", url: "/men/joggers/cat/?cid=26090" },
              "cargo-pants": { name: "Cargo Pants", url: "/men/cargo-trousers/cat/?cid=18797" }
            }
          },
          outerwear: {
            name: "Jackets & Coats",
            url: "/men/jackets-coats/cat/?cid=3606",
            subcategories: {
              "jackets": { name: "Jackets", url: "/men/jackets/cat/?cid=3606" },
              "coats": { name: "Coats", url: "/men/coats/cat/?cid=12181" },
              "blazers": { name: "Blazers", url: "/men/blazers/cat/?cid=12103" },
              "bombers": { name: "Bomber Jackets", url: "/men/bomber-jackets/cat/?cid=13210" }
            }
          }
        }
      },
      shoes: {
        name: "Shoes",
        url: "/men/shoes/cat/?cid=4209",
        subcategories: {
          "trainers": { name: "Trainers", url: "/men/trainers/cat/?cid=5775" },
          "boots": { name: "Boots", url: "/men/boots/cat/?cid=4212" },
          "formal-shoes": { name: "Formal Shoes", url: "/men/formal-shoes/cat/?cid=5770" },
          "casual-shoes": { name: "Casual Shoes", url: "/men/casual-shoes/cat/?cid=1935" },
          "sandals": { name: "Sandals & Flip Flops", url: "/men/sandals-flip-flops/cat/?cid=4213" }
        }
      },
      accessories: {
        name: "Accessories",
        url: "/men/accessories/cat/?cid=4210",
        subcategories: {
          "bags": { name: "Bags", url: "/men/bags/cat/?cid=9265" },
          "belts": { name: "Belts", url: "/men/belts/cat/?cid=4251" },
          "hats": { name: "Hats & Caps", url: "/men/hats-caps/cat/?cid=6102" },
          "watches": { name: "Watches", url: "/men/watches/cat/?cid=4252" },
          "jewelry": { name: "Jewelry", url: "/men/jewelry/cat/?cid=4253" },
          "sunglasses": { name: "Sunglasses", url: "/men/sunglasses/cat/?cid=6519" }
        }
      }
    }
  }
};

// Export categories and functions
export { ASOS_CATEGORIES };

export function buildCategoryBreadcrumb(categoryPath) {
  const parts = categoryPath.split('.');
  const breadcrumb = [];
  
  let current = ASOS_CATEGORIES;
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

// Helper functions
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

async function expandAccordions(page) {
  try {
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button[aria-expanded="false"]');
      buttons.forEach(btn => {
        try {
          btn.click();
        } catch (e) {}
      });
    });
    await randomDelay(500, 1000);
  } catch (e) {
    // Ignore errors
  }
}

// Main ASOS scraper function
export async function scrapeASOS(
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
      message: `Starting search scraper for "${searchTerm}" in ${options.mode} mode...`
    });
  } else {
    const categoryInfo = getCategoryPath(ASOS_CATEGORIES, categoryPath);
    const breadcrumb = buildCategoryBreadcrumb(categoryPath);
    broadcastProgress({
      type: 'info',
      message: `Starting category scraper for "${breadcrumb}" in ${options.mode} mode...`
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
    message: 'Browser launched successfully'
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
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
    });

    broadcastProgress({
      type: 'info',
      message: 'Navigating to ASOS homepage...'
    });
    
    // Navigation with retry logic
    let navigationSuccess = false;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (!navigationSuccess && retryCount < maxRetries) {
      try {
        await page.goto('https://www.asos.com', {
          waitUntil: "networkidle2",
          timeout: 60000
        });
        navigationSuccess = true;
      } catch (error) {
        retryCount++;
        if (retryCount < maxRetries) {
          await randomDelay(2000, 3000);
        } else {
          throw new Error(`Failed to navigate after ${maxRetries} attempts: ${error.message}`);
        }
      }
    }
    
    await randomDelay(2000, 4000);
    await simulateHumanBehavior(page);
    
    let targetUrl;
    let categoryInfo = null;
    
    if (isSearchMode) {
      targetUrl = `https://www.asos.com/search/?q=${encodeURIComponent(searchTerm)}`;
      broadcastProgress({
        type: 'info',
        message: `Navigating to search page for "${searchTerm}"...`
      });
    } else {
      const category = getCategoryPath(ASOS_CATEGORIES, categoryPath);
      
      if (!category || !category.url) {
        throw new Error(`Invalid category path: ${categoryPath}. Category not found in ASOS_CATEGORIES.`);
      }
      
      targetUrl = `https://www.asos.com${category.url}`;
      const breadcrumb = buildCategoryBreadcrumb(categoryPath);
      categoryInfo = { breadcrumb, path: categoryPath };
      
      broadcastProgress({
        type: 'info',
        message: `Navigating to category page: "${breadcrumb}"...`
      });
    }
    
    // Navigate to target URL
    navigationSuccess = false;
    retryCount = 0;
    
    while (!navigationSuccess && retryCount < maxRetries) {
      try {
        await page.goto(targetUrl, {
          waitUntil: "networkidle2",
          timeout: 60000
        });
        navigationSuccess = true;
      } catch (error) {
        retryCount++;
        if (retryCount < maxRetries) {
          await randomDelay(2000, 3000);
        } else {
          throw new Error(`Failed to navigate to category after ${maxRetries} attempts: ${error.message}`);
        }
      }
    }

    await randomDelay(3000, 5000);
    await simulateHumanBehavior(page);

    const currentUrl = page.url();
    broadcastProgress({
      type: 'info',
      message: `Successfully navigated to: ${currentUrl}`
    });
    
    if (currentUrl.includes('blocked') || currentUrl.includes('captcha')) {
      throw new Error('Page appears to be blocked or showing captcha');
    }

    // Find product tiles
    const selectors = [
      'li.productTile_U0clN',
      '[data-testid="product-tile"]',
      '.product-tile',
      'article[data-testid="product-tile"]',
      '.product',
      '[data-auto-id="productTile"]'
    ];

    let productSelector = null;
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 15000 });
        productSelector = selector;
        broadcastProgress({
          type: 'success',
          message: `Found products using selector: ${selector}`
        });
        break;
      } catch (e) {
        broadcastProgress({
          type: 'warning',
          message: `Selector ${selector} not found, trying next...`
        });
      }
    }

    if (!productSelector) {
      throw new Error('Could not find product tiles with any selector');
    }

    // Load all products if needed
    if (options.mode === "full" || options.mode === "range") {
      await loadAllProducts(page, broadcastProgress);
    }

    // Extract product links
    const linkSelectors = [
      `${productSelector} a.productLink_KM4PI`,
      `${productSelector} a[href*="/prd/"]`,
      `${productSelector} a[data-testid="product-link"]`,
      `${productSelector} a`
    ];
    
    let productLinks = [];
    for (const linkSel of linkSelectors) {
      try {
        productLinks = await page.$$eval(linkSel, (links) =>
          links.map((a) => a.href).filter(href => href && href.includes('/prd/'))
        );
        if (productLinks.length > 0) {
          broadcastProgress({
            type: 'success',
            message: `Found ${productLinks.length} product links`
          });
          break;
        }
      } catch (e) {}
    }

    if (productLinks.length === 0) {
      const allPrdLinks = await page.evaluate(() => {
        const links = [];
        const allAs = document.querySelectorAll('a');
        allAs.forEach(a => {
          if (a.href && (a.href.includes('/prd/') || a.href.match(/\/[\w-]+\/[\w-]+\/prd\/\d+/))) {
            links.push(a.href);
          }
        });
        return [...new Set(links)];
      });
      
      if (allPrdLinks.length > 0) {
        productLinks = allPrdLinks;
      }
    }

    if (productLinks.length === 0) {
      throw new Error('No product links found');
    }

    productLinks = [...new Set(productLinks)];

    let finalLinks = productLinks;
    if (options.mode === "limit" && options.limit) {
      finalLinks = productLinks.slice(0, options.limit);
    } else if (options.mode === "range" && options.startIndex !== undefined && options.endIndex !== undefined) {
      finalLinks = productLinks.slice(options.startIndex, options.endIndex + 1);
    }

    broadcastProgress({
      type: 'info',
      message: `Scraping ${finalLinks.length} products with concurrency: ${concurrency}`
    });

    const results = [];
    for (let i = 0; i < finalLinks.length; i += concurrency) {
      const batch = finalLinks.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map((link, idx) => scrapeProduct(browser, link, i + idx, finalLinks.length, categoryInfo, broadcastProgress, currentCronStats))
      );
      results.push(...batchResults.filter(r => r !== null));
      await sleep(2000);
    }

    await browser.close();
    
    broadcastProgress({
      type: 'success',
      message: `Scraping completed! Scraped ${results.length} products successfully.`
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

// Load all products helper (FIXED: Now handles ASOS infinite scroll properly)
async function loadAllProducts(page, broadcastProgress) {
  let lastCount = 0, clicks = 0, noChangeCount = 0;
  
  broadcastProgress({
    type: 'info',
    message: 'Loading all products from category...'
  });
  
  while (noChangeCount < 3) { // Try 3 times even if count doesn't change
    const currentCount = await page
      .$$eval("li.productTile_U0clN, [data-testid='product-tile']", els => els.length)
      .catch(() => 0);

    if (currentCount === lastCount) {
      noChangeCount++;
      broadcastProgress({
        type: 'warning',
        message: `No new products loaded (${noChangeCount}/3 attempts). Current: ${currentCount}`
      });
    } else {
      noChangeCount = 0; // Reset counter when products load
      lastCount = currentCount;
    }

    // Try to scroll to bottom first (ASOS uses infinite scroll)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await randomDelay(2000, 3000);

    // Then look for load more button
    const btn = await page.$(
      "a.loadButton_wWQ3F, [data-auto-id='loadMoreProducts'], [data-testid='load-more-button'], button[class*='load'], button[class*='more']"
    );

    if (btn) {
      clicks++;
      broadcastProgress({
        type: 'progress',
        message: `Loading more products... (Click ${clicks} - Total visible: ${currentCount})`
      });

      try {
        await btn.click();
        await randomDelay(3000, 5000);
      } catch (e) {
        broadcastProgress({
          type: 'warning',
          message: `Load more button click failed: ${e.message}`
        });
      }
    } else {
      // No button found, just scroll and wait
      await randomDelay(2000, 3000);
    }
  }
  
  broadcastProgress({
    type: 'success',
    message: `Finished loading all products. Total visible: ${lastCount}`
  });
}

// Scrape single product
async function scrapeProduct(browser, link, index, total, categoryInfo = null, broadcastProgress = () => {}, currentCronStats = null) {
  const page = await browser.newPage();
  
  try {
    broadcastProgress({
      type: 'progress',
      message: `Scraping product ${index + 1} of ${total}...`,
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
    
    // Expand accordions to access all data
    const expandAccordions = async (page) => {
      const accordions = await page.$$("button[data-testid='accordion-header']");
      for (const accordion of accordions) {
        await accordion.click();
        await randomDelay(1000, 2000);
      }
    };
    
    await expandAccordions(page);
    
    // Extract complete product data from page (restored from old working scraper)
    const data = await page.evaluate(() => {
      const safeText = (sel) => document.querySelector(sel)?.innerText?.trim() || null;
      
      const name = safeText("h1[data-testid='product-title']") || document.title.split("|")[0].trim();
      
      const price = safeText("[data-testid='current-price']");
      const currency = price?.match(/[£$€]/)?.[0] || null;
      const priceValue = price ? parseFloat(price.replace(/[^\d.]/g, "")) : null;
      
      const stock_status = safeText("[data-testid='stock-availability']") || "Available";
      const availability = !stock_status.toLowerCase().includes('out of stock') &&
                           !stock_status.toLowerCase().includes('unavailable');
      
      // Extract colors
      let colors = [];
      const selectedColor = document.querySelector("span[data-testid='product-colour']")?.innerText.trim();
      if (selectedColor) colors.push(selectedColor);
      document.querySelectorAll("[data-testid='facetList'] li a").forEach((a) => {
        const label = a.getAttribute("aria-label")?.trim();
        if (label && !colors.includes(label)) colors.push(label);
      });
      
      // Extract description
      let description = null;
      const descBlock = document.querySelector("#productDescriptionDetails .F_yfF");
      if (descBlock) description = descBlock.innerText.replace(/\s+/g, " ").trim();
      if (!description) {
        const metaDesc = document.querySelector("meta[name='description']")?.content;
        if (metaDesc) description = metaDesc.trim();
      }
      
      // Extract brand
      let brand = null;
      const brandBlock = document.querySelector("#productDescriptionBrand .F_yfF");
      if (brandBlock) {
        const strong = brandBlock.querySelector("strong");
        brand = strong ? strong.innerText.trim() : brandBlock.innerText.trim();
      }
      if (!brand) {
        const parts = window.location.pathname.split("/");
        if (parts.length > 1) {
          brand = parts[1].replace(/-/g, " ");
          brand = brand.charAt(0).toUpperCase() + brand.slice(1);
        }
      }
      
      // Extract category
      let category = "";
      const catLink = document.querySelector("#productDescriptionDetails a[href*='/cat/']");
      if (catLink) category = catLink.innerText.trim();
      
      // Extract materials
      const materialsText = document.querySelector("#productDescriptionAboutMe .F_yfF")?.innerText.trim() || null;
      
      // Extract care info
      let care_info = null;
      const careSelectors = [
        "#productDescriptionCareInfo .F_yfF",
        "[data-testid='productDescriptionCareInfo'] .F_yfF",
        ".accordion-item-module_contentWrapper__qd4TE .F_yfF",
        "[aria-controls='productDescriptionCareInfo'] ~ div .F_yfF",
        "[aria-label='Look After Me'] ~ div .F_yfF"
      ];
      
      for (const selector of careSelectors) {
        const element = document.querySelector(selector);
        if (element && element.innerText.trim()) {
          care_info = element.innerText.trim().replace(/\s+/g, " ");
          break;
        }
      }
      
      // Extract sizes
      let size = [];
      document.querySelectorAll("#variantSelector option").forEach((opt) => {
        if (opt.value) size.push(opt.innerText.trim());
      });
      if (size.length === 0) size = null;
      
      // Extract images
      const images = Array.from(document.querySelectorAll("#core-product img"))
        .map((img) => img.src.replace(/\?.*$/, ""))
        .map((src) => `${src}?$n_960w$&wid=960&fit=constrain`)
        .filter((src) => src.includes("asos-media"));
      
    // Extract product ID
    const urlParts = window.location.pathname.split('/');
    let product_id = null;
    for (let part of urlParts) {
      if (part.includes('prd')) {
        const idMatch = part.match(/(\d+)/);
        if (idMatch) {
          product_id = parseInt(idMatch[1]);
          break;
        }
      }
    }
    
    // Smart occasion detection based on category, name, and description
    const detectOccasions = () => {
      const textLower = `${name} ${description || ''} ${category || ''}`.toLowerCase();
      const occasions = [];
      
      // Party/Evening occasions
      if (textLower.match(/party|evening|cocktail|formal|gown|sequin|glitter|sparkle/i)) {
        occasions.push('party');
      }
      if (textLower.match(/wedding|formal|ceremony|gala|prom|ball/i)) {
        occasions.push('formal');
      }
      
      // Work/Professional
      if (textLower.match(/work|office|professional|business|blazer|suit/i)) {
        occasions.push('work');
      }
      
      // Casual/Everyday
      if (textLower.match(/casual|everyday|comfort|relax|lounge|basic/i)) {
        occasions.push('everyday');
        occasions.push('casual');
      }
      
      // Date/Night out
      if (textLower.match(/date|night out|going out|club/i)) {
        occasions.push('date');
      }
      
      // Vacation/Beach
      if (textLower.match(/vacation|beach|resort|swim|summer|tropical/i)) {
        occasions.push('vacation');
      }
      
      // Workout/Active
      if (textLower.match(/workout|gym|sport|active|running|yoga|fitness|athletic/i)) {
        occasions.push('workout');
      }
      
      // Default to casual/everyday if no specific occasion detected
      if (occasions.length === 0) {
        occasions.push('everyday', 'casual');
      }
      
      return [...new Set(occasions)]; // Remove duplicates
    };
    
    return {
      name,
      description,
      brand,
      category,
      price: priceValue,
      currency,
      stock_status,
      availability,
      materials: materialsText,
      care_info,
      size: size ? size.join(", ") : null,
      color: colors.join(", "),
      images,
      product_url: window.location.href,
      product_id: product_id || Math.floor(Math.random() * 1000000000),
      colour_code: Math.floor(Math.random() * 1000),
      section: null,
      product_family: category?.toUpperCase() || "CLOTHING",
      product_family_en: category || "Clothing",
      product_subfamily: null,
      dimension: null,
      low_on_stock: !availability,
      sku: null,
      occasions: detectOccasions()
    };
  });

    if (categoryInfo) {
      data.scraped_category = categoryInfo.breadcrumb;
      data.category_path = categoryInfo.path;
      data.scrape_type = 'ASOS Category';
    } else {
      data.scrape_type = 'ASOS Search';
    }

  // Insert to database with all fields including occasions
  try {
    const insertData = {
      product_id: String(data.product_id),
      product_name: data.name,
      brand: data.brand || 'ASOS',
      category_name: categoryInfo?.breadcrumb || data.category || 'Uncategorized',
      category_id: String(0),
      section: data.section,
      product_family: data.product_family,
      product_subfamily: data.product_subfamily,
      product_family_en: data.product_family_en,
      clothing_category: data.category,
      
      price: data.price,
      currency: data.currency || 'GBP',
      colour: data.color,
      colour_code: String(data.colour_code),
      size: data.size || 'One Size',
      description: data.description,
      materials_description: data.materials,
      dimension: data.dimension,
      
      low_on_stock: data.low_on_stock,
      availability: data.availability,
      sku: data.sku,
      occasions: data.occasions || [],
      
      url: data.product_url,
      image: data.images && data.images.length > 0 ? data.images.map(url => ({ url })) : [],
      images: data.images && data.images.length > 0 ? data.images.map(url => ({ url })) : null,
      
      source: 'asos',
      source_priority: 1,
      sync_method: data.scrape_type || 'ASOS Category Scraper',
      last_synced_by: 'automated_scraper',
      is_active: true
    };

      const { data: existingProduct } = await supabase
        .from('zara_cloth_scraper')
        .select('product_id, price, availability')
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
          message: `Failed to save product "${data.name}": ${error.message}`
        });
      } else {
        if (isUpdate) {
          if (currentCronStats) currentCronStats.productsUpdated++;
          broadcastProgress({
            type: 'success',
            message: `✓ Updated "${data.name}"${categoryInfo ? ` (${categoryInfo.breadcrumb})` : ''}`
          });
        } else {
          if (currentCronStats) currentCronStats.productsAdded++;
          broadcastProgress({
            type: 'success',
            message: `✓ Added new "${data.name}"${categoryInfo ? ` (${categoryInfo.breadcrumb})` : ''}`
          });
        }
      }
    } catch (insertError) {
      broadcastProgress({
        type: 'error',
        message: `Database insert failed for "${data.name}": ${insertError.message}`
      });
    }

    return data;
  } catch (err) {
    broadcastProgress({
      type: 'error',
      message: `Failed to scrape product ${index + 1}: ${err.message}`
    });
    return null;
  } finally {
    await page.close();
  }
}
