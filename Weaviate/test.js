import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import weaviate from "weaviate-ts-client"
import OpenAI from "openai"

dotenv.config()

// ============================================================================

// INITIALIZE

// ============================================================================

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Weaviate Client
const weaviateClient = weaviate.client({
  scheme: process.env.WEAVIATE_SCHEME || "http",
  host: process.env.WEAVIATE_HOST || "localhost:8080",
})

// OpenAI Client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const EMBEDDING_MODEL = "text-embedding-3-small"

// ============================================================================

// HELPER FUNCTIONS

// ============================================================================

/**
 * ✅ NEW: Extract subcategory from category_name
 * Example: "Shoes > Heels" → "heels"
 * Example: "Tops > Blouses" → "blouses"
 */
function extractSubcategory(category_name) {
  if (!category_name) return null
  
  // Split on " > " and take the last part
  const parts = category_name.split(' > ')
  if (parts.length > 1) {
    const subcategory = parts[parts.length - 1].toLowerCase().trim()
    
    // Clean up common variations
    return subcategory
      .replace(/\s+/g, ' ')  // Normalize spaces
      .replace(/&/g, 'and')   // "Jeans & Denim" → "jeans and denim"
  }
  
  return null
}

// ============================================================================
// OCCASION-TO-PRODUCT-TYPE MAPPING (CORE STRATEGY)
// ============================================================================
// Instead of searching for occasion keywords (which don't exist in product descriptions),
// we map occasions to specific product types that ARE present in the database.
// This ensures semantic search queries contain terms that actually match products.

const OCCASION_PRODUCT_MAPPING = {
  // === FITNESS & ACTIVE ===
  workout: {
    tops: ["tank top", "sports bra", "compression top", "athletic shirt", "performance tee", "muscle tank", "crop top athletic", "long sleeve workout", "zip hoodie", "running top"],
    bottoms: ["leggings", "joggers", "track pants", "athletic shorts", "compression shorts", "yoga pants", "running shorts", "sweatpants", "bike shorts", "training pants"],
    shoes: ["sneakers", "trainers", "running shoes", "cross-training shoes", "athletic shoes", "gym shoes", "sports shoes", "workout shoes"],
  },
  yoga: {
    tops: ["tank top", "sports bra", "crop top", "fitted tee", "wrap top", "racerback tank", "seamless top"],
    bottoms: ["leggings", "yoga pants", "wide leg pants", "flared leggings", "high waist leggings", "capri leggings"],
    shoes: ["barefoot shoes", "slip-on sneakers", "flat sneakers", "minimalist shoes"],
  },
  hiking: {
    tops: ["performance shirt", "long sleeve tee", "fleece jacket", "windbreaker", "zip-up jacket", "moisture-wicking top"],
    bottoms: ["cargo pants", "hiking pants", "outdoor shorts", "convertible pants", "joggers", "athletic pants"],
    shoes: ["hiking boots", "trail shoes", "outdoor sneakers", "waterproof boots", "ankle boots"],
  },
  
  // === FORMAL & SPECIAL EVENTS ===
  wedding: {
    tops: ["elegant blouse", "dressy top", "silk blouse", "lace top", "formal top", "embellished top", "off-shoulder top"],
    bottoms: ["dress pants", "wide leg trousers", "maxi skirt", "midi skirt", "formal trousers", "palazzo pants", "tailored pants"],
    shoes: ["heels", "pumps", "stilettos", "strappy heels", "dress shoes", "elegant sandals", "block heels", "kitten heels"],
    dresses: ["gown", "maxi dress", "midi dress", "cocktail dress", "formal dress", "evening dress", "wrap dress", "A-line dress"],
  },
  party: {
    tops: ["sequin top", "metallic top", "crop top", "halter top", "bandeau", "off-shoulder top", "glitter top", "sheer top", "bodysuit"],
    bottoms: ["mini skirt", "leather pants", "sequin pants", "metallic skirt", "high waist pants", "fitted skirt", "satin pants"],
    shoes: ["heels", "stilettos", "platform heels", "strappy heels", "sparkly heels", "ankle boots heels", "dressy sandals"],
    dresses: ["mini dress", "bodycon dress", "sequin dress", "cocktail dress", "party dress", "slip dress", "cut-out dress"],
  },
  cocktail: {
    tops: ["silk blouse", "dressy top", "elegant camisole", "lace top", "satin top", "embellished top"],
    bottoms: ["tailored pants", "dress pants", "midi skirt", "pencil skirt", "wide leg trousers"],
    shoes: ["heels", "pumps", "kitten heels", "strappy sandals", "elegant flats", "block heels"],
    dresses: ["cocktail dress", "midi dress", "wrap dress", "sheath dress", "fit and flare dress"],
  },
  gala: {
    tops: ["embellished top", "beaded top", "formal blouse", "elegant camisole"],
    bottoms: ["formal trousers", "wide leg pants", "maxi skirt", "evening pants"],
    shoes: ["stilettos", "formal heels", "dressy pumps", "elegant sandals", "crystal heels"],
    dresses: ["ball gown", "formal gown", "evening dress", "floor-length dress", "maxi dress elegant"],
  },
  graduation: {
    tops: ["elegant blouse", "fitted top", "dressy top", "smart blouse"],
    bottoms: ["dress pants", "midi skirt", "tailored trousers", "A-line skirt"],
    shoes: ["heels", "pumps", "block heels", "elegant flats", "loafers dressy"],
    dresses: ["midi dress", "A-line dress", "wrap dress", "fit and flare dress", "sheath dress"],
  },
  
  // === PROFESSIONAL ===
  work: {
    tops: ["blazer", "blouse", "button-up shirt", "dress shirt", "knit top", "turtleneck", "cardigan", "professional top", "smart top"],
    bottoms: ["dress pants", "trousers", "pencil skirt", "tailored pants", "slacks", "wide leg trousers", "midi skirt professional"],
    shoes: ["loafers", "oxford shoes", "pumps", "block heels", "ballet flats", "dress shoes", "kitten heels", "mules"],
  },
  interview: {
    tops: ["blazer", "button-up shirt", "professional blouse", "smart top", "fitted blazer"],
    bottoms: ["dress pants", "tailored trousers", "pencil skirt", "slacks"],
    shoes: ["pumps", "loafers", "oxford shoes", "block heels", "professional flats"],
  },
  business_casual: {
    tops: ["blouse", "knit top", "cardigan", "polo shirt", "smart casual top", "lightweight blazer"],
    bottoms: ["chinos", "dress pants", "midi skirt", "tailored shorts", "smart trousers"],
    shoes: ["loafers", "ballet flats", "low heels", "smart sneakers", "mules"],
  },
  conference: {
    tops: ["blazer", "professional blouse", "structured top", "smart shirt"],
    bottoms: ["tailored pants", "dress pants", "professional skirt", "wide leg trousers"],
    shoes: ["pumps", "loafers", "block heels", "professional flats"],
  },
  
  // === CASUAL & EVERYDAY ===
  everyday: {
    tops: ["t-shirt", "casual top", "sweater", "hoodie", "blouse casual", "tank top", "long sleeve tee", "cardigan"],
    bottoms: ["jeans", "casual pants", "joggers", "shorts", "skirt casual", "leggings", "chinos"],
    shoes: ["sneakers", "flats", "sandals", "loafers", "boots casual", "slip-ons", "canvas shoes"],
  },
  casual: {
    tops: ["t-shirt", "casual shirt", "sweater", "hoodie", "henley", "polo", "flannel shirt"],
    bottoms: ["jeans", "casual pants", "shorts", "joggers", "chinos", "cargo pants"],
    shoes: ["sneakers", "loafers", "sandals", "boat shoes", "slip-ons", "casual boots"],
  },
  weekend: {
    tops: ["casual tee", "sweatshirt", "hoodie", "flannel", "denim jacket", "casual blouse"],
    bottoms: ["jeans", "joggers", "shorts", "casual pants", "denim skirt"],
    shoes: ["sneakers", "sandals", "slip-ons", "casual boots", "espadrilles"],
  },
  brunch: {
    tops: ["blouse", "casual top", "knit top", "sundress top", "crop top", "off-shoulder top"],
    bottoms: ["jeans", "midi skirt", "wide leg pants", "shorts", "linen pants"],
    shoes: ["sandals", "mules", "ballet flats", "espadrilles", "low heels", "white sneakers"],
    dresses: ["sundress", "midi dress", "wrap dress", "maxi dress casual", "shirt dress"],
  },
  
  // === DATE & ROMANTIC ===
  date: {
    tops: ["elegant blouse", "silk top", "feminine top", "lace top", "off-shoulder top", "bodysuit", "fitted top"],
    bottoms: ["jeans", "leather pants", "midi skirt", "high waist pants", "fitted skirt", "wide leg pants"],
    shoes: ["heels", "ankle boots", "strappy sandals", "pumps", "block heels", "mules"],
    dresses: ["wrap dress", "midi dress", "slip dress", "bodycon dress", "fit and flare dress"],
  },
  date_casual: {
    tops: ["nice blouse", "fitted top", "cute sweater", "stylish tee"],
    bottoms: ["nice jeans", "midi skirt", "tailored pants"],
    shoes: ["ankle boots", "low heels", "stylish sneakers", "loafers"],
    dresses: ["casual dress", "knit dress", "shirt dress"],
  },
  date_fancy: {
    tops: ["silk blouse", "elegant top", "lace top", "dressy camisole"],
    bottoms: ["dress pants", "leather skirt", "satin pants", "midi skirt elegant"],
    shoes: ["heels", "stilettos", "strappy sandals", "elegant pumps"],
    dresses: ["cocktail dress", "midi dress elegant", "slip dress", "wrap dress silk"],
  },
  
  // === TRAVEL & VACATION ===
  vacation: {
    tops: ["tank top", "linen shirt", "casual blouse", "crop top", "resort top", "breezy top", "kimono"],
    bottoms: ["shorts", "linen pants", "wide leg pants", "maxi skirt", "flowy pants", "casual skirt"],
    shoes: ["sandals", "espadrilles", "flat sandals", "slides", "comfortable sneakers", "canvas shoes"],
    dresses: ["sundress", "maxi dress", "midi dress", "beach dress", "wrap dress", "flowy dress"],
  },
  beach: {
    tops: ["bikini top", "crop top", "tank top", "cover-up", "linen shirt", "beach blouse"],
    bottoms: ["shorts", "linen shorts", "sarong", "beach pants", "flowy skirt"],
    shoes: ["sandals", "flip flops", "slides", "espadrilles", "beach shoes"],
    dresses: ["beach dress", "cover-up dress", "maxi dress flowy", "sundress"],
  },
  resort: {
    tops: ["linen top", "silk camisole", "elegant tank", "resort blouse", "off-shoulder top"],
    bottoms: ["linen pants", "wide leg trousers", "maxi skirt", "palazzo pants", "flowy shorts"],
    shoes: ["wedges", "espadrilles", "elegant sandals", "mules", "block heel sandals"],
    dresses: ["resort dress", "maxi dress", "midi dress", "wrap dress", "flowy dress"],
  },
  travel: {
    tops: ["comfortable tee", "layering top", "cardigan", "travel-friendly blouse", "wrinkle-free top"],
    bottoms: ["comfortable pants", "travel pants", "joggers", "leggings", "stretchy jeans"],
    shoes: ["comfortable sneakers", "slip-on shoes", "walking shoes", "flat boots", "comfortable loafers"],
  },
  cruise: {
    tops: ["elegant casual top", "linen blouse", "smart casual top", "nautical top"],
    bottoms: ["dress pants", "linen pants", "smart shorts", "midi skirt"],
    shoes: ["deck shoes", "loafers", "sandals", "wedges", "boat shoes"],
    dresses: ["maxi dress", "midi dress", "wrap dress", "sundress elegant"],
  },
  
  // === HOME & COMFORT ===
  home: {
    tops: ["t-shirt", "sweatshirt", "hoodie", "loungewear top", "pajama top", "cozy sweater"],
    bottoms: ["sweatpants", "joggers", "lounge pants", "pajama pants", "shorts comfortable", "leggings soft"],
    shoes: ["slippers", "house shoes", "comfortable slides"],
  },
  lounge: {
    tops: ["loungewear top", "soft sweater", "oversized tee", "cozy hoodie", "knit top relaxed"],
    bottoms: ["lounge pants", "soft joggers", "cozy leggings", "knit pants"],
    shoes: ["slippers", "cozy slides", "soft moccasins"],
  },
  sleepwear: {
    tops: ["pajama top", "sleep shirt", "nightgown top", "camisole sleep"],
    bottoms: ["pajama pants", "sleep shorts", "lounge pants soft"],
    shoes: ["slippers", "bedroom slippers"],
  },
  
  // === SEASONAL ===
  summer: {
    tops: ["tank top", "crop top", "linen top", "sleeveless blouse", "light tee", "off-shoulder top"],
    bottoms: ["shorts", "linen pants", "flowy skirt", "mini skirt", "light joggers", "denim shorts"],
    shoes: ["sandals", "espadrilles", "slides", "canvas sneakers", "strappy sandals"],
    dresses: ["sundress", "maxi dress", "mini dress", "slip dress", "linen dress"],
  },
  winter: {
    tops: ["sweater", "turtleneck", "knit top", "fleece", "wool sweater", "thermal top", "cardigan thick"],
    bottoms: ["wool pants", "corduroy pants", "thick jeans", "warm leggings", "fleece pants"],
    shoes: ["boots", "ankle boots", "winter boots", "leather boots", "suede boots", "warm sneakers"],
  },
  fall: {
    tops: ["sweater", "cardigan", "long sleeve top", "flannel", "lightweight jacket", "knit top"],
    bottoms: ["jeans", "corduroy pants", "trousers", "midi skirt", "leather pants"],
    shoes: ["ankle boots", "loafers", "booties", "leather sneakers", "suede shoes"],
  },
  spring: {
    tops: ["light sweater", "blouse", "long sleeve tee", "light cardigan", "denim jacket"],
    bottoms: ["jeans", "light pants", "midi skirt", "cropped pants", "chinos"],
    shoes: ["loafers", "sneakers", "ballet flats", "low ankle boots", "canvas shoes"],
  },
  
  // === SPECIAL ACTIVITIES ===
  concert: {
    tops: ["band tee", "crop top", "edgy top", "leather jacket", "graphic tee", "statement top"],
    bottoms: ["jeans", "leather pants", "shorts", "mini skirt", "high waist pants"],
    shoes: ["boots", "sneakers", "platform shoes", "ankle boots", "combat boots"],
  },
  festival: {
    tops: ["crop top", "bikini top", "crochet top", "boho top", "fringe top", "tank top"],
    bottoms: ["denim shorts", "mini skirt", "flowy pants", "fringe shorts", "boho skirt"],
    shoes: ["boots", "ankle boots", "comfortable sandals", "flat boots", "western boots"],
  },
  dinner: {
    tops: ["elegant blouse", "silk top", "dressy top", "nice sweater", "smart top"],
    bottoms: ["dress pants", "nice jeans", "midi skirt", "tailored trousers"],
    shoes: ["heels", "loafers", "ankle boots", "dressy flats", "block heels"],
    dresses: ["midi dress", "wrap dress", "elegant dress", "knit dress dressy"],
  },
  garden_party: {
    tops: ["floral blouse", "feminine top", "light cardigan", "elegant tank"],
    bottoms: ["midi skirt", "flowy pants", "wide leg trousers", "A-line skirt"],
    shoes: ["wedges", "block heels", "elegant sandals", "espadrilles", "kitten heels"],
    dresses: ["floral dress", "midi dress", "A-line dress", "tea dress", "wrap dress floral"],
  },
  picnic: {
    tops: ["casual blouse", "cotton top", "light sweater", "striped tee"],
    bottoms: ["jeans", "casual skirt", "shorts", "linen pants"],
    shoes: ["sandals", "sneakers", "flats", "espadrilles"],
    dresses: ["sundress", "casual dress", "gingham dress", "shirt dress"],
  },
}

// Style modifiers that enhance product descriptions (not occasion keywords)
const STYLE_PRODUCT_MODIFIERS = {
  minimalist: {
    adjectives: ["clean", "simple", "solid", "structured", "tailored", "classic"],
    avoid: ["sequin", "glitter", "embellished", "fringe", "bold print"],
  },
  bohemian: {
    adjectives: ["flowy", "relaxed", "textured", "layered", "vintage", "embroidered", "crochet", "fringe"],
    avoid: ["structured", "formal", "corporate"],
  },
  edgy: {
    adjectives: ["leather", "bold", "asymmetric", "statement", "unique", "studded", "distressed"],
    avoid: ["delicate", "feminine", "soft", "pastel"],
  },
  classic: {
    adjectives: ["timeless", "tailored", "polished", "refined", "elegant", "sophisticated"],
    avoid: ["trendy", "avant-garde", "bold"],
  },
  romantic: {
    adjectives: ["soft", "feminine", "delicate", "flowy", "lace", "ruffle", "graceful"],
    avoid: ["edgy", "structured", "bold"],
  },
  sporty: {
    adjectives: ["athletic", "comfortable", "functional", "active", "performance"],
    avoid: ["formal", "delicate", "restrictive"],
  },
  trendy: {
    adjectives: ["fashion-forward", "modern", "stylish", "contemporary", "on-trend"],
    avoid: ["outdated", "classic", "traditional"],
  },
  nordic: {
    adjectives: ["minimal", "functional", "clean", "neutral", "quality", "simple", "understated"],
    avoid: ["bold", "flashy", "ornate"],
  },
  preppy: {
    adjectives: ["classic", "polished", "tailored", "collegiate", "smart"],
    avoid: ["edgy", "bohemian", "casual"],
  },
  streetwear: {
    adjectives: ["urban", "oversized", "graphic", "casual", "statement", "logo"],
    avoid: ["formal", "delicate", "structured"],
  },
  athleisure: {
    adjectives: ["sporty", "comfortable", "versatile", "sleek", "performance", "stretch"],
    avoid: ["formal", "structured", "delicate"],
  },
}

/**
 * ✅ NEW: Build semantic query using PRODUCT TYPES, not occasion keywords
 * This is the core of the new search strategy
 */
function buildSemanticQuery(query, occasion, category, style = null) {
  // Get product types for this occasion and category
  const occasionMapping = OCCASION_PRODUCT_MAPPING[occasion] || OCCASION_PRODUCT_MAPPING.everyday
  const productTypes = occasionMapping[category] || []
  
  // Start with the original query (user's request)
  let searchTerms = [query]
  
  // Add relevant product types (the actual terms that exist in product descriptions)
  if (productTypes.length > 0) {
    // Take top 5 most relevant product types to avoid overly broad queries
    const relevantTypes = productTypes.slice(0, 5)
    searchTerms.push(...relevantTypes)
  }
  
  // Add style-specific product descriptors (not abstract words, but product attributes)
  if (style) {
    const styleConfig = STYLE_PRODUCT_MODIFIERS[style.toLowerCase()]
    if (styleConfig) {
      // Add a few style adjectives that might appear in product descriptions
      const styleTerms = styleConfig.adjectives.slice(0, 3)
      searchTerms.push(...styleTerms)
    }
  }
  
  // Add the category itself for reinforcement
  searchTerms.push(category)
  
  // Build final query - product types first for stronger matching
  const semanticQuery = searchTerms.join(' ')
  
  console.log(`   🎯 Query strategy: occasion "${occasion}" → product types: [${productTypes.slice(0, 5).join(', ')}]`)
  
  return semanticQuery
}

/**
 * Get product types for a given occasion and category
 * Useful for external callers
 */
function getOccasionProductTypes(occasion, category) {
  const mapping = OCCASION_PRODUCT_MAPPING[occasion] || OCCASION_PRODUCT_MAPPING.everyday
  return mapping[category] || []
}

/**
 * Get all supported occasions
 */
function getSupportedOccasions() {
  return Object.keys(OCCASION_PRODUCT_MAPPING)
}

// ============================================================================

// API ROUTES

// ============================================================================

/**
 * Health check
 */
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Vector search server is running (IMPROVED v2)",
    endpoints: {
      health: "GET /health",
      search: "POST /api/search",
      count: "GET /api/count",
    },
  })
})

app.get("/health", async (req, res) => {
  try {
    const meta = await weaviateClient.misc.metaGetter().do()
    res.json({
      status: "ok",
      service: "vector-search-server-improved",
      weaviate: {
        connected: true,
        version: meta.version,
      },
      openai: {
        model: EMBEDDING_MODEL,
      },
    })
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    })
  }
})

/**
 * Get product count
 */
app.get("/api/count", async (req, res) => {
  try {
    const result = await weaviateClient.graphql.aggregate().withClassName("Product").withFields("meta { count }").do()

    const count = result.data.Aggregate.Product?.[0]?.meta?.count || 0

    res.json({
      success: true,
      count: count,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

/**
 * MAIN SEARCH ENDPOINT (IMPROVED v2)
 * ✅ KEY CHANGES:
 * - Removed occasion fallback filter (trust embeddings)
 * - Increased Top-K fetch limit
 * - Added heelType safety filters for shoes
 * - Simplified post-filtering
 */
app.post("/api/search", async (req, res) => {
  try {
    const {
      query,
      limit = 80,
      category = "general",
      occasion = "everyday",
      priceRange = null,
      totalBudget = null,
      style = null,
    } = req.body

    if (!query) {
      return res.status(400).json({
        success: false,
        error: "Query is required",
      })
    }

    console.log(`\n🔍 IMPROVED VECTOR SEARCH v2:`)
    console.log(`   Query: "${query}"`)
    console.log(`   Category: ${category}`)
    console.log(`   Occasion: ${occasion}`)
    if (style) console.log(`   Style: ${style}`)
    console.log(`   Limit: ${limit}`)

    const semanticQuery = buildSemanticQuery(query, occasion, category, style)
    console.log(`   Semantic: "${semanticQuery.substring(0, 150)}..."`)

    console.log(`   🤖 Generating embedding...`)
    const embedding = await generateEmbedding(semanticQuery)

    if (!embedding) {
      return res.status(500).json({
        success: false,
        error: "Failed to generate embedding",
      })
    }

    console.log(`   ✅ Embedding ready (${embedding.length} dims)`)

    const whereFilters = {
      operator: "And",
      operands: [
        {
          path: ["category"],
          operator: "Equal",
          valueText: category,
        },
      ],
    }

    // ✅ FIXED: Removed hard occasion filter - let embeddings handle occasion matching naturally
    // The semantic query already includes occasion-specific keywords which ensures relevant results
    // Hard filtering was causing ~4k leggings to be filtered down to ~19
    console.log(`   🔍 Trusting embeddings for occasion: ${occasion} (no hard filter)`)
    
    // DIAGNOSTIC: Log what filters are being applied
    console.log(`   📋 Active filters: category=${category}`)

    // ✅ SAFETY NET: Only add heel-type restrictions for shoes (minimal hard filtering)
    if (category === "shoes") {
      if (occasion === "workout") {
        whereFilters.operands.push({
          path: ["heelType"],
          operator: "Equal",
          valueText: "flat"  // Only flat shoes for workout
        })
        console.log(`   👟 Heel filter: flat shoes only (workout)`)
      } else if (occasion === "work") {
        whereFilters.operands.push({
          path: ["heelType"],
          operator: "NotEqual",
          valueText: "high"  // No very high heels for work (mid/flat only)
        })
        console.log(`   👟 Heel filter: excluding high heels (work appropriate)`)
      }
    }

    let budgetInfo = null
    if (priceRange && priceRange.min !== undefined && priceRange.max !== undefined) {
      if (!totalBudget) {
        console.log(`   ⚠️  No totalBudget provided, using priceRange for tier detection (may be inaccurate)`)
      }

      const budgetForCalculation = totalBudget || priceRange
      budgetInfo = calculateSmartBudget(budgetForCalculation.min, budgetForCalculation.max, category, occasion)

      whereFilters.operands.push({
        path: ["price"],
        operator: "GreaterThanEqual",
        valueNumber: budgetInfo.searchMin,
      })

      if (!budgetInfo.isUnlimited) {
        whereFilters.operands.push({
          path: ["price"],
          operator: "LessThanEqual",
          valueNumber: budgetInfo.searchMax,
        })
      }

      console.log(`   💰 Budget Strategy:`)
      console.log(`      Tier: ${budgetInfo.tier}`)
      console.log(`      Total Budget: $${budgetForCalculation.min}-$${budgetForCalculation.max}`)
      console.log(
        `      Category: ${category} (${Math.round((budgetInfo.categoryMin / budgetForCalculation.min) * 100)}% of total)`,
      )
      console.log(`      User Range: $${budgetInfo.categoryMin} - $${budgetInfo.categoryMax}`)
      console.log(
        `      Search Range: $${budgetInfo.searchMin} - ${budgetInfo.isUnlimited ? "unlimited" : "$" + budgetInfo.searchMax}`,
      )
      console.log(
        `      Flexibility: -${budgetInfo.downFlexPercent}% / +${budgetInfo.upFlexPercent}${typeof budgetInfo.upFlexPercent === "string" ? "" : "%"}`,
      )
    }

    console.log(`   🔎 Searching Weaviate with hybrid search...`)

    // ✅ FIXED: Much higher multipliers to ensure we get enough products before post-filtering
    // Bottoms especially need higher limits since many are neutral/everyday items
    const categoryMultiplier = category === "shoes" ? 8 : category === "bottoms" ? 6 : 4
    const fetchMultiplier = (budgetInfo?.tier === "luxury" ? 6 : budgetInfo?.tier === "premium" ? 5 : 4) * categoryMultiplier
    const initialLimit = Math.min(Math.round(limit * fetchMultiplier), 2000) // Cap at 2000 to prevent timeouts

    console.log(`   📊 Fetch strategy: ${initialLimit} products (${fetchMultiplier.toFixed(1)}x multiplier for ${budgetInfo?.tier || 'standard'} tier + ${category})`)

    const response = await weaviateClient.graphql
      .get()
      .withClassName("Product")
      .withFields(
        "product_id product_name description brand price color category suitableOccasions formalityLevel heelType",
      )
      .withNearVector({ vector: embedding })
      .withWhere(whereFilters)
      .withLimit(initialLimit)
      .withHybrid({
        query: query,
        alpha: 0.7,
      })
      .do()

    let products = response.data.Get.Product || []
    console.log(`   ✓ Found ${products.length} products before processing`)
    
    // ✅ SIMPLIFIED: Minimal style coherence filtering - trust embeddings
    const preFilterCount = products.length
    products = products.filter(product => {
      const name = (product.product_name || '').toLowerCase()
      const desc = (product.description || '').toLowerCase()
      const combined = `${name} ${desc}`
      
      // Workout: Only reject EXTREME formal wear (2+ indicators)
      if (occasion === 'workout') {
        const extremeRejects = ["sequin", "beaded", "rhinestone", "glitter", "formal", "evening", "gown", "tuxedo", "cocktail"]
        const rejectCount = extremeRejects.filter(word => combined.includes(word)).length
        if (rejectCount >= 2) return false  // Reject obvious party/formal items
      }
      
      // Formal/Party: Only reject EXTREME athletic wear
      if ((occasion === 'party' || occasion === 'formal') && (category === 'tops' || category === 'bottoms')) {
        if (/\bsweatpant|\bjogger|\bgym\s*short|\bworkout\s*(top|pant)|\bactivewear\b/i.test(combined)) {
          return false
        }
      }
      
      return true
    })
    
    if (preFilterCount > products.length) {
      console.log(`   🎨 Style coherence filter: ${preFilterCount} → ${products.length} products (minimal filtering)`)
    }

    // ✅ FIXED: Smarter budget relaxation - also reduces min price and increases limit
    if (products.length < limit / 2 && budgetInfo && !budgetInfo.isUnlimited) {
      console.log(`   ⚠️  Only ${products.length} products found (need ${limit}), relaxing constraints...`)
      console.log(`   📋 DIAGNOSTIC: Category=${category}, Occasion=${occasion}, Budget=$${budgetInfo.searchMin}-$${budgetInfo.searchMax}`)

      // Retry 1: Relax price BOTH directions (+50% up, -30% down)
      const relaxedMin = Math.max(0, budgetInfo.searchMin * 0.7)
      const relaxedMax = budgetInfo.searchMax * 1.5
      console.log(`   🔄 Retry 1: Expanding budget $${Math.round(relaxedMin)}-$${Math.round(relaxedMax)}`)

      whereFilters.operands = whereFilters.operands.filter(
        (op) => op.path[0] !== "price",
      )
      whereFilters.operands.push(
        { path: ["price"], operator: "GreaterThanEqual", valueNumber: relaxedMin },
        { path: ["price"], operator: "LessThanEqual", valueNumber: relaxedMax }
      )

      const retryResponse = await weaviateClient.graphql
        .get()
        .withClassName("Product")
        .withFields("product_id product_name description brand price color category suitableOccasions formalityLevel heelType")
        .withNearVector({ vector: embedding })
        .withWhere(whereFilters)
        .withLimit(initialLimit * 2) // Double the fetch limit
        .withHybrid({ query: query, alpha: 0.7 })
        .do()

      products = retryResponse.data.Get.Product || []
      console.log(`   ✓ Retry 1 result: ${products.length} products`)

      // Retry 2: Remove price floor entirely, double max
      if (products.length < limit / 2) {
        const veryRelaxedMax = budgetInfo.searchMax * 3
        console.log(`   🔄 Retry 2: Removing min, expanding max to $${Math.round(veryRelaxedMax)}`)

        whereFilters.operands = whereFilters.operands.filter((op) => op.path[0] !== "price")
        whereFilters.operands.push(
          { path: ["price"], operator: "GreaterThanEqual", valueNumber: 0 },
          { path: ["price"], operator: "LessThanEqual", valueNumber: veryRelaxedMax }
        )

        const retry2Response = await weaviateClient.graphql
          .get()
          .withClassName("Product")
          .withFields("product_id product_name description brand price color category suitableOccasions formalityLevel heelType")
          .withNearVector({ vector: embedding })
          .withWhere(whereFilters)
          .withLimit(initialLimit * 3)
          .withHybrid({ query: query, alpha: 0.7 })
          .do()

        products = retry2Response.data.Get.Product || []
        console.log(`   ✓ Retry 2 result: ${products.length} products`)

        // Retry 3: Remove ALL price filters - just category filter
        if (products.length < limit / 2) {
          console.log(`   🔄 Retry 3: Removing ALL price filters (category-only search)`)

          whereFilters.operands = whereFilters.operands.filter((op) => op.path[0] !== "price")

          const retry3Response = await weaviateClient.graphql
            .get()
            .withClassName("Product")
            .withFields("product_id product_name description brand price color category suitableOccasions formalityLevel heelType")
            .withNearVector({ vector: embedding })
            .withWhere(whereFilters)
            .withLimit(initialLimit * 4) // 4x the original limit
            .withHybrid({ query: query, alpha: 0.7 })
            .do()

          products = retry3Response.data.Get.Product || []
          console.log(`   ✓ Retry 3 result: ${products.length} products (no price filter)`)
        }
      }
    }

    products = deduplicateProducts(products)
    console.log(`   ✓ ${products.length} unique products after deduplication`)

    products = postFilterByOccasion(products, occasion, category)
    console.log(`   ✓ ${products.length} products after post-filter`)

    products = calculateDiversityScore(products)
    console.log(`   ✓ Diversity scoring applied`)

    products = products.slice(0, limit)

    console.log(`   ✅ Returning ${products.length} products`)
    if (products.length > 0) {
      console.log(
        `   Top 3: ${products
          .slice(0, 3)
          .map((p) => `${p.product_name?.substring(0, 30)} ($${p.price})`)
          .join(", ")}`,
      )
    }

    const budgetSummary = budgetInfo
      ? {
          tier: budgetInfo.tier,
          categoryBudget: `$${budgetInfo.categoryMin}-$${budgetInfo.categoryMax}`,
          searchRange: `$${budgetInfo.searchMin}-${budgetInfo.isUnlimited ? "unlimited" : "$" + budgetInfo.searchMax}`,
          flexibility: `${budgetInfo.downFlexPercent}%/${budgetInfo.upFlexPercent}${typeof budgetInfo.upFlexPercent === "string" ? "" : "%"}`,
        }
      : null

    res.json({
      success: true,
      product_ids: products.map((p) => p.product_id),
      count: products.length,
      query: query,
      category: category,
      occasion: occasion,
      style: style,
      budget: budgetSummary,
    })
  } catch (error) {
    console.error("❌ Search error:", error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

/**
 * Batch search endpoint (for searching multiple categories at once)
 */
app.post("/api/search-batch", async (req, res) => {
  try {
    const { queries } = req.body

    if (!queries || !Array.isArray(queries)) {
      return res.status(400).json({
        success: false,
        error: "Queries array is required",
      })
    }

    console.log(`\n📦 Batch search: ${queries.length} queries`)

    const results = await Promise.all(
      queries.map(async (q) => {
        const semanticQuery = buildSemanticQuery(q.query, q.occasion || "everyday", q.category || "general", q.style)
        const embedding = await generateEmbedding(semanticQuery)

        if (!embedding) return { query: q.query, product_ids: [] }

        const whereFilters = {
          operator: "And",
          operands: [
            {
              path: ["category"],
              operator: "Equal",
              valueText: q.category || "general",
            },
          ],
        }

        // ✅ IMPROVED: Use strict occasion filtering
        const specificOccasions = ["workout", "party", "work", "formal"]
        if (q.occasion && specificOccasions.includes(q.occasion)) {
          whereFilters.operands.push({
            path: ["suitableOccasions"],
            operator: "ContainsAny",
            valueTextArray: [q.occasion],
          })
        }

        const response = await weaviateClient.graphql
          .get()
          .withClassName("Product")
          .withFields("product_id product_name")
          .withNearVector({ vector: embedding })
          .withWhere(whereFilters)
          .withLimit(q.limit || 80)
          .do()

        const products = response.data.Get.Product || []

        return {
          query: q.query,
          category: q.category,
          occasion: q.occasion,
          style: q.style,
          product_ids: products.map((p) => p.product_id),
          count: products.length,
        }
      }),
    )

    console.log(`✅ Batch complete\n`)

    res.json({
      success: true,
      results: results,
    })
  } catch (error) {
    console.error("❌ Batch search error:", error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

/**
 * EMBEDDING GENERATION ENDPOINT (IMPROVED v2)
 * ✅ KEY CHANGES:
 * - Extracts subcategory from category_name
 * - Includes subcategory in embedding text for better matching
 * - Uses outfit_category as primary category source
 * - Strengthened occasion boost keywords
 */
app.post("/api/generate-embeddings", async (req, res) => {
  try {
    console.log("\n========================================")
    console.log("🚀 STARTING EMBEDDING GENERATION (v2)")
    console.log("========================================\n")

    const startTime = Date.now()

    // ========================================================================

    // STEP 1: DELETE OLD DATA FROM WEAVIATE

    // ========================================================================

    console.log("1️⃣  Clearing old Weaviate data...")
    try {
      await weaviateClient.schema.classDeleter().withClassName("Product").do()
      console.log("   ✅ Deleted old Product class\n")
    } catch (error) {
      console.log("   ℹ️  No existing Product class to delete\n")
    }

    // ========================================================================

    // STEP 2: RECREATE PRODUCT CLASS SCHEMA

    // ========================================================================

    console.log("2️⃣  Creating Product class schema...")
    const classObj = {
      class: "Product",
      description: "Product with embeddings (v2 - with subcategory)",
      vectorizer: "none",
      properties: [
        {
          name: "product_id",
          dataType: ["text"],
          description: "Product ID",
        },
        {
          name: "product_name",
          dataType: ["text"],
          description: "Product name",
        },
        {
          name: "description",
          dataType: ["text"],
          description: "Product description",
        },
        {
          name: "price",
          dataType: ["number"],
          description: "Product price",
        },
        {
          name: "category",
          dataType: ["text"],
          description: "Product category (outfit_category)",
        },
        {
          name: "subcategory",
          dataType: ["text"],
          description: "Product subcategory (extracted from category_name)",
        },
        {
          name: "brand",
          dataType: ["text"],
          description: "Brand name",
        },
        {
          name: "color",
          dataType: ["text"],
          description: "Product color",
        },
        {
          name: "suitableOccasions",
          dataType: ["text[]"],
          description: "Suitable occasions",
        },
        {
          name: "formalityLevel",
          dataType: ["text"],
          description: "Formality level",
        },
        {
          name: "heelType",
          dataType: ["text"],
          description: "Heel type for shoes",
        },
      ],
    }

    await weaviateClient.schema.classCreator().withClass(classObj).do()
    console.log("   ✅ Product class created (with subcategory field)\n")

    // ========================================================================

    // STEP 3: FETCH PRODUCTS FROM SUPABASE

    // ========================================================================

    console.log("3️⃣  Fetching products from Supabase...")
    const { createClient } = await import("@supabase/supabase-js")
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

    let allProducts = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data: products, error } = await supabase
        .from("zara_cloth_scraper")
        .select("*")
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (error) {
        return res.status(500).json({
          success: false,
          error: `Supabase error: ${error.message}`,
        })
      }

      if (products.length === 0) {
        hasMore = false
      } else {
        allProducts = [...allProducts, ...products]
        page++
        console.log(`   📄 Fetched page ${page}: ${products.length} products (total: ${allProducts.length})`)
      }
    }
    console.log(`   ✅ Total products fetched: ${allProducts.length}\n`)

    // ========================================================================

    // STEP 4: FILTER VALID PRODUCTS

    // ========================================================================

    console.log("4️⃣  Filtering valid products...")
    const validProducts = allProducts.filter((p) => {
      const hasName = p.product_name?.trim() && p.product_name.length > 2
      const hasPrice = Number.parseFloat(p.price) > 0
      return hasName && hasPrice
    })
    console.log(`   ✅ ${validProducts.length} valid products (removed ${allProducts.length - validProducts.length})\n`)

    // ========================================================================
    // HELPER FUNCTIONS FOR EMBEDDING GENERATION
    // ========================================================================

    function extractMaterials(materialsData) {
      if (!materialsData) return "versatile"
      const text = typeof materialsData === 'string' ? materialsData.toLowerCase() : JSON.stringify(materialsData).toLowerCase()
      const materials = []
      const fabricMap = { cotton: 'cotton', silk: 'silk', wool: 'wool', linen: 'linen', leather: 'leather', denim: 'denim', polyester: 'polyester', nylon: 'nylon', spandex: 'spandex' }
      for (const [pattern, label] of Object.entries(fabricMap)) {
        if (text.includes(pattern)) materials.push(label)
      }
      return materials.length > 0 ? materials.join(' ') : 'versatile'
    }

    function extractNeckline(name, desc) {
      const combined = `${name} ${desc}`.toLowerCase()
      const necklines = ['v-neck', 'crew', 'scoop', 'turtleneck', 'off-shoulder', 'halter', 'boat-neck', 'sweetheart']
      for (const neckline of necklines) {
        if (combined.includes(neckline)) return neckline
      }
      return null
    }

    function extractSleeveType(name, desc) {
      const combined = `${name} ${desc}`.toLowerCase()
      if (combined.includes('sleeveless') || combined.includes('tank')) return 'sleeveless'
      if (combined.includes('long sleeve')) return 'long sleeve'
      if (combined.includes('short sleeve')) return 'short sleeve'
      if (combined.includes('cap sleeve')) return 'cap sleeve'
      if (combined.includes('three-quarter')) return 'three-quarter sleeve'
      return null
    }

    function extractPattern(name, desc) {
      const combined = `${name} ${desc}`.toLowerCase()
      const patterns = { stripe: 'striped', floral: 'floral', 'polka dot': 'polka dot', plaid: 'plaid', check: 'checked', paisley: 'paisley', animal: 'animal print', solid: 'solid' }
      for (const [pattern, label] of Object.entries(patterns)) {
        if (combined.includes(pattern)) return label
      }
      return 'solid'
    }

    function extractFit(name, desc) {
      const combined = `${name} ${desc}`.toLowerCase()
      const fits = ['oversized', 'fitted', 'relaxed', 'slim', 'skinny', 'loose', 'tailored', 'boxy']
      for (const fit of fits) {
        if (combined.includes(fit)) return fit
      }
      return 'regular'
    }

    function extractCut(name, desc, category) {
      const combined = `${name} ${desc}`.toLowerCase()
      if (category === 'shoes') {
        if (/platform|high heel|stiletto/i.test(combined)) return 'high'
        if (/kitten heel|mid heel|block heel/i.test(combined)) return 'mid'
        if (/flat|sneaker|trainer|loafer|sandal/i.test(combined)) return 'flat'
        return 'flat'
      }
      if (category === 'bottoms') {
        const cuts = ['wide-leg', 'straight', 'skinny', 'cropped', 'high-rise', 'low-rise', 'mid-rise', 'bootcut', 'flared']
        for (const cut of cuts) {
          if (combined.includes(cut)) return cut
        }
      }
      return null
    }

    /**
     * ✅ IMPROVED: Exclusive occasion detection - no fallback stacking
     */
    function detectSuitableOccasions(name, desc) {
      const combined = `${name} ${desc}`.toLowerCase()
      const occasions = []
      
      // HIERARCHY: Check from most specific to least specific
      // Each item gets ONE primary occasion (NEVER add fallback)
      
      // WORKOUT - HIGHEST PRIORITY (NEVER add other occasions if this matches)
      if (/\b(workout|athletic|sport|gym|fitness|training|running|yoga|active|jogger|sweatpant|performance|moisture.?wicking|legging|tank|sports.?bra|activewear|compression|dri.?fit|breathable|stretch|gym\s*shorts?|track\s*pant|trainers?|sneakers?|cross.?fit)\b/i.test(combined)) {
        occasions.push('workout')
        return occasions // ← CRITICAL: Stop here, don't add "everyday"
      }
      
      // FORMAL - SECOND PRIORITY
      if (/\b(formal|evening|gown|tuxedo|cocktail|black.?tie|gala|dinner\s*jacket|dress\s*shirt|dress\s*pant)\b/i.test(combined)) {
        occasions.push('formal')
        return occasions // ← Stop here
      }
      
      // PARTY - THIRD PRIORITY
      if (/\b(party|sequin|beaded|rhinestone|metallic|sparkle|glitter|club|night\s*out|date\s*night|festive|dressy)\b/i.test(combined)) {
        occasions.push('party')
        return occasions // ← Stop here
      }
      
      // WORK/BUSINESS - FOURTH PRIORITY
      if (/\b(business|professional|work|office|blazer|suit|business\s*casual|corporate|career|trouser)\b/i.test(combined)) {
        occasions.push('work')
        return occasions // ← Stop here
      }
      
      // HOME/CASUAL - FIFTH PRIORITY
      if (/\b(loungewear|homewear|cozy|home|casual|relaxed|comfortable|everyday)\b/i.test(combined)) {
        occasions.push('everyday')
        return occasions
      }
      
      // DEFAULT: EVERYDAY ONLY
      occasions.push('everyday')
      return occasions
    }

    function classifyBrandTier(brand, price) {
      if (price > 300) return 'luxury'
      if (price > 100) return 'premium'
      if (price > 50) return 'mid-range'
      return 'affordable'
    }

    /**
     * ✅ IMPROVED: Detect category - prioritizes outfit_category
     */
    function detectCategory(product) {
      // ✅ PRIORITY 1: Use outfit_category from database (100% accurate, set at scrape time)
      if (product.outfit_category) {
        return product.outfit_category
      }
      
      // FALLBACK 2: Use category_name field (most accurate)
      const categoryName = (product.category_name || "").toLowerCase()

      if (categoryName) {
        // Filter out ONLY true accessories - NOT swimwear bottoms
        if (/accessori|wallet|keychain|\bbag\b|purse|jewelry|watch|\bbelt\b|\bhat\b|scarf|glove|sunglasses|bralette|\bthong\b(?!.*bodysuit)|underwear(?!.*dress)|lingerie(?!.*dress)|bikini\s*top|swim\s*top|necklace|bracelet|earring|\bring\b|cover[\s-]?up/i.test(categoryName)) {
          return "unknown"
        }

        // CHECK IN STRICT ORDER: shoes → bottoms → tops
        // SHOES FIRST (most specific)
        if (/shoe|boot|sneaker|trainer|sandal|heel|flat|pump|footwear/i.test(categoryName)) {
          return "shoes"
        }

        // BOTTOMS SECOND - flexible patterns without strict word boundaries
        if (/pant|jean|trouser|legging|short(?!.*sleeve)|skirt|jogger|culotte|chino|sweatpant|palazzo|capri|skort|bottoms/i.test(categoryName)) {
          return "bottoms"
        }

        // TOPS LAST
        if (/shirt|blouse|top|tank|tee|sweater|cardigan|hoodie|jacket|blazer|coat|vest|dress|gown|tunic|pullover|crop|cami|bodysuit/i.test(categoryName)) {
          return "tops"
        }
      }

      // FALLBACK 3: Use product name and description
      const name = (product.product_name || "").toLowerCase()
      const desc = (product.description || "").toLowerCase()
      const combined = `${name} ${desc}`

      // Filter ONLY true accessories - NOT clothing
      if (/wallet|keychain|\bbag\b(?!gy)|purse|jewelry|watch|\bbelt\b(?!ed)|\bhat\b|scarf|glove(?!s?\b)|sunglasses|bralette|\bthong\b(?!.*bodysuit)|underwear(?!.*dress)|lingering(?!.*dress)|bikini\s*top|swim\s*top|necklace|bracelet|earring|\bring\b(?!.*detail)|sarong|cover[\s-]?up/i.test(combined)) {
        return "unknown"
      }

      // CHECK IN STRICT ORDER: shoes → bottoms → tops

      // SHOES FIRST - flexible pattern
      if (/shoe|boot|sneaker|trainer|sandal|pump|loafer|heel|flat|mule|clog|espadrille|oxford|derby|monk|brogue/i.test(combined)) {
        return "shoes"
      }

      // BOTTOMS SECOND - ULTRA FLEXIBLE (handles hyphens, compounds, modifiers)
      // Matches: "Wide-Leg Jeans", "Cargo Pants", "Mini Skirt", "Bikini Bottoms"
      if (/pant|jean|trouser|legging|short(?![s\-]*\s*sleeve)|skirt|jogger|culotte|chino|sweatpant|palazzo|capri|skort|bottoms/i.test(combined)) {
        return "bottoms"
      }

      // TOPS LAST - flexible pattern with modifiers
      // Matches: "Mini Dress", "Tube Dress", "Strapless Dress", "Bodysuit"
      if (/shirt|blouse|top(?!knot)|tank|tee|sweater|cardigan|hoodie|jacket|blazer|coat|vest|dress|gown|tunic|poncho|pullover|crop|halter|cami|romper|jumpsuit|bodysuit/i.test(combined)) {
        return "tops"
      }

      return "unknown"
    }

    // ========================================================================

    // STEP 5: GENERATE EMBEDDINGS (v2 - WITH SUBCATEGORY)

    // ========================================================================

    console.log("5️⃣  Generating embeddings with OpenAI (v2 - with subcategory)...")
    const BATCH_SIZE = 100
    const productsWithEmbeddings = []
    let embeddingCount = 0
    let subcategoryCount = 0

    // ✅ NEW: Occasion boost keywords for stronger semantic signal
    const occasionBoost = {
      'workout': 'athletic performance gym fitness training sports active running yoga legging jogger sneaker trainer',
      'formal': 'formal evening elegant sophisticated gown tuxedo black-tie gala dinner',
      'party': 'party sequin sparkle glitter metallic glamorous nightclub festive dressy',
      'work': 'professional business corporate office blazer tailored business-casual',
      'everyday': 'casual comfortable everyday basic versatile simple'
    }

    for (let i = 0; i < validProducts.length; i += BATCH_SIZE) {
      const batch = validProducts.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(validProducts.length / BATCH_SIZE)

      console.log(`   📦 Batch ${batchNum}/${totalBatches}`)

      const results = await Promise.all(
        batch.map(async (product) => {
          try {
            // ✅ PRIORITY 1: Use outfit_category (100% accurate)
            const category = product.outfit_category || detectCategory(product)
            const name = product.product_name || ""
            const desc = product.description || ""

            // Skip products with unknown category
            if (category === "unknown" || !category) {
              console.log(`   ⚠️  Skipping product with unknown category: ${name.substring(0, 50)}`)
              return null
            }

            // ✅ NEW: Extract subcategory from category_name
            const subcategory = extractSubcategory(product.category_name)
            if (subcategory) subcategoryCount++

            const occasions = detectSuitableOccasions(name, desc)
            const formalityLevel = classifyBrandTier(product.brand, Number.parseFloat(product.price))
            const heelType = extractCut(name, desc, category)
            const primaryOccasion = occasions[0] || 'everyday'

            // ✅ CRITICAL FIX: Build RICH embedding text with subcategory emphasis
            const embeddingText = `${name}. ${desc}. Main category: ${category}. ${subcategory ? `Product type: ${subcategory} ${category}.` : ''} Heel height: ${heelType}. Material: ${extractMaterials(product.materials || product.materials_description || desc)}. Neckline: ${extractNeckline(name, desc)}. Sleeve: ${extractSleeveType(name, desc)}. Pattern: ${extractPattern(name, desc)}. Fit: ${extractFit(name, desc)}. Cut: ${heelType}. Suitable for: ${occasions.join(", ")}. Formality: ${formalityLevel}. Occasion emphasis: ${occasionBoost[primaryOccasion]} ${primaryOccasion}. Heel type: ${heelType}`

            const embedding = await generateEmbedding(embeddingText)

            if (embedding) embeddingCount++

            // Use both product.id and product.product_id for compatibility
            const productId = product.product_id || product.id

            return {
              product_id: productId,
              product_name: product.product_name,
              description: product.description,
              price: product.price,
              brand: product.brand,
              color: product.colour || product.color,
              category: product.outfit_category || category, // ✅ Use outfit_category
              subcategory: subcategory, // ✅ NEW: Store subcategory
              suitableOccasions: occasions,
              formalityLevel: formalityLevel,
              heelType: heelType,
              embedding: embedding,
            }
          } catch (error) {
            console.error(`   ❌ Error processing product "${product.product_name}":`, error.message)
            return null
          }
        }),
      )

      // Filter out nulls
      const validResults = results.filter(r => r !== null && r.embedding !== null)
      productsWithEmbeddings.push(...validResults)
      console.log(`      ✅ Generated ${validResults.length} embeddings (${subcategoryCount} with subcategory)`)

      // Reduced rate limiting
      if (i + BATCH_SIZE < validProducts.length) {
        await new Promise((r) => setTimeout(r, 200))
      }
    }

    console.log(`\n   ✅ Total: ${embeddingCount} embeddings generated`)
    console.log(`   ✅ Products with subcategory: ${subcategoryCount}\n`)

    // ========================================================================

    // STEP 6: BATCH IMPORT TO WEAVIATE

    // ========================================================================

    console.log("6️⃣  Importing to Weaviate...")

    let successCount = 0
    let failedCount = 0
    for (let i = 0; i < productsWithEmbeddings.length; i += BATCH_SIZE) {
      const batch = productsWithEmbeddings.slice(i, i + BATCH_SIZE).filter((p) => p.embedding)

      try {
        let batcher = weaviateClient.batch.objectsBatcher()

        for (const product of batch) {
          // Convert product_id to string to ensure compatibility
          const productIdStr = String(product.product_id)

          batcher = batcher.withObject({
            class: "Product",
            properties: {
              product_id: productIdStr,
              product_name: product.product_name || "Unknown",
              description: (product.description || "").substring(0, 1000),
              price: Number.parseFloat(product.price) || 0,
              brand: product.brand || "",
              color: product.color || "",
              category: product.category || "",
              subcategory: product.subcategory || "", // ✅ NEW: Include subcategory
              suitableOccasions: product.suitableOccasions || ["everyday"],
              formalityLevel: product.formalityLevel || "mid-range",
              heelType: product.heelType || "",
            },
            vector: product.embedding,
          })
        }

        await batcher.do()
        successCount += batch.length
        
        if ((i / BATCH_SIZE + 1) % 10 === 0) {
          console.log(`   ✅ Imported ${successCount} products...`)
        }
      } catch (error) {
        console.error(`   ❌ Batch import error:`, error.message)
        failedCount += batch.length
      }
    }

    console.log(`\n   ✅ Import complete: ${successCount} success, ${failedCount} failed\n`)

    // ========================================================================

    // STEP 7: VERIFY

    // ========================================================================

    console.log("7️⃣  Verifying Weaviate data...")
    const result = await weaviateClient.graphql.aggregate().withClassName("Product").withFields("meta { count }").do()

    const count = result.data.Aggregate.Product?.[0]?.meta?.count || 0
    console.log(`   ✅ Products in Weaviate: ${count}\n`)

    const duration = Math.round((Date.now() - startTime) / 1000)

    console.log("========================================")
    console.log("✅ EMBEDDING GENERATION COMPLETE (v2)")
    console.log("========================================")
    console.log(`⏱️  Duration: ${duration}s`)
    console.log(`📊 Processed: ${validProducts.length}`)
    console.log(`🤖 Embeddings: ${embeddingCount}`)
    console.log(`📂 With subcategory: ${subcategoryCount}`)
    console.log(`✅ Imported: ${successCount}`)
    console.log(`💾 In Weaviate: ${count}`)
    console.log("========================================\n")

    res.json({
      success: true,
      message: "Embedding generation complete (v2 - with subcategory)",
      stats: {
        processed: validProducts.length,
        embeddings: embeddingCount,
        withSubcategory: subcategoryCount,
        imported: successCount,
        inWeaviate: count,
        duration: `${duration}s`,
      },
    })
  } catch (error) {
    console.error("❌ Embedding generation error:", error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// ============================================================================

// START SERVER

// ============================================================================

app.listen(PORT, () => {
  console.log("\n========================================")
  console.log("🚀 IMPROVED VECTOR SEARCH SERVER (v2)")
  console.log("========================================")
  console.log(`📍 Running on: http://localhost:${PORT}`)
  console.log(`🔗 Weaviate: ${process.env.WEAVIATE_SCHEME}://${process.env.WEAVIATE_HOST}`)
  console.log(`🤖 Model: ${EMBEDDING_MODEL}`)
  console.log("========================================")
  console.log("\n📋 Endpoints:")
  console.log(`   GET  /                           - Service info`)
  console.log(`   GET  /health                     - Health check`)
  console.log(`   GET  /api/count                  - Product count`)
  console.log(`   POST /api/search                 - Vector search (IMPROVED v2)`)
  console.log(`   POST /api/search-batch           - Batch search`)
  console.log(`   POST /api/generate-embeddings    - Generate & import embeddings (v2)`)
  console.log("\n✅ Server ready!\n")
})

/**
 * Generate embedding for query with retry logic
 */
async function generateEmbedding(text, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text.substring(0, 8000),
      })
      return response.data[0].embedding
    } catch (error) {
      if (attempt === retries) {
        console.error(`❌ Embedding error after ${retries} attempts:`, error.message)
        return null
      }
      
      // Wait before retry (exponential backoff)
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
      console.log(`   ⚠️  Retry ${attempt}/${retries} after ${waitTime}ms...`)
      await new Promise(r => setTimeout(r, waitTime))
    }
  }
  return null
}

/**
 * ✅ IMPROVED: Minimal post-filter - trust embeddings, only reject ABSURD mismatches
 */
function postFilterByOccasion(products, occasion, category) {
  if (!occasion) return products

  return products.filter((product) => {
    const name = (product.product_name || "").toLowerCase()
    const desc = (product.description || "").toLowerCase()
    const combined = `${name} ${desc}`

    // ✅ WORKOUT: Minimal post-filtering - trust embeddings, heelType filter already handled shoes
    if (occasion === "workout") {
      // Only reject EXTREME formal/party wear (2+ indicators)
      const extremeRejects = ["sequin", "beaded", "rhinestone", "glitter", "formal", "evening", "gown", "tuxedo", "cocktail"]
      const rejectCount = extremeRejects.filter(word => combined.includes(word)).length
      
      if (rejectCount >= 2) {
        return false  // Reject obvious party/formal items
      }
      
      // For shoes: heelType filter already handled this in Weaviate, so trust it
      return true
    }

    // WORK OCCASION: Reject casual/athletic, accept professional items
    if (occasion === "work" || occasion === "business") {
      const casualRejects = ["athletic", "gym", "workout", "sport", "sweatpant", "jogger", "yoga", "tank top", "crop top"]
      const partyRejects = ["sequin", "beaded", "rhinestone", "glitter", "party", "club", "sparkle"]
      
      const hasCasualReject = casualRejects.some(word => combined.includes(word))
      const hasPartyReject = partyRejects.some(word => combined.includes(word))
      
      if (hasCasualReject || hasPartyReject) {
        return false
      }
      
      return true
    }

    // PARTY OCCASION: Reject casual/athletic, accept dressy items
    if (occasion === "party") {
      const rejects = ["athletic", "gym", "workout", "sport", "sweatpant", "jogger", "yoga", "loungewear"]
      
      const hasReject = rejects.some(word => combined.includes(word))
      
      if (hasReject) {
        return false
      }
      
      return true
    }

    // DEFAULT: Allow for other occasions (trust embeddings)
    return true
  })
}

/**
 * Deduplicate products by product_id or id field
 */
function deduplicateProducts(products) {
  const seen = new Set()
  const unique = []

  for (const product of products) {
    const productId = product.product_id || product.id
    if (!seen.has(productId)) {
      seen.add(productId)
      unique.push(product)
    }
  }

  if (seen.size < products.length) {
    console.log(`  🔄 Removed ${products.length - seen.size} duplicate products`)
  }

  return unique
}

/**
 * Calculate diversity score for product selection
 */
function calculateDiversityScore(products) {
  if (products.length === 0) return products

  // Group products by price ranges
  const priceRanges = {
    budget: products.filter((p) => p.price < 50),
    mid: products.filter((p) => p.price >= 50 && p.price < 150),
    premium: products.filter((p) => p.price >= 150 && p.price < 300),
    luxury: products.filter((p) => p.price >= 300),
  }

  // Group by brand
  const brandCounts = {}
  products.forEach((p) => {
    const brand = p.brand || "unknown"
    brandCounts[brand] = (brandCounts[brand] || 0) + 1
  })

  // Track similar names to prevent near-duplicates
  const nameCounts = {}
  products.forEach((p) => {
    const baseName = (p.product_name || "").toLowerCase().split(" ").slice(0, 3).join(" ")
    nameCounts[baseName] = (nameCounts[baseName] || 0) + 1
  })

  // Score each product for diversity
  const scoredProducts = products.map((product, index) => {
    let diversityScore = 0

    const priceRange =
      product.price < 50 ? "budget" : product.price < 150 ? "mid" : product.price < 300 ? "premium" : "luxury"
    const rangeCount = priceRanges[priceRange].length
    diversityScore += (1 / rangeCount) * 35

    const brand = product.brand || "unknown"
    const brandFrequency = brandCounts[brand] / products.length
    diversityScore += (1 - brandFrequency) * 25

    const baseName = (product.product_name || "").toLowerCase().split(" ").slice(0, 3).join(" ")
    const nameFrequency = nameCounts[baseName] / products.length
    diversityScore += (1 - nameFrequency) * 30

    diversityScore += (1 - index / products.length) * 10

    return {
      ...product,
      diversityScore,
      _debug: {
        priceRange,
        brand,
        baseName,
        score: Math.round(diversityScore),
      },
    }
  })

  return scoredProducts
    .sort((a, b) => b.diversityScore - a.diversityScore)
    .map(({ _debug, diversityScore, ...product }) => product)
}

/**
 * Get budget tier and flexibility rules
 */
function getBudgetFlexibility(totalMin, totalMax) {
  const avgPrice = (totalMin + totalMax) / 2

  let tier, downFlex, upFlex

  if (avgPrice < 150) {
    tier = "budget"
    downFlex = 0.1
    upFlex = 0.2
  } else if (avgPrice < 300) {
    tier = "moderate"
    downFlex = 0.1
    upFlex = 0.3
  } else if (avgPrice < 700) {
    tier = "premium"
    downFlex = 0.05
    upFlex = 0.35
  } else {
    tier = "luxury"
    downFlex = 0.05
    upFlex = 999
  }

  return { tier, downFlex, upFlex }
}

/**
 * Get occasion-based category budget percentages
 */
function getOccasionCategoryBudgets(occasion) {
  const budgetRules = {
    workout: {
      shoes: { min: 0.4, max: 0.5 },
      tops: { min: 0.25, max: 0.3 },
      bottoms: { min: 0.25, max: 0.3 },
    },
    party: {
      tops: { min: 0.35, max: 0.4 },
      shoes: { min: 0.3, max: 0.35 },
      bottoms: { min: 0.25, max: 0.3 },
    },
    work: {
      tops: { min: 0.35, max: 0.4 },
      bottoms: { min: 0.3, max: 0.35 },
      shoes: { min: 0.25, max: 0.3 },
    },
    date: {
      tops: { min: 0.35, max: 0.4 },
      bottoms: { min: 0.3, max: 0.35 },
      shoes: { min: 0.25, max: 0.3 },
    },
    vacation: {
      tops: { min: 0.33, max: 0.35 },
      bottoms: { min: 0.33, max: 0.35 },
      shoes: { min: 0.3, max: 0.35 },
    },
    everyday: {
      tops: { min: 0.3, max: 0.35 },
      bottoms: { min: 0.3, max: 0.35 },
      shoes: { min: 0.3, max: 0.35 },
    },
  }

  return budgetRules[occasion] || budgetRules.everyday
}

/**
 * Calculate smart budget range with asymmetric flexibility
 */
function calculateSmartBudget(totalMin, totalMax, category, occasion) {
  const { tier, downFlex, upFlex } = getBudgetFlexibility(totalMin, totalMax)

  const categoryBudgets = getOccasionCategoryBudgets(occasion)
  const categoryPercent = categoryBudgets[category] || { min: 0.3, max: 0.35 }

  const categoryMin = totalMin * categoryPercent.min
  const categoryMax = totalMax * categoryPercent.max

  const flexibleMin = categoryMin * (1 - downFlex)
  const flexibleMax = upFlex === 999 ? 999999 : categoryMax * (1 + upFlex)

  return {
    tier,
    categoryMin: Math.round(categoryMin),
    categoryMax: Math.round(categoryMax),
    searchMin: Math.round(flexibleMin),
    searchMax: upFlex === 999 ? 999999 : Math.round(flexibleMax),
    downFlexPercent: Math.round(downFlex * 100),
    upFlexPercent: upFlex === 999 ? "unlimited" : Math.round(upFlex * 100),
    isUnlimited: upFlex === 999,
  }
}
