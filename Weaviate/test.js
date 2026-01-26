import { createClient } from '@supabase/supabase-js'
import dotenv from "dotenv"


dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)


async function analyzeDatabase() {
  console.log('🔍 Analyzing database categories and occasions...\n')

  try {
    // Fetch ALL products with pagination (Supabase has 1000 row default limit)
    console.log('📊 Fetching products from database...')
    let allProducts = []
    let offset = 0
    const chunkSize = 1000
    
    while (true) {
      const { data: chunk, error } = await supabase
        .from('zara_cloth_scraper')
        .select('category_name, product_name, description, price')
        .range(offset, offset + chunkSize - 1)

      if (error) {
        console.error('❌ Error fetching products:', error)
        return
      }

      if (!chunk || chunk.length === 0) break
      
      allProducts.push(...chunk)
      console.log(`   Fetched ${allProducts.length} products...`)
      
      if (chunk.length < chunkSize) break // Last chunk
      offset += chunkSize
    }

    const products = allProducts
    console.log(`\n✅ Total products: ${products.length}\n`)

    // Category detection logic (same as embeddings server)
    const detectCategory = (product) => {
      const categoryName = (product.category_name || "").toLowerCase()
      
      if (categoryName) {
        if (/shirt|blouse|top|tank|tee|sweater|cardigan|hoodie|jacket|blazer|coat|vest|dress|gown|tunic|pullover|crop|cami|romper|jumpsuit/.test(categoryName)) {
          return "tops"
        }
        if (/pant|jean|trouser|legging|short|skirt|jogger|culotte|cargo|chino/.test(categoryName)) {
          return "bottoms"
        }
        if (/shoe|sneaker|boot|sandal|trainer|heel|flat|pump|footwear/.test(categoryName)) {
          return "shoes"
        }
      }
      
      const name = (product.product_name || "").toLowerCase()
      const desc = (product.description || "").toLowerCase()
      const combined = `${name} ${desc}`
      
      if (/shirt|blouse|top|tank|tee|sweater|cardigan|hoodie|jacket|blazer|coat|vest|dress|gown|tunic|poncho|pullover|crop|halter|cami|romper|jumpsuit/.test(combined)) {
        return "tops"
      }
      if (/pant|jean|trouser|legging|short|skirt|jogger|culotte|cargo|chino|culottes|palazzo|capri/.test(combined)) {
        return "bottoms"
      }
      if (/shoe|sneaker|boot|sandal|trainer|runner|loafer|heel|flat|pump|slipper|mule|clog|espadrille|oxford|derby|monk|brogue/.test(combined)) {
        return "shoes"
      }
      
      return "unknown"
    }

    // Occasion detection logic
    const detectOccasions = (product) => {
      const name = (product.product_name || "").toLowerCase()
      const desc = (product.description || "").toLowerCase()
      const combined = `${name} ${desc}`
      
      const occasions = []
      
      if (/gym|sport|workout|athletic|training|running|yoga|fitness/.test(combined)) {
        occasions.push("gym")
      }
      if (/formal|suit|blazer|tuxedo|evening|gown|cocktail|dress/.test(combined)) {
        occasions.push("formal")
      }
      if (/party|club|night|sequin|metallic|glitter|sparkle/.test(combined)) {
        occasions.push("party")
      }
      if (/casual|everyday|relaxed|comfort/.test(combined) || occasions.length === 0) {
        occasions.push("casual")
      }
      
      return occasions
    }

    // Analyze categories
    const categoryCount = { tops: 0, bottoms: 0, shoes: 0, unknown: 0 }
    const occasionCount = { gym: 0, formal: 0, party: 0, casual: 0 }
    const priceRanges = { under50: 0, "50-100": 0, "100-200": 0, "200-500": 0, over500: 0 }
    
    products.forEach(product => {
      const category = detectCategory(product)
      categoryCount[category]++
      
      const occasions = detectOccasions(product)
      occasions.forEach(occ => {
        occasionCount[occ]++
      })
      
      const price = parseFloat(product.price) || 0
      if (price < 50) priceRanges.under50++
      else if (price < 100) priceRanges["50-100"]++
      else if (price < 200) priceRanges["100-200"]++
      else if (price < 500) priceRanges["200-500"]++
      else priceRanges.over500++
    })

    console.log('📊 CATEGORY BREAKDOWN:')
    console.log(`   Tops: ${categoryCount.tops} (${(categoryCount.tops/products.length*100).toFixed(1)}%)`)
    console.log(`   Bottoms: ${categoryCount.bottoms} (${(categoryCount.bottoms/products.length*100).toFixed(1)}%)`)
    console.log(`   Shoes: ${categoryCount.shoes} (${(categoryCount.shoes/products.length*100).toFixed(1)}%)`)
    console.log(`   Unknown: ${categoryCount.unknown} (${(categoryCount.unknown/products.length*100).toFixed(1)}%)\n`)

    console.log('🎉 OCCASION BREAKDOWN:')
    console.log(`   Casual: ${occasionCount.casual} (${(occasionCount.casual/products.length*100).toFixed(1)}%)`)
    console.log(`   Party: ${occasionCount.party} (${(occasionCount.party/products.length*100).toFixed(1)}%)`)
    console.log(`   Formal: ${occasionCount.formal} (${(occasionCount.formal/products.length*100).toFixed(1)}%)`)
    console.log(`   Gym: ${occasionCount.gym} (${(occasionCount.gym/products.length*100).toFixed(1)}%)\n`)

    console.log('💰 PRICE BREAKDOWN:')
    console.log(`   Under $50: ${priceRanges.under50}`)
    console.log(`   $50-$100: ${priceRanges["50-100"]}`)
    console.log(`   $100-$200: ${priceRanges["100-200"]}`)
    console.log(`   $200-$500: ${priceRanges["200-500"]}`)
    console.log(`   Over $500: ${priceRanges.over500}\n`)

    // Sample unknown products
    console.log('❓ SAMPLE UNKNOWN CATEGORY PRODUCTS:')
    const unknownProducts = products.filter(p => detectCategory(p) === 'unknown').slice(0, 5)
    unknownProducts.forEach(p => {
      console.log(`   - ${p.product_name} (category_name: ${p.category_name})`)
    })

  } catch (err) {
    console.error('❌ Analysis error:', err)
  }
}

analyzeDatabase()
