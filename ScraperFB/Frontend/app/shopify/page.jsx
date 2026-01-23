"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Search,
  Package,
  Loader2,
  Download,
  Filter,
  Grid,
  DollarSign,
  CheckCircle,
  XCircle,
  Database,
  Check,
  ImageIcon,
  Store,
  Plus,
  Trash2,
  Globe,
  Eye,
  X,
  RefreshCw,
  ShoppingBag,
  Layers,
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  AlertCircle,
} from "lucide-react"
import { createClient } from "@supabase/supabase-js"
import toast, { Toaster } from "react-hot-toast"

const supabase = createClient(
  "https://aqkeprwxxsryropnhfvm.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxa2Vwcnd4eHNyeXJvcG5oZnZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4MzE4MjksImV4cCI6MjA1MzQwNzgyOX0.1nstrLtlahU3kGAu-UrzgOVw6XwyKU6n5H5q4Taqtus",
)

const DEFAULT_STORES = [
  { name: "Beginning Boutique", url: "https://www.beginningboutique.com", active: true }, // Updated default store
  { name: "Kith", url: "https://kith.com", active: false },
  { name: "Allbirds", url: "https://www.allbirds.com", active: false },
  // Removed other default stores to match the update
]

export default function DynamicShopifyScraper() {
  const [viewMode, setViewMode] = useState("scraper") // 'scraper' or 'dashboard'
  const [syncLogs, setSyncLogs] = useState([])
  const [priceChanges, setPriceChanges] = useState([])
  const [stockChanges, setStockChanges] = useState([])
  const [dashboardStats, setDashboardStats] = useState({
    totalStores: 0,
    totalProducts: 0,
    recentChanges: 0,
    lastSync: null,
  })
  const [syncing, setSyncing] = useState(false)
  const [selectedStoreForSync, setSelectedStoreForSync] = useState(null)

  // Store Management
  const [stores, setStores] = useState(DEFAULT_STORES)
  const [currentStore, setCurrentStore] = useState(DEFAULT_STORES[0])
  const [showAddStore, setShowAddStore] = useState(false)
  const [newStoreName, setNewStoreName] = useState("")
  const [newStoreUrl, setNewStoreUrl] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  // State Management
  const [collections, setCollections] = useState([])
  const [selectedCollection, setSelectedCollection] = useState("")
  const [allProducts, setAllProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [productsPerPage] = useState(24)
  const [scrapingAll, setScrapingAll] = useState(false)

  // Renamed 'viewMode' state to 'displayMode' to avoid conflict
  const [displayMode, setDisplayMode] = useState("paginated") // 'paginated' or 'all'

  // Selection & Database States
  const [selectedProducts, setSelectedProducts] = useState(new Set())
  const [uploadingToDb, setUploadingToDb] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [uploadResults, setUploadResults] = useState({ success: 0, failed: 0, skipped: 0 })
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedProductImages, setSelectedProductImages] = useState(null)

  // Quick View State
  const [quickViewProduct, setQuickViewProduct] = useState(null)
  const [showQuickView, setShowQuickView] = useState(false)
  const [checkingShopify, setCheckingShopify] = useState(false)

  // Filter States
  const [filters, setFilters] = useState({
    vendor: "",
    productType: "",
    tag: "",
    priceMin: "",
    priceMax: "",
    availability: "all",
    searchQuery: "",
  })

  // Metadata States
  const [vendors, setVendors] = useState([])
  const [productTypes, setProductTypes] = useState([])
  const [tags, setTags] = useState([])
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalCollections: 0,
    avgPrice: 0,
    inStock: 0,
    outOfStock: 0,
  })

  useEffect(() => {
    if (viewMode === "dashboard") {
      loadDashboardData()
    }
  }, [viewMode])

  // Load stores from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem("shopify_stores")
    if (saved) {
      const parsedStores = JSON.parse(saved)
      setStores(parsedStores)
      const activeStore = parsedStores.find((s) => s.active) || parsedStores[0]
      setCurrentStore(activeStore)
    }
  }, [])

  // Save stores to localStorage
  useEffect(() => {
    localStorage.setItem("shopify_stores", JSON.stringify(stores))
  }, [stores])

  // Fetch Collections when store changes
  useEffect(() => {
    if (currentStore && viewMode === "scraper") {
      fetchCollections()
      setSelectedCollection("")
      setAllProducts([])
      setSelectedProducts(new Set())
    }
  }, [currentStore, viewMode])

  const loadDashboardData = async () => {
    try {
      // Load sync logs
      const { data: logs, error: logsError } = await supabase
        .from("sync_logs")
        .select("*")
        .order("sync_timestamp", { ascending: false })
        .limit(20)

      // Check if tables don't exist
      if (logsError && logsError.code === "42P01") {
        toast.error("Database tables not found. Please run the SQL scripts first!", { duration: 8000 })
        setDashboardStats({
          totalStores: stores.length,
          totalProducts: 0,
          recentChanges: 0,
          lastSync: null,
        })
        return
      }

      if (logsError) throw logsError
      setSyncLogs(logs || [])

      // Load price changes
      const { data: prices, error: pricesError } = await supabase
        .from("price_history")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(20)

      if (pricesError && pricesError.code !== "42P01") throw pricesError
      setPriceChanges(prices || [])

      // Load stock changes
      const { data: stocks, error: stocksError } = await supabase
        .from("stock_history")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(20)

      if (stocksError && stocksError.code !== "42P01") throw stocksError
      setStockChanges(stocks || [])

      // Calculate dashboard stats
      const { count: productCount } = await supabase
        .from("zara_cloth_test")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)

      setDashboardStats({
        totalStores: stores.length,
        totalProducts: productCount || 0,
        recentChanges: (prices?.length || 0) + (stocks?.length || 0),
        lastSync: logs?.[0]?.sync_timestamp || null,
      })
    } catch (err) {
      console.error("[v0] Error loading dashboard data:", err)
      toast.error("Failed to load dashboard data: " + err.message)
    }
  }

  const syncStore = async (store) => {
    setSyncing(true)
    setSelectedStoreForSync(store)
    toast.loading(`Syncing ${store.name}...`, { id: "sync" })

    let productsAdded = 0
    let productsUpdated = 0
    let productsRemoved = 0
    let totalProductsSynced = 0

    try {
      // Fetch all products from the store
      const response = await fetch(`${store.url}/products.json?limit=250`)
      if (!response.ok) throw new Error("Failed to fetch products")

      const data = await response.json()
      const shopifyProducts = data.products || []
      totalProductsSynced = shopifyProducts.length

      // Get existing products from database for this store
      const { data: dbProducts, error: dbError } = await supabase
        .from("zara_cloth_test")
        .select("product_id, price, stock_status, product_name")
        .eq("brand", store.name)

      if (dbError) throw dbError

      const dbProductMap = new Map(dbProducts.map((p) => [p.product_id, p]))

      // Process each product
      for (const product of shopifyProducts) {
        const productId = Number.parseInt(product.id)
        const variant = product.variants?.[0] || {}
        const newPrice = variant.price ? Number.parseFloat(variant.price) : 0
        const newStockStatus = variant.available ? "in_stock" : "out_of_stock"

        const existingProduct = dbProductMap.get(productId)

        if (!existingProduct) {
          // New product - insert it
          const dbProduct = transformProductForDB(product, store)
          const { error: insertError } = await supabase.from("zara_cloth_test").insert([dbProduct])

          if (!insertError) {
            productsAdded++
          }
        } else {
          // Existing product - check for changes
          let hasChanges = false
          const updates = {
            last_synced_at: new Date().toISOString(),
            sync_count: (existingProduct.sync_count || 0) + 1,
          }

          // Check price change
          if (existingProduct.price !== newPrice) {
            await supabase.from("price_history").insert([
              {
                product_id: productId,
                product_name: product.title,
                old_price: existingProduct.price,
                new_price: newPrice,
                store_name: store.name,
              },
            ])
            updates.price = newPrice
            hasChanges = true
          }

          // Check stock change
          if (existingProduct.stock_status !== newStockStatus) {
            await supabase.from("stock_history").insert([
              {
                product_id: productId,
                product_name: product.title,
                old_status: existingProduct.stock_status,
                new_status: newStockStatus,
                store_name: store.name,
              },
            ])
            updates.stock_status = newStockStatus
            updates.availability = variant.available
            hasChanges = true
          }

          if (hasChanges) {
            await supabase.from("zara_cloth_test").update(updates).eq("product_id", productId)
            productsUpdated++
          } else {
            // Just update sync timestamp
            await supabase
              .from("zara_cloth_test")
              .update({ last_synced_at: new Date().toISOString(), sync_count: updates.sync_count })
              .eq("product_id", productId)
          }

          dbProductMap.delete(productId)
        }
      }

      // Mark remaining products as inactive (removed from store)
      for (const [productId] of dbProductMap) {
        await supabase.from("zara_cloth_test").update({ is_active: false }).eq("product_id", productId)
        productsRemoved++
      }

      // Log the sync
      await supabase.from("sync_logs").insert([
        {
          store_name: store.name,
          store_url: store.url,
          products_added: productsAdded,
          products_updated: productsUpdated,
          products_removed: productsRemoved,
          total_products_synced: totalProductsSynced,
          status: "success",
        },
      ])

      toast.success(
        `Sync complete! Added: ${productsAdded}, Updated: ${productsUpdated}, Removed: ${productsRemoved}`,
        { id: "sync", duration: 6000 },
      )

      // Reload dashboard data
      await loadDashboardData()
    } catch (err) {
      console.error("Sync error:", err)
      await supabase.from("sync_logs").insert([
        {
          store_name: store.name,
          store_url: store.url,
          products_added: productsAdded,
          products_updated: productsUpdated,
          products_removed: productsRemoved,
          total_products_synced: totalProductsSynced,
          status: "failed",
          error_message: err.message,
        },
      ])
      toast.error(`Sync failed: ${err.message}`, { id: "sync" })
    } finally {
      setSyncing(false)
      setSelectedStoreForSync(null)
    }
  }

  const filteredStores = stores.filter(
    (store) =>
      store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.url.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const addStore = async () => {
    if (!newStoreName || !newStoreUrl) {
      toast.error("Please enter both store name and URL")
      return
    }

    try {
      setCheckingShopify(true)
      const url = new URL(newStoreUrl)
      const shopifyCheckUrl = `${url.origin}/products.json`

      const response = await fetch(shopifyCheckUrl)

      if (!response.ok) {
        toast.error("This site is not using Shopify.") // Simplified error message
        return
      }

      const data = await response.json()

      if (data.products) {
        const newStore = {
          name: newStoreName,
          url: url.origin,
          active: false,
        }

        setStores((prev) => [...prev, newStore])
        setNewStoreName("")
        setNewStoreUrl("")
        setShowAddStore(false)
        toast.success(`Store "${newStoreName}" added successfully!`) // Simplified success message
      } else {
        toast.error("This site is not a valid Shopify store.") // Simplified error message
      }
    } catch (err) {
      toast.error("This store is not built on Shopify — please enter a Shopify store URL.") // Simplified error message
    } finally {
      setCheckingShopify(false)
    }
  }

  // Delete store
  const deleteStore = (index) => {
    if (confirm(`Delete store "${stores[index].name}"?`)) {
      const newStores = stores.filter((_, i) => i !== index)
      setStores(newStores)
      if (currentStore === stores[index]) {
        setCurrentStore(newStores[0])
      }
      toast.success("Store deleted successfully")
    }
  }

  // Switch store
  const switchStore = (store) => {
    setCurrentStore(store)
    setStores(stores.map((s) => ({ ...s, active: s.url === store.url })))
    toast.success(`Switched to ${store.name}`)
  }

  const fetchCollections = async () => {
    try {
      setLoading(true)
      setError("")
      const response = await fetch(`${currentStore.url}/collections.json`)

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (data.collections) {
        setCollections(data.collections)
        setStats((prev) => ({ ...prev, totalCollections: data.collections.length }))
      } else {
        setError("No collections found. This might not be a Shopify store.")
      }
    } catch (err) {
      setError(`Failed to fetch collections: ${err.message}`)
      setCollections([])
      toast.error("Failed to fetch collections")
    } finally {
      setLoading(false)
    }
  }

  const fetchCollectionProducts = async (handle, pageNum = 1) => {
    if (!handle) return []

    try {
      const limit = 250
      const url = `${currentStore.url}/collections/${handle}/products.json?limit=${limit}&page=${pageNum}`
      const response = await fetch(url)

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      return data.products || []
    } catch (err) {
      console.error(`Error fetching page ${pageNum}:`, err)
      toast.error(`Error fetching page ${pageNum}`)
      return []
    }
  }

  const scrapeAllCollectionProducts = async (handle) => {
    setScrapingAll(true)
    setError("")
    let allProds = []
    let page = 1
    let hasMore = true

    try {
      toast.loading("Fetching all products...", { id: "scraping" })

      while (hasMore) {
        const prods = await fetchCollectionProducts(handle, page)

        if (prods.length === 0) {
          hasMore = false
        } else {
          allProds = [...allProds, ...prods]
          toast.loading(`Fetched ${allProds.length} products...`, { id: "scraping" })

          if (prods.length < 250) {
            hasMore = false
          }

          page++
          await new Promise((resolve) => setTimeout(resolve, 300)) // Rate limiting
        }
      }

      toast.success(`Successfully fetched ${allProds.length} products!`, { id: "scraping" })
      return allProds
    } catch (err) {
      setError("Error during full scrape: " + err.message)
      toast.error("Error during scraping", { id: "scraping" })
      return allProds
    } finally {
      setScrapingAll(false)
    }
  }

  const handleCollectionSelect = async (handle) => {
    setSelectedCollection(handle)
    setCurrentPage(1)
    setLoading(true)
    setError("")
    setSelectedProducts(new Set())
    setDisplayMode("paginated") // Reset to paginated view

    try {
      const prods = await scrapeAllCollectionProducts(handle)
      setAllProducts(prods)

      extractMetadata(prods)
      calculateStats(prods)
    } catch (err) {
      setError("Failed to load products: " + err.message)
      toast.error("Failed to load products")
    } finally {
      setLoading(false)
    }
  }

  const extractMetadata = (prods) => {
    const vendorSet = new Set()
    const typeSet = new Set()
    const tagSet = new Set()

    prods.forEach((p) => {
      if (p.vendor) vendorSet.add(p.vendor)
      if (p.product_type) typeSet.add(p.product_type)
      if (p.tags) {
        if (Array.isArray(p.tags)) {
          p.tags.forEach((t) => tagSet.add(t))
        } else if (typeof p.tags === "string") {
          p.tags.split(",").forEach((t) => tagSet.add(t.trim()))
        }
      }
    })

    setVendors(Array.from(vendorSet).sort())
    setProductTypes(Array.from(typeSet).sort())
    setTags(Array.from(tagSet).sort())
  }

  const calculateStats = (prods) => {
    let totalPrice = 0
    let inStock = 0
    let outOfStock = 0

    prods.forEach((p) => {
      if (p.variants && p.variants.length > 0) {
        const variant = p.variants[0]
        if (variant.price) {
          totalPrice += Number.parseFloat(variant.price)
        }
        if (variant.available) {
          inStock++
        } else {
          outOfStock++
        }
      }
    })

    setStats({
      totalProducts: prods.length,
      totalCollections: collections.length,
      avgPrice: prods.length > 0 ? (totalPrice / prods.length).toFixed(2) : 0,
      inStock,
      outOfStock,
    })
  }

  const filteredProducts = useMemo(() => {
    let filtered = [...allProducts]

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.title?.toLowerCase().includes(query) ||
          p.vendor?.toLowerCase().includes(query) ||
          p.product_type?.toLowerCase().includes(query),
      )
    }

    if (filters.vendor) {
      filtered = filtered.filter((p) => p.vendor === filters.vendor)
    }

    if (filters.productType) {
      filtered = filtered.filter((p) => p.product_type === filters.productType)
    }

    if (filters.tag) {
      filtered = filtered.filter((p) => {
        if (Array.isArray(p.tags)) {
          return p.tags.includes(filters.tag)
        } else if (typeof p.tags === "string") {
          return p.tags
            .split(",")
            .map((t) => t.trim())
            .includes(filters.tag)
        }
        return false
      })
    }

    if (filters.priceMin || filters.priceMax) {
      filtered = filtered.filter((p) => {
        if (!p.variants || p.variants.length === 0) return false
        const price = Number.parseFloat(p.variants[0].price)
        if (filters.priceMin && price < Number.parseFloat(filters.priceMin)) return false
        if (filters.priceMax && price > Number.parseFloat(filters.priceMax)) return false
        return true
      })
    }

    if (filters.availability !== "all") {
      filtered = filtered.filter((p) => {
        if (!p.variants || p.variants.length === 0) return false
        const available = p.variants[0].available
        return filters.availability === "in-stock" ? available : !available
      })
    }

    return filtered
  }, [allProducts, filters])

  const displayedProducts = useMemo(() => {
    if (displayMode === "all") {
      // Changed from viewMode to displayMode
      return filteredProducts // Show all products
    }
    // Paginated view
    const startIndex = (currentPage - 1) * productsPerPage
    const endIndex = startIndex + productsPerPage
    return filteredProducts.slice(startIndex, endIndex)
  }, [filteredProducts, currentPage, productsPerPage, displayMode]) // Changed from viewMode to displayMode

  const totalPages = Math.ceil(filteredProducts.length / productsPerPage)

  const resetFilters = () => {
    setFilters({
      vendor: "",
      productType: "",
      tag: "",
      priceMin: "",
      priceMax: "",
      availability: "all",
      searchQuery: "",
    })
    toast.success("Filters reset")
  }

  const toggleProductSelection = (id) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedProducts(newSelected)
  }

  const selectAllPage = () => {
    const newSelected = new Set(selectedProducts)
    displayedProducts.forEach((p) => newSelected.add(p.id))
    setSelectedProducts(newSelected)
    toast.success(`Selected ${displayedProducts.length} products on this page`)
  }

  const selectAllFiltered = () => {
    const newSelected = new Set()
    filteredProducts.forEach((p) => newSelected.add(p.id))
    setSelectedProducts(newSelected)
    toast.success(`Selected all ${filteredProducts.length} filtered products`)
  }

  const deselectAll = () => {
    setSelectedProducts(new Set())
    toast.success("All products deselected")
  }

  const openQuickView = (product) => {
    setQuickViewProduct(product)
    setShowQuickView(true)
  }

  const closeQuickView = () => {
    setShowQuickView(false)
    setQuickViewProduct(null)
  }

  const transformProductForDB = (product, store = currentStore) => {
    // Added store param
    const variant = product.variants?.[0] || {}
    const allVariants = product.variants || []

    const sizes = allVariants.map((v) => v.title || v.option1 || "One Size").filter(Boolean)
    const images = product.images?.map((img) => img.src) || []

    let tagsArray = []
    if (Array.isArray(product.tags)) {
      tagsArray = product.tags
    } else if (typeof product.tags === "string") {
      tagsArray = product.tags.split(",").map((t) => t.trim())
    }

    const productUrl = `${store.url}/products/${product.handle}`

    const stripHtml = (html) => {
      if (!html) return ""
      return html
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .trim()
    }

    let productColor = "N/A"
    if (variant.option2) productColor = variant.option2
    else if (variant.option1 && !sizes.includes(variant.option1)) productColor = variant.option1
    else if (tagsArray.length > 0) productColor = tagsArray[0]

    return {
      product_name: product.title || "Untitled Product",
      price: variant.price ? Number.parseFloat(variant.price) : 0,
      colour: productColor, // REQUIRED field
      description: stripHtml(product.body_html) || null,
      size: sizes, // REQUIRED array field
      materials: [], // Array field (empty for now)
      availability: variant.available || false,
      category_id: null,
      product_id: product.id ? Number.parseInt(product.id) : null,
      colour_code: null,
      section: null,
      product_family: product.product_type || null,
      product_family_en: product.product_type || null,
      product_subfamily: null,
      care: null,
      materials_description: null,
      dimension: null,
      low_on_stock: !variant.available,
      sku: variant.sku || null,
      url: productUrl,
      currency: "USD",
      image: images.length > 0 ? images.map((url) => ({ url })) : null,
      you_may_also_like: null,
      category_path: product.product_type || null,
      scraped_category: product.product_type || null,
      scrape_type: "shopify_api",
      brand: product.vendor || store.name,
      category: product.product_type || null,
      stock_status: variant.available ? "in_stock" : "out_of_stock",
      color: productColor,
      images: images.length > 0 ? images.map((url) => ({ url })) : null,
      product_url: productUrl,
      care_info: null,
      last_synced_at: new Date().toISOString(), // Added
      is_active: true, // Added
      sync_count: 0, // Added
      first_scraped_at: new Date().toISOString(), // Added
    }
  }

  const uploadSelectedToDatabase = async () => {
    if (selectedProducts.size === 0) {
      toast.error("Please select products to upload")
      return
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      toast.error("Database not configured. Please set up Supabase environment variables.") // Simplified error message
      return
    }

    const selectedProds = allProducts.filter((p) => selectedProducts.has(p.id))

    setUploadingToDb(true)
    setUploadProgress({ current: 0, total: selectedProds.length })
    setUploadResults({ success: 0, failed: 0, skipped: 0 })

    let successCount = 0
    let failedCount = 0
    let skippedCount = 0

    toast.loading(`Uploading 0/${selectedProds.length} products...`, { id: "upload" })

    for (let i = 0; i < selectedProds.length; i++) {
      const product = selectedProds[i]
      setUploadProgress({ current: i + 1, total: selectedProds.length })

      try {
        const dbProduct = transformProductForDB(product)

        const { data: insertResult, error } = await supabase.from("zara_cloth_test").insert([dbProduct])

        if (error) {
          // console.error("[v0] Database insert error:", {
          //   message: error.message,
          //   details: error.details,
          //   hint: error.hint,
          //   code: error.code,
          //   product: product.title,
          // })

          if (error.code === "23505" || error.message?.includes("duplicate") || error.message?.includes("unique")) {
            // console.log(`[v0] Product "${product.title}" already exists, skipping...`) // Removed console log
            skippedCount++
          } else {
            failedCount++
          }
        } else {
          // console.log(`[v0] Successfully uploaded "${product.title}"`) // Removed console log
          successCount++
        }
      } catch (err) {
        // console.error(`[v0] Exception while processing "${product.title}":`, {
        //   error: err,
        //   message: err.message,
        //   stack: err.stack,
        // }) // Removed console log
        failedCount++
      }

      setUploadResults({ success: successCount, failed: failedCount, skipped: skippedCount })

      // Update toast every 5 products
      if (i % 5 === 0 || i === selectedProds.length - 1) {
        toast.loading(`Uploading ${i + 1}/${selectedProds.length} products...`, { id: "upload" })
      }

      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    setUploadingToDb(false)

    if (failedCount > 0) {
      toast.error(
        `Upload Complete with errors! Success: ${successCount} | Skipped: ${skippedCount} | Failed: ${failedCount}. Check console for details.`, // Simplified message
        {
          id: "upload",
          duration: 8000,
        },
      )
    } else {
      toast.success(`Upload Complete! ${successCount} | ${skippedCount} | ${failedCount}`, {
        // Simplified message
        id: "upload",
        duration: 5000,
      })
    }
  }

  const exportToJSON = () => {
    const dataStr = JSON.stringify(filteredProducts, null, 2)
    const blob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${currentStore.name.replace(/\s+/g, "-")}-products-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("JSON exported successfully")
  }

  const exportToCSV = () => {
    let csv = "ID,Title,Handle,Vendor,Type,Price,Compare Price,Available,SKU,Tags,Images,Variants,Weight,Inventory\n"

    filteredProducts.forEach((p) => {
      const variant = p.variants?.[0] || {}
      const tags = Array.isArray(p.tags) ? p.tags.join(";") : p.tags || ""
      const images = p.images?.map((img) => img.src).join(";") || ""
      const variantCount = p.variants?.length || 0

      csv += `${p.id},"${(p.title || "").replace(/"/g, '""')}",${p.handle || ""},${p.vendor || ""},${p.product_type || ""},${variant.price || ""},${variant.compare_at_price || ""},${variant.available || false},${variant.sku || ""},"${tags}","${images}",${variantCount},${variant.weight || ""},${variant.inventory_quantity || 0}\n`
    })

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${currentStore.name.replace(/\s+/g, "-")}-products-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("CSV exported successfully")
  }

  const showImageGallery = (product) => {
    setSelectedProductImages(product)
    setShowImageModal(true)
  }

  const ProductCard = ({ product }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0)

    // Now check if product exists AFTER all hooks are declared
    if (!product) return null

    const variant = product.variants?.[0] || {}
    const images = product.images || []
    const hasDiscount =
      variant.compare_at_price && Number.parseFloat(variant.compare_at_price) > Number.parseFloat(variant.price)
    const discount = hasDiscount
      ? (
          ((Number.parseFloat(variant.compare_at_price) - Number.parseFloat(variant.price)) /
            Number.parseFloat(variant.compare_at_price)) *
          100
        ).toFixed(0)
      : 0
    const isSelected = selectedProducts.has(product.id)

    const nextImage = (e) => {
      e.stopPropagation()
      setCurrentImageIndex((prev) => (prev + 1) % images.length)
    }

    const prevImage = (e) => {
      e.stopPropagation()
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
    }

    return (
      // Product Card styling to match luxury aesthetic
      <div
        className={`bg-white rounded-none overflow-hidden hover:shadow-2xl transition-all duration-300 border ${isSelected ? "border-black ring-2 ring-gray-300" : "border-gray-200"}`}
      >
        <div className="relative h-96 bg-gray-50 group overflow-hidden">
          {images.length > 0 ? (
            <>
              <img
                src={images[currentImageIndex].src || "/placeholder.svg"}
                alt={product.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
              />

              {images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/80 text-white p-2 rounded-none opacity-0 group-hover:opacity-100 transition-all hover:bg-black"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <button
                    onClick={nextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/80 text-white p-2 rounded-none opacity-0 group-hover:opacity-100 transition-all hover:bg-black"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation()
                          setCurrentImageIndex(idx)
                        }}
                        className={`h-1.5 rounded-none transition-all ${
                          idx === currentImageIndex ? "bg-white w-8" : "bg-white/50 hover:bg-white/75 w-1.5"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <Package className="w-20 h-20 text-gray-300" />
            </div>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation()
              openQuickView(product)
            }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black text-white px-8 py-3 rounded-none opacity-0 group-hover:opacity-100 transition-all hover:bg-gray-900 font-light tracking-wider text-sm flex items-center gap-2"
          >
            <Eye className="w-4 h-4" /> QUICK VIEW
          </button>

          <div className="absolute top-4 left-4">
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleProductSelection(product.id)
              }}
              className={`w-10 h-10 rounded-none flex items-center justify-center transition-all ${isSelected ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"}`}
            >
              {isSelected && <Check className="w-5 h-5" />}
            </button>
          </div>

          {hasDiscount && (
            <div className="absolute top-4 right-4 bg-black text-white px-3 py-1.5 rounded-none text-xs font-light tracking-wide">
              {discount}% OFF
            </div>
          )}

          <div className="absolute bottom-4 right-4">
            {variant.available ? (
              <span className="bg-white text-black px-3 py-1.5 rounded-none text-xs font-light tracking-wide border border-black">
                IN STOCK
              </span>
            ) : (
              <span className="bg-black text-white px-3 py-1.5 rounded-none text-xs font-light tracking-wide">
                OUT OF STOCK
              </span>
            )}
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="font-light text-black text-sm tracking-wide line-clamp-2 flex-1 uppercase">
              {product.title}
            </h3>
            <button
              onClick={(e) => {
                e.stopPropagation()
                showImageGallery(product)
              }}
              className="text-gray-400 hover:text-black transition-colors flex-shrink-0"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl font-light text-black tracking-wide">${variant.price}</span>
            {hasDiscount && (
              <span className="text-sm text-gray-400 line-through font-light">${variant.compare_at_price}</span>
            )}
          </div>

          <div className="space-y-2 text-xs text-gray-600 font-light">
            {product.vendor && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">BRAND:</span>
                <span className="uppercase tracking-wide">{product.vendor}</span>
              </div>
            )}
            {product.product_type && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">TYPE:</span>
                <span className="uppercase tracking-wide">{product.product_type}</span>
              </div>
            )}
            {product.variants && product.variants.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">VARIANTS:</span>
                <span>{product.variants.length}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const DashboardView = () => (
    <div className="space-y-6">
      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <Store className="w-8 h-8 text-black" />
            <span className="text-3xl font-light text-black">{dashboardStats.totalStores}</span>
          </div>
          <p className="text-sm text-gray-600 font-light tracking-wide uppercase">Total Stores</p>
        </div>

        <div className="bg-white p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <Package className="w-8 h-8 text-black" />
            <span className="text-3xl font-light text-black">{dashboardStats.totalProducts}</span>
          </div>
          <p className="text-sm text-gray-600 font-light tracking-wide uppercase">Active Products</p>
        </div>

        <div className="bg-white p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <Activity className="w-8 h-8 text-black" />
            <span className="text-3xl font-light text-black">{dashboardStats.recentChanges}</span>
          </div>
          <p className="text-sm text-gray-600 font-light tracking-wide uppercase">Recent Changes</p>
        </div>

        <div className="bg-white p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <Clock className="w-8 h-8 text-black" />
            <span className="text-xl font-light text-black">
              {dashboardStats.lastSync ? new Date(dashboardStats.lastSync).toLocaleDateString() : "Never"}
            </span>
          </div>
          <p className="text-sm text-gray-600 font-light tracking-wide uppercase">Last Sync</p>
        </div>
      </div>

      {/* Stores with Sync Buttons */}
      <div className="bg-white p-6 border border-gray-200">
        <h2 className="text-xl font-light mb-6 text-black tracking-wider uppercase flex items-center gap-2">
          <Store className="w-6 h-6" /> Your Stores
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((store, idx) => (
            <div key={idx} className="bg-gray-50 p-5 border border-gray-200 hover:border-black transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-light text-black text-lg mb-1">{store.name}</h3>
                  <p className="text-xs text-gray-500 font-light break-all">{store.url}</p>
                </div>
                {store.active && (
                  <span className="bg-black text-white px-2 py-1 text-xs font-light tracking-wider">ACTIVE</span>
                )}
              </div>
              <button
                onClick={() => syncStore(store)}
                disabled={syncing && selectedStoreForSync?.url === store.url}
                className="w-full mt-4 bg-black text-white px-4 py-2.5 rounded-none hover:bg-gray-900 transition-colors font-light tracking-wider text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {syncing && selectedStoreForSync?.url === store.url ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> SYNCING...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" /> SYNC NOW
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Sync History */}
      <div className="bg-white p-6 border border-gray-200">
        <h2 className="text-xl font-light mb-6 text-black tracking-wider uppercase flex items-center gap-2">
          <Clock className="w-6 h-6" /> Sync History
        </h2>
        <div className="space-y-3">
          {syncLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-500 font-light">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No sync history yet. Start by syncing a store above.</p>
            </div>
          ) : (
            syncLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 hover:border-black transition-colors"
              >
                <div className="flex-1">
                  <p className="font-light text-black mb-1">{log.store_name}</p>
                  <p className="text-xs text-gray-500 font-light">{new Date(log.sync_timestamp).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-6 text-sm font-light">
                  <div className="text-center">
                    <p className="text-green-600 text-lg">{log.products_added}</p>
                    <p className="text-xs text-gray-500 uppercase">Added</p>
                  </div>
                  <div className="text-center">
                    <p className="text-blue-600 text-lg">{log.products_updated}</p>
                    <p className="text-xs text-gray-500 uppercase">Updated</p>
                  </div>
                  <div className="text-center">
                    <p className="text-red-600 text-lg">{log.products_removed}</p>
                    <p className="text-xs text-gray-500 uppercase">Removed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-black text-lg">{log.total_products_synced}</p>
                    <p className="text-xs text-gray-500 uppercase">Total</p>
                  </div>
                </div>
                <div className="ml-6">
                  {log.status === "success" ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Changes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Price Changes */}
        <div className="bg-white p-6 border border-gray-200">
          <h2 className="text-xl font-light mb-6 text-black tracking-wider uppercase flex items-center gap-2">
            <TrendingDown className="w-6 h-6" /> Price Changes
          </h2>
          <div className="space-y-3">
            {priceChanges.length === 0 ? (
              <p className="text-center py-8 text-gray-500 font-light text-sm">No price changes yet</p>
            ) : (
              priceChanges.slice(0, 10).map((change) => (
                <div key={change.id} className="p-3 bg-gray-50 border border-gray-200">
                  <p className="font-light text-black text-sm mb-2 line-clamp-1">{change.product_name}</p>
                  <div className="flex items-center gap-4 text-xs font-light">
                    <span className="text-gray-500 line-through">${change.old_price}</span>
                    <TrendingDown className="w-4 h-4 text-green-600" />
                    <span className="text-black">${change.new_price}</span>
                    <span className="ml-auto text-gray-400">{new Date(change.changed_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stock Changes */}
        <div className="bg-white p-6 border border-gray-200">
          <h2 className="text-xl font-light mb-6 text-black tracking-wider uppercase flex items-center gap-2">
            <TrendingUp className="w-6 h-6" /> Stock Changes
          </h2>
          <div className="space-y-3">
            {stockChanges.length === 0 ? (
              <p className="text-center py-8 text-gray-500 font-light text-sm">No stock changes yet</p>
            ) : (
              stockChanges.slice(0, 10).map((change) => (
                <div key={change.id} className="p-3 bg-gray-50 border border-gray-200">
                  <p className="font-light text-black text-sm mb-2 line-clamp-1">{change.product_name}</p>
                  <div className="flex items-center gap-4 text-xs font-light">
                    <span
                      className={`px-2 py-1 ${change.old_status === "in_stock" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                    >
                      {change.old_status.replace("_", " ").toUpperCase()}
                    </span>
                    <span>→</span>
                    <span
                      className={`px-2 py-1 ${change.new_status === "in_stock" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                    >
                      {change.new_status.replace("_", " ").toUpperCase()}
                    </span>
                    <span className="ml-auto text-gray-400">{new Date(change.changed_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    // Redesigned header with luxury black and white aesthetic
    <div className="min-h-screen bg-white">
      <Toaster position="top-right" />

      {!process.env.NEXT_PUBLIC_SUPABASE_URL ||
        (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && (
          <div className="bg-black text-white py-3 px-6 text-center font-light tracking-wide text-sm">
            DATABASE UPLOAD DISABLED: Supabase environment variables not set
          </div>
        ))}

      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-black p-3 rounded-none">
                <ShoppingBag className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-light text-black tracking-wider uppercase">Shopify Scraper</h1>
                <p className="text-sm text-gray-500 font-light tracking-wide">Luxury Product Management Dashboard</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex border border-gray-300 rounded-none overflow-hidden">
                <button
                  onClick={() => setViewMode("scraper")}
                  className={`px-5 py-2.5 text-sm font-light tracking-wider transition-colors ${
                    viewMode === "scraper" ? "bg-black text-white" : "bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  SCRAPER
                </button>
                <button
                  onClick={() => setViewMode("dashboard")}
                  className={`px-5 py-2.5 text-sm font-light tracking-wider transition-colors ${
                    viewMode === "dashboard" ? "bg-black text-white" : "bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  DASHBOARD
                </button>
              </div>
              <button
                onClick={() => setShowAddStore(true)}
                className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-none hover:bg-gray-900 transition-colors font-light tracking-wider text-sm"
              >
                <Plus className="w-4 h-4" /> ADD STORE
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {viewMode === "dashboard" ? (
          <DashboardView />
        ) : (
          <>
            {/* Store Manager - adapted for new design */}
            <div className="bg-white rounded-none shadow-none p-6 mb-6 border border-gray-200">
              <h2 className="text-xl font-light mb-4 flex items-center gap-2 text-black tracking-wider uppercase">
                <Globe className="w-6 h-6 text-black" /> Manage Stores
              </h2>

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search stores..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-none focus:ring-1 focus:ring-black focus:border-black font-light text-sm"
                  />
                </div>
              </div>

              {showAddStore && (
                <div className="mb-6 p-5 bg-gray-100 border border-gray-300 rounded-none">
                  <h3 className="font-light text-black mb-3 flex items-center gap-2 tracking-wider uppercase">
                    <Plus className="w-5 h-5" /> Add New Store
                  </h3>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Store Name (e.g., Nike)"
                      value={newStoreName}
                      onChange={(e) => setNewStoreName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-none focus:ring-1 focus:ring-black focus:border-black font-light text-sm"
                    />
                    <input
                      type="url"
                      placeholder="Store URL (e.g., https://nike.com)"
                      value={newStoreUrl}
                      onChange={(e) => setNewStoreUrl(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-none focus:ring-1 focus:ring-black focus:border-black font-light text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={addStore}
                        disabled={checkingShopify}
                        className="flex-1 bg-black text-white px-4 py-2.5 rounded-none hover:bg-gray-900 transition-colors font-light tracking-wider text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {checkingShopify ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" /> Add Store
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowAddStore(false)
                          setNewStoreName("")
                          setNewStoreUrl("")
                        }}
                        className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-none hover:bg-gray-300 transition-colors font-light"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStores.length === 0 ? (
                  <div className="col-span-full text-center py-12 bg-gray-50 rounded-none border-2 border-dashed border-gray-300">
                    <Store className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">No stores found</p>
                    <p className="text-sm text-gray-500 mt-1">Try adding a new store or adjusting your search</p>
                  </div>
                ) : (
                  filteredStores.map((store, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-none border-2 transition-all cursor-pointer ${
                        currentStore.url === store.url
                          ? "border-black bg-gray-50 shadow-md"
                          : "border-gray-200 bg-white hover:border-black hover:shadow-md"
                      }`}
                      onClick={() => switchStore(store)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-light text-black mb-1 tracking-wide uppercase">{store.name}</h3>
                          <a
                            href={store.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-black hover:underline flex items-center gap-1 font-light tracking-wide"
                          >
                            {store.url} <Globe className="w-3 h-3" />
                          </a>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteStore(index)
                          }}
                          className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-none transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {currentStore.url === store.url && (
                        <div className="flex items-center gap-2 text-xs text-black font-bold tracking-wide">
                          <CheckCircle className="w-4 h-4" /> Currently Active
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
                <div className="bg-black text-white p-4 rounded-none">
                  <p className="text-xs text-gray-300 font-light tracking-wider uppercase">Total Stores</p>
                  <p className="text-3xl font-light text-white tracking-wide">{stores.length}</p>
                </div>
                <div className="bg-white border border-gray-300 text-black p-4 rounded-none">
                  <p className="text-xs text-gray-500 font-light tracking-wider uppercase">Active Store</p>
                  <p className="text-3xl font-light text-black tracking-wide">1</p>
                </div>
                <div className="bg-black text-white p-4 rounded-none">
                  <p className="text-xs text-gray-300 font-light tracking-wider uppercase">Collections</p>
                  <p className="text-3xl font-light text-white tracking-wide">{collections.length}</p>
                </div>
                <div className="bg-white border border-gray-300 text-black p-4 rounded-none">
                  <p className="text-xs text-gray-500 font-light tracking-wider uppercase">Products</p>
                  <p className="text-3xl font-light text-black tracking-wide">{allProducts.length}</p>
                </div>
              </div>
            </div>

            {allProducts.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <div className="bg-black text-white p-6 rounded-none">
                  <Package className="w-6 h-6 mb-3 opacity-80" />
                  <div className="text-3xl font-light mb-1 tracking-wide">{stats.totalProducts}</div>
                  <div className="text-gray-400 text-xs font-light tracking-wider uppercase">Total Products</div>
                </div>

                <div className="bg-white border border-gray-300 text-black p-6 rounded-none">
                  <Grid className="w-6 h-6 mb-3 opacity-80" />
                  <div className="text-3xl font-light mb-1 tracking-wide">{selectedProducts.size}</div>
                  <div className="text-gray-500 text-xs font-light tracking-wider uppercase">Selected Items</div>
                </div>

                <div className="bg-black text-white p-6 rounded-none">
                  <DollarSign className="w-6 h-6 mb-3 opacity-80" />
                  <div className="text-3xl font-light mb-1 tracking-wide">${stats.avgPrice}</div>
                  <div className="text-gray-400 text-xs font-light tracking-wider uppercase">Average Price</div>
                </div>

                <div className="bg-white border border-gray-300 text-black p-6 rounded-none">
                  <CheckCircle className="w-6 h-6 mb-3 opacity-80" />
                  <div className="text-3xl font-light mb-1 tracking-wide">{stats.inStock}</div>
                  <div className="text-gray-500 text-xs font-light tracking-wider uppercase">In Stock</div>
                </div>

                <div className="bg-black text-white p-6 rounded-none">
                  <XCircle className="w-6 h-6 mb-3 opacity-80" />
                  <div className="text-3xl font-light mb-1 tracking-wide">{stats.outOfStock}</div>
                  <div className="text-gray-400 text-xs font-light tracking-wider uppercase">Out of Stock</div>
                </div>
              </div>
            )}

            {/* Collection Selector - Categories shown as cards instead of dropdown */}
            {collections.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-light mb-6 text-black tracking-wider uppercase flex items-center gap-3">
                  <Layers className="w-6 h-6" /> Collections from {currentStore.name}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {collections.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleCollectionSelect(c.handle)}
                      disabled={loading}
                      className={`p-6 border rounded-none transition-all text-left group ${
                        selectedCollection === c.handle
                          ? "border-black bg-black text-white"
                          : "border-gray-300 bg-white hover:border-black hover:bg-gray-50"
                      }`}
                    >
                      <h3
                        className={`font-light tracking-wide mb-2 uppercase text-sm ${selectedCollection === c.handle ? "text-white" : "text-black group-hover:text-black"}`}
                      >
                        {c.title}
                      </h3>
                      <p
                        className={`text-xs font-light ${selectedCollection === c.handle ? "text-gray-300" : "text-gray-500"}`}
                      >
                        {c.products_count !== undefined ? `${c.products_count} products` : "View collection"}
                      </p>
                    </button>
                  ))}
                </div>

                {scrapingAll && (
                  <div className="mt-6 bg-black text-white p-4 rounded-none flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="font-light tracking-wide">FETCHING ALL PRODUCTS...</span>
                  </div>
                )}
              </div>
            )}

            {/* Selection Controls - Action Buttons - Redesigned for luxury aesthetic */}
            {allProducts.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-none p-6 mb-8">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={selectAllPage}
                    className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-none border border-black hover:bg-black hover:text-white transition-colors font-light tracking-wider text-sm"
                  >
                    <Check className="w-4 h-4" /> SELECT PAGE ({displayedProducts.length})
                  </button>
                  <button
                    onClick={selectAllFiltered}
                    className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-none border border-black hover:bg-black hover:text-white transition-colors font-light tracking-wider text-sm"
                  >
                    <CheckCircle className="w-4 h-4" /> SELECT ALL ({filteredProducts.length})
                  </button>
                  <button
                    onClick={deselectAll}
                    className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-none border border-gray-300 hover:border-black transition-colors font-light tracking-wider text-sm"
                  >
                    <XCircle className="w-4 h-4" /> DESELECT ALL
                  </button>

                  <button
                    onClick={() => setDisplayMode(displayMode === "paginated" ? "all" : "paginated")} // Changed from viewMode to displayMode
                    className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-none border border-gray-300 hover:border-black transition-colors font-light tracking-wider text-sm"
                  >
                    <Grid className="w-4 h-4" /> {displayMode === "paginated" ? "SHOW ALL" : "SHOW PAGINATED"}{" "}
                    {/* Changed from viewMode to displayMode */}
                  </button>

                  <div className="ml-auto flex gap-3">
                    <button
                      onClick={uploadSelectedToDatabase}
                      disabled={uploadingToDb || selectedProducts.size === 0}
                      className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-none hover:bg-gray-900 transition-colors font-light tracking-wider text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploadingToDb ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> UPLOADING ({uploadProgress.current}/
                          {uploadProgress.total})
                        </>
                      ) : (
                        <>
                          <Database className="w-4 h-4" /> UPLOAD TO DB ({selectedProducts.size})
                        </>
                      )}
                    </button>
                    <button
                      onClick={exportToJSON}
                      className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-none border border-black hover:bg-black hover:text-white transition-colors font-light tracking-wider text-sm"
                    >
                      <Download className="w-4 h-4" /> JSON
                    </button>
                    <button
                      onClick={exportToCSV}
                      className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-none border border-black hover:bg-black hover:text-white transition-colors font-light tracking-wider text-sm"
                    >
                      <Download className="w-4 h-4" /> CSV
                    </button>
                  </div>
                </div>

                {uploadingToDb && (
                  <div className="mt-4 bg-gray-100 p-4 rounded-none">
                    <div className="flex items-center justify-between text-sm font-light tracking-wide mb-2">
                      <span className="text-black">UPLOAD PROGRESS</span>
                      <span className="text-gray-600">
                        {uploadProgress.current} / {uploadProgress.total}
                      </span>
                    </div>
                    <div className="w-full bg-gray-300 h-2 rounded-none overflow-hidden">
                      <div
                        className="bg-black h-full transition-all duration-300"
                        style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-3 text-xs font-light tracking-wide">
                      <span className="text-green-700">SUCCESS: {uploadResults.success}</span>
                      <span className="text-gray-600">SKIPPED: {uploadResults.skipped}</span>
                      <span className="text-red-700">FAILED: {uploadResults.failed}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {allProducts.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-none p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-light tracking-wider uppercase flex items-center gap-2">
                    <Filter className="w-5 h-5" /> Filters
                  </h3>
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-2 text-black hover:text-gray-600 transition-colors font-light tracking-wide text-sm"
                  >
                    <RefreshCw className="w-4 h-4" /> RESET
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={filters.searchQuery}
                      onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-none focus:ring-1 focus:ring-black focus:border-black font-light text-sm"
                    />
                  </div>

                  <select
                    value={filters.vendor}
                    onChange={(e) => setFilters({ ...filters, vendor: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-none focus:ring-1 focus:ring-black focus:border-black font-light text-sm"
                  >
                    <option value="">All Brands</option>
                    {vendors.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filters.productType}
                    onChange={(e) => setFilters({ ...filters, productType: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-none focus:ring-1 focus:ring-black focus:border-black font-light text-sm"
                  >
                    <option value="">All Types</option>
                    {productTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filters.availability}
                    onChange={(e) => setFilters({ ...filters, availability: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-none focus:ring-1 focus:ring-black focus:border-black font-light text-sm"
                  >
                    <option value="all">All Products</option>
                    <option value="in-stock">In Stock</option>
                    <option value="out-of-stock">Out of Stock</option>
                  </select>

                  <input
                    type="number"
                    placeholder="Min Price"
                    value={filters.priceMin}
                    onChange={(e) => setFilters({ ...filters, priceMin: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-none focus:ring-1 focus:ring-black focus:border-black font-light text-sm"
                  />

                  <input
                    type="number"
                    placeholder="Max Price"
                    value={filters.priceMax}
                    onChange={(e) => setFilters({ ...filters, priceMax: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-none focus:ring-1 focus:ring-black focus:border-black font-light text-sm"
                  />

                  <select
                    value={filters.tag}
                    onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-none focus:ring-1 focus:ring-black focus:border-black font-light text-sm col-span-2"
                  >
                    <option value="">All Tags</option>
                    {tags.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 text-sm font-light tracking-wide text-gray-600">
                  SHOWING {displayedProducts.length} OF {filteredProducts.length} PRODUCTS
                  {selectedProducts.size > 0 && ` | ${selectedProducts.size} SELECTED`}
                </div>
              </div>
            )}

            {/* Products Grid - Products Grid - Black and white luxury design */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-black" />
                  <p className="text-black font-light tracking-wide">LOADING PRODUCTS...</p>
                </div>
              </div>
            ) : displayedProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                  {displayedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {displayMode === "paginated" &&
                  totalPages > 1 && ( // Changed from viewMode to displayMode
                    <div className="flex items-center justify-center gap-3 mt-8">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 bg-white text-black border border-gray-300 rounded-none hover:border-black disabled:opacity-50 disabled:cursor-not-allowed font-light tracking-wide text-sm"
                      >
                        PREVIOUS
                      </button>

                      <div className="flex gap-2">
                        {[...Array(Math.min(5, totalPages))].map((_, i) => {
                          let pageNum
                          if (totalPages <= 5) {
                            pageNum = i + 1
                          } else if (currentPage <= 3) {
                            pageNum = i + 1
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i
                          } else {
                            pageNum = currentPage - 2 + i
                          }

                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-10 h-10 rounded-none font-light text-sm ${
                                currentPage === pageNum
                                  ? "bg-black text-white"
                                  : "bg-white text-black border border-gray-300 hover:border-black"
                              }`}
                            >
                              {pageNum}
                            </button>
                          )
                        })}
                      </div>

                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 bg-white text-black border border-gray-300 rounded-none hover:border-black disabled:opacity-50 disabled:cursor-not-allowed font-light tracking-wide text-sm"
                      >
                        NEXT
                      </button>
                    </div>
                  )}
              </>
            ) : selectedCollection ? (
              // No products found message - adapted for new design
              <div className="text-center py-20 bg-gray-50 border-2 border-dashed border-gray-300 rounded-none">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-black font-light tracking-wide text-lg mb-2">NO PRODUCTS FOUND</p>
                <p className="text-gray-500 font-light text-sm">
                  Try adjusting your filters or select a different collection
                </p>
              </div>
            ) : (
              // Select a collection message - adapted for new design
              <div className="text-center py-20 bg-gray-50 border-2 border-dashed border-gray-300 rounded-none">
                <Grid className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-black font-light tracking-wide text-lg mb-2">SELECT A COLLECTION TO BEGIN</p>
                <p className="text-gray-500 font-light text-sm">Choose a collection from above to view products</p>
              </div>
            )}
          </>
        )}
      </div>

      {showQuickView && quickViewProduct && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white rounded-none max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-xl font-light tracking-wider uppercase">PRODUCT DETAILS</h2>
              <button onClick={closeQuickView} className="text-black hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  {quickViewProduct.images && quickViewProduct.images.length > 0 ? (
                    <img
                      src={quickViewProduct.images[0].src || "/placeholder.svg"}
                      alt={quickViewProduct.title}
                      className="w-full h-auto border border-gray-200"
                    />
                  ) : (
                    <div className="w-full h-96 bg-gray-100 flex items-center justify-center border border-gray-200">
                      <Package className="w-20 h-20 text-gray-300" />
                    </div>
                  )}

                  {quickViewProduct.images && quickViewProduct.images.length > 1 && (
                    <div className="grid grid-cols-4 gap-2 mt-4">
                      {quickViewProduct.images.slice(1, 5).map((img, idx) => (
                        <img
                          key={idx}
                          src={img.src || "/placeholder.svg"}
                          alt={`${quickViewProduct.title} ${idx + 2}`}
                          className="w-full h-24 object-cover border border-gray-200 hover:border-black transition-colors cursor-pointer"
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-2xl font-light tracking-wide mb-4 uppercase">{quickViewProduct.title}</h3>

                  {quickViewProduct.variants && quickViewProduct.variants[0] && (
                    <div className="mb-6">
                      <div className="flex items-baseline gap-3">
                        <span className="text-3xl font-light text-black tracking-wide">
                          ${quickViewProduct.variants[0].price}
                        </span>
                        {quickViewProduct.variants[0].compare_at_price && (
                          <span className="text-lg text-gray-400 line-through font-light">
                            ${quickViewProduct.variants[0].compare_at_price}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 mb-6 text-sm font-light">
                    {quickViewProduct.vendor && (
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 w-24 tracking-wide uppercase">Brand:</span>
                        <span className="text-black tracking-wide uppercase">{quickViewProduct.vendor}</span>
                      </div>
                    )}
                    {quickViewProduct.product_type && (
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 w-24 tracking-wide uppercase">Type:</span>
                        <span className="text-black tracking-wide uppercase">{quickViewProduct.product_type}</span>
                      </div>
                    )}
                    {quickViewProduct.variants && quickViewProduct.variants[0] && (
                      <>
                        {quickViewProduct.variants[0].sku && (
                          <div className="flex items-center gap-3">
                            <span className="text-gray-500 w-24 tracking-wide uppercase">SKU:</span>
                            <span className="text-black font-mono">{quickViewProduct.variants[0].sku}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 w-24 tracking-wide uppercase">Status:</span>
                          <span
                            className={`tracking-wide uppercase ${quickViewProduct.variants[0].available ? "text-black" : "text-gray-400"}`}
                          >
                            {quickViewProduct.variants[0].available ? "IN STOCK" : "OUT OF STOCK"}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {quickViewProduct.body_html && (
                    <div className="border-t border-gray-200 pt-6">
                      <h4 className="text-sm font-light tracking-wider uppercase mb-3 text-gray-500">Description</h4>
                      <div
                        className="text-sm font-light leading-relaxed text-gray-700"
                        dangerouslySetInnerHTML={{ __html: quickViewProduct.body_html }}
                      />
                    </div>
                  )}

                  {quickViewProduct.variants && quickViewProduct.variants.length > 1 && (
                    <div className="border-t border-gray-200 pt-6 mt-6">
                      <h4 className="text-sm font-light tracking-wider uppercase mb-3 text-gray-500">
                        Available Variants ({quickViewProduct.variants.length})
                      </h4>
                      <div className="space-y-2">
                        {quickViewProduct.variants.slice(0, 5).map((variant, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm font-light">
                            <span className="text-black tracking-wide">
                              {variant.title || variant.option1 || `Variant ${idx + 1}`}
                            </span>
                            <span className="text-gray-600">${variant.price}</span>
                          </div>
                        ))}
                        {quickViewProduct.variants.length > 5 && (
                          <p className="text-xs text-gray-500 font-light">
                            +{quickViewProduct.variants.length - 5} more variants
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <button
                      onClick={() => {
                        toggleProductSelection(quickViewProduct.id)
                        toast.success(
                          selectedProducts.has(quickViewProduct.id)
                            ? "Product removed from selection"
                            : "Product added to selection",
                        )
                      }}
                      className={`w-full py-3 rounded-none font-light tracking-wider text-sm transition-colors ${
                        selectedProducts.has(quickViewProduct.id)
                          ? "bg-black text-white hover:bg-gray-900"
                          : "bg-white text-black border border-black hover:bg-black hover:text-white"
                      }`}
                    >
                      {selectedProducts.has(quickViewProduct.id) ? "REMOVE FROM SELECTION" : "ADD TO SELECTION"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImageModal && selectedProductImages && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-none max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-xl font-light tracking-wider uppercase">{selectedProductImages.title}</h2>
              <button
                onClick={() => setShowImageModal(false)}
                className="text-black hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {selectedProductImages.images && selectedProductImages.images.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedProductImages.images.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={img.src || "/placeholder.svg"}
                        alt={`${selectedProductImages.title} ${idx + 1}`}
                        className="w-full h-auto border border-gray-200"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-black font-light tracking-wide">NO IMAGES AVAILABLE</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
