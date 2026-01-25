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
 * Build semantic query with occasion AND style context
 * Added style parameter to respect user's aesthetic preferences
 */
function buildSemanticQuery(query, occasion, category, style = null) {
  let semanticQuery = query

  // Add style-specific modifiers FIRST (highest priority)
  const styleModifiers = {
    minimalist: "clean simple structured understated elegant refined timeless classic solid",
    bohemian: "flowy relaxed earthy natural organic textured layered artistic",
    edgy: "bold modern asymmetric leather statement unique contemporary urban",
    classic: "traditional timeless tailored polished sophisticated refined elegant",
    romantic: "soft feminine delicate flowy graceful pretty gentle flowing",
    sporty: "athletic casual comfortable practical functional active dynamic",
    trendy: "fashion-forward modern stylish current contemporary chic on-trend",
  }

  if (style && styleModifiers[style.toLowerCase()]) {
    semanticQuery += ` ${styleModifiers[style.toLowerCase()]}`
  }

  // Add occasion-specific context words (but filter based on style)
  const occasionContext = {
    workout: "athletic breathable moisture-wicking performance sportswear activewear gym fitness",
    party: "elegant dressy glamorous formal evening cocktail stylish",
    work: "professional business corporate office tailored polished structured career",
    date: "romantic chic sophisticated feminine elegant stylish trendy dressy",
    vacation: "resort casual travel lightweight comfortable relaxed breezy beach",
    everyday: "casual comfortable versatile everyday basic essential simple",
  }

  let contextWords = occasionContext[occasion] || occasionContext.everyday

  // REMOVE contradictory words based on style
  if (style === "minimalist") {
    // Remove maximalist descriptors for minimalist style
    contextWords = contextWords.replace(/sparkle|glamorous|festive/gi, "").trim()
  }

  semanticQuery += ` ${contextWords}`

  // Add category context
  semanticQuery += ` ${category}`

  return semanticQuery
}

/**
 * Generate embedding for query
 */
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.substring(0, 8000),
    })
    return response.data[0].embedding
  } catch (error) {
    console.error("❌ Embedding error:", error.message)
    return null
  }
}

/**
 * Post-filter products by occasion (safety net)
 */
function postFilterByOccasion(products, occasion, category) {
  if (!occasion || occasion === "everyday") return products

  return products.filter((product) => {
    const name = (product.product_name || "").toLowerCase()
    const desc = (product.description || "").toLowerCase()
    const combined = `${name} ${desc}`

    if (occasion === "workout") {
      const workoutKeywords = [
        "athletic",
        "sport",
        "gym",
        "fitness",
        "training",
        "workout",
        "activewear",
        "performance",
        "moisture",
        "breathable",
        "running",
        "yoga",
        "crossfit",
        "exercise",
        "legging",
        "jogger",
        "track",
        "tank",
        "compression",
        "sweat",
        "sneaker",
        "trainer",
        "runner",
        "ski",
        "water repellent",
        "windproof",
        "fleece",
        "anorak",
        "puffer",
        "hoodie",
        "tech",
        "stretch",
        "recco",
        "thermal",
        "insulated",
        "quick dry",
        "spandex",
        "lycra",
        "mesh",
        "wicking",
      ]

      if (category === "bottoms") {
        // Reject leather pants completely for workout
        if (/leather/i.test(combined)) {
          console.log(`  🚫 Rejected leather item for workout: ${name.substring(0, 50)}`)
          return false
        }

        // Accept leggings/joggers if not formal
        if (/legging|jogger|track pant|athletic pant|gym pant|workout pant|sport pant/i.test(combined)) {
          if (!/sequin|beaded|dress|formal|cocktail|velvet|satin/i.test(combined)) {
            return true
          }
        }
      }

      if (category === "tops") {
        if (/ski|snowboard|water repellent|windproof|anorak|fleece/i.test(combined)) {
          return true
        }
        if (/tank|crop.*(?:top|hoodie|jacket)/i.test(combined) && !/strapless|beaded|sequin/i.test(combined)) {
          return true
        }
      }

      const hasWorkoutKeyword = workoutKeywords.some((k) => combined.includes(k))

      if (!hasWorkoutKeyword) {
        // Trust vector search for neutral items (they passed embedding filter already)
        // Only reject OBVIOUSLY formal/inappropriate items
        const obviouslyNotWorkout = [
          "blazer",
          "suit jacket",
          "formal",
          "business suit",
          "office wear",
          "dress pants",
          "dress shirt",
          "cocktail",
          "evening gown",
          "party dress",
          "gown",
          "wedding dress",
          "prom",
          "tuxedo",
          "bow tie",
          "cufflink",
          "silk blouse",
          "velvet gown",
          "satin dress",
          "lace dress",
          "sequin",
          "beaded",
          "rhinestone",
          "embroidered dress",
          "crochet dress",
          "fur coat",
          "trench coat",
        ]

        const isObviouslyNotWorkout = obviouslyNotWorkout.some((k) => combined.includes(k))

        if (isObviouslyNotWorkout) {
          console.log(`  🚫 Rejected non-workout item: ${name.substring(0, 50)}`)
          return false
        }

        // Trust vector search for items that passed embedding occasion filter
        return true
      }

      const workoutReject = [
        "sequin",
        "beaded",
        "rhinestone",
        "formal dress",
        "cocktail dress",
        "evening gown",
        "party dress",
        "prom dress",
        "wedding dress",
        "ballgown",
        "tuxedo",
      ]

      const hasRejectKeyword = workoutReject.some((k) => combined.includes(k))

      if (hasRejectKeyword) {
        console.log(`  🚫 Rejected formal item for workout: ${name.substring(0, 50)}`)
        return false
      }

      if (category === "shoes") {
        // Reject heels and dress shoes, but ALLOW leather sneakers/trainers
        if (/heel|pump|stiletto|dress shoe|oxford|loafer(?!.*sneaker)|boot(?!.*(?:running|hiking|athletic|ankle))/i.test(combined)) {
          // Except if it's explicitly athletic (leather sneaker, leather trainer)
          if (!/sneaker|trainer|athletic|sport|running/i.test(combined)) {
            console.log(`  🚫 Rejected non-athletic shoe for workout: ${name.substring(0, 50)}`)
            return false
          }
        }
      }
    }

    if (occasion === "party") {
      const partyReject = [
        "athletic",
        "gym",
        "workout",
        "sport sweat",
        "jogger",
        "legging",
        "sneaker",
        "trainer",
        "running",
        "yoga",
        "fitness",
      ]
      if (partyReject.some((k) => combined.includes(k))) {
        console.log(`  🚫 Rejected athletic item for party: ${name.substring(0, 50)}`)
        return false
      }
    }

    if (occasion === "work") {
      const workReject = ["athletic", "gym", "workout", "sport sweat", "party dress", "sequin", "clubwear"]
      if (workReject.some((k) => combined.includes(k))) {
        console.log(`  🚫 Rejected inappropriate item for work: ${name.substring(0, 50)}`)
        return false
      }
    }

    return true
  })
}

/**
 * Deduplicate products by product_id or id field
 * Fixed to check both product_id and id fields for deduplication
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
 * Ensures variety in price, brand, style, and prevents near-duplicates
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
    // Extract base name (first 3 words) to detect similar products
    const baseName = (p.product_name || "").toLowerCase().split(" ").slice(0, 3).join(" ")
    nameCounts[baseName] = (nameCounts[baseName] || 0) + 1
  })

  // Score each product for diversity
  const scoredProducts = products.map((product, index) => {
    let diversityScore = 0

    // Variety in price ranges (prefer even distribution)
    const priceRange =
      product.price < 50 ? "budget" : product.price < 150 ? "mid" : product.price < 300 ? "premium" : "luxury"
    const rangeCount = priceRanges[priceRange].length
    diversityScore += (1 / rangeCount) * 35 // Max 35 points for price diversity

    // Variety in brands (penalize over-represented brands)
    const brand = product.brand || "unknown"
    const brandFrequency = brandCounts[brand] / products.length
    diversityScore += (1 - brandFrequency) * 25 // Max 25 points for brand diversity

    const baseName = (product.product_name || "").toLowerCase().split(" ").slice(0, 3).join(" ")
    const nameFrequency = nameCounts[baseName] / products.length
    diversityScore += (1 - nameFrequency) * 30 // Max 30 points for name uniqueness

    // Position bonus (gradually decrease to encourage mixing)
    diversityScore += (1 - index / products.length) * 10 // Max 10 points for relevance

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

  // Sort by diversity score and remove debug info
  return scoredProducts
    .sort((a, b) => b.diversityScore - a.diversityScore)
    .map(({ _debug, diversityScore, ...product }) => product)
}

/**
 * Get budget tier and flexibility rules based on price range
 * Fixed to properly calculate tier from total budget, not category budget
 */
function getBudgetFlexibility(totalMin, totalMax) {
  // Calculate average from TOTAL budget, not category budget
  const avgPrice = (totalMin + totalMax) / 2

  let tier, downFlex, upFlex

  if (avgPrice < 150) {
    // Budget tier - tight on both ends
    tier = "budget"
    downFlex = 0.1 // -10% on minimum
    upFlex = 0.2 // +20% on maximum
  } else if (avgPrice < 300) {
    // Moderate tier - standard flexibility
    tier = "moderate"
    downFlex = 0.1 // -10% on minimum
    upFlex = 0.3 // +30% on maximum
  } else if (avgPrice < 700) {
    // Premium tier - generous upward flexibility
    tier = "premium"
    downFlex = 0.05 // -5% on minimum
    upFlex = 0.35 // +35% on maximum
  } else {
    // Luxury tier - unlimited upward
    tier = "luxury"
    downFlex = 0.05 // -5% on minimum
    upFlex = 999 // Unlimited upward
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
 * Calculate smart budget range with asymmetric flexibility and occasion awareness
 * Fixed to require totalBudget parameter for correct tier detection
 */
function calculateSmartBudget(totalMin, totalMax, category, occasion) {
  // Use TOTAL budget for tier detection, not category budget
  const { tier, downFlex, upFlex } = getBudgetFlexibility(totalMin, totalMax)

  // Get occasion-specific category percentages
  const categoryBudgets = getOccasionCategoryBudgets(occasion)
  const categoryPercent = categoryBudgets[category] || { min: 0.3, max: 0.35 }

  // Calculate category-specific budget
  const categoryMin = totalMin * categoryPercent.min
  const categoryMax = totalMax * categoryPercent.max

  // Apply asymmetric flexibility (less down, more up)
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

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * Health check
 */
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Vector search server is running",
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
      service: "vector-search-server",
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
 * MAIN SEARCH ENDPOINT (IMPROVED)
 * Uses hybrid search + occasion filtering + post-filtering + deduplication + diversity
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
      style = null, // Accept style parameter
    } = req.body

    if (!query) {
      return res.status(400).json({
        success: false,
        error: "Query is required",
      })
    }

    console.log(`\n🔍 IMPROVED VECTOR SEARCH:`)
    console.log(`   Query: "${query}"`)
    console.log(`   Category: ${category}`)
    console.log(`   Occasion: ${occasion}`)
    if (style) console.log(`   Style: ${style}`) // Log style
    console.log(`   Limit: ${limit}`)

    const semanticQuery = buildSemanticQuery(query, occasion, category, style)
    console.log(`   Semantic: "${semanticQuery}"`)

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

    if (occasion && occasion !== "everyday") {
      whereFilters.operands.push({
        path: ["suitableOccasions"],
        operator: "ContainsAny",
        valueTextArray: [occasion, "everyday"],
      })
    }

    if (occasion === "workout" && category === "shoes") {
      whereFilters.operands.push({
        path: ["heelType"],
        operator: "Equal",
        valueText: "athletic",
      })
      console.log(`   🎯 Forcing athletic shoes for workout`)
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

    const fetchMultiplier = budgetInfo?.tier === "luxury" ? 4 : budgetInfo?.tier === "premium" ? 3.5 : 3
    const initialLimit = Math.round(limit * fetchMultiplier)

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

    if (products.length < limit / 2 && budgetInfo && !budgetInfo.isUnlimited) {
      console.log(`   ⚠️  Only ${products.length} products found, relaxing budget constraints...`)

      // First attempt: +10% more upward flexibility
      const relaxedMax = budgetInfo.searchMax * 1.1
      console.log(`   🔄 Retry 1: Increasing max to $${Math.round(relaxedMax)}`)

      whereFilters.operands = whereFilters.operands.filter(
        (op) => op.path[0] !== "price" || op.operator !== "LessThanEqual",
      )
      whereFilters.operands.push({
        path: ["price"],
        operator: "LessThanEqual",
        valueNumber: relaxedMax,
      })

      const retryResponse = await weaviateClient.graphql
        .get()
        .withClassName("Product")
        .withFields(
          "product_id product_name description brand price color category suitableOccasions formalityLevel heelType",
        )
        .withNearVector({ vector: embedding })
        .withWhere(whereFilters)
        .withLimit(initialLimit)
        .withHybrid({ query: query, alpha: 0.7 })
        .do()

      products = retryResponse.data.Get.Product || []
      console.log(`   ✓ Retry 1 result: ${products.length} products`)

      // Second attempt: +50% more if still too few
      if (products.length < limit / 2) {
        const veryRelaxedMax = budgetInfo.searchMax * 1.5
        console.log(`   🔄 Retry 2: Increasing max to $${Math.round(veryRelaxedMax)}`)

        whereFilters.operands = whereFilters.operands.filter(
          (op) => op.path[0] !== "price" || op.operator !== "LessThanEqual",
        )
        whereFilters.operands.push({
          path: ["price"],
          operator: "LessThanEqual",
          valueNumber: veryRelaxedMax,
        })

        const retry2Response = await weaviateClient.graphql
          .get()
          .withClassName("Product")
          .withFields(
            "product_id product_name description brand price color category suitableOccasions formalityLevel heelType",
          )
          .withNearVector({ vector: embedding })
          .withWhere(whereFilters)
          .withLimit(initialLimit)
          .withHybrid({ query: query, alpha: 0.7 })
          .do()

        products = retry2Response.data.Get.Product || []
        console.log(`   ✓ Retry 2 result: ${products.length} products`)

        // Final attempt: remove upper limit entirely
        if (products.length < limit / 2) {
          console.log(`   🔄 Retry 3: Removing upper budget limit entirely`)

          whereFilters.operands = whereFilters.operands.filter(
            (op) => op.path[0] !== "price" || op.operator !== "LessThanEqual",
          )

          const retry3Response = await weaviateClient.graphql
            .get()
            .withClassName("Product")
            .withFields(
              "product_id product_name description brand price color category suitableOccasions formalityLevel heelType",
            )
            .withNearVector({ vector: embedding })
            .withWhere(whereFilters)
            .withLimit(initialLimit)
            .withHybrid({ query: query, alpha: 0.7 })
            .do()

          products = retry3Response.data.Get.Product || []
          console.log(`   ✓ Retry 3 result: ${products.length} products`)
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
      style: style, // Include style in response
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

        if (q.occasion && q.occasion !== "everyday") {
          whereFilters.operands.push({
            path: ["suitableOccasions"],
            operator: "ContainsAny",
            valueTextArray: [q.occasion, "everyday"],
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
          style: q.style, // Include style in response
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
 * EMBEDDING GENERATION ENDPOINT
 * POST /api/generate-embeddings
 * Clears old Weaviate data, generates embeddings from Supabase, imports to Weaviate
 */
app.post("/api/generate-embeddings", async (req, res) => {
  try {
    console.log("\n========================================")
    console.log("🚀 STARTING EMBEDDING GENERATION")
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
      description: "Product with embeddings",
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
          description: "Product category",
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
    console.log("   ✅ Product class created\n")

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
    // STEP 4: HELPER FUNCTIONS FOR OCCASION DETECTION
    // ========================================================================
    function detectSuitableOccasions(name, desc) {
      const combined = `${name} ${desc}`.toLowerCase()
      const occasions = []

      const workoutKeywords = [
        "athletic",
        "sport",
        "gym",
        "fitness",
        "training",
        "workout",
        "activewear",
        "performance",
        "running",
        "yoga",
        "jogging",
        "moisture wicking",
        "breathable",
        "compression",
        "dri-fit",
        "sneaker",
        "trainer",
        "legging",
        "jogger athletic",
        "sports bra",
      ]
      const workoutReject = ["formal", "evening", "cocktail", "party dress", "gala", "sequin", "beaded", "velvet gown", "heel", "pump", "stiletto"]

      const hasWorkout = workoutKeywords.some((k) => combined.includes(k))
      const hasWorkoutReject = workoutReject.some((k) => combined.includes(k))

      if (hasWorkout && !hasWorkoutReject) {
        occasions.push("workout")
      }

      const partyKeywords = ["party", "evening", "cocktail", "formal", "sequin", "sparkle", "metallic", "satin", "velvet", "elegant", "dressy", "gala"]
      if (partyKeywords.some((k) => combined.includes(k))) {
        occasions.push("party")
      }

      const workKeywords = ["office", "business", "professional", "corporate", "blazer", "suit", "tailored", "structured"]
      if (workKeywords.some((k) => combined.includes(k))) {
        occasions.push("work")
      }

      const dateKeywords = ["date", "romantic", "elegant", "chic", "sophisticated", "feminine", "flirty", "dressy"]
      if (dateKeywords.some((k) => combined.includes(k))) {
        occasions.push("date")
      }

      const vacationKeywords = ["vacation", "resort", "beach", "summer", "tropical", "travel", "linen", "lightweight", "breezy"]
      if (vacationKeywords.some((k) => combined.includes(k))) {
        occasions.push("vacation")
      }

      if (occasions.length === 0 || (!occasions.includes("workout") && !occasions.includes("party"))) {
        occasions.push("everyday")
      }

      return occasions.length > 0 ? occasions : ["everyday"]
    }

    function detectFormalityLevel(name, desc, occasions) {
      const combined = `${name} ${desc}`.toLowerCase()

      if (occasions.includes("workout")) return "athletic"
      if (occasions.includes("party")) return "formal"
      if (occasions.includes("work")) return "business-casual"

      const casualKeywords = ["casual", "relaxed", "comfortable", "everyday", "basic"]
      if (casualKeywords.some((k) => combined.includes(k))) return "casual"

      const smartKeywords = ["smart", "polished", "tailored", "structured", "chic"]
      if (smartKeywords.some((k) => combined.includes(k))) return "smart-casual"

      return "casual"
    }

    function detectHeelType(name, desc, category) {
      if (category !== "shoes") return "n/a"

      const combined = `${name} ${desc}`.toLowerCase()

      if (/sneaker|trainer|runner|athletic|sport/i.test(combined)) return "athletic"
      if (/flat|loafer|slipper|ballet/i.test(combined)) return "flat"
      if (/stiletto|high heel|platform/i.test(combined)) return "high-heel"
      if (/kitten heel|low heel/i.test(combined)) return "low-heel"
      if (/mid heel|block heel|wedge/i.test(combined)) return "mid-heel"

      return "flat"
    }

    function detectCategory(product) {
      const name = (product.product_name || "").toLowerCase()
      const desc = (product.description || "").toLowerCase()
      const combined = `${name} ${desc}`

      if (/shirt|blouse|top|tank|tee|sweater|cardigan|hoodie|jacket|blazer|coat|vest/.test(combined)) {
        return "tops"
      }
      if (/pant|jean|trouser|legging|short|skirt|jogger|culotte|cargo|chino/.test(combined)) {
        return "bottoms"
      }
      if (/shoe|sneaker|boot|sandal|trainer|runner|loafer|heel|flat|pump/.test(combined)) {
        return "shoes"
      }
      return "unknown"
    }

    function extractColorFromName(productName) {
      const colorKeywords = [
        "white", "black", "red", "blue", "green", "yellow", "purple", "pink", "orange", "brown",
        "gray", "grey", "navy", "beige", "cream", "gold", "silver", "bronze", "copper", "rose",
        "coral", "teal", "turquoise", "aqua", "indigo", "burgundy", "maroon", "crimson", "olive",
        "khaki", "tan", "taupe", "charcoal", "ivory", "pearl", "blush", "champagne", "nude"
      ]
      
      const nameLower = (productName || "").toLowerCase()
      for (const color of colorKeywords) {
        if (nameLower.includes(color)) {
          return color.charAt(0).toUpperCase() + color.slice(1)
        }
      }
      return ""
    }

    function extractStyleKeywords(productName, description) {
      const stylePatterns = {
        details: ["tie front", "broderie detail", "embroidered", "printed", "striped", "polka dot", "floral", "sequin", "beaded", "pleated", "ruched", "draped", "wrap", "button-down", "zip", "collar", "pocket", "sleeve"],
        fit: ["slim fit", "regular fit", "oversized", "fitted", "loose", "bodycon", "wide leg", "skinny", "straight leg", "tapered"],
        style: ["casual", "formal", "vintage", "minimalist", "bohemian", "sporty", "elegant", "trendy", "classic", "edgy"]
      }
      
      const combined = `${productName} ${description}`.toLowerCase()
      const found = []
      
      for (const [category, keywords] of Object.entries(stylePatterns)) {
        for (const keyword of keywords) {
          if (combined.includes(keyword)) {
            found.push(keyword)
          }
        }
      }
      
      return found.length > 0 ? found.slice(0, 5).join(", ") : ""
    }

    function parseCategoryHierarchy(categoryName) {
      if (!categoryName) return ""
      // e.g., "Women > Clothing > Blouses" → extract useful parts
      const parts = categoryName.split(">").map(p => p.trim())
      // Return the most specific category (last part) plus parent if useful
      const specific = parts[parts.length - 1] || ""
      const parent = parts.length > 1 ? parts[parts.length - 2] : ""
      
      return [parent, specific].filter(p => p && p !== "Clothing").join(" ")
    }

    function createEmbeddingText(product, category, occasions, formalityLevel, heelType) {
      const name = product.product_name || ""
      
      // Extract color from product_name if colour field is empty
      let color = product.colour || product.color || extractColorFromName(name)
      
      // Use both description and materials_description
      const desc = (product.description || "").substring(0, 300)
      const materials = (product.materials_description || "").substring(0, 300)
      const fullDesc = [desc, materials].filter(d => d.trim() && !d.includes("Shop")).join(" ")

      const brand = product.brand || ""
      const family = product.product_family || ""
      const styleKeywords = extractStyleKeywords(name, desc)
      const categoryHierarchy = parseCategoryHierarchy(product.category_name)

      let text = `${name}`
      
      // Add style keywords extracted from product name/description
      if (styleKeywords) {
        text += `. Details: ${styleKeywords}`
      }
      
      // Add description if it's not just boilerplate
      if (fullDesc && !fullDesc.includes("ASOS")) {
        text += `. ${fullDesc}`
      }
      
      // Add structured data
      if (categoryHierarchy) {
        text += `. Category: ${categoryHierarchy}`
      } else {
        text += `. This is a ${category} item`
      }
      
      text += `. Suitable for: ${occasions.join(", ")}`
      text += `. Formality: ${formalityLevel}`

      if (category === "shoes" && heelType !== "n/a") {
        text += `. Heel type: ${heelType}`
      }

      if (color) text += `. Color: ${color}`
      if (brand) text += `. Brand: ${brand}`
      if (family) text += `. Type: ${family}`

      return text.trim()
    }

    // ========================================================================
    // STEP 5: FILTER VALID PRODUCTS
    // ========================================================================
    console.log("4️⃣  Filtering valid products...")
    const validProducts = allProducts.filter((p) => {
      const hasName = p.product_name?.trim() && p.product_name.length > 2
      const hasPrice = Number.parseFloat(p.price) > 0
      return hasName && hasPrice
    })
    console.log(`   ✅ ${validProducts.length} valid products (removed ${allProducts.length - validProducts.length})\n`)

    // ========================================================================
    // STEP 6: GENERATE EMBEDDINGS
    // ========================================================================
    console.log("5️⃣  Generating embeddings with OpenAI...")
    const BATCH_SIZE = 50
    const productsWithEmbeddings = []
    let embeddingCount = 0

    for (let i = 0; i < validProducts.length; i += BATCH_SIZE) {
      const batch = validProducts.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(validProducts.length / BATCH_SIZE)

      console.log(`   📦 Batch ${batchNum}/${totalBatches}`)

      const results = await Promise.all(
        batch.map(async (product) => {
          const category = product.category_name || "unknown"
          const name = product.product_name || ""
          const desc = product.description || ""

          const occasions = detectSuitableOccasions(name, desc)
          const formalityLevel = detectFormalityLevel(name, desc, occasions)
          const heelType = detectHeelType(name, desc, category)

          const embeddingText = createEmbeddingText(product, category, occasions, formalityLevel, heelType)
          const embedding = await generateEmbedding(embeddingText)

          if (embedding) embeddingCount++

          return {
            product_id: product.id,
            product_name: product.product_name,
            description: product.description,
            price: product.price,
            brand: product.brand,
            color: product.colour || product.color,
            category: category,
            suitableOccasions: occasions,
            formalityLevel: formalityLevel,
            heelType: heelType,
            embedding: embedding,
          }
        }),
      )

      productsWithEmbeddings.push(...results)
      console.log(`      ✅ Generated ${results.filter((r) => r.embedding).length} embeddings`)

      // Rate limiting
      if (i + BATCH_SIZE < validProducts.length) {
        await new Promise((r) => setTimeout(r, 1000))
      }
    }

    console.log(`\n   ✅ Total: ${embeddingCount} embeddings generated\n`)

    // ========================================================================
    // STEP 7: BATCH IMPORT TO WEAVIATE
    // ========================================================================
    console.log("6️⃣  Importing to Weaviate...")

    let successCount = 0
    for (let i = 0; i < productsWithEmbeddings.length; i += BATCH_SIZE) {
      const batch = productsWithEmbeddings.slice(i, i + BATCH_SIZE).filter((p) => p.embedding)

      let batcher = weaviateClient.batch.objectsBatcher()

      for (const product of batch) {
        batcher = batcher.withObject({
          class: "Product",
          properties: {
            product_id: product.product_id,
            product_name: product.product_name || "Unknown",
            description: (product.description || "").substring(0, 1000),
            price: Number.parseFloat(product.price) || 0,
            category: product.category || "unknown",
            brand: product.brand || "Unknown",
            color: product.color || "N/A",
            suitableOccasions: product.suitableOccasions || ["everyday"],
            formalityLevel: product.formalityLevel || "casual",
            heelType: product.heelType || "n/a",
          },
          vector: product.embedding,
        })
      }

      await batcher.do()
      successCount += batch.length
      console.log(`   ✅ Imported ${successCount}/${productsWithEmbeddings.filter((p) => p.embedding).length}`)
    }

    // ========================================================================
    // STEP 8: VERIFY IMPORT
    // ========================================================================
    console.log("\n7️⃣  Verifying...")
    const result = await weaviateClient.graphql.aggregate().withClassName("Product").withFields("meta { count }").do()

    const count = result.data.Aggregate.Product?.[0]?.meta?.count || 0
    console.log(`   ✅ Weaviate has ${count} products\n`)

    const duration = Math.round((Date.now() - startTime) / 1000)

    console.log("========================================")
    console.log("✅ EMBEDDING GENERATION COMPLETE")
    console.log("========================================")
    console.log(`⏱️  Duration: ${duration}s`)
    console.log(`📊 Processed: ${validProducts.length}`)
    console.log(`🤖 Embeddings: ${embeddingCount}`)
    console.log(`✅ Imported: ${successCount}`)
    console.log(`💾 In Weaviate: ${count}`)
    console.log("========================================\n")

    res.json({
      success: true,
      message: "Embedding generation complete",
      stats: {
        processed: validProducts.length,
        embeddings: embeddingCount,
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
  console.log("🚀 IMPROVED VECTOR SEARCH SERVER")
  console.log("========================================")
  console.log(`📍 Running on: http://localhost:${PORT}`)
  console.log(`🔗 Weaviate: ${process.env.WEAVIATE_SCHEME}://${process.env.WEAVIATE_HOST}`)
  console.log(`🤖 Model: ${EMBEDDING_MODEL}`)
  console.log("========================================")
  console.log("\n📋 Endpoints:")
  console.log(`   GET  /                           - Service info`)
  console.log(`   GET  /health                     - Health check`)
  console.log(`   GET  /api/count                  - Product count`)
  console.log(`   POST /api/search                 - Vector search (MAIN)`)
  console.log(`   POST /api/search-batch           - Batch search`)
  console.log(`   POST /api/generate-embeddings    - Generate & import embeddings`)
  console.log("\n✅ Server ready!\n")
})
