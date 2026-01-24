// Occasions mapper - Maps product categories to appropriate occasions
// This enriches product data by automatically detecting occasions from category names

const OCCASION_MAPPINGS = {
  wedding: {
    keywords: ['wedding', 'bridal', 'bridesmaid', 'formal gown', 'evening gown'],
    occasions: ['Wedding', 'Formal Event', 'Black Tie']
  },
  party: {
    keywords: ['party', 'going out', 'night out', 'clubwear', 'cocktail'],
    occasions: ['Party', 'Night Out', 'Cocktail']
  },
  workwear: {
    keywords: ['workwear', 'office', 'business', 'smart', 'professional'],
    occasions: ['Work', 'Business', 'Office']
  },
  casual: {
    keywords: ['casual', 'everyday', 'loungewear', 'basics', 't-shirt', 'jeans'],
    occasions: ['Casual', 'Everyday']
  },
  sport: {
    keywords: ['sport', 'gym', 'activewear', 'fitness', 'running', 'yoga', 'workout'],
    occasions: ['Sport', 'Gym', 'Active']
  },
  beach: {
    keywords: ['beach', 'swimwear', 'bikini', 'swimsuit', 'resort'],
    occasions: ['Beach', 'Holiday', 'Resort']
  },
  maternity: {
    keywords: ['maternity', 'pregnancy', 'mama'],
    occasions: ['Maternity']
  },
  prom: {
    keywords: ['prom', 'ball gown', 'homecoming'],
    occasions: ['Prom', 'Formal Event']
  },
  date: {
    keywords: ['date night', 'romantic', 'dinner'],
    occasions: ['Date Night', 'Evening']
  }
};

export function detectOccasions(categoryName, productName = '', description = '') {
  if (!categoryName) return null;
  
  const searchText = `${categoryName} ${productName} ${description}`.toLowerCase();
  const detectedOccasions = new Set();
  
  // Check each mapping
  for (const [key, mapping] of Object.entries(OCCASION_MAPPINGS)) {
    for (const keyword of mapping.keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        mapping.occasions.forEach(occ => detectedOccasions.add(occ));
        break;
      }
    }
  }
  
  // Return as comma-separated string or null if none detected
  return detectedOccasions.size > 0 
    ? Array.from(detectedOccasions).join(', ') 
    : null;
}

export function getOccasionsByCategory(categoryPath) {
  // Extract the last part of category path (most specific)
  const parts = categoryPath.split('>').map(p => p.trim());
  const lastCategory = parts[parts.length - 1];
  
  return detectOccasions(categoryPath, lastCategory);
}
