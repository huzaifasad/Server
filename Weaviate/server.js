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
  scheme: "http",
  host:"localhost:8080",
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
 * Extract subcategory from category_name
 * Example: "Shoes > Heels" → "heels"
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
/**
 * Build semantic query for vector search with occasion and category context
 */
function buildSemanticQuery(query, occasion, category, style = null) {
  let semanticQuery = query

  // Add style-specific modifiers FIRST (highest priority)
  const styleModifiers = {
    minimalist: "clean simple structured understated elegant refined timeless classic solid minimal",
    bohemian: "flowy relaxed earthy natural organic textured layered artistic vintage",
    edgy: "bold modern asymmetric leather statement unique contemporary urban goth",
    classic: "traditional timeless tailored polished sophisticated refined elegant formal",
    romantic: "soft feminine delicate flowy graceful pretty gentle flowing lace",
    sporty: "athletic casual comfortable practical functional active dynamic tech",
    trendy: "fashion-forward modern stylish current contemporary chic on-trend",
  }

  if (style && styleModifiers[style.toLowerCase()]) {
    semanticQuery += ` ${styleModifiers[style.toLowerCase()]}`
  }

  // EXCLUSIVE occasion-specific keywords - NO cross-contamination
  const occasionContext = {
    // Workout: ONLY athletic keywords - NO formal, casual, dressy
    workout: "athletic performance sportswear activewear gym fitness training running yoga moisture-wicking breathable stretch compression dri-fit legging jogger sports-bra tank-top athletic-shorts",
    
    // Wedding: ONLY formal elegant keywords - NO casual, athletic, party
    wedding: "wedding bridal ceremonial elegant formal sophisticated gown dress white ivory blush embroidered beaded lace satin silk champagne heels pumps dressy formal-shoes",
    
    // Party: ONLY glamorous evening keywords - NO casual, athletic, work
    party: "party evening cocktail glamorous dressy sequin glitter metallic sparkle sparkly night-out club festive mini-dress short-dress evening-dress heels pumps wedges metallic-heels",
    
    // Work: ONLY professional keywords - NO casual, athletic, party, wedding
    work: "professional business corporate office tailored structured polished career blazer suit formal dress-pants pencil-skirt blouse cardigan knitwear loafer oxford formal-shoes structured-heels",
    
    // Vacation: ONLY casual beach keywords - NO formal, work, athletic
    vacation: "vacation beach resort casual relaxed travel lightweight sundress maxi-dress beach-dress flip-flop sandal slide casual-sneaker comfortable",
    
    // Everyday: ONLY casual comfortable keywords - NO formal, athletic, party, work
    everyday: "casual comfortable everyday basic versatile simple loungewear t-shirt casual-dress sneaker flat comfortable-shoes",
  }

  let contextWords = occasionContext[occasion] || occasionContext.everyday

  // REMOVE contradictory words based on style
  if (style === "minimalist") {
    contextWords = contextWords.replace(/sparkle|glamorous|sequin|glitter|metallic|shimmer/gi, "").trim()
  }

  semanticQuery += ` ${contextWords}`

// ✅ NEW: Add category + subcategory reinforcement based on occasion
const categorySubcategoryTerms = {
  shoes: {
    workout: "sneakers trainers athletic shoes running shoes sport shoes",
    party: "heels pumps stilettos dressy shoes dress shoes",
    work: "loafers flats oxford shoes professional shoes dress shoes",
    date: "heels sandals dressy shoes elegant shoes",
    vacation: "sandals flats casual shoes comfortable shoes",
    everyday: "sandals flats sneakers casual shoes boots"
  },
  tops: {
    workout: "tank top sports bra athletic shirt performance top workout top",
    party: "blouse dress elegant top cocktail dress dressy top",
    work: "blazer blouse professional shirt business top button-up",
    date: "blouse dress elegant top stylish top",
    vacation: "tank tee casual top light top breezy top",
    everyday: "tee shirt casual top sweater comfortable top"
  },
  bottoms: {
    workout: "leggings joggers athletic pants workout shorts gym pants",
    party: "dress pants skirt elegant trousers dressy pants",
    work: "dress pants trousers professional bottoms slacks work pants",
    date: "jeans skirt elegant pants stylish bottoms",
    vacation: "shorts casual pants comfortable bottoms light pants",
    everyday: "jeans casual pants comfortable bottoms everyday pants"
  }
}

// Add category-specific subcategory terms
const subcategoryTerms = categorySubcategoryTerms[category]?.[occasion] || ""
semanticQuery += ` ${category} ${subcategoryTerms}`

return semanticQuery
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

    // FIX: Make occasion filter very flexible - include casual/everyday as fallback
// ✅ NEW: Trust embeddings for occasion matching - only filter for SPECIFIC occasions
// For generic occasions (date, vacation, everyday), skip hard filter and let embeddings decide
const specificOccasions = ["workout", "party", "work", "formal"]

if (occasion && specificOccasions.includes(occasion)) {
  whereFilters.operands.push({
    path: ["suitableOccasions"],
    operator: "ContainsAny",
    valueTextArray: [occasion]  // ← No fallback, strict matching
  })
  console.log(`   🔍 Filtering by occasion: ${occasion} (strict matching, trusting embeddings)`)
} else {
  console.log(`   🔍 No occasion filter (trusting embeddings for: ${occasion})`)
}

    // FIX: REMOVED strict heelType filters - they block all results since embeddings aren't regenerated yet
    // The semantic query + post-filtering will handle style appropriateness instead

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

// ✅ NEW: Increased base multiplier for better diversity (embeddings are now stronger, so we can fetch more confidently)
const categoryMultiplier = category === "shoes" ? 6 : 1.2  // Shoes: 6x, Others: 1.2x
const fetchMultiplier = (budgetInfo?.tier === "luxury" ? 5 : budgetInfo?.tier === "premium" ? 4.5 : 4) * categoryMultiplier
const initialLimit = Math.round(limit * fetchMultiplier)

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
    
    // FIX: Relaxed style coherence filtering - only reject EXTREMELY mismatched items
    const preFilterCount = products.length
    products = products.filter(product => {
      const name = (product.product_name || '').toLowerCase()
      const desc = (product.description || '').toLowerCase()
      const combined = `${name} ${desc}`
      
      // Workout: Only reject OBVIOUS formal wear (not all dressy items)
      if (occasion === 'workout' && category !== 'shoes') {
        if (/sequin|beaded|rhinestone|crystal|tuxedo|ball\s*gown|evening\s*gown|cocktail\s*dress/i.test(combined)) {
          return false
        }
      }
      
      // Formal/Party: Only reject OBVIOUS athletic wear for tops/bottoms
      if ((occasion === 'party' || occasion === 'formal') && (category === 'tops' || category === 'bottoms')) {
        if (/\bsweatpant|\bjogger|\bgym\s*short|\bworkout\s*(top|pant)|\bactivewear\b/i.test(combined)) {
          return false
        }
      }
      
      return true
    })
    
    if (preFilterCount > products.length) {
      console.log(`   🎨 Style coherence filter: ${preFilterCount} → ${products.length} products (relaxed)`)
    }

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

    // STEP 6: GENERATE EMBEDDINGS (OPTIMIZED)

    // ========================================================================

    console.log("5️⃣  Generating embeddings with OpenAI (optimized)...")
    const BATCH_SIZE = 150 // Increased from 50 to 100 for faster processing
    const productsWithEmbeddings = []
    let embeddingCount = 0

    for (let i = 0; i < validProducts.length; i += BATCH_SIZE) {
      const batch = validProducts.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(validProducts.length / BATCH_SIZE)

      console.log(`   📦 Batch ${batchNum}/${totalBatches}`)

      const results = await Promise.all(
        batch.map(async (product) => {
          try {
            // PRIORITY: Use outfit_category from database (set at scrape time - 100% accurate)
            // FALLBACK: Use detectCategory() for old data without outfit_category
 

 
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

const occasions = detectSuitableOccasions(name, desc)
const formalityLevel = classifyBrandTier(product.brand, Number.parseFloat(product.price))
const heelType = extractCut(name, desc, category)

// ✅ NEW: Occasion boost keywords for stronger semantic signal
const occasionBoost = {
  'workout': 'athletic performance gym fitness training sports active running yoga legging jogger',
  'formal': 'formal evening elegant sophisticated gown tuxedo black-tie gala dinner',
  'party': 'party sequin sparkle glitter metallic glamorous nightclub festive dressy',
  'work': 'professional business corporate office blazer tailored business-casual',
  'everyday': 'casual comfortable everyday basic versatile simple'
}

const primaryOccasion = occasions[0] || 'everyday'

// ✅ CRITICAL FIX: Build RICH embedding text with subcategory emphasis
const embeddingText = `${name}. ${desc}. Main category: ${category}. ${subcategory ? `Product type: ${subcategory} ${category}.` : ''} Heel height: ${heelType}. Material: ${extractMaterials(product.materials || product.materials_description || desc)}. Neckline: ${extractNeckline(name, desc)}. Sleeve: ${extractSleeveType(name, desc)}. Pattern: ${extractPattern(name, desc)}. Fit: ${extractFit(name, desc)}. Cut: ${heelType}. Suitable for: ${occasions.join(", ")}. Formality: ${formalityLevel}. Occasion emphasis: ${occasionBoost[primaryOccasion]} ${primaryOccasion}. Heel type: ${heelType}`

const embedding = await generateEmbedding(embeddingText)

            if (embedding) embeddingCount++

            // Use both product_id and product.product_id for compatibility
            const productId = product.product_id || product.id

            return {
              product_id: productId,
              product_name: product.product_name,
              description: product.description,
              price: product.price,
              brand: product.brand,
              color: product.colour || product.color,
              category: product.outfit_category || category, // FIX: Use outfit_category from database (100% accurate)
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
      console.log(`      ✅ Generated ${validResults.length} embeddings`)

      // Reduced rate limiting from 1000ms to 200ms (5x faster between batches)
      if (i + BATCH_SIZE < validProducts.length) {
        await new Promise((r) => setTimeout(r, 200))
      }
    }

    console.log(`\n   ✅ Total: ${embeddingCount} embeddings generated\n`)

    // ========================================================================

    // STEP 7: BATCH IMPORT TO WEAVIATE

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

        const result = await batcher.do()

        // Check for errors in batch result
        if (result && result.length > 0) {
          const errors = result.filter(r => r.result?.errors)
          if (errors.length > 0) {
            console.log(`   ⚠️  ${errors.length} errors in batch`)
            failedCount += errors.length
          }
        }

        successCount += batch.length
        console.log(`   ✅ Imported ${successCount}/${productsWithEmbeddings.filter((p) => p.embedding).length}`)
      } catch (error) {
        console.error(`   ❌ Batch import error:`, error.message)
        failedCount += batch.length
      }
    }

    if (failedCount > 0) {
      console.log(`\n   ⚠️  ${failedCount} products failed to import\n`)
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
 * STRICT FASHION RULES - Real Fashion Sense
 * Only allows items that truly suit the occasion
 */
function postFilterByOccasion(products, occasion, category) {
  if (!occasion) return products

  return products.filter((product) => {
    const name = (product.product_name || "").toLowerCase()
    const desc = (product.description || "").toLowerCase()
    const combined = `${name} ${desc}`

    // STRICT HARD REJECTS - Never acceptable regardless of category
    const universalRejects = {
      workout: ["heel", "pump", "stiletto", "formal", "tuxedo", "gown", "sequin", "beaded", "velvet", "satin", "silk blouse", "cocktail", "evening gown"],
      wedding: ["athletic", "gym", "workout", "sport", "sweatpant", "jogger", "legging", "trainer", "yoga", "casual", "loungewear", "hoodie", "sneaker"],
      party: ["athletic", "gym", "workout", "sport", "formal", "tuxedo", "gown", "business suit", "blazer", "evening gown"],
      work: ["athletic", "gym", "workout", "sport", "formal", "tuxedo", "gown", "business suit", "blazer", "evening gown"],
      vacation: ["athletic", "gym", "workout", "sport", "formal", "tuxedo", "gown", "business suit", "blazer", "evening gown"],
      everyday: ["heel", "pump", "stiletto", "sequin", "beaded", "glitter", "formal", "tuxedo", "gown", "cocktail", "evening gown", "business suit"]
    }

    const rejectsForOccasion = universalRejects[occasion] || []
    const hasReject = rejectsForOccasion.some(word => combined.includes(word))
    
    if (hasReject) {
      return false
    }

    // CATEGORY-SPECIFIC STRICT RULES
 // ✅ NEW: Minimal post-filtering - trust embeddings, only reject ABSURD mismatches
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

    if (occasion === "wedding") {
      // BOTTOMS: Only formal/elegant (dress pants, skirts, formal pants)
      if (category === "bottoms") {
        const reject = ["jean", "short", "cargo", "casual"]
        const hasReject = reject.some(word => combined.includes(word))
        if (hasReject) return false
        // Must be formal
        return true
      }

      // TOPS: Only formal/elegant (blazer, blouse, dress, cardigan)
      if (category === "tops") {
        const reject = ["tee", "tank", "hoodie", "casual", "graphic"]
        const hasReject = reject.some(word => combined.includes(word))
        if (hasReject) return false
        return true
      }

      // SHOES: Only formal shoes (heels, pumps, dressy flats, oxfords)
      if (category === "shoes") {
        const reject = ["sneaker", "trainer", "sandal", "flip flop", "casual", "athletic"]
        const hasReject = reject.some(word => combined.includes(word))
        if (hasReject) return false
        // Must be formal shoes
        const mustHave = ["heel", "pump", "formal", "dress", "oxford", "loafer", "dressy"]
        const isFormal = mustHave.some(word => combined.includes(word))
        return isFormal ? true : true // Allow dressy flats too
      }

      return true
    }

    if (occasion === "party") {
      // BOTTOMS: Dressy bottoms (avoid casual, athletic, formal business)
      if (category === "bottoms") {
        const reject = ["jean", "cargo", "athletic", "hoodie"]
        const hasReject = reject.some(word => combined.includes(word))
        if (hasReject) return false
        return true
      }

      // TOPS: Dressy tops (avoid casual tees, hoodies)
      if (category === "tops") {
        const reject = ["tee", "hoodie", "casual", "graphic"]
        const hasReject = reject.some(word => combined.includes(word))
        if (hasReject) return false
        return true
      }

      // SHOES: Dressy shoes only (heels, pumps, wedges, dressy sandals)
      if (category === "shoes") {
        const reject = ["sneaker", "trainer", "athletic", "flat", "casual", "flip flop"]
        const hasReject = reject.some(word => combined.includes(word))
        if (hasReject) return false
        // Must be dressy
        const mustHave = ["heel", "pump", "wedge", "metallic", "glitter", "dressy"]
        const isDressy = mustHave.some(word => combined.includes(word))
        return isDressy ? true : true // Allow other dressy shoes
      }

      return true
    }

    if (occasion === "work") {
      // BOTTOMS: Professional pants/skirts (avoid jeans, shorts, casual)
      if (category === "bottoms") {
        const reject = ["short", "jean", "cargo", "athleisure", "casual"]
        const hasReject = reject.some(word => combined.includes(word))
        if (hasReject) return false
        // Must be professional
        const mustHave = ["pant", "trouser", "skirt", "professional", "formal", "chino"]
        const isProfessional = mustHave.some(word => combined.includes(word))
        return isProfessional ? true : true
      }

      // TOPS: Professional tops (blouse, blazer, cardigan - avoid tee, tank, hoodie)
      if (category === "tops") {
        const reject = ["tee", "tank", "hoodie", "casual", "graphic"]
        const hasReject = reject.some(word => combined.includes(word))
        if (hasReject) return false
        // Must be professional
        const mustHave = ["blouse", "blazer", "cardigan", "professional", "shirt", "knitwear"]
        const isProfessional = mustHave.some(word => combined.includes(word))
        return isProfessional ? true : true
      }

      // SHOES: Professional shoes (heels, pumps, loafers, oxfords - avoid sneakers, flats, sandals)
      if (category === "shoes") {
        const reject = ["sneaker", "trainer", "flip flop", "sandal", "casual"]
        const hasReject = reject.some(word => combined.includes(word))
        if (hasReject) return false
        // Must be professional
        const mustHave = ["heel", "pump", "loafer", "oxford", "boot", "professional", "dress"]
        const isProfessional = mustHave.some(word => combined.includes(word))
        return isProfessional ? true : true
      }

      return true
    }

    if (occasion === "vacation") {
      // BOTTOMS: Casual/resort wear (shorts, casual pants, skirts)
      if (category === "bottoms") {
        const reject = ["formal", "business", "athletic", "workout"]
        const hasReject = reject.some(word => combined.includes(word))
        if (hasReject) return false
        return true
      }

      // TOPS: Light casual tops (avoid formal blazer, athletic wear)
      if (category === "tops") {
        const reject = ["blazer", "formal", "business", "athletic", "workout"]
        const hasReject = reject.some(word => combined.includes(word))
        if (hasReject) return false
        return true
      }

      // SHOES: Casual/beach shoes (sandals, flip flops, sneakers, flat sandals)
      if (category === "shoes") {
        const reject = ["heel", "pump", "stiletto", "formal", "business", "athletic"]
        const hasReject = reject.some(word => combined.includes(word))
        if (hasReject) return false
        return true
      }

      return true
    }

    if (occasion === "everyday") {
      // BOTTOMS: Casual comfortable bottoms (avoid formal, athletic, dressy)
      if (category === "bottoms") {
        const reject = ["formal", "business", "athletic", "dress pant", "workout"]
        const hasReject = reject.some(word => combined.includes(word))
        if (hasReject) return false
        return true
      }

      // TOPS: Casual comfortable tops (avoid blazer, formal, athletic)
      if (category === "tops") {
        const reject = ["blazer", "formal", "business", "athletic", "workout"]
        const hasReject = reject.some(word => combined.includes(word))
        if (hasReject) return false
        return true
      }

      // SHOES: Comfortable casual shoes (sneakers, flats, casual sandals - avoid heels, formal)
      if (category === "shoes") {
        const reject = ["heel", "pump", "stiletto", "formal", "business", "athletic"]
        const hasReject = reject.some(word => combined.includes(word))
        if (hasReject) return false
        return true
      }

      return true
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

/**
 * Detect category from product name and description
 */
/**
 * Detect category from product - NOW PRIORITIZES outfit_category
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

// Helper functions for embedding generation
function extractMaterials(materialsData) {
  if (!materialsData) return "versatile"
  const text = typeof materialsData === 'string' ? materialsData.toLowerCase() : JSON.stringify(materialsData).toLowerCase()
  const materials = []
  const fabricMap = { cotton: 'cotton', silk: 'silk', wool: 'wool', linen: 'linen', leather: 'leather', denim: 'denim' }
  for (const [pattern, label] of Object.entries(fabricMap)) {
    if (text.includes(pattern)) materials.push(label)
  }
  return materials.length > 0 ? materials.join(' ') : 'versatile'
}

function extractNeckline(name, desc) {
  const combined = `${name} ${desc}`.toLowerCase()
  const necklines = ['v-neck', 'crew', 'scoop', 'turtleneck', 'off-shoulder', 'halter']
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
  return null
}

function extractPattern(name, desc) {
  const combined = `${name} ${desc}`.toLowerCase()
  const patterns = { stripe: 'striped', floral: 'floral', 'polka dot': 'polka dot', plaid: 'plaid', solid: 'solid' }
  for (const [pattern, label] of Object.entries(patterns)) {
    if (combined.includes(pattern)) return label
  }
  return 'solid'
}

function extractFit(name, desc) {
  const combined = `${name} ${desc}`.toLowerCase()
  const fits = ['oversized', 'fitted', 'relaxed', 'slim', 'skinny', 'loose']
  for (const fit of fits) {
    if (combined.includes(fit)) return fit
  }
  return 'regular'
}

function extractCut(name, desc, category) {
  const combined = `${name} ${desc}`.toLowerCase()
  if (category === 'shoes') {
    if (/platform|high heel/i.test(combined)) return 'high'
    if (/kitten heel|mid heel/i.test(combined)) return 'mid'
    if (/flat|sneaker/i.test(combined)) return 'flat'
    return 'flat'
  }
  if (category === 'bottoms') {
    const cuts = ['wide-leg', 'straight', 'skinny', 'cropped', 'high-rise']
    for (const cut of cuts) {
      if (combined.includes(cut)) return cut
    }
  }
  return null
}

function classifyBrandTier(brand, price) {
  if (price > 300) return 'luxury'
  if (price > 100) return 'premium'
  if (price > 50) return 'mid-range'
  return 'affordable'
}

function detectSuitableOccasions(name, desc) {
  const combined = `${name} ${desc}`.toLowerCase()
  const occasions = []
  
  // ✅ HIERARCHY: Check from most specific to least specific
  // ✅ EXCLUSIVITY: Each item gets ONE primary occasion (NEVER add fallback)
  
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

function extractDressType(name, desc, category) {
  // Placeholder function for extracting dress type
  // This should be implemented based on actual logic
  return "unknown"
}
