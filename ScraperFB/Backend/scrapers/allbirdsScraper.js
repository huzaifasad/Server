import { scrapeShopifyStore, buildCategoryBreadcrumb as buildBreadcrumb } from './shopifyScraperTemplate.js';

// Allbirds Category Structure
export const ALLBIRDS_CATEGORIES = {
  mens: {
    name: "Men's",
    subcategories: {
      shoes: {
        name: "Shoes",
        subcategories: {
          "everyday-sneakers": { name: "Everyday Sneakers", handle: "mens-everyday-sneakers" },
          "active-shoes": { name: "Active Shoes", handle: "mens-active-shoes" },
          "high-tops": { name: "High Tops", handle: "mens-high-tops" },
          "slip-ons": { name: "Slip-Ons", handle: "mens-slip-ons" },
          "loungers": { name: "Loungers", handle: "mens-loungers" },
          "sandals": { name: "Sandals", handle: "mens-sandals" },
          "weather-repellent": { name: "Weather Repellent", handle: "mens-weather-repellent" }
        }
      },
      apparel: {
        name: "Apparel",
        subcategories: {
          "socks": { name: "Socks", handle: "mens-socks" },
          "tees": { name: "T-Shirts", handle: "mens-tees" },
          "sweatshirts": { name: "Sweatshirts", handle: "mens-sweatshirts" },
          "sweatpants": { name: "Sweatpants", handle: "mens-sweatpants" },
          "hats": { name: "Hats", handle: "mens-hats" },
          "bags": { name: "Bags", handle: "mens-bags" }
        }
      }
    }
  },
  womens: {
    name: "Women's",
    subcategories: {
      shoes: {
        name: "Shoes",
        subcategories: {
          "everyday-sneakers": { name: "Everyday Sneakers", handle: "womens-everyday-sneakers" },
          "active-shoes": { name: "Active Shoes", handle: "womens-active-shoes" },
          "high-tops": { name: "High Tops", handle: "womens-high-tops" },
          "slip-ons": { name: "Slip-Ons", handle: "womens-slip-ons" },
          "loungers": { name: "Loungers", handle: "womens-loungers" },
          "sandals": { name: "Sandals", handle: "womens-sandals" },
          "breezers": { name: "Breezers", handle: "womens-breezers" },
          "weather-repellent": { name: "Weather Repellent", handle: "womens-weather-repellent" }
        }
      },
      apparel: {
        name: "Apparel",
        subcategories: {
          "socks": { name: "Socks", handle: "womens-socks" },
          "tees": { name: "T-Shirts", handle: "womens-tees" },
          "sweatshirts": { name: "Sweatshirts", handle: "womens-sweatshirts" },
          "sweatpants": { name: "Sweatpants", handle: "womens-sweatpants" },
          "hats": { name: "Hats", handle: "womens-hats" },
          "bags": { name: "Bags", handle: "womens-bags" }
        }
      }
    }
  }
};

// Allbirds Store Configuration
const ALLBIRDS_CONFIG = {
  storeName: 'Allbirds',
  storeKey: 'allbirds',
  baseUrl: 'https://www.allbirds.com',
  categories: ALLBIRDS_CATEGORIES,
  sourcePriority: 2
};

// Main Allbirds scraping function
export async function scrapeAllbirds(
  browser = null,
  categoryPath,
  options = {},
  concurrency = 5,
  broadcastProgress = () => {},
  currentCronStats = null
) {
  return scrapeShopifyStore(
    ALLBIRDS_CONFIG,
    categoryPath,
    options,
    concurrency,
    broadcastProgress,
    currentCronStats
  );
}

// Build category breadcrumb for Allbirds
export function buildAllbirdsCategoryBreadcrumb(categoryPath) {
  return buildBreadcrumb(categoryPath, ALLBIRDS_CATEGORIES);
}
