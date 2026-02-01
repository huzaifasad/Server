import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ASOS Global Women's Category Taxonomy with outfit_category and category_name
const ASOS_CATEGORIES = {
  women: {
    name: "Women",
    url: "/women/",
    subcategories: {
      clothing: {
        name: "Clothing",
        url: "/women/ctas/clothing/cat/?cid=3934",
        subcategories: {
          "tops": {
            outfit_category: "tops",
            category_name: "women>clothing>tops",
            name: "Tops",
            url: "/women/tops/cat/?cid=4169",
            subcategories: {
              "t-shirts": { outfit_category: "tops", category_name: "women>clothing>tops>t-shirts", name: "T-Shirts & Vests", url: "/women/tops/t-shirts-vests/cat/?cid=4718" },
              "shirts": { outfit_category: "tops", category_name: "women>clothing>tops>shirts", name: "Shirts", url: "/women/shirts/cat/?cid=15200" },
              "blouses": { outfit_category: "tops", category_name: "women>clothing>tops>blouses", name: "Blouses", url: "/women/blouses/cat/?cid=15199" },
              "crop-tops": { outfit_category: "tops", category_name: "women>clothing>tops>crop-tops", name: "Crop Tops", url: "/women/top/cat/?cid=15196" },
              "bodysuits": { outfit_category: "tops", category_name: "women>clothing>tops>bodysuits", name: "Bodysuits", url: "/women/top/bodysuits/cat/?cid=11323" },
              "printed-graphic-t-shirts": { outfit_category: "tops", category_name: "women>clothing>tops>printed-graphic-t-shirts", name: "Printed & Graphic T-Shirts", url: "/women/tops/printed-graphic-t-shirts/cat/?cid=19825" },
              "crochet-tops": { outfit_category: "tops", category_name: "women>clothing>tops>crochet-tops", name: "Crochet Tops", url: "/women/tops/crochet-tops/cat/?cid=51078" },
              "evening-tops": { outfit_category: "tops", category_name: "women>clothing>tops>evening-tops", name: "Evening Tops", url: "/women/tops/evening-tops/cat/?cid=11320" },
              "party-tops": { outfit_category: "tops", category_name: "women>clothing>tops>party-tops", name: "Party Tops", url: "/women/tops/party-tops/cat/?cid=51447" },
              "long-sleeve-tops": { outfit_category: "tops", category_name: "women>clothing>tops>long-sleeve-tops", name: "Long Sleeve Tops", url: "/women/tops/long-sleeve-tops/cat/?cid=17334" },
              "corset-tops": { outfit_category: "tops", category_name: "women>clothing>tops>corset-tops", name: "Corset Tops", url: "/women/tops/corset-tops/cat/?cid=50070" },
              "camis": { outfit_category: "tops", category_name: "women>clothing>tops>camis", name: "Camis", url: "/women/tops/camis/cat/?cid=15202" },
              "tie-front-tops": { outfit_category: "tops", category_name: "women>clothing>tops>tie-front-tops", name: "Tie Front Tops", url: "/women/tops/tie-front-tops/cat/?cid=51707" }
            }
          },
          "jumpers-and-cardigans": {
            outfit_category: "tops",
            category_name: "women>clothing>jumpers-and-cardigans",
            name: "Jumpers & Cardigans",
            url: "/women/sweaters-cardigans/cat/?cid=2637",
            subcategories: {
              "cardigans": { outfit_category: "tops", category_name: "women>clothing>jumpers-and-cardigans>cardigans", name: "Cardigans", url: "/women/jumpers-cardigans/cardigans/cat/?cid=15161" },
              "cropped-cardigans": { outfit_category: "tops", category_name: "women>clothing>jumpers-and-cardigans>cropped-cardigans", name: "Cropped Cardigans", url: "/women/sweaters-cardigans/cropped-cardigans/cat/?cid=51018" },
              "patterned-cardigans": { outfit_category: "tops", category_name: "women>clothing>jumpers-and-cardigans>patterned-cardigans", name: "Patterned Cardigans", url: "/women/sweaters-cardigans/patterned-cardigans/cat/?cid=51028" },
              "sweaters": { outfit_category: "tops", category_name: "women>clothing>jumpers-and-cardigans>sweaters", name: "Sweaters", url: "/women/sweaters-cardigans/sweaters/cat/?cid=15160" },
              "oversized-sweaters": { outfit_category: "tops", category_name: "women>clothing>jumpers-and-cardigans>oversized-sweaters", name: "Oversized Sweaters", url: "/women/sweaters-cardigans/oversized-sweaters/cat/?cid=51027" },
              "sweater-vests": { outfit_category: "tops", category_name: "women>clothing>jumpers-and-cardigans>sweater-vests", name: "Sweater Vests", url: "/women/jumpers-cardigans/sweater-vests/cat/?cid=50415" },
              "cropped-sweaters": { outfit_category: "tops", category_name: "women>clothing>jumpers-and-cardigans>cropped-sweaters", name: "Cropped Sweaters", url: "/women/sweaters-cardigans/cropped-sweaters/cat/?cid=51025" }
            }
          },
          "bottoms": {
            outfit_category: "bottoms",
            category_name: "women>clothing>bottoms",
            name: "Bottoms",
            url: "/women/trousers-leggings/cat/?cid=2640",
            subcategories: {
              "jeans": { outfit_category: "bottoms", category_name: "women>clothing>bottoms>jeans", name: "Jeans", url: "/women/jeans/cat/?cid=3630" },
              "trousers": { outfit_category: "bottoms", category_name: "women>clothing>bottoms>trousers", name: "Pants & Trousers", url: "/women/trousers-leggings/cat/?cid=2640" },
              "wide-leg-trousers": { outfit_category: "bottoms", category_name: "women>clothing>bottoms>wide-leg-trousers", name: "Wide Leg Trousers", url: "/women/trousers-leggings/wide-leg-trousers/cat/?cid=17400" },
              "cargo-trousers": { outfit_category: "bottoms", category_name: "women>clothing>bottoms>cargo-trousers", name: "Cargo Trousers", url: "/women/trousers-leggings/cargo-trousers/cat/?cid=50458" },
              "work-trousers": { outfit_category: "bottoms", category_name: "women>clothing>bottoms>work-trousers", name: "Work Trousers", url: "/women/trousers-leggings/work-trousers/cat/?cid=15203" },
              "leggings": { outfit_category: "bottoms", category_name: "women>clothing>bottoms>leggings", name: "Leggings", url: "/women/trousers-leggings/leggings/cat/?cid=16037" },
              "skirts": { outfit_category: "bottoms", category_name: "women>clothing>bottoms>skirts", name: "Skirts", url: "/women/skirts/cat/?cid=2639" },
              "shorts": { outfit_category: "bottoms", category_name: "women>clothing>bottoms>shorts", name: "Shorts", url: "/women/shorts/cat/?cid=9263" }
            }
          },
          "dresses": {
            outfit_category: "bottoms",
            category_name: "women>clothing>dresses",
            name: "Dresses",
            url: "/women/dresses/cat/?cid=8799",
            subcategories: {
              "day-dresses": { outfit_category: "bottoms", category_name: "women>clothing>dresses>day-dresses", name: "Day Dresses", url: "/women/dresses/day-dresses/cat/?cid=19680" },
              "casual-dresses": { outfit_category: "bottoms", category_name: "women>clothing>dresses>casual-dresses", name: "Casual Dresses", url: "/women/dresses/casual-dresses/cat/?cid=8834" },
              "wedding-guest": { outfit_category: "bottoms", category_name: "women>clothing>dresses>wedding-guest", name: "Wedding Guest Dresses", url: "/women/dresses/wedding-guest-dresses/cat/?cid=13934" },
              "bridesmaid-dresses": { outfit_category: "bottoms", category_name: "women>clothing>dresses>bridesmaid-dresses", name: "Bridesmaid Dresses", url: "/women/dresses/bridesmaid-dresses/cat/?cid=15156" },
              "evening-dresses": { outfit_category: "bottoms", category_name: "women>clothing>dresses>evening-dresses", name: "Evening Dresses", url: "/women/dresses/evening-dresses/cat/?cid=84" },
              "party-dresses": { outfit_category: "bottoms", category_name: "women>clothing>dresses>party-dresses", name: "Party Dresses", url: "/women/dresses/party-dresses/cat/?cid=82" },
              "mini-dresses": { outfit_category: "bottoms", category_name: "women>clothing>dresses>mini-dresses", name: "Mini Dresses", url: "/women/dresses/mini-dresses/cat/?cid=92" },
              "midi-dresses": { outfit_category: "bottoms", category_name: "women>clothing>dresses>midi-dresses", name: "Midi Dresses", url: "/women/dresses/midi-dresses/cat/?cid=91" },
              "maxi-dresses": { outfit_category: "bottoms", category_name: "women>clothing>dresses>maxi-dresses", name: "Maxi Dresses", url: "/women/dresses/maxi-dresses/cat/?cid=90" },
              "sweater-dresses": { outfit_category: "bottoms", category_name: "women>clothing>dresses>sweater-dresses", name: "Sweater Dresses", url: "/women/dresses/sweater-dresses/cat/?cid=73" }
            }
          }
        }
      },
      "shoes": {
        outfit_category: "shoes",
        category_name: "women>shoes",
        name: "Shoes",
        url: "/women/shoes/cat/?cid=4172",
        subcategories: {
          "sneakers": { outfit_category: "shoes", category_name: "women>shoes>sneakers", name: "Sneakers", url: "/women/shoes/sneakers/cat/?cid=6456" },
          "heels": { outfit_category: "shoes", category_name: "women>shoes>heels", name: "Heels", url: "/women/shoes/heels/cat/?cid=6461" },
          "sandals": { outfit_category: "shoes", category_name: "women>shoes>sandals", name: "Sandals", url: "/women/shoes/sandals/cat/?cid=6458" },
          "boots": { outfit_category: "shoes", category_name: "women>shoes>boots", name: "Boots", url: "/women/shoes/boots/cat/?cid=6455" },
          "flat-shoes": { outfit_category: "shoes", category_name: "women>shoes>flat-shoes", name: "Flat Shoes", url: "/women/shoes/flat-shoes/cat/?cid=6459" },
          "loafers": { outfit_category: "shoes", category_name: "women>shoes>loafers", name: "Loafers", url: "/women/shoes/loafers/cat/?cid=13692" },
          "wide-fit-shoes": { outfit_category: "shoes", category_name: "women>shoes>wide-fit-shoes", name: "Wide Fit Shoes", url: "/women/shoes/wide-fit-shoes/cat/?cid=19886" },
          "ballet-pumps": { outfit_category: "shoes", category_name: "women>shoes>ballet-pumps", name: "Ballet Pumps", url: "/women/shoes/ballet-pumps/cat/?cid=13685" },
          "kitten-heels": { outfit_category: "shoes", category_name: "women>shoes>kitten-heels", name: "Kitten Heels", url: "/women/shoes/kitten-heels/cat/?cid=52305" },
          "mules": { outfit_category: "shoes", category_name: "women>shoes>mules", name: "Mules", url: "/women/shoes/mules/cat/?cid=50073" },
          "platform-shoes": { outfit_category: "shoes", category_name: "women>shoes>platform-shoes", name: "Platform Shoes", url: "/women/shoes/platform-shoes/cat/?cid=14208" },
          "party-shoes": { outfit_category: "shoes", category_name: "women>shoes>party-shoes", name: "Party Shoes", url: "/women/shoes/party-shoes/cat/?cid=14466" },
          "wedges": { outfit_category: "shoes", category_name: "women>shoes>wedges", name: "Wedges", url: "/women/shoes/sandals/wedges/cat/?cid=10266" }
        }
      },
      "workout": {
        outfit_category: "tops",
        category_name: "women>workout",
        name: "Workout",
        url: "/women/activewear/cat/?cid=26091",
        subcategories: {
          "active-leggings": { outfit_category: "bottoms", category_name: "women>workout>active-leggings", name: "Active Leggings", url: "/women/activewear/leggings/cat/?cid=27163" },
          "active-tops": { outfit_category: "tops", category_name: "women>workout>active-tops", name: "Active Tops", url: "/women/activewear/tops/cat/?cid=27167" },
          "sports-bras": { outfit_category: "tops", category_name: "women>workout>sports-bras", name: "Sports Bras", url: "/women/activewear/sports-bras/cat/?cid=27168" },
          "active-shorts": { outfit_category: "bottoms", category_name: "women>workout>active-shorts", name: "Active Shorts", url: "/women/activewear/shorts/cat/?cid=27164" },
          "gym-training": { outfit_category: "tops", category_name: "women>workout>gym-training", name: "Gym & Training", url: "/women/activewear/gym-training/cat/?cid=27171" }
        }
      }
    }
  },
  workout: {
    outfit_category: "tops",
    category_name: "workout",
    name: "Workout",
    url: "/search/?q=workout&refine=floor:1000,2001"
  },
  legging: {
    outfit_category: "bottoms",
    category_name: "legging",
    name: "Legging",
    url: "/search/?q=workout&currentpricerange=5-380&refine=attribute_1047:8385|floor:1000"
  }
};


// Function to get outfit_category from scraped category_name
function getOutfitCategoryFromScrapedName(scrapedCategoryName) {
  // Convert scraped format "Women > Clothing > Tops > T-Shirts & Vests" to lookup format
  const normalized = scrapedCategoryName
    .split(" > ")
    .map(part => part.toLowerCase().replace(/&/g, "-").replace(/\s+/g, "-"))
    .join(">");
  
  // Hardcoded mapping lookup table with all variations
  const categoryMapping = {
    // TOPS
    "women>clothing>tops": "tops",
    "women>clothing>tops>t-shirts": "tops",
    "women>clothing>tops>t-shirts--vests": "tops",
    "women>clothing>tops>shirts": "tops",
    "women>clothing>tops>blouses": "tops",
    "women>clothing>tops>crop-tops": "tops",
    "women>clothing>tops>bodysuits": "tops",
    "women>clothing>tops>printed--graphic-t-shirts": "tops",
    "women>clothing>tops>crochet-tops": "tops",
    "women>clothing>tops>evening-tops": "tops",
    "women>clothing>tops>party-tops": "tops",
    "women>clothing>tops>long-sleeve-tops": "tops",
    "women>clothing>tops>corset-tops": "tops",
    "women>clothing>tops>camis": "tops",
    "women>clothing>tops>tie-front-tops": "tops",
    "women>clothing>jumpers--cardigans": "tops",
    "women>clothing>jumpers-and-cardigans": "tops",
    "women>clothing>jumpers--cardigans>cardigans": "tops",
    "women>clothing>jumpers-and-cardigans>cardigans": "tops",
    "women>clothing>jumpers--cardigans>cropped-cardigans": "tops",
    "women>clothing>jumpers-and-cardigans>cropped-cardigans": "tops",
    "women>clothing>jumpers--cardigans>patterned-cardigans": "tops",
    "women>clothing>jumpers-and-cardigans>patterned-cardigans": "tops",
    "women>clothing>jumpers--cardigans>sweaters": "tops",
    "women>clothing>jumpers-and-cardigans>sweaters": "tops",
    "women>clothing>jumpers--cardigans>oversized-sweaters": "tops",
    "women>clothing>jumpers-and-cardigans>oversized-sweaters": "tops",
    "women>clothing>jumpers--cardigans>sweater-vests": "tops",
    "women>clothing>jumpers-and-cardigans>sweater-vests": "tops",
    "women>clothing>jumpers--cardigans>cropped-sweaters": "tops",
    "women>clothing>jumpers-and-cardigans>cropped-sweaters": "tops",
    "women>workout>active-tops": "tops",
    "women>workout>sports-bras": "tops",
    "women>workout>gym--training": "tops",
    "women>workout>gym-training": "tops",
    
    // BOTTOMS - Only actual bottoms (no dresses)
    "women>clothing>bottoms": "bottoms",
    "women>clothing>bottoms>jeans": "bottoms",
    "women>clothing>bottoms>trousers": "bottoms",
    "women>clothing>bottoms>wide-leg-trousers": "bottoms",
    "women>clothing>bottoms>cargo-trousers": "bottoms",
    "women>clothing>bottoms>work-trousers": "bottoms",
    "women>clothing>bottoms>leggings": "bottoms",
    "women>clothing>bottoms>skirts": "bottoms",
    "women>clothing>bottoms>shorts": "bottoms",
    "women>workout>active-leggings": "bottoms",
    "women>workout>active-shorts": "bottoms",
    
    // SHOES
    "women>shoes": "shoes",
    "women>shoes>sneakers": "shoes",
    "women>shoes>heels": "shoes",
    "women>shoes>sandals": "shoes",
    "women>shoes>boots": "shoes",
    "women>shoes>flat-shoes": "shoes",
    "women>shoes>loafers": "shoes",
    "women>shoes>wide-fit-shoes": "shoes",
    "women>shoes>ballet-pumps": "shoes",
    "women>shoes>kitten-heels": "shoes",
    "women>shoes>mules": "shoes",
    "women>shoes>platform-shoes": "shoes",
    "women>shoes>party-shoes": "shoes",
    "women>shoes>wedges": "shoes"
  };
  
  return categoryMapping[normalized] || null;
}

// Export categories and functions
export { ASOS_CATEGORIES, getOutfitCategoryFromScrapedName };

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
    message: 'Browser launched successfully'
  });

  const page = await browser.newPage();
  
  try {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // SET US REGION COOKIES BEFORE NAVIGATION
    await page.setCookie(
      {
        name: 'browseCountry',
        value: 'US',
        domain: '.asos.com',
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax'
      },
      {
        name: 'browseCurrency',
        value: 'USD',
        domain: '.asos.com',
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax'
      },
      {
        name: 'browseLanguage',
        value: 'en-US',
        domain: '.asos.com',
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax'
      },
      {
        name: 'storeCode',
        value: 'COM',
        domain: '.asos.com',
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax'
      }
    );

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
      message: 'Navigating to ASOS US homepage...'
    });
    
    // Navigation with retry logic - USE US DOMAIN
    let navigationSuccess = false;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (!navigationSuccess && retryCount < maxRetries) {
      try {
        await page.goto('https://us.asos.com', {
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
      targetUrl = `https://us.asos.com/search/?q=${encodeURIComponent(searchTerm)}`;
      broadcastProgress({
        type: 'info',
        message: `Navigating to US search page for "${searchTerm}"...`
      });
    } else {
      const category = getCategoryPath(ASOS_CATEGORIES, categoryPath);
      
      if (!category || !category.url) {
        throw new Error(`Invalid category path: ${categoryPath}. Category not found in ASOS_CATEGORIES.`);
      }
      
      targetUrl = `https://us.asos.com${category.url}`;
      const breadcrumb = buildCategoryBreadcrumb(categoryPath);
      categoryInfo = { breadcrumb, path: categoryPath };
      
      broadcastProgress({
        type: 'info',
        message: `Navigating to US category page: "${breadcrumb}"...`
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

    // OPTIMIZED: Chunked loading and scraping for full/range mode
    if (options.mode === "full" || options.mode === "range") {
      return await scrapeWithChunkedLoading(browser, page, productSelector, categoryInfo, options, concurrency, broadcastProgress, currentCronStats);
    }

    // For "limit" mode, use old approach (load first batch only)
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

  // SMART PARALLEL: Rolling load ahead of scraping (scrape immediately, trigger loads at 40, 80, 120...)
  async function scrapeWithChunkedLoading(browser, page, productSelector, categoryInfo, options, concurrency, broadcastProgress, currentCronStats) {
  const LOAD_TRIGGER_INTERVAL = 40; // FIX: Reduced from 60 to 40 - trigger next load every 40 products scraped
  
  broadcastProgress({
    type: 'info',
    message: 'Starting smart parallel scraping (scraping + loading in background)...'
  });

  const linkSelectors = [
    `${productSelector} a.productLink_KM4PI`,
    `${productSelector} a[href*="/prd/"]`,
    `${productSelector} a[data-testid="product-link"]`,
    `${productSelector} a`
  ];

  const results = [];
  let scrapedCount = 0;
  let nextLoadTrigger = LOAD_TRIGGER_INTERVAL;
  let loadingInProgress = false;
  let noMoreProducts = false;
  
  const getProductLinks = async () => {
    for (const linkSel of linkSelectors) {
      try {
        const links = await page.$$eval(linkSel, (links) =>
          links.map((a) => a.href).filter(href => href && href.includes('/prd/'))
        );
        if (links.length > 0) {
          return [...new Set(links)];
        }
      } catch (e) {}
    }
    return [];
  };

  // Background loader - triggers load more when needed
  const triggerLoadMore = async () => {
    if (loadingInProgress || noMoreProducts) return;
    
    loadingInProgress = true;
    
    try {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await randomDelay(1500, 2500);

      const btn = await page.$(
        "a.loadButton_wWQ3F, [data-auto-id='loadMoreProducts'], [data-testid='load-more-button'], button[class*='load'], button[class*='more']"
      );

      if (btn) {
        broadcastProgress({
          type: 'progress',
          message: `🔄 Loading more products in background (scraped: ${scrapedCount})...`
        });
        
        await btn.click();
        await randomDelay(3000, 5000);
        
        const newLinks = await getProductLinks();
        broadcastProgress({
          type: 'info',
          message: `✓ Background load complete - ${newLinks.length} products now available`
        });
      } else {
        noMoreProducts = true;
        broadcastProgress({
          type: 'info',
          message: 'No more products to load - will scrape remaining'
        });
      }
    } catch (e) {
      console.log(`[v0] Background load error: ${e.message}`);
    } finally {
      loadingInProgress = false;
    }
  };

  // Get initial products
  const allLinks = await getProductLinks();
  
  if (allLinks.length === 0) {
    throw new Error('No product links found');
  }

  broadcastProgress({
    type: 'success',
    message: `Found ${allLinks.length} initial products - starting scrape...`
  });
  
  // FIX: Trigger first load immediately so more products are loading while we scrape the first 50
  if (allLinks.length >= 40) {
    console.log(`[v0] Triggering early background load (initial batch has ${allLinks.length} products)`)
    triggerLoadMore();
    nextLoadTrigger = 40; // Next trigger at 40 scraped
  }

  // Main scraping loop - continuous scraping
  while (true) {
    const currentLinks = await getProductLinks();
    const unscrapedLinks = currentLinks.slice(scrapedCount);

    // FIX: Check if we've reached load trigger milestone (reduced from 60 to 40)
    if (scrapedCount >= nextLoadTrigger && !noMoreProducts) {
      triggerLoadMore(); // Fire and forget - don't wait
      nextLoadTrigger += 40; // Reduced from 60 to trigger more frequently
      broadcastProgress({
        type: 'info',
        message: `📍 Milestone ${scrapedCount} - next load trigger at ${nextLoadTrigger}`
      });
    }

    // FIX: No more products to scrape - wait longer for background load
    if (unscrapedLinks.length === 0) {
      // Wait longer for background load to complete
      if (!noMoreProducts && loadingInProgress) {
        broadcastProgress({
          type: 'info',
          message: `⏳ Waiting for background load to complete... (${scrapedCount} scraped)`
        });
        await sleep(5000); // Increased from 3000 to 5000ms
        continue;
      }
      
      // FIX: Try one more load before giving up
      if (!noMoreProducts && !loadingInProgress) {
        broadcastProgress({
          type: 'info',
          message: `🔄 No unscraped products - triggering final load attempt...`
        });
        await triggerLoadMore();
        await sleep(5000);
        continue;
      }
      
      break;
    }

    // Scrape available products (in batches of concurrency)
    const batch = unscrapedLinks.slice(0, concurrency);
    
    const batchResults = await Promise.all(
      batch.map((link, idx) => 
        scrapeProduct(browser, link, scrapedCount + idx, currentLinks.length, categoryInfo, broadcastProgress, currentCronStats)
      )
    );
    
    results.push(...batchResults.filter(r => r !== null));
    scrapedCount += batch.length;
    
    // Apply range/limit filters
    if (options.mode === "range" && options.endIndex !== undefined && scrapedCount >= options.endIndex + 1) {
      broadcastProgress({
        type: 'info',
        message: `Reached range end index (${options.endIndex}). Stopping scrape.`
      });
      break;
    }

    await sleep(2000);
  }

  await browser.close();

  // Apply filters if needed
  let finalResults = results;
  if (options.mode === "range" && options.startIndex !== undefined && options.endIndex !== undefined) {
    finalResults = results.slice(options.startIndex, options.endIndex + 1);
  }

  broadcastProgress({
    type: 'success',
    message: `Smart parallel scraping completed! Scraped ${finalResults.length} products successfully.`
  });

  return finalResults;
}

// Load all products helper (LEGACY: Used only for "limit" mode)
async function loadAllProducts(page, broadcastProgress) {
  let lastCount = 0, clicks = 0, noChangeCount = 0;
  
  broadcastProgress({
    type: 'info',
    message: 'Loading all products from category...'
  });
  
  while (noChangeCount < 3) {
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
      noChangeCount = 0;
      lastCount = currentCount;
    }

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await randomDelay(2000, 3000);

    const btn = await page.$(
      "a.loadButton_wWQ3F, [data-auto-id='loadMoreProducts'], [data-testid='load-more-button'], button[class*='load'], button[class*='more']"
    );

    if (btn) {
      clicks++;
      broadcastProgress({
        type: 'progress',
        message: `Loading more products... (Click ${clicks} - Total visible: ${lastCount})`
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

  // Retry logic for slow product pages
  let pageLoadSuccess = false;
  let pageRetries = 0;
  
  while (!pageLoadSuccess && pageRetries < 2) {
    try {
      await page.goto(link, { waitUntil: "domcontentloaded", timeout: 90000 }); // Increased to 90s
      pageLoadSuccess = true;
    } catch (error) {
      pageRetries++;
      if (pageRetries < 2) {
        console.log(`[v0] Retry ${pageRetries}/2 for product page: ${link}`);
        await randomDelay(2000, 3000);
      } else {
        throw error; // Failed after retries
      }
    }
  }
  
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
      
    // Extract product ID (FIXED: Better extraction + deterministic fallback)
    let product_id = null;
    
    // Method 1: Extract from /prd/ path
    const prdMatch = window.location.pathname.match(/\/prd\/(\d+)/);
    if (prdMatch) {
      product_id = prdMatch[1];
    }
    
    // Method 2: Try URL parameter
    if (!product_id) {
      const urlParams = new URLSearchParams(window.location.search);
      product_id = urlParams.get('productId') || urlParams.get('id');
    }
    
    // Method 3: Fallback - use hash of full URL (deterministic, not random!)
    if (!product_id) {
      const urlHash = window.location.href.split('?')[0].split('#')[0];
      product_id = 'asos_' + btoa(urlHash).slice(0, 20).replace(/[^a-zA-Z0-9]/g, '');
    }
    
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
        product_id: product_id, // No random fallback - always deterministic
        colour_code: Math.floor(Math.random() * 1000),
        section: null,
        product_family: category?.toUpperCase() || "CLOTHING",
        product_family_en: category || "Clothing",
        product_subfamily: null,
        dimension: null,
        low_on_stock: !availability,
        sku: null
      };
    });

    if (categoryInfo) {
      data.scraped_category = categoryInfo.breadcrumb;
      data.category_path = categoryInfo.path;
      data.scrape_type = 'ASOS Category';
    } else {
      data.scrape_type = 'ASOS Search';
    }

  // Validate product data before insertion (skip broken products)
  const isValidProduct = 
    data.product_url && 
    !data.product_url.includes('chrome-error') &&
    !data.product_url.includes('about:blank') &&
    data.name && 
    data.name !== 'www.asos.com' && 
    data.name.length > 3 &&
    (data.images && data.images.length > 0);

  if (!isValidProduct) {
    console.log(`[v0] Skipping invalid product: ${data.name || 'Unknown'} - URL: ${data.product_url}`);
    broadcastProgress({
      type: 'warning',
      message: `Skipped invalid product (page failed to load properly)`
    });
    
    if (currentCronStats) {
      currentCronStats.productsFailed++;
    }
    
    return null;
  }

  // Insert to database with all fields including occasions
  try {
  // Map category to outfit type (tops/bottoms/shoes)
  const outfitCategory = mapCategoryToOutfitType(categoryInfo?.breadcrumb || data.category || '');
  
  const insertData = {
  product_id: String(data.product_id),
  product_name: data.name,
  brand: data.brand || 'ASOS',
  category_name: categoryInfo?.breadcrumb || data.category || 'Uncategorized',
  outfit_category: outfitCategory, // NEW: tops, bottoms, or shoes
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
        .from('clean_scraper')
        .select('product_id, price, availability')
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

  // Function to map category to outfit type using hardcoded lookup
function mapCategoryToOutfitType(scrapedCategoryName) {
  // Use the exported function to get outfit category from scraped name
  return getOutfitCategoryFromScrapedName(scrapedCategoryName) || 'uncategorized';
}
