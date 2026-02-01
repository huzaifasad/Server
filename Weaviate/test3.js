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
// COLOR SYSTEM V4 - Extraction, Normalization, Harmony, Mood & Style Mapping
// ============================================================================

// ============================================================================
// MOOD → COLOR HEX MAPPING (V4)
// Maps emotional contexts to recommended colors with HEX values
// ============================================================================
const MOOD_COLOR_MAPPING = {
  elegant: {
    description: "Sophisticated, refined, and luxurious",
    hexPalette: {
      top: ["#000000", "#FFFFFF", "#2C3E50", "#1A1A1A", "#708090"],
      bottom: ["#000000", "#2C3E50", "#1A1A1A", "#4A4A4A", "#FFFFFF"],
      shoes: ["#000000", "#1A1A1A", "#8B4513", "#2C3E50"],
      coat: ["#000000", "#2C3E50", "#1A1A1A", "#FFFFFF", "#708090"]
    }
  },
  energized: {
    description: "Vibrant, bold, and dynamic",
    hexPalette: {
      top: ["#FF4500", "#FFD700", "#FF6347", "#FFA500", "#FFFFFF"],
      bottom: ["#000000", "#FFFFFF", "#2C3E50", "#1A1A1A"],
      shoes: ["#FFFFFF", "#000000", "#FF4500", "#FFD700"],
      coat: ["#FF4500", "#FFD700", "#000000", "#FFFFFF"]
    }
  },
  romantic: {
    description: "Soft, feminine, and dreamy",
    hexPalette: {
      top: ["#FFB6C1", "#E6E6FA", "#FFC0CB", "#FFFFFF", "#F5DEB3"],
      bottom: ["#FFFFFF", "#F5F5DC", "#FFE4E1", "#E6E6FA"],
      shoes: ["#FFB6C1", "#FFFFFF", "#D2B48C", "#DDA0DD"],
      coat: ["#FFB6C1", "#E6E6FA", "#FFFFFF", "#FFC0CB"]
    }
  },
  powerful: {
    description: "Authoritative, confident, and commanding",
    hexPalette: {
      top: ["#000000", "#800020", "#2C3E50", "#FFFFFF", "#1A1A1A"],
      bottom: ["#000000", "#2C3E50", "#1A1A1A", "#191970"],
      shoes: ["#000000", "#800020", "#8B4513", "#2C3E50"],
      coat: ["#000000", "#800020", "#2C3E50", "#1A1A1A"]
    }
  },
  calm: {
    description: "Peaceful, serene, and balanced",
    hexPalette: {
      top: ["#87CEEB", "#E0FFFF", "#B0E0E6", "#FFFFFF", "#F0FFF0"],
      bottom: ["#FFFFFF", "#F5F5F5", "#E0FFFF", "#F0FFF0"],
      shoes: ["#FFFFFF", "#D2B48C", "#87CEEB", "#B0E0E6"],
      coat: ["#87CEEB", "#E0FFFF", "#FFFFFF", "#B0E0E6"]
    }
  },
  flowing: {
    description: "Graceful, fluid, and effortless",
    hexPalette: {
      top: ["#E6E6FA", "#F0E68C", "#FAFAD2", "#FFFFFF", "#FFEFD5"],
      bottom: ["#FFFFFF", "#FFF8DC", "#FAF0E6", "#F5F5DC"],
      shoes: ["#D2B48C", "#DEB887", "#F5DEB3", "#FFFFFF"],
      coat: ["#E6E6FA", "#FAFAD2", "#FFFFFF", "#FAF0E6"]
    }
  },
  optimist: {
    description: "Cheerful, bright, and positive",
    hexPalette: {
      top: ["#FFD700", "#FFA500", "#FFFFFF", "#F0E68C", "#FFFACD"],
      bottom: ["#FFFFFF", "#F5F5DC", "#FFFACD", "#000000"],
      shoes: ["#FFFFFF", "#FFD700", "#D2B48C", "#FFA500"],
      coat: ["#FFD700", "#FFA500", "#FFFFFF", "#F0E68C"]
    }
  },
  mysterious: {
    description: "Enigmatic, dark, and intriguing",
    hexPalette: {
      top: ["#191970", "#2F4F4F", "#4B0082", "#000000", "#301934"],
      bottom: ["#000000", "#191970", "#2F4F4F", "#1A1A1A"],
      shoes: ["#000000", "#191970", "#4B0082", "#2F4F4F"],
      coat: ["#191970", "#2F4F4F", "#4B0082", "#000000"]
    }
  },
  sweet: {
    description: "Cute, playful, and youthful",
    hexPalette: {
      top: ["#FFB6C1", "#FFC0CB", "#FFFFFF", "#FFE4E1", "#FFF0F5"],
      bottom: ["#FFFFFF", "#FFE4E1", "#FFF0F5", "#F5F5DC"],
      shoes: ["#FFB6C1", "#FFFFFF", "#FFC0CB", "#D2B48C"],
      coat: ["#FFB6C1", "#FFC0CB", "#FFFFFF", "#FFE4E1"]
    }
  },
  passionate: {
    description: "Intense, fiery, and bold",
    hexPalette: {
      top: ["#DC143C", "#FF0000", "#8B0000", "#000000", "#FFFFFF"],
      bottom: ["#000000", "#1A1A1A", "#2C3E50", "#FFFFFF"],
      shoes: ["#000000", "#DC143C", "#8B0000", "#8B4513"],
      coat: ["#DC143C", "#8B0000", "#000000", "#B22222"]
    }
  },
  general: {
    description: "Balanced, versatile, and classic",
    hexPalette: {
      top: ["#000000", "#FFFFFF", "#2C3E50", "#808080", "#D3D3D3"],
      bottom: ["#000000", "#FFFFFF", "#2C3E50", "#808080", "#1A1A1A"],
      shoes: ["#000000", "#FFFFFF", "#8B4513", "#2C3E50"],
      coat: ["#000000", "#2C3E50", "#808080", "#FFFFFF"]
    }
  }
}

// ============================================================================
// STYLE → COLOR HEX MAPPING (V4 - COMPLETE 15-COLOR PALETTES FROM CLIENT SPEC)
// ============================================================================
const STYLE_COLOR_MAPPING = {
  classic: {
    description: "Timeless, elegant, and structured",
    preferredColors: ["navy", "black", "white", "gray", "brown", "beige"],
    fullPalette: ["#1C2541", "#2C3E50", "#34495E", "#5D4E37", "#8B4513", "#722F37", "#2E4A3E", "#F5F5DC", "#FFFFF0", "#FFFFFF", "#1A1A1A", "#708090", "#D4C4A8", "#4A4A4A", "#8B7355"],
    colorNames: ["dark navy", "blue-gray", "deep gray", "camel brown", "saddle brown", "burgundy", "forest green", "beige", "ivory", "white", "black", "slate gray", "light khaki", "charcoal", "walnut"],
    hexPalette: {
      top: ["#FFFFFF", "#2C3E50", "#1A1A1A", "#F5F5DC", "#708090"],
      bottom: ["#2C3E50", "#1A1A1A", "#8B4513", "#D4C4A8", "#4A4A4A"],
      shoes: ["#8B4513", "#1A1A1A", "#2C3E50", "#D4C4A8", "#722F37"],
      coat: ["#2C3E50", "#8B4513", "#1A1A1A", "#D4C4A8", "#722F37"]
    }
  },
  romantic: {
    description: "Soft, feminine, and dreamy",
    preferredColors: ["pink", "rose", "cream", "lavender", "soft blue", "white"],
    fullPalette: ["#FFB6C1", "#FFC0CB", "#FF69B4", "#DB7093", "#C71585", "#E6E6FA", "#DDA0DD", "#D8BFD8", "#FFE4E1", "#FFF0F5", "#FFDAB9", "#F5DEB3", "#FFFACD", "#FAF0E6", "#FDF5E6"],
    colorNames: ["light pink", "pink", "hot pink", "pale violet red", "medium violet red", "lavender", "plum", "thistle", "misty rose", "lavender blush", "peach puff", "wheat", "lemon chiffon", "linen", "old lace"],
    hexPalette: {
      top: ["#FFB6C1", "#FFC0CB", "#E6E6FA", "#FFFFFF", "#FFE4E1"],
      bottom: ["#FFFFFF", "#F5DEB3", "#FFE4E1", "#FFC0CB", "#FAF0E6"],
      shoes: ["#FFB6C1", "#FFFFFF", "#D8BFD8", "#E6E6FA", "#FFDAB9"],
      coat: ["#FFB6C1", "#E6E6FA", "#FFFFFF", "#FFC0CB", "#DDA0DD"]
    }
  },
  minimalist: {
    description: "Simple, clean, and essential-focused",
    preferredColors: ["black", "white", "gray", "beige", "navy", "cream", "stone", "charcoal"],
    fullPalette: ["#000000", "#1A1A1A", "#2D2D2D", "#4A4A4A", "#6B6B6B", "#8C8C8C", "#A8A8A8", "#C4C4C4", "#E0E0E0", "#F0F0F0", "#FAFAFA", "#FFFFFF", "#E8DCD0", "#D3C4B5", "#C2B8A3"],
    colorNames: ["pure black", "near black", "dark charcoal", "charcoal", "dark gray", "gray", "medium gray", "light gray", "silver", "off-white", "broken white", "pure white", "greige", "taupe", "stone"],
    hexPalette: {
      top: ["#FFFFFF", "#000000", "#808080", "#F0F0F0", "#E8DCD0"],
      bottom: ["#000000", "#FFFFFF", "#4A4A4A", "#1A1A1A", "#2C3E50"],
      shoes: ["#000000", "#FFFFFF", "#808080", "#D3C4B5", "#1A1A1A"],
      coat: ["#000000", "#FFFFFF", "#4A4A4A", "#2C3E50", "#E8DCD0"]
    }
  },
  casual: {
    description: "Relaxed, everyday, and comfortable",
    preferredColors: ["blue", "denim", "gray", "white", "khaki", "brown", "green", "beige", "navy", "black", "red", "olive", "tan", "burgundy", "coral", "teal"],
    fullPalette: ["#4169E1", "#6495ED", "#87CEEB", "#708090", "#556B2F", "#6B8E23", "#8FBC8F", "#F5DEB3", "#D2B48C", "#BC8F8F", "#CD853F", "#A0522D", "#FFFFF0", "#FFFAF0", "#FAF0E6", "#DEB887", "#B22222", "#2F4F4F"],
    colorNames: ["royal blue", "cornflower blue", "sky blue", "slate gray", "dark olive", "olive drab", "dark sea green", "wheat", "tan", "rosy brown", "peru", "sienna", "ivory", "floral white", "linen", "burlywood", "firebrick", "dark slate gray"],
    hexPalette: {
      top: ["#FFFFFF", "#000000", "#4169E1", "#708090", "#6B8E23"],
      bottom: ["#000000", "#2C3E50", "#D2B48C", "#4169E1", "#556B2F"],
      shoes: ["#FFFFFF", "#000000", "#D2B48C", "#8B4513", "#708090"],
      coat: ["#2C3E50", "#000000", "#708090", "#8B4513", "#556B2F"]
    }
  },
  elegant: {
    description: "Sophisticated, refined, and luxurious",
    preferredColors: ["black", "navy", "gray", "burgundy", "white", "gold"],
    fullPalette: ["#000000", "#1A1A1A", "#2C3E50", "#191970", "#4A4A4A", "#800020", "#722F37", "#C0C0C0", "#FFD700", "#FFFFFF", "#708090", "#36454F", "#F5F5F5", "#D4AF37", "#B8860B"],
    colorNames: ["black", "near black", "navy", "midnight blue", "charcoal", "burgundy", "wine", "silver", "gold", "white", "slate", "charcoal", "off-white", "metallic gold", "dark gold"],
    hexPalette: {
      top: ["#000000", "#FFFFFF", "#2C3E50", "#C0C0C0", "#708090"],
      bottom: ["#000000", "#2C3E50", "#1A1A1A", "#FFFFFF", "#4A4A4A"],
      shoes: ["#000000", "#1A1A1A", "#8B4513", "#C0C0C0", "#FFD700"],
      coat: ["#000000", "#2C3E50", "#1A1A1A", "#C0C0C0", "#800020"]
    }
  },
  sporty: {
    description: "Athletic, dynamic, and active",
    preferredColors: ["blue", "black", "white", "red", "gray", "green"],
    fullPalette: ["#00BFFF", "#1E90FF", "#00CED1", "#20B2AA", "#3CB371", "#32CD32", "#7FFF00", "#ADFF2F", "#FFFF00", "#FFD700", "#FFA500", "#FF4500", "#FFFFFF", "#000000", "#C0C0C0", "#FF6B6B"],
    colorNames: ["deep sky blue", "dodger blue", "dark turquoise", "light sea green", "medium sea green", "lime green", "chartreuse", "green yellow", "yellow", "gold", "orange", "orange red", "white", "black", "silver", "coral"],
    hexPalette: {
      top: ["#000000", "#FFFFFF", "#1E90FF", "#FF4500", "#32CD32"],
      bottom: ["#000000", "#2C3E50", "#1E90FF", "#FFFFFF", "#4A4A4A"],
      shoes: ["#FFFFFF", "#000000", "#1E90FF", "#FF4500", "#32CD32"],
      coat: ["#000000", "#2C3E50", "#1E90FF", "#FFFFFF", "#FF4500"]
    }
  },
  boohoo: {
    description: "Bold, trendy, and statement-making",
    preferredColors: ["red", "pink", "purple", "blue", "green", "gold", "orange"],
    fullPalette: ["#FF0000", "#FF4500", "#FF6347", "#FF1493", "#FF00FF", "#8B008B", "#9400D3", "#8A2BE2", "#4B0082", "#0000FF", "#00CED1", "#00FF7F", "#ADFF2F", "#FFD700", "#FFA500", "#DC143C"],
    colorNames: ["pure red", "orange red", "tomato", "deep pink", "magenta", "dark magenta", "dark violet", "blue violet", "indigo", "pure blue", "dark turquoise", "spring green", "green yellow", "gold", "orange", "crimson"],
    hexPalette: {
      top: ["#FF1493", "#FF0000", "#8A2BE2", "#FFD700", "#FFFFFF"],
      bottom: ["#000000", "#0000FF", "#4B0082", "#FFFFFF", "#1A1A1A"],
      shoes: ["#FF1493", "#FFD700", "#000000", "#FF0000", "#8A2BE2"],
      coat: ["#FF0000", "#8A2BE2", "#000000", "#FFD700", "#FF1493"]
    }
  },
  nordic: {
    description: "Clean, cozy, and nature-inspired",
    preferredColors: ["white", "cream", "gray", "beige", "soft blue", "forest green"],
    fullPalette: ["#FFFFFF", "#F5F5F5", "#FAFAFA", "#F5F5DC", "#E8DCD0", "#D3C4B5", "#C4C4C4", "#A8A8A8", "#808080", "#87CEEB", "#B0E0E6", "#2E4A3E", "#3CB371", "#556B2F", "#8FBC8F"],
    colorNames: ["white", "white smoke", "snow", "beige", "greige", "taupe", "light gray", "medium gray", "gray", "sky blue", "powder blue", "forest green", "medium sea green", "dark olive", "dark sea green"],
    hexPalette: {
      top: ["#FFFFFF", "#F5F5DC", "#E8DCD0", "#87CEEB", "#2E4A3E"],
      bottom: ["#FFFFFF", "#F5F5F5", "#E8DCD0", "#C4C4C4", "#556B2F"],
      shoes: ["#FFFFFF", "#D3C4B5", "#8B4513", "#2E4A3E", "#808080"],
      coat: ["#E8DCD0", "#2E4A3E", "#FFFFFF", "#D3C4B5", "#556B2F"]
    }
  },
  bohemian: {
    description: "Free-spirited, artistic, and earthy",
    preferredColors: ["brown", "tan", "cream", "rust", "olive", "terracotta"],
    fullPalette: ["#8B4513", "#D2691E", "#CD853F", "#DEB887", "#F4A460", "#D2B48C", "#BC8F8F", "#A0522D", "#556B2F", "#6B8E23", "#808000", "#F5DEB3", "#FAEBD7", "#FFE4C4", "#E8DCD0"],
    colorNames: ["saddle brown", "chocolate", "peru", "burlywood", "sandy brown", "tan", "rosy brown", "sienna", "dark olive green", "olive drab", "olive", "wheat", "antique white", "bisque", "greige"],
    hexPalette: {
      top: ["#DEB887", "#F5DEB3", "#FFFFFF", "#F4A460", "#D2691E"],
      bottom: ["#8B4513", "#D2691E", "#DEB887", "#556B2F", "#D2B48C"],
      shoes: ["#8B4513", "#D2B48C", "#DEB887", "#CD853F", "#A0522D"],
      coat: ["#DEB887", "#8B4513", "#D2691E", "#F4A460", "#556B2F"]
    }
  },
  edgy: {
    description: "Bold, unconventional, and rebellious",
    preferredColors: ["black", "red", "silver", "purple", "dark gray"],
    fullPalette: ["#000000", "#1A1A1A", "#2D2D2D", "#DC143C", "#8B0000", "#4B0082", "#800080", "#C0C0C0", "#A9A9A9", "#696969", "#FFFFFF", "#B22222", "#8B008B", "#483D8B", "#2F4F4F"],
    colorNames: ["black", "near black", "dark charcoal", "crimson", "dark red", "indigo", "purple", "silver", "dark gray", "dim gray", "white", "firebrick", "dark magenta", "dark slate blue", "dark slate gray"],
    hexPalette: {
      top: ["#000000", "#1A1A1A", "#DC143C", "#FFFFFF", "#4B0082"],
      bottom: ["#000000", "#1A1A1A", "#2C3E50", "#696969", "#2D2D2D"],
      shoes: ["#000000", "#1A1A1A", "#DC143C", "#C0C0C0", "#4B0082"],
      coat: ["#000000", "#1A1A1A", "#DC143C", "#2C3E50", "#4B0082"]
    }
  },
  glamorous: {
    description: "Luxurious, sparkly, and show-stopping",
    preferredColors: ["gold", "silver", "black", "white", "red"],
    fullPalette: ["#FFD700", "#D4AF37", "#B8860B", "#C0C0C0", "#A9A9A9", "#000000", "#1A1A1A", "#FFFFFF", "#F5F5F5", "#DC143C", "#8B0000", "#800020", "#E6E6FA", "#DDA0DD", "#FF69B4"],
    colorNames: ["gold", "metallic gold", "dark goldenrod", "silver", "dark gray", "black", "near black", "white", "white smoke", "crimson", "dark red", "burgundy", "lavender", "plum", "hot pink"],
    hexPalette: {
      top: ["#FFD700", "#C0C0C0", "#000000", "#FFFFFF", "#D4AF37"],
      bottom: ["#000000", "#FFFFFF", "#2C3E50", "#1A1A1A", "#C0C0C0"],
      shoes: ["#FFD700", "#C0C0C0", "#000000", "#D4AF37", "#DC143C"],
      coat: ["#FFD700", "#C0C0C0", "#000000", "#FFFFFF", "#800020"]
    }
  },
  preppy: {
    description: "Classic, polished, and collegiate",
    preferredColors: ["navy", "white", "red", "green", "khaki", "pink"],
    fullPalette: ["#000080", "#2C3E50", "#FFFFFF", "#DC143C", "#228B22", "#006400", "#F0E68C", "#D2B48C", "#FFB6C1", "#FFC0CB", "#87CEEB", "#F5F5DC", "#FFFFF0", "#8B4513", "#B22222"],
    colorNames: ["navy", "dark navy", "white", "crimson", "forest green", "dark green", "khaki", "tan", "light pink", "pink", "sky blue", "beige", "ivory", "saddle brown", "firebrick"],
    hexPalette: {
      top: ["#FFFFFF", "#000080", "#228B22", "#DC143C", "#FFB6C1"],
      bottom: ["#000080", "#2C3E50", "#D2B48C", "#FFFFFF", "#F0E68C"],
      shoes: ["#8B4513", "#D2B48C", "#000080", "#FFFFFF", "#228B22"],
      coat: ["#000080", "#228B22", "#DC143C", "#2C3E50", "#FFFFFF"]
    }
  },
  modern: {
    description: "Contemporary, sleek, and fashion-forward",
    preferredColors: ["black", "white", "gray", "navy", "steel blue"],
    fullPalette: ["#000000", "#1A1A1A", "#2D2D2D", "#FFFFFF", "#F5F5F5", "#808080", "#A9A9A9", "#C0C0C0", "#2C3E50", "#34495E", "#4682B4", "#5F9EA0", "#708090", "#778899", "#B0C4DE"],
    colorNames: ["black", "near black", "dark charcoal", "white", "white smoke", "gray", "dark gray", "silver", "navy", "dark slate", "steel blue", "cadet blue", "slate gray", "light slate gray", "light steel blue"],
    hexPalette: {
      top: ["#000000", "#FFFFFF", "#808080", "#2C3E50", "#4682B4"],
      bottom: ["#000000", "#2C3E50", "#808080", "#FFFFFF", "#1A1A1A"],
      shoes: ["#000000", "#FFFFFF", "#808080", "#2C3E50", "#4682B4"],
      coat: ["#000000", "#2C3E50", "#808080", "#FFFFFF", "#4682B4"]
    }
  }
}

// ============================================================================
// HEX TO COLOR NAME MAPPING (V4 - For Semantic Search)
// ============================================================================
const HEX_TO_COLOR_NAME_V4 = {
  "#000000": "black", "#1A1A1A": "black", "#2C3E50": "navy", "#4A4A4A": "charcoal",
  "#FFFFFF": "white", "#F5F5F5": "white", "#F5F5DC": "cream", "#FFF8DC": "cream",
  "#808080": "grey", "#A9A9A9": "grey", "#D3D3D3": "light grey", "#C0C0C0": "silver",
  "#696969": "dark grey", "#708090": "slate", "#DCDCDC": "grey",
  "#000080": "navy", "#191970": "midnight blue", "#4169E1": "royal blue",
  "#4682B4": "steel blue", "#87CEEB": "sky blue", "#ADD8E6": "light blue",
  "#228B22": "forest green", "#32CD32": "lime green", "#2E8B57": "sea green",
  "#DC143C": "crimson", "#FF0000": "red", "#8B0000": "dark red", "#800020": "burgundy",
  "#FFB6C1": "light pink", "#FFC0CB": "pink", "#FF69B4": "hot pink",
  "#FF4500": "orange red", "#FFA500": "orange", "#FFD700": "gold", "#FFFF00": "yellow",
  "#4B0082": "indigo", "#800080": "purple", "#E6E6FA": "lavender", "#DDA0DD": "plum",
  "#8B4513": "brown", "#D2B48C": "tan", "#DEB887": "burlywood", "#F5DEB3": "wheat"
}

/**
 * ✅ V4: Convert HEX to color name for semantic search
 */
function hexToColorNameV4(hex) {
  if (!hex) return null
  const normalized = hex.toUpperCase()
  if (HEX_TO_COLOR_NAME_V4[normalized]) return HEX_TO_COLOR_NAME_V4[normalized]
  
  // Fallback: determine from RGB
  const r = parseInt(normalized.slice(1, 3), 16)
  const g = parseInt(normalized.slice(3, 5), 16)
  const b = parseInt(normalized.slice(5, 7), 16)
  
  if (r > 200 && g > 200 && b > 200) return "white"
  if (r < 50 && g < 50 && b < 50) return "black"
  if (r > g && r > b) return r > 200 ? "red" : "burgundy"
  if (g > r && g > b) return "green"
  if (b > r && b > g) return b > 200 ? "blue" : "navy"
  return "grey"
}

/**
 * ✅ V4: Generate allowed color palette based on mood, style, and user preferences
 * @param {Object} options - { mood, style, userColors }
 * @returns {Object} - { top: [...], bottom: [...], shoes: [...], coat: [...] }
 */
function generateAllowedColorPalette(options = {}) {
  const { mood = 'general', style = 'casual', userColors = [] } = options
  
  const moodPalette = MOOD_COLOR_MAPPING[mood]?.hexPalette || MOOD_COLOR_MAPPING.general.hexPalette
  const stylePalette = STYLE_COLOR_MAPPING[style]?.hexPalette || STYLE_COLOR_MAPPING.casual.hexPalette
  
  const result = { top: [], bottom: [], shoes: [], coat: [] }
  
  for (const category of ['top', 'bottom', 'shoes', 'coat']) {
    const moodColors = moodPalette[category] || []
    const styleColors = stylePalette[category] || []
    
    // Find intersection
    let intersection = moodColors.filter(c => styleColors.includes(c))
    
    // If intersection too small, union instead
    if (intersection.length < 3) {
      intersection = [...new Set([...moodColors.slice(0, 3), ...styleColors.slice(0, 2)])]
    }
    
    // Add user colors with highest priority
    if (userColors.length > 0) {
      const userHexColors = userColors.map(c => {
        if (c.startsWith('#')) return c.toUpperCase()
        return colorNameToHex(c)
      }).filter(Boolean)
      
      intersection = [...new Set([...userHexColors, ...intersection])]
    }
    
    // Format with names
    result[category] = intersection.slice(0, 5).map(hex => ({
      hex: hex,
      name: hexToColorNameV4(hex)
    }))
  }
  
  console.log(`🎨 Generated Color Palette (mood: ${mood}, style: ${style}):`)
  console.log(`   Top: ${result.top.map(c => c.name).join(', ')}`)
  console.log(`   Bottom: ${result.bottom.map(c => c.name).join(', ')}`)
  console.log(`   Shoes: ${result.shoes.map(c => c.name).join(', ')}`)
  
  return result
}

/**
 * ✅ V4: Convert color name to HEX
 */
function colorNameToHex(colorName) {
  const nameToHex = {
    black: "#000000", white: "#FFFFFF", navy: "#2C3E50", grey: "#808080", gray: "#808080",
    red: "#DC143C", blue: "#4682B4", green: "#228B22", pink: "#FFB6C1", purple: "#800080",
    orange: "#FFA500", yellow: "#FFD700", brown: "#8B4513", cream: "#F5F5DC", beige: "#F5F5DC",
    burgundy: "#800020", gold: "#FFD700", silver: "#C0C0C0", tan: "#D2B48C", coral: "#FF6347"
  }
  return nameToHex[colorName?.toLowerCase()] || null
}

/**
 * ✅ V4: Score outfit colors for harmony
 */
function scoreOutfitColorsV4(outfitColors) {
  if (!outfitColors || outfitColors.length < 2) return { score: 100, harmony: 'single_item' }
  
  const colorNames = outfitColors.map(c => typeof c === 'string' ? hexToColorNameV4(c) : c.name).filter(Boolean)
  
  // Use existing harmony checking
  return checkOutfitColorHarmony(colorNames)
}

// Export V4 utilities
const ColorSystemV4 = {
  MOOD_COLOR_MAPPING,
  STYLE_COLOR_MAPPING,
  HEX_TO_COLOR_NAME_V4,
  hexToColorNameV4,
  generateAllowedColorPalette,
  colorNameToHex,
  scoreOutfitColorsV4
}

/**
 * ✅ COMPREHENSIVE COLOR MAPPING
 * Maps color variations/shades to base colors for matching
 */
const COLOR_NORMALIZATION_MAP = {
  // REDS
  red: 'red', crimson: 'red', scarlet: 'red', burgundy: 'red', maroon: 'red',
  cherry: 'red', ruby: 'red', wine: 'red', merlot: 'red', oxblood: 'red',
  rust: 'red', terracotta: 'red', brick: 'red', auburn: 'red', vermillion: 'red',
  
  // PINKS
  pink: 'pink', blush: 'pink', rose: 'pink', coral: 'pink', salmon: 'pink',
  fuchsia: 'pink', magenta: 'pink', hot_pink: 'pink', dusty_pink: 'pink',
  mauve: 'pink', raspberry: 'pink', flamingo: 'pink', bubblegum: 'pink',
  
  // ORANGES
  orange: 'orange', tangerine: 'orange', peach: 'orange', apricot: 'orange',
  amber: 'orange', copper: 'orange', burnt_orange: 'orange', cantaloupe: 'orange',
  
  // YELLOWS
  yellow: 'yellow', gold: 'yellow', mustard: 'yellow', lemon: 'yellow',
  canary: 'yellow', honey: 'yellow', saffron: 'yellow', butter: 'yellow',
  sunshine: 'yellow', marigold: 'yellow', chartreuse: 'yellow',
  
  // GREENS
  green: 'green', olive: 'green', sage: 'green', mint: 'green', emerald: 'green',
  forest: 'green', hunter: 'green', khaki: 'green', lime: 'green', teal: 'green',
  jade: 'green', moss: 'green', seafoam: 'green', pistachio: 'green',
  evergreen: 'green', fern: 'green', avocado: 'green', army: 'green',
  
  // BLUES
  blue: 'blue', navy: 'blue', cobalt: 'blue', royal: 'blue', sky: 'blue',
  baby_blue: 'blue', powder_blue: 'blue', denim: 'blue', indigo: 'blue',
  azure: 'blue', sapphire: 'blue', cerulean: 'blue', cornflower: 'blue',
  slate: 'blue', steel: 'blue', midnight: 'blue', ocean: 'blue', aqua: 'blue',
  turquoise: 'blue', cyan: 'blue', periwinkle: 'blue',
  
  // PURPLES
  purple: 'purple', violet: 'purple', lavender: 'purple', plum: 'purple',
  eggplant: 'purple', grape: 'purple', lilac: 'purple', orchid: 'purple',
  amethyst: 'purple', mauve: 'purple', mulberry: 'purple', aubergine: 'purple',
  
  // BROWNS
  brown: 'brown', tan: 'brown', beige: 'brown', camel: 'brown', cognac: 'brown',
  chocolate: 'brown', coffee: 'brown', mocha: 'brown', espresso: 'brown',
  chestnut: 'brown', cinnamon: 'brown', walnut: 'brown', toffee: 'brown',
  caramel: 'brown', bronze: 'brown', umber: 'brown', sienna: 'brown',
  taupe: 'brown', sand: 'brown', nude: 'brown', fawn: 'brown', timber: 'brown',
  
  // NEUTRALS - WHITE
  white: 'white', ivory: 'white', cream: 'white', pearl: 'white', snow: 'white',
  eggshell: 'white', vanilla: 'white', off_white: 'white', ecru: 'white',
  
  // NEUTRALS - BLACK
  black: 'black', onyx: 'black', jet: 'black', charcoal: 'black', ebony: 'black',
  raven: 'black', midnight: 'black', obsidian: 'black',
  
  // NEUTRALS - GREY
  grey: 'grey', gray: 'grey', silver: 'grey', ash: 'grey', stone: 'grey',
  graphite: 'grey', heather: 'grey', pewter: 'grey', smoke: 'grey',
  
  // METALLICS
  metallic: 'metallic', gold_metallic: 'metallic', silver_metallic: 'metallic',
  rose_gold: 'metallic', bronze_metallic: 'metallic', copper_metallic: 'metallic',
}

/**
 * ✅ COLOR WHEEL for harmony calculations
 * Position on wheel (0-11) for complementary/analogous matching
 */
const COLOR_WHEEL_POSITION = {
  red: 0,
  orange: 1,
  yellow: 2,
  green: 4,      // chartreuse would be 3
  blue: 7,       // cyan would be 5, azure 6
  purple: 9,     // violet would be 8
  pink: 11,      // magenta would be 10
}

/**
 * ✅ COLOR HARMONY RULES (FROM CLIENT SPEC)
 * Defines which colors work well together per primary color
 */
const COLOR_HARMONY = {
  // Per-color harmony rules from client spec
  black: {
    complementary: ['white', 'gray', 'silver'],
    analogous: ['charcoal', 'navy', 'dark gray'],
    triadic: ['red', 'gold', 'white']
  },
  white: {
    complementary: ['black', 'navy', 'gray'],
    analogous: ['cream', 'beige', 'ivory'],
    triadic: ['blue', 'red', 'yellow']
  },
  navy: {
    complementary: ['white', 'cream', 'beige'],
    analogous: ['blue', 'royal blue', 'dark blue'],
    triadic: ['burgundy', 'gold', 'white']
  },
  beige: {
    complementary: ['brown', 'cream', 'white'],
    analogous: ['tan', 'sand', 'khaki'],
    triadic: ['navy', 'burgundy', 'forest green']
  },
  gray: {
    complementary: ['white', 'black', 'silver'],
    analogous: ['charcoal', 'light gray', 'slate'],
    triadic: ['blue', 'pink', 'yellow']
  },
  red: {
    complementary: ['green', 'teal', 'mint'],
    analogous: ['orange', 'pink', 'coral'],
    triadic: ['yellow', 'blue']
  },
  blue: {
    complementary: ['orange', 'coral', 'rust'],
    analogous: ['green', 'purple', 'teal', 'navy'],
    triadic: ['red', 'yellow']
  },
  green: {
    complementary: ['red', 'pink', 'coral'],
    analogous: ['yellow', 'blue', 'teal', 'olive'],
    triadic: ['purple', 'orange']
  },
  pink: {
    complementary: ['green', 'olive', 'sage'],
    analogous: ['purple', 'red', 'coral', 'blush'],
    triadic: ['yellow', 'teal']
  },
  purple: {
    complementary: ['yellow', 'gold', 'mustard'],
    analogous: ['blue', 'pink', 'violet', 'lavender'],
    triadic: ['orange', 'green']
  },
  orange: {
    complementary: ['blue', 'navy', 'teal'],
    analogous: ['red', 'yellow', 'coral', 'peach'],
    triadic: ['green', 'purple']
  },
  yellow: {
    complementary: ['purple', 'violet', 'lavender'],
    analogous: ['orange', 'green', 'lime', 'gold'],
    triadic: ['blue', 'red']
  },
  brown: {
    complementary: ['cream', 'white', 'beige'],
    analogous: ['tan', 'camel', 'cognac', 'rust'],
    triadic: ['navy', 'teal']
  },
  
  // Universal neutrals (go with everything)
  neutrals: ['black', 'white', 'grey', 'gray', 'beige', 'tan', 'nude', 'cream', 'ivory', 'brown', 'navy', 'charcoal'],
  
  // Metallic accent rules
  metallics: {
    warm: ['gold', 'bronze', 'copper', 'rose_gold'],
    cool: ['silver', 'platinum', 'pewter']
  },
}

/**
 * ✅ WARM vs COOL color classification
 */
const COLOR_TEMPERATURE = {
  warm: ['red', 'orange', 'yellow', 'coral', 'peach', 'gold', 'rust', 'burgundy', 'terracotta', 'cognac'],
  cool: ['blue', 'green', 'purple', 'teal', 'navy', 'lavender', 'mint', 'silver', 'grey'],
  neutral: ['black', 'white', 'grey', 'beige', 'brown', 'tan', 'cream', 'ivory'],
}

/**
 * ✅ Extract color from product name/description
 * Returns normalized base color and original color term
 */
function extractProductColor(productName, description = '') {
  const combined = `${productName} ${description}`.toLowerCase()
  
  // Create sorted keys by length (longest first) to match "dusty pink" before "pink"
  const sortedColorKeys = Object.keys(COLOR_NORMALIZATION_MAP)
    .sort((a, b) => b.length - a.length)
  
  const foundColors = []
  
  for (const colorKey of sortedColorKeys) {
    // Handle underscore variations (dusty_pink -> dusty pink)
    const searchTerms = [colorKey, colorKey.replace(/_/g, ' '), colorKey.replace(/_/g, '-')]
    
    for (const term of searchTerms) {
      // Use word boundary regex to avoid matching "green" in "evergreen" incorrectly
      const regex = new RegExp(`\\b${term}\\b`, 'i')
      if (regex.test(combined)) {
        const baseColor = COLOR_NORMALIZATION_MAP[colorKey]
        foundColors.push({
          original: term,
          normalized: baseColor,
          position: combined.indexOf(term)
        })
        break
      }
    }
  }
  
  // Return first found color (typically in product name)
  if (foundColors.length > 0) {
    // Sort by position (earlier = more important)
    foundColors.sort((a, b) => a.position - b.position)
    return {
      original: foundColors[0].original,
      normalized: foundColors[0].normalized,
      allColors: foundColors.map(c => c.normalized),
    }
  }
  
  return null
}

/**
 * ✅ Normalize user color preferences to base colors
 */
function normalizeUserColors(userColors) {
  if (!userColors || !Array.isArray(userColors)) return []
  
  return userColors.map(color => {
    const lowerColor = color.toLowerCase().replace(/\s+/g, '_')
    return COLOR_NORMALIZATION_MAP[lowerColor] || color.toLowerCase()
  })
}

/**
 * ✅ Check if two colors are harmonious
 * Returns harmony type and score (0-100)
 */
function getColorHarmonyScore(color1, color2) {
  const c1 = color1.toLowerCase()
  const c2 = color2.toLowerCase()
  
  // Same color = perfect match
  if (c1 === c2) return { type: 'identical', score: 100 }
  
  // Neutrals go with everything
  if (COLOR_HARMONY.neutrals.includes(c1) || COLOR_HARMONY.neutrals.includes(c2)) {
    return { type: 'neutral', score: 90 }
  }
  
  // Check complementary (highest impact)
  const comp = COLOR_HARMONY.complementary[c1]
  if (comp && comp.includes(c2)) {
    return { type: 'complementary', score: 95 }
  }
  
  // Check triadic
  const triadic = COLOR_HARMONY.triadic[c1]
  if (triadic && triadic.includes(c2)) {
    return { type: 'triadic', score: 85 }
  }
  
  // Check analogous
  const analogous = COLOR_HARMONY.analogous[c1]
  if (analogous && analogous.includes(c2)) {
    return { type: 'analogous', score: 80 }
  }
  
  // Check temperature compatibility
  const temp1 = getColorTemperature(c1)
  const temp2 = getColorTemperature(c2)
  
  if (temp1 === temp2 && temp1 !== 'neutral') {
    return { type: 'same_temperature', score: 70 }
  }
  
  if (temp1 === 'neutral' || temp2 === 'neutral') {
    return { type: 'neutral_compatible', score: 75 }
  }
  
  // Clashing warm/cool
  return { type: 'contrasting', score: 40 }
}

/**
 * ✅ Get color temperature (warm/cool/neutral)
 */
function getColorTemperature(color) {
  const c = color.toLowerCase()
  if (COLOR_TEMPERATURE.warm.includes(c)) return 'warm'
  if (COLOR_TEMPERATURE.cool.includes(c)) return 'cool'
  return 'neutral'
}

/**
 * ✅ Score a product based on user's color preferences
 * Returns 0-100 score
 */
function scoreProductColorMatch(productColor, userColors) {
  if (!productColor || !userColors || userColors.length === 0) return 50 // Neutral score
  
  const normalizedUserColors = normalizeUserColors(userColors)
  const productNormalized = productColor.normalized || productColor
  
  // Direct match with user's preferred colors
  if (normalizedUserColors.includes(productNormalized)) {
    return 100
  }
  
  // Check harmony with each user color
  let bestScore = 0
  for (const userColor of normalizedUserColors) {
    const harmony = getColorHarmonyScore(productNormalized, userColor)
    if (harmony.score > bestScore) {
      bestScore = harmony.score
    }
  }
  
  return bestScore
}

/**
 * ✅ Check outfit color harmony (all pieces together)
 * Returns harmony score and recommendations
 */
function checkOutfitColorHarmony(outfitColors) {
  if (!outfitColors || outfitColors.length < 2) {
    return { score: 100, harmony: 'single_item', recommendation: null }
  }
  
  // Get all pairwise harmony scores
  let totalScore = 0
  let pairCount = 0
  const issues = []
  
  for (let i = 0; i < outfitColors.length; i++) {
    for (let j = i + 1; j < outfitColors.length; j++) {
      const harmony = getColorHarmonyScore(outfitColors[i], outfitColors[j])
      totalScore += harmony.score
      pairCount++
      
      if (harmony.score < 50) {
        issues.push(`${outfitColors[i]} + ${outfitColors[j]} may clash`)
      }
    }
  }
  
  const avgScore = pairCount > 0 ? Math.round(totalScore / pairCount) : 100
  
  // Determine overall harmony type
  let harmonyType = 'balanced'
  if (avgScore >= 90) harmonyType = 'excellent'
  else if (avgScore >= 75) harmonyType = 'good'
  else if (avgScore >= 60) harmonyType = 'acceptable'
  else harmonyType = 'needs_improvement'
  
  return {
    score: avgScore,
    harmony: harmonyType,
    issues: issues.length > 0 ? issues : null,
    recommendation: issues.length > 0 
      ? 'Consider swapping one item for a neutral color' 
      : null
  }
}

/**
 * ✅ IMPROVED v3: Build color-enhanced search query
 * Injects ALL user's preferred colors with weighting into the semantic query
 * Strategy: Add colors as prefix AND suffix + weighted mentions for ~90% color accuracy
 */
function buildColorEnhancedQuery(query, userColors, category) {
  if (!userColors || userColors.length === 0) return query
  
  const normalizedColors = normalizeUserColors(userColors)
  
  // Build weighted color injection (first color = 3x, second = 2x, third = 1x)
  const weightedColorTerms = []
  
  normalizedColors.forEach((color, index) => {
    const weight = 3 - index // 3, 2, 1 based on priority
    const variations = [color]
    
    // Add common variations for each base color
    if (color === 'purple') variations.push('violet', 'lavender', 'plum')
    if (color === 'green') variations.push('olive', 'sage', 'emerald', 'forest')
    if (color === 'brown') variations.push('tan', 'camel', 'cognac', 'beige')
    if (color === 'blue') variations.push('navy', 'cobalt', 'denim', 'indigo')
    if (color === 'pink') variations.push('blush', 'rose', 'coral', 'fuchsia')
    if (color === 'grey') variations.push('gray', 'charcoal', 'silver', 'slate')
    if (color === 'black') variations.push('onyx', 'jet', 'ebony')
    if (color === 'white') variations.push('ivory', 'cream', 'pearl')
    if (color === 'red') variations.push('burgundy', 'wine', 'crimson', 'scarlet')
    if (color === 'orange') variations.push('coral', 'peach', 'rust', 'amber')
    if (color === 'yellow') variations.push('gold', 'mustard', 'honey')
    
    // Repeat color based on weight (more important = more mentions)
    for (let i = 0; i < weight; i++) {
      weightedColorTerms.push(variations.join(' '))
    }
  })
  
  // Build prefix (colors at start for strong signal)
  const colorPrefix = normalizedColors.slice(0, 2).join(' ')
  
  // Build suffix (all colors for reinforcement)
  const colorSuffix = normalizedColors.join(' ')
  
  // Combine: [color prefix] [weighted colors] [original query] [color suffix]
  const enhancedQuery = `${colorPrefix} ${weightedColorTerms.join(' ')} ${query} ${colorSuffix}`
  
  return enhancedQuery
}

// Export color utilities for use in other modules
const ColorUtils = {
  extractProductColor,
  normalizeUserColors,
  getColorHarmonyScore,
  getColorTemperature,
  scoreProductColorMatch,
  checkOutfitColorHarmony,
  buildColorEnhancedQuery,
  COLOR_NORMALIZATION_MAP,
  COLOR_HARMONY,
  COLOR_TEMPERATURE,
}

// ============================================================================
// OCCASION-TO-PRODUCT-TYPE MAPPING (CORE STRATEGY)
// ============================================================================
// Instead of searching for occasion keywords (which don't exist in product descriptions),
// we map occasions to specific product types that ARE present in the database.
// This ensures semantic search queries contain terms that actually match products.

const OCCASION_PRODUCT_MAPPING = {
  // ============================================================================
  // FITNESS & ACTIVE (12 occasions)
  // ============================================================================
  workout: {
    tops: ["tank top", "sports bra", "compression top", "athletic shirt", "performance tee", "muscle tank", "crop top athletic", "long sleeve workout", "zip hoodie", "running top", "gym top", "training top", "racerback tank", "sleeveless tee", "moisture-wicking shirt", "dri-fit top", "workout vest", "athletic crop top"],
    bottoms: ["leggings", "joggers", "track pants", "athletic shorts", "compression shorts", "yoga pants", "running shorts", "sweatpants", "bike shorts", "training pants", "gym shorts", "workout leggings", "high waist leggings", "capri leggings", "sport shorts", "athletic joggers", "stretch pants", "performance leggings"],
    shoes: ["sneakers", "trainers", "running shoes", "cross-training shoes", "athletic shoes", "gym shoes", "sports shoes", "workout shoes", "training sneakers", "lightweight trainers", "cushioned sneakers", "stability shoes", "fitness shoes", "exercise shoes"],
  },
  yoga: {
    tops: ["tank top", "sports bra", "crop top", "fitted tee", "wrap top", "racerback tank", "seamless top", "yoga top", "breathable tank", "stretch top", "soft tee", "bamboo top", "organic cotton top", "flowy tank", "relaxed fit top"],
    bottoms: ["leggings", "yoga pants", "wide leg pants", "flared leggings", "high waist leggings", "capri leggings", "yoga leggings", "bootcut yoga pants", "stretch pants", "flow pants", "palazzo pants yoga", "harem pants", "loose yoga pants"],
    shoes: ["barefoot shoes", "slip-on sneakers", "flat sneakers", "minimalist shoes", "yoga shoes", "grip socks", "studio shoes", "flexible flats"],
  },
  pilates: {
    tops: ["fitted tank", "sports bra", "compression top", "cropped top", "seamless tank", "breathable tee", "stretch top", "pilates top"],
    bottoms: ["leggings", "capri leggings", "fitted pants", "compression leggings", "high waist leggings", "stirrup leggings", "ankle leggings"],
    shoes: ["grip socks", "pilates shoes", "barefoot shoes", "studio flats"],
  },
  hiking: {
    tops: ["performance shirt", "long sleeve tee", "fleece jacket", "windbreaker", "zip-up jacket", "moisture-wicking top", "hiking shirt", "quick-dry top", "base layer", "technical tee", "outdoor shirt", "UV protection top", "lightweight jacket", "softshell jacket"],
    bottoms: ["cargo pants", "hiking pants", "outdoor shorts", "convertible pants", "joggers", "athletic pants", "trail pants", "zip-off pants", "stretch hiking pants", "quick-dry shorts", "trekking pants", "outdoor trousers"],
    shoes: ["hiking boots", "trail shoes", "outdoor sneakers", "waterproof boots", "ankle boots", "trekking boots", "trail runners", "approach shoes", "waterproof hiking shoes", "mid-cut boots", "lightweight hikers"],
  },
  running: {
    tops: ["running top", "performance tee", "singlet", "running vest", "moisture-wicking shirt", "technical tank", "long sleeve running", "half-zip top", "lightweight tee", "breathable tank", "race singlet"],
    bottoms: ["running shorts", "running leggings", "split shorts", "compression shorts", "track pants", "running tights", "tempo shorts", "race shorts", "lined shorts"],
    shoes: ["running shoes", "road runners", "racing flats", "cushioned runners", "stability running shoes", "neutral runners", "tempo shoes", "marathon shoes", "lightweight runners"],
  },
  cycling: {
    tops: ["cycling jersey", "bike top", "technical tee", "windbreaker cycling", "base layer", "cycle vest", "aero jersey", "long sleeve jersey"],
    bottoms: ["cycling shorts", "bike shorts", "padded shorts", "cycling tights", "bib shorts", "cycling leggings", "compression shorts cycling"],
    shoes: ["cycling shoes", "spin shoes", "clip-in shoes", "bike shoes", "indoor cycling shoes"],
  },
  swimming: {
    tops: ["swimsuit top", "bikini top", "tankini", "rash guard", "swim top", "one-piece top section", "sports bikini top"],
    bottoms: ["swim bottoms", "bikini bottoms", "swim shorts", "board shorts women", "swim skirt", "high waist bikini bottom"],
    shoes: ["water shoes", "aqua shoes", "pool slides", "swim sandals"],
    dresses: ["one-piece swimsuit", "swimdress", "monokini"],
  },
  tennis: {
    tops: ["tennis top", "polo shirt", "performance tank", "tennis dress top", "athletic polo", "sleeveless polo"],
    bottoms: ["tennis skirt", "skort", "tennis shorts", "pleated skirt", "athletic skirt", "sport skort"],
    shoes: ["tennis shoes", "court shoes", "tennis sneakers", "hard court shoes", "clay court shoes"],
    dresses: ["tennis dress", "athletic dress", "sport dress"],
  },
  golf: {
    tops: ["polo shirt", "golf top", "collared shirt", "quarter-zip pullover", "golf sweater", "mock neck top", "sleeveless polo"],
    bottoms: ["golf pants", "golf skirt", "golf shorts", "chinos", "tailored shorts", "golf skort", "cropped golf pants"],
    shoes: ["golf shoes", "spikeless golf shoes", "golf sneakers", "waterproof golf shoes"],
  },
  gym: {
    tops: ["tank top", "sports bra", "gym top", "workout tee", "compression top", "muscle tank", "cropped hoodie", "gym vest"],
    bottoms: ["leggings", "gym shorts", "joggers", "workout shorts", "gym leggings", "compression leggings", "training shorts"],
    shoes: ["training shoes", "gym sneakers", "cross trainers", "weightlifting shoes", "flat trainers", "versatile gym shoes"],
  },
  dance: {
    tops: ["dance top", "crop top", "leotard", "wrap top", "fitted tank", "dance sweater", "off-shoulder dance top"],
    bottoms: ["dance pants", "leggings", "dance shorts", "flared pants", "jazz pants", "bootcut leggings"],
    shoes: ["dance sneakers", "jazz shoes", "ballet flats", "dance heels", "character shoes"],
  },
  sports: {
    tops: ["sports jersey", "athletic top", "team shirt", "performance tee", "sports bra", "game day top"],
    bottoms: ["athletic shorts", "sports pants", "team shorts", "compression shorts", "sport leggings"],
    shoes: ["athletic shoes", "sports sneakers", "cleats", "turf shoes", "multi-sport shoes"],
  },

  // ============================================================================
  // FORMAL & SPECIAL EVENTS (20 occasions)
  // ============================================================================
  wedding: {
    tops: ["elegant blouse", "dressy top", "silk blouse", "lace top", "formal top", "embellished top", "off-shoulder top", "beaded top", "chiffon blouse", "satin top", "sophisticated blouse", "evening top", "sequin top subtle", "structured blazer formal", "tailored jacket"],
    bottoms: ["dress pants", "wide leg trousers", "maxi skirt", "midi skirt", "formal trousers", "palazzo pants", "tailored pants", "satin pants", "elegant skirt", "flowing skirt", "A-line skirt formal", "pleated maxi skirt", "silk pants"],
    shoes: ["heels", "pumps", "stilettos", "strappy heels", "dress shoes", "elegant sandals", "block heels", "kitten heels", "satin heels", "embellished heels", "platform heels elegant", "peep toe heels", "ankle strap heels", "dressy mules"],
    dresses: ["gown", "maxi dress", "midi dress", "cocktail dress", "formal dress", "evening dress", "wrap dress", "A-line dress", "fit and flare dress", "sheath dress", "column dress", "tea length dress", "ball gown", "empire waist dress", "grecian dress"],
  },
  wedding_guest: {
    tops: ["elegant blouse", "silk top", "dressy camisole", "structured blazer", "embellished top", "lace blouse", "off-shoulder top"],
    bottoms: ["tailored pants", "midi skirt", "wide leg trousers", "dress pants", "flowing skirt", "palazzo pants"],
    shoes: ["heels", "block heels", "strappy sandals", "elegant pumps", "kitten heels", "dressy flats"],
    dresses: ["midi dress", "maxi dress", "wrap dress", "A-line dress", "fit and flare", "cocktail dress", "tea dress"],
  },
  black_tie: {
    tops: ["formal blouse", "beaded top", "sequin top", "elegant camisole", "embellished top", "silk evening top"],
    bottoms: ["formal trousers", "wide leg evening pants", "maxi skirt formal", "silk pants", "palazzo pants elegant"],
    shoes: ["stilettos", "formal heels", "strappy heels", "embellished heels", "satin pumps", "crystal heels"],
    dresses: ["ball gown", "floor-length dress", "formal gown", "evening gown", "column dress", "sheath gown"],
  },
  party: {
    tops: ["sequin top", "metallic top", "crop top", "halter top", "bandeau", "off-shoulder top", "glitter top", "sheer top", "bodysuit", "sparkly top", "party blouse", "backless top", "cut-out top", "mesh top", "velvet top", "satin camisole"],
    bottoms: ["mini skirt", "leather pants", "sequin pants", "metallic skirt", "high waist pants", "fitted skirt", "satin pants", "vinyl pants", "sparkly skirt", "bodycon skirt", "velvet pants", "wet look leggings", "party pants"],
    shoes: ["heels", "stilettos", "platform heels", "strappy heels", "sparkly heels", "ankle boots heels", "dressy sandals", "glitter heels", "metallic heels", "statement heels", "clear heels", "rhinestone heels"],
    dresses: ["mini dress", "bodycon dress", "sequin dress", "cocktail dress", "party dress", "slip dress", "cut-out dress", "backless dress", "one-shoulder dress", "velvet dress", "metallic dress", "wrap mini dress", "bandage dress"],
  },
  cocktail: {
    tops: ["silk blouse", "dressy top", "elegant camisole", "lace top", "satin top", "embellished top", "halter top elegant", "ruched top", "one-shoulder top"],
    bottoms: ["tailored pants", "dress pants", "midi skirt", "pencil skirt", "wide leg trousers", "cigarette pants", "high waist skirt"],
    shoes: ["heels", "pumps", "kitten heels", "strappy sandals", "elegant flats", "block heels", "slingback heels", "peep toe pumps"],
    dresses: ["cocktail dress", "midi dress", "wrap dress", "sheath dress", "fit and flare dress", "A-line dress", "one-shoulder dress", "asymmetric dress"],
  },
  gala: {
    tops: ["embellished top", "beaded top", "formal blouse", "elegant camisole", "crystal top", "couture top", "evening blouse"],
    bottoms: ["formal trousers", "wide leg pants", "maxi skirt", "evening pants", "silk trousers", "palazzo pants formal"],
    shoes: ["stilettos", "formal heels", "dressy pumps", "elegant sandals", "crystal heels", "satin heels", "designer heels"],
    dresses: ["ball gown", "formal gown", "evening dress", "floor-length dress", "maxi dress elegant", "couture dress", "red carpet dress", "princess gown"],
  },
  prom: {
    tops: ["elegant top", "beaded top", "sequin top", "formal corset", "embellished blouse"],
    bottoms: ["formal skirt", "maxi skirt", "ball gown skirt", "tulle skirt"],
    shoes: ["heels", "platform heels", "strappy heels", "sparkly heels", "prom heels", "block heels dressy"],
    dresses: ["prom dress", "ball gown", "A-line gown", "mermaid dress", "two-piece prom dress", "princess dress", "fit and flare gown"],
  },
  graduation: {
    tops: ["elegant blouse", "fitted top", "dressy top", "smart blouse", "silk top", "structured top", "sophisticated blouse"],
    bottoms: ["dress pants", "midi skirt", "tailored trousers", "A-line skirt", "pencil skirt", "wide leg pants"],
    shoes: ["heels", "pumps", "block heels", "elegant flats", "loafers dressy", "kitten heels", "comfortable heels"],
    dresses: ["midi dress", "A-line dress", "wrap dress", "fit and flare dress", "sheath dress", "shift dress", "smart dress"],
  },
  anniversary: {
    tops: ["romantic blouse", "silk top", "lace top", "elegant camisole", "off-shoulder top", "feminine blouse"],
    bottoms: ["tailored pants", "midi skirt", "wide leg trousers", "flowing skirt", "elegant pants"],
    shoes: ["heels", "strappy sandals", "elegant pumps", "block heels", "dressy mules"],
    dresses: ["romantic dress", "wrap dress", "midi dress", "maxi dress", "slip dress elegant", "lace dress"],
  },
  engagement_party: {
    tops: ["elegant blouse", "lace top", "silk camisole", "romantic top", "off-shoulder blouse"],
    bottoms: ["tailored pants", "midi skirt", "wide leg trousers", "flowing pants"],
    shoes: ["heels", "elegant sandals", "block heels", "strappy heels", "dressy flats"],
    dresses: ["midi dress", "wrap dress", "A-line dress", "cocktail dress", "romantic dress", "lace dress"],
  },
  baby_shower: {
    tops: ["soft blouse", "feminine top", "floral blouse", "pastel top", "elegant casual top", "wrap top"],
    bottoms: ["dress pants", "midi skirt", "tailored pants", "flowing skirt", "chinos dressy"],
    shoes: ["block heels", "elegant flats", "low heels", "comfortable heels", "dressy sandals"],
    dresses: ["midi dress", "wrap dress", "floral dress", "A-line dress", "shift dress", "tea dress"],
  },
  birthday_party: {
    tops: ["fun top", "sparkly top", "crop top", "statement top", "off-shoulder top", "cute blouse"],
    bottoms: ["jeans dressy", "mini skirt", "midi skirt", "leather pants", "tailored shorts"],
    shoes: ["heels", "ankle boots", "strappy sandals", "block heels", "platform heels"],
    dresses: ["party dress", "mini dress", "wrap dress", "bodycon dress", "fit and flare dress"],
  },
  funeral: {
    tops: ["black blouse", "conservative top", "dark blazer", "modest blouse", "simple black top", "long sleeve blouse", "turtleneck black"],
    bottoms: ["black dress pants", "dark trousers", "black skirt", "midi skirt black", "tailored black pants", "conservative skirt"],
    shoes: ["black heels", "black flats", "dark pumps", "conservative heels", "black loafers", "simple black shoes"],
    dresses: ["black dress", "conservative dress", "midi dress black", "sheath dress dark", "modest dress", "long sleeve dress"],
  },
  memorial: {
    tops: ["dark blouse", "navy top", "black blazer", "conservative blouse", "modest top"],
    bottoms: ["dark pants", "black trousers", "navy skirt", "dark midi skirt"],
    shoes: ["black heels", "dark flats", "conservative shoes", "low heels dark"],
    dresses: ["dark dress", "navy dress", "black midi dress", "conservative dress"],
  },
  christening: {
    tops: ["elegant blouse", "soft blouse", "feminine top", "pastel blouse", "lace top subtle"],
    bottoms: ["tailored pants", "midi skirt", "dress pants", "A-line skirt"],
    shoes: ["elegant flats", "low heels", "block heels", "dressy shoes"],
    dresses: ["midi dress", "A-line dress", "wrap dress", "tea dress", "floral dress subtle"],
  },
  bat_mitzvah: {
    tops: ["elegant blouse", "modest top", "dressy top", "sophisticated blouse", "conservative top"],
    bottoms: ["dress pants", "midi skirt", "tailored pants", "A-line skirt"],
    shoes: ["heels", "elegant flats", "block heels", "dressy shoes"],
    dresses: ["midi dress", "A-line dress", "sheath dress", "conservative dress", "elegant dress"],
  },
  charity_event: {
    tops: ["elegant blouse", "silk top", "dressy top", "sophisticated blouse", "statement top"],
    bottoms: ["dress pants", "wide leg trousers", "midi skirt", "tailored pants"],
    shoes: ["heels", "elegant pumps", "strappy heels", "designer heels"],
    dresses: ["cocktail dress", "midi dress", "elegant dress", "A-line dress", "wrap dress"],
  },
  award_ceremony: {
    tops: ["formal blouse", "beaded top", "elegant top", "embellished blouse", "silk top"],
    bottoms: ["formal pants", "wide leg trousers", "evening pants", "tailored pants"],
    shoes: ["stilettos", "formal heels", "elegant pumps", "statement heels"],
    dresses: ["formal dress", "evening gown", "cocktail dress", "elegant dress", "floor-length dress"],
  },
  opera: {
    tops: ["elegant blouse", "silk top", "formal top", "sophisticated blouse", "velvet top"],
    bottoms: ["dress pants", "formal trousers", "midi skirt", "wide leg pants"],
    shoes: ["heels", "elegant pumps", "formal heels", "kitten heels"],
    dresses: ["formal dress", "midi dress elegant", "evening dress", "sophisticated dress"],
  },
  theater: {
    tops: ["smart blouse", "elegant top", "dressy top", "silk blouse", "sophisticated top"],
    bottoms: ["dress pants", "tailored pants", "midi skirt", "wide leg trousers"],
    shoes: ["heels", "elegant flats", "block heels", "dressy loafers"],
    dresses: ["midi dress", "wrap dress", "A-line dress", "smart dress", "elegant dress"],
  },

  // ============================================================================
  // PROFESSIONAL (10 occasions)
  // ============================================================================
  work: {
    tops: ["blazer", "blouse", "button-up shirt", "dress shirt", "knit top", "turtleneck", "cardigan", "professional top", "smart top", "collared shirt", "structured top", "work blouse", "office top", "crisp shirt", "elegant work top", "fitted blazer", "cropped blazer"],
    bottoms: ["dress pants", "trousers", "pencil skirt", "tailored pants", "slacks", "wide leg trousers", "midi skirt professional", "straight leg pants", "cigarette pants", "culottes", "ankle pants", "work pants", "office skirt"],
    shoes: ["loafers", "oxford shoes", "pumps", "block heels", "ballet flats", "dress shoes", "kitten heels", "mules", "slingbacks", "court shoes", "pointed flats", "professional heels", "low heels", "work flats"],
  },
  interview: {
    tops: ["blazer", "button-up shirt", "professional blouse", "smart top", "fitted blazer", "structured blazer", "conservative blouse", "collared shirt", "silk blouse professional"],
    bottoms: ["dress pants", "tailored trousers", "pencil skirt", "slacks", "straight leg pants", "conservative skirt", "professional pants"],
    shoes: ["pumps", "loafers", "oxford shoes", "block heels", "professional flats", "conservative heels", "court shoes", "pointed toe flats"],
    dresses: ["sheath dress", "professional dress", "A-line dress", "conservative dress", "shift dress"],
  },
  business_casual: {
    tops: ["blouse", "knit top", "cardigan", "polo shirt", "smart casual top", "lightweight blazer", "button-up casual", "sweater professional", "structured top", "refined tee"],
    bottoms: ["chinos", "dress pants", "midi skirt", "tailored shorts", "smart trousers", "ankle pants", "cropped pants", "relaxed trousers"],
    shoes: ["loafers", "ballet flats", "low heels", "smart sneakers", "mules", "pointed flats", "driving shoes", "refined loafers"],
  },
  business_formal: {
    tops: ["tailored blazer", "structured blouse", "formal shirt", "power blazer", "silk blouse", "conservative top"],
    bottoms: ["formal trousers", "pencil skirt", "tailored pants", "professional skirt", "straight leg pants"],
    shoes: ["pumps", "formal heels", "pointed pumps", "court shoes", "professional heels"],
    dresses: ["formal sheath dress", "professional dress", "power dress", "structured dress"],
  },
  conference: {
    tops: ["blazer", "professional blouse", "structured top", "smart shirt", "knit top", "cardigan professional"],
    bottoms: ["tailored pants", "dress pants", "professional skirt", "wide leg trousers", "ankle pants"],
    shoes: ["pumps", "loafers", "block heels", "professional flats", "comfortable heels", "slingbacks"],
  },
  presentation: {
    tops: ["blazer", "structured blouse", "professional top", "confident top", "power blazer"],
    bottoms: ["tailored pants", "dress pants", "pencil skirt", "professional trousers"],
    shoes: ["heels", "pumps", "block heels", "confident heels", "professional shoes"],
    dresses: ["professional dress", "sheath dress", "A-line dress professional"],
  },
  networking: {
    tops: ["smart blouse", "blazer casual", "elegant top", "professional yet approachable top"],
    bottoms: ["tailored pants", "dress pants", "midi skirt", "smart trousers"],
    shoes: ["comfortable heels", "loafers", "block heels", "elegant flats"],
    dresses: ["professional dress", "midi dress", "wrap dress professional"],
  },
  client_meeting: {
    tops: ["blazer", "professional blouse", "structured top", "silk blouse", "tailored top"],
    bottoms: ["dress pants", "tailored trousers", "pencil skirt", "professional pants"],
    shoes: ["heels", "pumps", "professional loafers", "elegant flats"],
    dresses: ["professional dress", "sheath dress", "elegant dress"],
  },
  office_party: {
    tops: ["festive blouse", "sparkly top subtle", "elegant top", "dressy work top"],
    bottoms: ["dress pants", "tailored pants", "midi skirt", "elegant trousers"],
    shoes: ["heels", "elegant pumps", "festive flats", "sparkly heels subtle"],
    dresses: ["cocktail dress modest", "midi dress", "elegant dress", "party dress work-appropriate"],
  },
  creative_office: {
    tops: ["trendy blouse", "statement top", "creative blazer", "unique top", "artistic top"],
    bottoms: ["interesting pants", "culottes", "wide leg pants", "creative trousers"],
    shoes: ["unique heels", "statement flats", "interesting loafers", "creative shoes"],
    dresses: ["creative dress", "unique midi dress", "statement dress"],
  },

  // ============================================================================
  // CASUAL & EVERYDAY (12 occasions)
  // ============================================================================
  everyday: {
    tops: ["t-shirt", "casual top", "sweater", "hoodie", "blouse casual", "tank top", "long sleeve tee", "cardigan", "basic tee", "henley", "pullover", "casual shirt", "relaxed top", "comfortable tee", "everyday blouse"],
    bottoms: ["jeans", "casual pants", "joggers", "shorts", "skirt casual", "leggings", "chinos", "cargo pants", "denim shorts", "relaxed pants", "comfortable jeans", "everyday skirt", "basic pants"],
    shoes: ["sneakers", "flats", "sandals", "loafers", "boots casual", "slip-ons", "canvas shoes", "comfortable sneakers", "everyday flats", "casual boots", "walking shoes"],
  },
  casual: {
    tops: ["t-shirt", "casual shirt", "sweater", "hoodie", "henley", "polo", "flannel shirt", "graphic tee", "sweatshirt", "long sleeve tee", "casual blouse", "relaxed top"],
    bottoms: ["jeans", "casual pants", "shorts", "joggers", "chinos", "cargo pants", "denim shorts", "khakis", "relaxed jeans", "casual skirt"],
    shoes: ["sneakers", "loafers", "sandals", "boat shoes", "slip-ons", "casual boots", "canvas sneakers", "comfortable flats"],
  },
  weekend: {
    tops: ["casual tee", "sweatshirt", "hoodie", "flannel", "denim jacket", "casual blouse", "cozy sweater", "relaxed top", "weekend top"],
    bottoms: ["jeans", "joggers", "shorts", "casual pants", "denim skirt", "comfortable pants", "relaxed jeans", "weekend pants"],
    shoes: ["sneakers", "sandals", "slip-ons", "casual boots", "espadrilles", "comfortable flats", "weekend sneakers"],
  },
  brunch: {
    tops: ["blouse", "casual top", "knit top", "sundress top", "crop top", "off-shoulder top", "feminine top", "brunch blouse", "cute top", "trendy top"],
    bottoms: ["jeans", "midi skirt", "wide leg pants", "shorts", "linen pants", "flowing pants", "brunch skirt", "culottes"],
    shoes: ["sandals", "mules", "ballet flats", "espadrilles", "low heels", "white sneakers", "cute flats", "comfortable heels"],
    dresses: ["sundress", "midi dress", "wrap dress", "maxi dress casual", "shirt dress", "brunch dress", "flowy dress"],
  },
  shopping: {
    tops: ["comfortable tee", "casual top", "easy blouse", "tank top", "light sweater"],
    bottoms: ["comfortable jeans", "joggers", "easy pants", "casual shorts", "leggings"],
    shoes: ["comfortable sneakers", "flats", "slip-ons", "walking shoes", "easy sandals"],
  },
  coffee_date: {
    tops: ["nice tee", "cute top", "casual blouse", "sweater", "trendy top"],
    bottoms: ["nice jeans", "casual pants", "midi skirt", "comfortable pants"],
    shoes: ["sneakers", "ankle boots", "flats", "loafers", "comfortable heels"],
    dresses: ["casual dress", "sweater dress", "shirt dress"],
  },
  movie: {
    tops: ["comfortable tee", "hoodie", "sweater", "cozy top", "relaxed top"],
    bottoms: ["jeans", "joggers", "comfortable pants", "leggings"],
    shoes: ["sneakers", "slip-ons", "comfortable flats", "casual shoes"],
  },
  errand: {
    tops: ["basic tee", "casual top", "comfortable shirt", "easy blouse"],
    bottoms: ["jeans", "joggers", "comfortable pants", "shorts", "leggings"],
    shoes: ["sneakers", "slip-ons", "comfortable shoes", "sandals"],
  },
  bbq: {
    tops: ["casual tee", "tank top", "casual shirt", "button-up casual", "light top"],
    bottoms: ["jeans", "shorts", "casual pants", "denim shorts", "chinos"],
    shoes: ["sneakers", "sandals", "casual boots", "slip-ons"],
  },
  farmers_market: {
    tops: ["casual top", "linen top", "comfortable blouse", "tank top", "light sweater"],
    bottoms: ["jeans", "shorts", "linen pants", "casual skirt", "comfortable pants"],
    shoes: ["comfortable sandals", "sneakers", "espadrilles", "flats"],
    dresses: ["sundress", "casual maxi dress", "shirt dress"],
  },
  dog_walking: {
    tops: ["comfortable tee", "hoodie", "athletic top", "casual shirt", "sweatshirt"],
    bottoms: ["joggers", "leggings", "comfortable pants", "athletic shorts", "jeans casual"],
    shoes: ["sneakers", "comfortable walking shoes", "athletic shoes", "slip-ons"],
  },
  lazy_day: {
    tops: ["soft tee", "sweatshirt", "hoodie", "loungewear top", "cozy sweater"],
    bottoms: ["sweatpants", "joggers", "soft leggings", "lounge pants", "comfortable shorts"],
    shoes: ["slippers", "soft slides", "house shoes"],
  },

  // ============================================================================
  // DATE & ROMANTIC (8 occasions)
  // ============================================================================
  date: {
    tops: ["elegant blouse", "silk top", "feminine top", "lace top", "off-shoulder top", "bodysuit", "fitted top", "romantic blouse", "cute top", "date top", "stylish blouse", "pretty top"],
    bottoms: ["jeans", "leather pants", "midi skirt", "high waist pants", "fitted skirt", "wide leg pants", "date pants", "nice jeans", "elegant pants", "trendy pants"],
    shoes: ["heels", "ankle boots", "strappy sandals", "pumps", "block heels", "mules", "elegant heels", "date heels", "cute heels"],
    dresses: ["wrap dress", "midi dress", "slip dress", "bodycon dress", "fit and flare dress", "date dress", "romantic dress", "elegant dress"],
  },
  date_casual: {
    tops: ["nice blouse", "fitted top", "cute sweater", "stylish tee", "feminine top", "casual elegant top"],
    bottoms: ["nice jeans", "midi skirt", "tailored pants", "comfortable elegant pants"],
    shoes: ["ankle boots", "low heels", "stylish sneakers", "loafers", "comfortable heels"],
    dresses: ["casual dress", "knit dress", "shirt dress", "easy dress"],
  },
  date_fancy: {
    tops: ["silk blouse", "elegant top", "lace top", "dressy camisole", "romantic blouse", "sophisticated top"],
    bottoms: ["dress pants", "leather skirt", "satin pants", "midi skirt elegant", "tailored trousers"],
    shoes: ["heels", "stilettos", "strappy sandals", "elegant pumps", "dressy heels"],
    dresses: ["cocktail dress", "midi dress elegant", "slip dress", "wrap dress silk", "sophisticated dress"],
  },
  first_date: {
    tops: ["flattering top", "nice blouse", "feminine top", "cute top", "stylish top"],
    bottoms: ["nice jeans", "flattering pants", "midi skirt", "elegant pants"],
    shoes: ["comfortable heels", "cute flats", "ankle boots", "elegant sandals"],
    dresses: ["flattering dress", "wrap dress", "A-line dress", "cute dress"],
  },
  romantic_dinner: {
    tops: ["elegant blouse", "silk top", "romantic top", "lace camisole", "off-shoulder top"],
    bottoms: ["dress pants", "elegant skirt", "tailored pants", "midi skirt"],
    shoes: ["heels", "strappy sandals", "elegant pumps", "dressy heels"],
    dresses: ["romantic dress", "elegant midi dress", "slip dress", "wrap dress"],
  },
  valentines: {
    tops: ["romantic blouse", "red top", "pink top", "lace top", "feminine top", "heart print top"],
    bottoms: ["nice pants", "red skirt", "pink pants", "elegant skirt"],
    shoes: ["red heels", "romantic heels", "strappy sandals", "elegant pumps"],
    dresses: ["red dress", "pink dress", "romantic dress", "heart print dress", "valentines dress"],
  },
  wine_tasting: {
    tops: ["elegant casual top", "silk blouse", "nice sweater", "sophisticated top"],
    bottoms: ["nice jeans", "tailored pants", "midi skirt", "elegant pants"],
    shoes: ["comfortable heels", "elegant flats", "loafers dressy", "ankle boots"],
    dresses: ["midi dress", "wrap dress", "elegant casual dress"],
  },
  rooftop_bar: {
    tops: ["chic top", "elegant blouse", "stylish top", "statement top"],
    bottoms: ["nice jeans", "leather pants", "midi skirt", "tailored pants"],
    shoes: ["heels", "strappy sandals", "block heels", "stylish boots"],
    dresses: ["chic dress", "midi dress", "stylish dress", "elegant mini dress"],
  },

  // ============================================================================
  // TRAVEL & VACATION (15 occasions)
  // ============================================================================
  vacation: {
    tops: ["tank top", "linen shirt", "casual blouse", "crop top", "resort top", "breezy top", "kimono", "vacation top", "light blouse", "comfortable tee", "travel top", "flowy top"],
    bottoms: ["shorts", "linen pants", "wide leg pants", "maxi skirt", "flowy pants", "casual skirt", "vacation shorts", "comfortable pants", "resort pants", "flowing skirt"],
    shoes: ["sandals", "espadrilles", "flat sandals", "slides", "comfortable sneakers", "canvas shoes", "vacation sandals", "walking sandals", "easy shoes"],
    dresses: ["sundress", "maxi dress", "midi dress", "beach dress", "wrap dress", "flowy dress", "vacation dress", "resort dress", "comfortable dress"],
  },
  beach: {
    tops: ["bikini top", "crop top", "tank top", "cover-up", "linen shirt", "beach blouse", "swim top", "beach cover", "bralette", "beach crop top"],
    bottoms: ["shorts", "linen shorts", "sarong", "beach pants", "flowy skirt", "swim shorts", "beach skirt", "cover-up skirt"],
    shoes: ["sandals", "flip flops", "slides", "espadrilles", "beach shoes", "water sandals", "flat sandals"],
    dresses: ["beach dress", "cover-up dress", "maxi dress flowy", "sundress", "kaftan", "beach kaftan", "swim cover dress"],
  },
  pool: {
    tops: ["bikini top", "swim top", "cover-up top", "tankini", "pool top"],
    bottoms: ["bikini bottoms", "swim shorts", "cover-up shorts", "sarong"],
    shoes: ["slides", "flip flops", "pool sandals", "waterproof sandals"],
    dresses: ["cover-up", "pool dress", "beach cover", "kaftan"],
  },
  resort: {
    tops: ["linen top", "silk camisole", "elegant tank", "resort blouse", "off-shoulder top", "tropical print top", "resort wear top", "flowy blouse"],
    bottoms: ["linen pants", "wide leg trousers", "maxi skirt", "palazzo pants", "flowy shorts", "resort pants", "elegant shorts"],
    shoes: ["wedges", "espadrilles", "elegant sandals", "mules", "block heel sandals", "resort heels", "dressy sandals"],
    dresses: ["resort dress", "maxi dress", "midi dress", "wrap dress", "flowy dress", "tropical dress", "elegant beach dress"],
  },
  tropical: {
    tops: ["tropical print top", "palm print blouse", "floral top", "breezy top", "resort top", "bright top"],
    bottoms: ["tropical shorts", "floral pants", "bright skirt", "linen pants", "flowy pants"],
    shoes: ["sandals", "espadrilles", "bright sandals", "tropical wedges"],
    dresses: ["tropical dress", "floral maxi dress", "bright sundress", "palm print dress"],
  },
  travel: {
    tops: ["comfortable tee", "layering top", "cardigan", "travel-friendly blouse", "wrinkle-free top", "versatile top", "travel sweater", "packable top"],
    bottoms: ["comfortable pants", "travel pants", "joggers", "leggings", "stretchy jeans", "wrinkle-free pants", "versatile pants"],
    shoes: ["comfortable sneakers", "slip-on shoes", "walking shoes", "flat boots", "comfortable loafers", "travel shoes", "versatile flats"],
  },
  airport: {
    tops: ["comfortable top", "layering piece", "cozy sweater", "easy tee", "travel cardigan"],
    bottoms: ["comfortable pants", "joggers", "leggings", "stretchy jeans", "easy pants"],
    shoes: ["slip-on sneakers", "comfortable flats", "easy shoes", "airport-friendly shoes"],
  },
  cruise: {
    tops: ["elegant casual top", "linen blouse", "smart casual top", "nautical top", "resort blouse", "cruise top"],
    bottoms: ["dress pants", "linen pants", "smart shorts", "midi skirt", "cruise pants", "elegant shorts"],
    shoes: ["deck shoes", "loafers", "sandals", "wedges", "boat shoes", "cruise heels"],
    dresses: ["maxi dress", "midi dress", "wrap dress", "sundress elegant", "cruise dress", "nautical dress"],
  },
  cruise_formal: {
    tops: ["elegant top", "formal blouse", "dressy top", "silk top"],
    bottoms: ["formal pants", "dress pants", "elegant skirt"],
    shoes: ["heels", "elegant pumps", "dressy sandals"],
    dresses: ["formal dress", "evening dress", "elegant gown", "cocktail dress"],
  },
  road_trip: {
    tops: ["comfortable tee", "casual top", "cozy sweater", "easy blouse"],
    bottoms: ["comfortable jeans", "joggers", "leggings", "easy pants"],
    shoes: ["comfortable sneakers", "slip-ons", "easy flats"],
  },
  camping: {
    tops: ["practical tee", "long sleeve shirt", "flannel", "outdoor top", "layering top"],
    bottoms: ["hiking pants", "comfortable jeans", "cargo pants", "practical shorts"],
    shoes: ["hiking boots", "sturdy sneakers", "outdoor shoes", "waterproof shoes"],
  },
  city_break: {
    tops: ["stylish tee", "nice blouse", "versatile top", "city top", "smart casual top"],
    bottoms: ["nice jeans", "comfortable pants", "stylish trousers", "walking-friendly pants"],
    shoes: ["comfortable stylish sneakers", "walking flats", "ankle boots", "comfortable loafers"],
    dresses: ["comfortable dress", "city dress", "versatile dress"],
  },
  sightseeing: {
    tops: ["comfortable top", "breathable tee", "layering piece", "practical top"],
    bottoms: ["comfortable pants", "walking-friendly jeans", "practical shorts"],
    shoes: ["walking shoes", "comfortable sneakers", "supportive flats", "practical sandals"],
  },
  safari: {
    tops: ["khaki shirt", "linen shirt", "neutral top", "safari shirt", "breathable blouse"],
    bottoms: ["khaki pants", "cargo pants", "safari shorts", "neutral trousers", "practical pants"],
    shoes: ["safari boots", "sturdy sandals", "walking shoes", "practical boots"],
  },
  ski_trip: {
    tops: ["thermal top", "fleece", "base layer", "ski sweater", "warm top"],
    bottoms: ["ski pants", "thermal leggings", "warm pants", "base layer bottoms"],
    shoes: ["ski boots", "warm boots", "apres-ski boots", "snow boots"],
  },

  // ============================================================================
  // HOME & COMFORT (6 occasions)
  // ============================================================================
  home: {
    tops: ["t-shirt", "sweatshirt", "hoodie", "loungewear top", "pajama top", "cozy sweater", "soft tee", "comfortable hoodie", "relaxed top"],
    bottoms: ["sweatpants", "joggers", "lounge pants", "pajama pants", "shorts comfortable", "leggings soft", "cozy pants", "home pants"],
    shoes: ["slippers", "house shoes", "comfortable slides", "cozy slippers", "indoor shoes"],
  },
  lounge: {
    tops: ["loungewear top", "soft sweater", "oversized tee", "cozy hoodie", "knit top relaxed", "lounge sweater", "comfortable top"],
    bottoms: ["lounge pants", "soft joggers", "cozy leggings", "knit pants", "relaxed pants", "comfort pants"],
    shoes: ["slippers", "cozy slides", "soft moccasins", "house slippers"],
  },
  sleepwear: {
    tops: ["pajama top", "sleep shirt", "nightgown top", "camisole sleep", "soft tee", "sleep top"],
    bottoms: ["pajama pants", "sleep shorts", "lounge pants soft", "sleep pants"],
    shoes: ["slippers", "bedroom slippers", "soft slippers"],
    dresses: ["nightgown", "sleep dress", "nightie"],
  },
  work_from_home: {
    tops: ["nice top", "video-call friendly blouse", "comfortable but presentable top", "smart loungewear top"],
    bottoms: ["comfortable pants", "nice joggers", "presentable leggings", "comfortable jeans"],
    shoes: ["slippers", "comfortable flats", "house shoes"],
  },
  cozy_night: {
    tops: ["oversized sweater", "cozy hoodie", "soft tee", "fleece top", "warm sweater"],
    bottoms: ["soft joggers", "cozy leggings", "fleece pants", "warm sweatpants"],
    shoes: ["fuzzy slippers", "cozy socks", "warm slippers"],
  },
  sick_day: {
    tops: ["super soft tee", "comfortable hoodie", "cozy sweater", "pajama top"],
    bottoms: ["soft pants", "comfortable joggers", "pajama pants", "cozy leggings"],
    shoes: ["slippers", "soft socks"],
  },

  // ============================================================================
  // SEASONAL (8 occasions)
  // ============================================================================
  summer: {
    tops: ["tank top", "crop top", "linen top", "sleeveless blouse", "light tee", "off-shoulder top", "bralette", "halter top", "summer top", "breathable blouse", "light camisole"],
    bottoms: ["shorts", "linen pants", "flowy skirt", "mini skirt", "light joggers", "denim shorts", "summer pants", "light skirt", "breezy pants"],
    shoes: ["sandals", "espadrilles", "slides", "canvas sneakers", "strappy sandals", "summer flats", "light sneakers", "open-toe shoes"],
    dresses: ["sundress", "maxi dress", "mini dress", "slip dress", "linen dress", "summer dress", "flowy dress", "light dress"],
  },
  winter: {
    tops: ["sweater", "turtleneck", "knit top", "fleece", "wool sweater", "thermal top", "cardigan thick", "warm hoodie", "layering top", "chunky knit", "winter blouse"],
    bottoms: ["wool pants", "corduroy pants", "thick jeans", "warm leggings", "fleece pants", "winter trousers", "lined pants", "thermal leggings"],
    shoes: ["boots", "ankle boots", "winter boots", "leather boots", "suede boots", "warm sneakers", "shearling boots", "insulated boots", "snow boots"],
  },
  fall: {
    tops: ["sweater", "cardigan", "long sleeve top", "flannel", "lightweight jacket", "knit top", "fall blouse", "layering sweater", "cozy top"],
    bottoms: ["jeans", "corduroy pants", "trousers", "midi skirt", "leather pants", "fall pants", "warm trousers"],
    shoes: ["ankle boots", "loafers", "booties", "leather sneakers", "suede shoes", "fall boots", "chelsea boots"],
    dresses: ["sweater dress", "midi dress", "knit dress", "fall dress", "layered dress"],
  },
  spring: {
    tops: ["light sweater", "blouse", "long sleeve tee", "light cardigan", "denim jacket", "spring top", "transitional top", "light blouse"],
    bottoms: ["jeans", "light pants", "midi skirt", "cropped pants", "chinos", "spring trousers", "flowy pants"],
    shoes: ["loafers", "sneakers", "ballet flats", "low ankle boots", "canvas shoes", "spring flats", "light boots"],
    dresses: ["spring dress", "floral dress", "midi dress", "wrap dress", "transitional dress"],
  },
  rainy_day: {
    tops: ["waterproof jacket", "rain coat", "layering top", "moisture-wicking top"],
    bottoms: ["water-resistant pants", "quick-dry pants", "practical jeans"],
    shoes: ["rain boots", "waterproof boots", "water-resistant sneakers", "rubber boots"],
  },
  hot_weather: {
    tops: ["ultra-light top", "breathable tank", "moisture-wicking tee", "airy blouse", "minimal top"],
    bottoms: ["light shorts", "breathable pants", "flowy skirt", "minimal bottoms"],
    shoes: ["breathable sandals", "ventilated sneakers", "open shoes", "light slides"],
    dresses: ["minimal dress", "breathable dress", "airy sundress"],
  },
  cold_weather: {
    tops: ["heavy sweater", "insulated top", "thermal layer", "down vest", "warm fleece"],
    bottoms: ["insulated pants", "thermal leggings", "lined jeans", "heavy trousers"],
    shoes: ["insulated boots", "warm boots", "lined shoes", "thermal footwear"],
  },
  transitional: {
    tops: ["layering top", "light sweater", "versatile blouse", "easy cardigan"],
    bottoms: ["versatile pants", "jeans", "adaptable trousers"],
    shoes: ["versatile boots", "all-weather sneakers", "transitional flats"],
  },

  // ============================================================================
  // SPECIAL ACTIVITIES & EVENTS (20 occasions)
  // ============================================================================
  concert: {
    tops: ["band tee", "crop top", "edgy top", "leather jacket", "graphic tee", "statement top", "mesh top", "vintage tee", "rock tee"],
    bottoms: ["jeans", "leather pants", "shorts", "mini skirt", "high waist pants", "ripped jeans", "black jeans"],
    shoes: ["boots", "sneakers", "platform shoes", "ankle boots", "combat boots", "doc martens", "chunky boots"],
  },
  festival: {
    tops: ["crop top", "bikini top", "crochet top", "boho top", "fringe top", "tank top", "festival top", "glitter top", "bandeau"],
    bottoms: ["denim shorts", "mini skirt", "flowy pants", "fringe shorts", "boho skirt", "festival shorts", "high waist shorts"],
    shoes: ["boots", "ankle boots", "comfortable sandals", "flat boots", "western boots", "festival boots", "comfortable sneakers"],
  },
  club: {
    tops: ["crop top", "bodysuit", "sequin top", "mesh top", "halter top", "backless top", "sparkly top", "cut-out top"],
    bottoms: ["mini skirt", "leather pants", "bodycon skirt", "high waist shorts", "vinyl pants", "sparkly skirt"],
    shoes: ["heels", "platform heels", "stilettos", "strappy heels", "sparkly heels", "clear heels"],
    dresses: ["mini dress", "bodycon dress", "sparkly dress", "cut-out dress", "backless dress", "club dress"],
  },
  dinner: {
    tops: ["elegant blouse", "silk top", "dressy top", "nice sweater", "smart top", "dinner blouse"],
    bottoms: ["dress pants", "nice jeans", "midi skirt", "tailored trousers", "elegant pants"],
    shoes: ["heels", "loafers", "ankle boots", "dressy flats", "block heels", "elegant shoes"],
    dresses: ["midi dress", "wrap dress", "elegant dress", "knit dress dressy", "dinner dress"],
  },
  garden_party: {
    tops: ["floral blouse", "feminine top", "light cardigan", "elegant tank", "garden party top", "pretty blouse"],
    bottoms: ["midi skirt", "flowy pants", "wide leg trousers", "A-line skirt", "floral skirt"],
    shoes: ["wedges", "block heels", "elegant sandals", "espadrilles", "kitten heels", "garden party heels"],
    dresses: ["floral dress", "midi dress", "A-line dress", "tea dress", "wrap dress floral", "garden dress"],
  },
  picnic: {
    tops: ["casual blouse", "cotton top", "light sweater", "striped tee", "gingham top", "picnic top"],
    bottoms: ["jeans", "casual skirt", "shorts", "linen pants", "comfortable pants"],
    shoes: ["sandals", "sneakers", "flats", "espadrilles", "comfortable shoes"],
    dresses: ["sundress", "casual dress", "gingham dress", "shirt dress", "picnic dress"],
  },
  sports_game: {
    tops: ["team jersey", "casual tee", "team colors top", "sporty top", "fan tee", "comfortable top"],
    bottoms: ["jeans", "comfortable pants", "shorts", "joggers", "casual pants"],
    shoes: ["sneakers", "comfortable shoes", "athletic shoes", "casual sneakers"],
  },
  tailgate: {
    tops: ["team tee", "casual top", "sporty jacket", "fan gear top"],
    bottoms: ["jeans", "comfortable pants", "shorts"],
    shoes: ["comfortable sneakers", "boots", "casual shoes"],
  },
  museum: {
    tops: ["nice blouse", "smart casual top", "comfortable sweater", "elegant top"],
    bottoms: ["nice pants", "midi skirt", "comfortable trousers"],
    shoes: ["comfortable flats", "loafers", "low heels", "walking shoes"],
    dresses: ["comfortable dress", "midi dress", "smart casual dress"],
  },
  art_gallery: {
    tops: ["sophisticated top", "minimalist blouse", "artistic top", "elegant simple top"],
    bottoms: ["tailored pants", "wide leg trousers", "minimalist skirt"],
    shoes: ["elegant flats", "minimalist heels", "sophisticated loafers"],
    dresses: ["minimalist dress", "sophisticated dress", "artistic dress"],
  },
  book_club: {
    tops: ["cozy sweater", "nice blouse", "comfortable top", "smart casual top"],
    bottoms: ["comfortable pants", "nice jeans", "midi skirt"],
    shoes: ["comfortable flats", "loafers", "ankle boots"],
    dresses: ["comfortable dress", "casual elegant dress"],
  },
  happy_hour: {
    tops: ["nice blouse", "stylish top", "cute top", "dressy casual top"],
    bottoms: ["nice jeans", "tailored pants", "midi skirt", "leather pants"],
    shoes: ["heels", "ankle boots", "stylish flats", "block heels"],
    dresses: ["casual dress", "midi dress", "wrap dress"],
  },
  karaoke: {
    tops: ["fun top", "statement top", "sparkly top", "bold top"],
    bottoms: ["nice jeans", "leather pants", "fun skirt"],
    shoes: ["heels", "fun shoes", "statement boots"],
    dresses: ["fun dress", "sparkly dress", "bold dress"],
  },
  bowling: {
    tops: ["casual top", "comfortable tee", "retro top", "fun tee"],
    bottoms: ["jeans", "comfortable pants", "casual pants"],
    shoes: ["flat sneakers", "comfortable shoes", "bowling-friendly flats"],
  },
  movie_premiere: {
    tops: ["elegant top", "statement blouse", "dressy top", "sophisticated top"],
    bottoms: ["tailored pants", "elegant trousers", "midi skirt"],
    shoes: ["heels", "statement heels", "elegant pumps"],
    dresses: ["elegant dress", "statement dress", "red carpet dress"],
  },
  wine_bar: {
    tops: ["sophisticated blouse", "silk top", "elegant casual top"],
    bottoms: ["nice pants", "tailored trousers", "midi skirt"],
    shoes: ["elegant heels", "sophisticated flats", "ankle boots"],
    dresses: ["sophisticated dress", "elegant midi dress"],
  },
  jazz_club: {
    tops: ["elegant top", "vintage-inspired blouse", "sophisticated top", "silk blouse"],
    bottoms: ["tailored pants", "wide leg trousers", "elegant skirt"],
    shoes: ["elegant heels", "vintage-style shoes", "sophisticated flats"],
    dresses: ["elegant dress", "vintage-inspired dress", "sophisticated midi dress"],
  },
  photoshoot: {
    tops: ["photogenic top", "solid color blouse", "flattering top", "statement top"],
    bottoms: ["flattering pants", "photogenic skirt", "solid color pants"],
    shoes: ["stylish heels", "photogenic shoes", "statement shoes"],
    dresses: ["photogenic dress", "solid color dress", "flattering dress"],
  },
  job_fair: {
    tops: ["professional top", "smart blouse", "blazer casual", "approachable professional top"],
    bottoms: ["dress pants", "tailored pants", "professional skirt"],
    shoes: ["professional flats", "low heels", "loafers"],
    dresses: ["professional dress", "smart dress"],
  },
  networking_event: {
    tops: ["professional blouse", "smart top", "blazer", "confident top"],
    bottoms: ["dress pants", "tailored trousers", "professional skirt"],
    shoes: ["comfortable heels", "professional flats", "elegant loafers"],
    dresses: ["professional dress", "networking dress"],
  },

  // ============================================================================
  // NICHE CELEBRATIONS & LIFE EVENTS (25+ occasions)
  // ============================================================================
  bachelorette_party: {
    tops: ["sparkly top", "sequin top", "fun crop top", "party top", "matching group top", "bride squad top", "glitter top", "feather top", "pink top", "satin camisole", "bold statement top", "off-shoulder top party"],
    bottoms: ["mini skirt", "leather pants", "sparkly pants", "white pants", "hot pink skirt", "sequin skirt", "bodycon skirt", "tutu skirt", "fun shorts", "metallic pants"],
    shoes: ["strappy heels", "platform heels", "sparkly heels", "fun heels", "statement heels", "pink heels", "clear heels", "block heels party", "dancing heels"],
    dresses: ["mini dress", "sparkly dress", "white dress", "pink dress", "bodycon dress", "sequin dress", "feather dress", "fun party dress", "bachelorette dress", "bride dress casual"],
  },
  bachelor_party: {
    tops: ["casual button-up", "nice tee", "polo shirt casual", "fun graphic tee", "smart casual top"],
    bottoms: ["dark jeans", "chinos", "nice pants", "casual trousers"],
    shoes: ["loafers", "clean sneakers", "casual dress shoes", "boat shoes"],
  },
  gender_reveal: {
    tops: ["pastel blouse", "pink or blue top", "soft feminine top", "neutral elegant top", "flowing blouse", "cute casual top", "wrap top soft", "gentle floral top"],
    bottoms: ["white pants", "pastel skirt", "tailored pants light", "flowing pants", "midi skirt soft", "neutral trousers"],
    shoes: ["block heels", "elegant flats", "comfortable heels", "nude heels", "pastel flats", "wedges casual"],
    dresses: ["soft midi dress", "floral dress", "pastel dress", "wrap dress feminine", "A-line dress soft", "tea dress", "flowing dress", "garden party dress"],
  },
  housewarming: {
    tops: ["nice casual top", "elegant blouse casual", "smart sweater", "chic top", "relaxed blouse", "hostess top", "sophisticated casual top"],
    bottoms: ["nice jeans", "tailored pants casual", "comfortable trousers", "midi skirt casual", "chinos dressy"],
    shoes: ["comfortable flats", "loafers casual", "ankle boots low", "elegant flats", "block heels low"],
    dresses: ["casual elegant dress", "wrap dress", "midi dress comfortable", "shirt dress chic"],
  },
  retirement_party: {
    tops: ["elegant blouse", "sophisticated top", "silk blouse", "celebration top", "dressy casual top", "refined blouse"],
    bottoms: ["dress pants", "tailored trousers", "midi skirt elegant", "wide leg pants", "comfortable dress pants"],
    shoes: ["comfortable heels", "elegant flats", "block heels", "dressy loafers", "kitten heels"],
    dresses: ["elegant dress", "A-line dress", "midi dress sophisticated", "wrap dress dressy", "celebratory dress"],
  },
  promotion_celebration: {
    tops: ["celebratory blouse", "statement top", "silk top elegant", "power top", "confident blouse"],
    bottoms: ["tailored pants", "dress pants", "pencil skirt", "elegant trousers"],
    shoes: ["heels", "power heels", "elegant pumps", "statement heels"],
    dresses: ["power dress", "celebratory dress", "confident dress", "elegant midi dress"],
  },
  farewell_party: {
    tops: ["nice top", "memorable blouse", "elegant casual top", "photo-ready top"],
    bottoms: ["nice pants", "tailored trousers", "midi skirt", "dressy jeans"],
    shoes: ["comfortable heels", "elegant flats", "block heels"],
    dresses: ["memorable dress", "nice midi dress", "photo-ready dress"],
  },
  housewarming_host: {
    tops: ["chic hostess top", "elegant comfortable top", "sophisticated blouse", "welcoming top"],
    bottoms: ["comfortable elegant pants", "nice jeans", "flowing pants"],
    shoes: ["comfortable elegant flats", "low heels", "stylish slippers"],
    dresses: ["hostess dress", "comfortable chic dress", "elegant casual dress"],
  },
  potluck: {
    tops: ["casual nice top", "comfortable blouse", "friendly top", "approachable blouse"],
    bottoms: ["comfortable pants", "nice jeans", "casual skirt"],
    shoes: ["comfortable flats", "casual sneakers nice", "loafers"],
    dresses: ["casual comfortable dress", "friendly dress"],
  },
  game_night: {
    tops: ["comfortable fun top", "casual tee", "cozy sweater", "relaxed top"],
    bottoms: ["comfortable jeans", "joggers nice", "casual pants", "leggings casual"],
    shoes: ["comfortable sneakers", "slippers stylish", "flats casual"],
  },
  movie_night: {
    tops: ["cozy sweater", "soft tee", "comfortable hoodie", "relaxed top"],
    bottoms: ["comfortable pants", "soft joggers", "nice leggings", "comfortable jeans"],
    shoes: ["cozy slippers", "comfortable flats", "soft sneakers"],
  },
  holiday_party: {
    tops: ["festive top", "sparkly holiday top", "velvet blouse", "red top", "green top", "sequin holiday top", "elegant festive top", "metallic top"],
    bottoms: ["velvet pants", "dressy pants", "festive skirt", "holiday skirt", "sparkly pants"],
    shoes: ["festive heels", "sparkly heels", "velvet heels", "holiday pumps", "elegant boots"],
    dresses: ["holiday dress", "festive dress", "velvet dress", "sparkly dress", "red dress", "green dress", "cocktail dress holiday"],
  },
  christmas_party: {
    tops: ["red blouse", "green top", "sparkly top", "velvet top", "festive sweater", "holiday blouse", "sequin top subtle"],
    bottoms: ["velvet pants", "red pants", "sparkly skirt", "elegant trousers", "festive skirt"],
    shoes: ["red heels", "velvet heels", "sparkly heels", "gold heels", "festive pumps"],
    dresses: ["red dress", "velvet dress", "sparkly dress", "green dress", "holiday cocktail dress", "christmas dress"],
  },
  new_years_eve: {
    tops: ["sequin top", "sparkly top", "metallic top", "glitter top", "statement top", "bold top", "champagne colored top", "gold top", "silver top"],
    bottoms: ["sequin pants", "metallic pants", "sparkly skirt", "leather pants", "velvet pants", "glamorous pants"],
    shoes: ["stilettos", "sparkly heels", "gold heels", "silver heels", "statement heels", "platform heels glam"],
    dresses: ["sequin dress", "sparkly dress", "metallic dress", "glamorous dress", "champagne dress", "gold dress", "silver dress", "mini dress party", "bodycon dress sparkly"],
  },
  halloween_party: {
    tops: ["costume top", "black top", "orange top", "spooky top", "themed top", "fun costume piece"],
    bottoms: ["black pants", "costume bottoms", "themed skirt", "fun costume pants"],
    shoes: ["costume shoes", "black boots", "fun themed shoes", "comfortable party shoes"],
    dresses: ["costume dress", "black dress", "themed dress", "halloween dress"],
  },
  thanksgiving: {
    tops: ["cozy sweater", "warm blouse", "autumnal top", "elegant comfortable top", "fall colored top", "burnt orange top", "burgundy top"],
    bottoms: ["comfortable pants", "nice jeans", "corduroy pants", "fall trousers", "stretch pants dressy"],
    shoes: ["comfortable boots", "ankle boots", "elegant flats", "loafers"],
    dresses: ["fall dress", "sweater dress", "comfortable elegant dress", "autumnal dress"],
  },
  easter: {
    tops: ["pastel blouse", "spring top", "floral top", "soft feminine blouse", "light cardigan", "pretty top"],
    bottoms: ["pastel pants", "white pants", "spring skirt", "floral skirt", "light trousers"],
    shoes: ["spring flats", "pastel heels", "elegant sandals", "kitten heels"],
    dresses: ["pastel dress", "floral dress", "spring dress", "easter dress", "A-line dress spring"],
  },
  fourth_of_july: {
    tops: ["red top", "white top", "blue top", "patriotic top", "striped top", "star print top", "americana top"],
    bottoms: ["denim shorts", "white shorts", "blue jeans", "red pants", "patriotic skirt"],
    shoes: ["casual sandals", "comfortable sneakers", "espadrilles", "patriotic shoes"],
    dresses: ["red white blue dress", "patriotic dress", "americana dress", "casual summer dress"],
  },
  valentines_day: {
    tops: ["red blouse", "pink top", "romantic top", "lace top", "heart print top", "silk top red", "feminine blouse"],
    bottoms: ["nice jeans", "red pants", "pink skirt", "romantic skirt", "tailored pants"],
    shoes: ["red heels", "pink heels", "romantic heels", "strappy sandals"],
    dresses: ["red dress", "pink dress", "romantic dress", "lace dress", "bodycon dress red", "wrap dress romantic"],
  },
  mothers_day: {
    tops: ["elegant blouse", "feminine top", "soft blouse", "floral top", "pretty blouse", "sophisticated top"],
    bottoms: ["tailored pants", "midi skirt", "elegant trousers", "flowing pants"],
    shoes: ["elegant flats", "comfortable heels", "block heels", "pretty pumps"],
    dresses: ["elegant dress", "floral dress", "midi dress pretty", "wrap dress elegant", "tea dress"],
  },
  fathers_day: {
    tops: ["smart casual top", "nice blouse", "comfortable elegant top"],
    bottoms: ["nice pants", "comfortable trousers", "casual dressy pants"],
    shoes: ["comfortable flats", "loafers", "elegant casual shoes"],
    dresses: ["casual elegant dress", "comfortable nice dress"],
  },
  memorial_day: {
    tops: ["patriotic top", "red white blue top", "casual summer top", "americana blouse"],
    bottoms: ["white shorts", "denim shorts", "casual pants", "patriotic bottoms"],
    shoes: ["casual sandals", "sneakers", "espadrilles"],
    dresses: ["casual summer dress", "patriotic dress", "bbq dress"],
  },
  labor_day: {
    tops: ["end of summer top", "casual nice top", "transitional top", "last hurrah summer top"],
    bottoms: ["white pants last wear", "summer shorts", "casual pants"],
    shoes: ["summer sandals", "casual sneakers", "transitional flats"],
    dresses: ["end of summer dress", "casual dress", "transitional dress"],
  },
  super_bowl: {
    tops: ["team colors top", "sporty casual top", "comfortable tee", "jersey casual", "game day top"],
    bottoms: ["comfortable jeans", "joggers", "casual pants", "team colors bottoms"],
    shoes: ["comfortable sneakers", "casual shoes", "flat boots"],
  },
  wine_tasting: {
    tops: ["sophisticated blouse", "elegant casual top", "silk top", "refined blouse", "wine country top"],
    bottoms: ["tailored pants", "nice jeans dark", "midi skirt", "elegant trousers"],
    shoes: ["comfortable heels", "elegant flats", "ankle boots sophisticated", "block heels"],
    dresses: ["sophisticated dress", "wine country dress", "elegant casual dress", "midi dress refined"],
  },
  brewery_tour: {
    tops: ["casual nice top", "comfortable blouse", "relaxed top", "cute casual top"],
    bottoms: ["comfortable jeans", "casual pants", "nice shorts"],
    shoes: ["comfortable sneakers", "casual boots", "walking flats"],
  },
  spa_day: {
    tops: ["comfortable wrap top", "soft cardigan", "relaxed blouse", "post-spa top", "easy pullover"],
    bottoms: ["comfortable pants", "soft joggers", "easy leggings", "relaxed pants"],
    shoes: ["comfortable slides", "slip-on flats", "easy sneakers"],
    dresses: ["comfortable wrap dress", "easy dress", "relaxed dress"],
  },
  nail_appointment: {
    tops: ["easy on off top", "button-front blouse", "pullover easy", "comfortable top"],
    bottoms: ["comfortable pants", "easy bottoms", "relaxed pants"],
    shoes: ["open-toe sandals", "flip flops nice", "easy slides"],
  },
  hair_appointment: {
    tops: ["button-front top", "easy zip top", "comfortable blouse"],
    bottoms: ["comfortable pants", "nice jeans", "casual skirt"],
    shoes: ["comfortable flats", "casual sneakers"],
  },
  doctors_appointment: {
    tops: ["easy access top", "comfortable blouse", "button-front shirt", "practical top"],
    bottoms: ["comfortable pants", "easy pull-on pants", "practical bottoms"],
    shoes: ["easy on off shoes", "comfortable flats", "slip-on sneakers"],
  },
  class_reunion: {
    tops: ["impressive blouse", "elegant top", "statement top", "confident blouse", "sophisticated top", "success top"],
    bottoms: ["tailored pants", "elegant trousers", "impressive skirt", "confident pants"],
    shoes: ["heels", "statement heels", "elegant pumps", "power shoes"],
    dresses: ["impressive dress", "elegant dress", "statement dress", "success dress", "confident midi dress"],
  },
  family_reunion: {
    tops: ["nice casual top", "comfortable blouse", "photo-ready top", "approachable elegant top"],
    bottoms: ["nice jeans", "comfortable pants", "casual dressy pants", "photo-ready pants"],
    shoes: ["comfortable flats", "low heels", "casual ankle boots", "walking comfortable"],
    dresses: ["casual elegant dress", "family photo dress", "comfortable nice dress", "flattering dress"],
  },
  school_event: {
    tops: ["appropriate blouse", "smart casual top", "parent-friendly top", "polished casual top"],
    bottoms: ["nice pants", "tailored casual pants", "appropriate skirt", "modest pants"],
    shoes: ["comfortable flats", "low heels", "appropriate shoes", "walking shoes nice"],
    dresses: ["appropriate dress", "modest dress", "parent-friendly dress", "smart casual dress"],
  },
  pta_meeting: {
    tops: ["approachable blouse", "smart casual top", "friendly professional top"],
    bottoms: ["nice pants", "comfortable trousers", "casual professional pants"],
    shoes: ["comfortable flats", "low heels", "loafers casual"],
    dresses: ["approachable dress", "casual professional dress"],
  },
  kids_birthday: {
    tops: ["comfortable fun top", "practical nice top", "activity-ready blouse", "casual cute top"],
    bottoms: ["comfortable pants", "practical jeans", "activity-ready pants"],
    shoes: ["comfortable sneakers", "practical flats", "activity shoes"],
    dresses: ["comfortable dress", "practical dress", "activity-ready dress"],
  },
  carnival: {
    tops: ["fun bright top", "comfortable colorful top", "casual festival top", "playful top"],
    bottoms: ["comfortable shorts", "casual jeans", "fun pants", "practical bottoms"],
    shoes: ["comfortable sneakers", "practical walking shoes", "fun flats"],
    dresses: ["fun casual dress", "colorful dress", "practical dress"],
  },
  amusement_park: {
    tops: ["comfortable practical top", "breathable tee", "activity-ready top", "casual fun top"],
    bottoms: ["comfortable shorts", "practical pants", "athletic casual bottoms", "walking pants"],
    shoes: ["comfortable sneakers", "walking shoes", "supportive sneakers", "practical athletic shoes"],
  },
  zoo: {
    tops: ["comfortable walking top", "breathable casual top", "practical tee", "outdoor casual top"],
    bottoms: ["comfortable pants", "walking shorts", "practical jeans", "outdoor pants"],
    shoes: ["walking sneakers", "comfortable shoes", "practical flats", "outdoor walking shoes"],
  },
  aquarium: {
    tops: ["casual nice top", "comfortable blouse", "practical top", "walking-friendly top"],
    bottoms: ["comfortable pants", "nice jeans", "practical bottoms"],
    shoes: ["comfortable walking flats", "sneakers nice", "practical shoes"],
    dresses: ["comfortable walking dress", "practical dress"],
  },
  cooking_class: {
    tops: ["practical blouse", "comfortable top apron-friendly", "easy movement top", "casual nice top"],
    bottoms: ["comfortable pants", "practical jeans", "easy movement bottoms"],
    shoes: ["closed-toe comfortable", "practical flats", "standing comfortable shoes"],
  },
  art_class: {
    tops: ["creative comfortable top", "artistic casual top", "practical artsy top", "easy movement blouse"],
    bottoms: ["comfortable pants", "practical creative pants", "easy movement bottoms"],
    shoes: ["comfortable creative flats", "practical shoes", "standing comfortable"],
  },
  pottery_class: {
    tops: ["practical clay-friendly top", "comfortable creative top", "easy wash top", "artistic casual top"],
    bottoms: ["practical pants", "easy clean bottoms", "comfortable creative pants"],
    shoes: ["closed-toe practical", "easy clean shoes", "standing comfortable"],
  },
}

// ============================================================================
// STYLE MODIFIERS (Enhanced)
// ============================================================================
const STYLE_PRODUCT_MODIFIERS = {
  minimalist: {
    adjectives: ["clean", "simple", "solid", "structured", "tailored", "classic", "understated", "refined", "sleek", "monochrome"],
    avoid: ["sequin", "glitter", "embellished", "fringe", "bold print", "logo", "flashy"],
  },
  bohemian: {
    adjectives: ["flowy", "relaxed", "textured", "layered", "vintage", "embroidered", "crochet", "fringe", "earthy", "artistic", "free-spirited"],
    avoid: ["structured", "formal", "corporate", "sleek", "minimal"],
  },
  edgy: {
    adjectives: ["leather", "bold", "asymmetric", "statement", "unique", "studded", "distressed", "dark", "punk", "avant-garde", "unconventional"],
    avoid: ["delicate", "feminine", "soft", "pastel", "conservative"],
  },
  classic: {
    adjectives: ["timeless", "tailored", "polished", "refined", "elegant", "sophisticated", "traditional", "quality", "enduring"],
    avoid: ["trendy", "avant-garde", "bold", "flashy", "experimental"],
  },
  romantic: {
    adjectives: ["soft", "feminine", "delicate", "flowy", "lace", "ruffle", "graceful", "pretty", "dreamy", "ethereal"],
    avoid: ["edgy", "structured", "bold", "dark", "harsh"],
  },
  sporty: {
    adjectives: ["athletic", "comfortable", "functional", "active", "performance", "breathable", "dynamic", "energetic"],
    avoid: ["formal", "delicate", "restrictive", "dressy"],
  },
  trendy: {
    adjectives: ["fashion-forward", "modern", "stylish", "contemporary", "on-trend", "current", "fresh", "now"],
    avoid: ["outdated", "classic", "traditional", "conservative"],
  },
  nordic: {
    adjectives: ["minimal", "functional", "clean", "neutral", "quality", "simple", "understated", "scandinavian", "muted"],
    avoid: ["bold", "flashy", "ornate", "excessive", "loud"],
  },
  preppy: {
    adjectives: ["classic", "polished", "tailored", "collegiate", "smart", "clean-cut", "refined", "traditional"],
    avoid: ["edgy", "bohemian", "casual", "distressed"],
  },
  streetwear: {
    adjectives: ["urban", "oversized", "graphic", "casual", "statement", "logo", "bold", "comfortable", "modern"],
    avoid: ["formal", "delicate", "structured", "conservative"],
  },
  athleisure: {
    adjectives: ["sporty", "comfortable", "versatile", "sleek", "performance", "stretch", "modern", "casual-chic"],
    avoid: ["formal", "structured", "delicate", "dressy"],
  },
  glamorous: {
    adjectives: ["sparkly", "luxurious", "elegant", "statement", "bold", "shiny", "dramatic", "eye-catching"],
    avoid: ["casual", "simple", "understated", "plain"],
  },
  vintage: {
    adjectives: ["retro", "classic", "timeless", "nostalgic", "old-school", "antique", "heritage"],
    avoid: ["modern", "contemporary", "futuristic", "minimal"],
  },
  grunge: {
    adjectives: ["distressed", "oversized", "dark", "layered", "worn", "plaid", "ripped"],
    avoid: ["polished", "refined", "elegant", "feminine"],
  },
  boho_chic: {
    adjectives: ["flowy", "layered", "eclectic", "artistic", "natural", "textured", "mixed prints"],
    avoid: ["structured", "corporate", "minimal", "uniform"],
  },
  parisian: {
    adjectives: ["effortless", "chic", "understated", "elegant", "refined", "timeless", "sophisticated"],
    avoid: ["overdone", "flashy", "loud", "excessive"],
  },
  coastal: {
    adjectives: ["breezy", "light", "natural", "relaxed", "fresh", "nautical", "airy"],
    avoid: ["heavy", "dark", "formal", "structured"],
  },
  cottagecore: {
    adjectives: ["romantic", "floral", "pastoral", "soft", "vintage", "feminine", "natural"],
    avoid: ["modern", "edgy", "dark", "urban"],
  },
  dark_academia: {
    adjectives: ["scholarly", "vintage", "muted", "layered", "intellectual", "classic", "earthy"],
    avoid: ["bright", "sporty", "casual", "modern"],
  },
  y2k: {
    adjectives: ["nostalgic", "bold", "playful", "sparkly", "low-rise", "crop", "colorful"],
    avoid: ["minimalist", "classic", "conservative", "subtle"],
  },
}

/**
 * ✅ IMPROVED: Build semantic query using PRODUCT TYPES + COLOR ENHANCEMENT
 * This is the core of the new search strategy
 */
function buildSemanticQuery(query, occasion, category, style = null, userColors = null) {
  // Get product types for this occasion and category
  const occasionMapping = OCCASION_PRODUCT_MAPPING[occasion] || OCCASION_PRODUCT_MAPPING.everyday
  const productTypes = occasionMapping[category] || []
  
  // Get style rules for fabric/shoe constraints
  const styleKey = (style || "casual").toLowerCase()
  const fabricRules = AI_STYLE_FABRIC_RULES[styleKey] || AI_STYLE_FABRIC_RULES.casual
  const shoeRules = AI_STYLE_SHOE_RULES[styleKey] || AI_STYLE_SHOE_RULES.casual
  
  // Extract colors - prioritize user colors
  let primaryColor = "black"
  let secondaryColor = "white"
  if (userColors) {
    if (Array.isArray(userColors)) {
      primaryColor = userColors[0]?.name || userColors[0] || "black"
      secondaryColor = userColors[1]?.name || userColors[1] || primaryColor
    } else if (userColors[category]) {
      const catColors = userColors[category]
      primaryColor = catColors[0]?.name || catColors[0] || "black"
      secondaryColor = catColors[1]?.name || catColors[1] || primaryColor
    }
  }
  
  // Get allowed fabrics and shoe types from rules
  const allowedFabrics = fabricRules.allow.split(",").slice(0, 2).map(f => f.trim())
  const allowedShoes = shoeRules.allow.split(",").slice(0, 3).map(s => s.trim())
  
  // Get top product types for this occasion/category
  const topProductTypes = productTypes.slice(0, 3)
  
  // Build ASOS-style query pattern: "[Color] [Modifier] [Fabric] [Item] in [Color]"
  // Example: "black cotton relaxed t-shirt in black comfortable casual"
  let semanticQuery = ""
  
  if (category === "shoes") {
    // Shoe query: "[Color] [Style] [ShoeType] [Color] [Occasion keywords]"
    semanticQuery = `${primaryColor} ${allowedShoes[0]} ${allowedShoes[1] || ""} ${primaryColor} ${topProductTypes.join(" ")} ${secondaryColor} comfortable`
  } else if (category === "tops" || category === "top") {
    // Top query: "[Color] [Fabric] [ProductType] in [Color] [Style modifiers]"
    semanticQuery = `${primaryColor} ${allowedFabrics[0]} ${topProductTypes[0] || "top"} in ${primaryColor} ${topProductTypes.slice(1).join(" ")} ${secondaryColor} ${allowedFabrics[1] || ""}`
  } else if (category === "bottoms" || category === "bottom") {
    // Bottom query: "[Color] [Fabric] [ProductType] in [Color] [Fit modifiers]"
    semanticQuery = `${primaryColor} ${allowedFabrics[0]} ${topProductTypes[0] || "pants"} in ${primaryColor} ${topProductTypes.slice(1).join(" ")} ${secondaryColor}`
  } else if (category === "dresses" || category === "dress") {
    // Dress query: "[Color] [Fabric] [DressType] in [Color]"
    semanticQuery = `${primaryColor} ${allowedFabrics[0]} ${topProductTypes[0] || "dress"} in ${primaryColor} ${topProductTypes.slice(1).join(" ")} ${secondaryColor}`
  } else {
    // Generic fallback
    semanticQuery = `${primaryColor} ${topProductTypes.join(" ")} ${category} in ${primaryColor} ${allowedFabrics[0]} ${secondaryColor}`
  }
  
  // Add color weighting (5x/3x/1x) - inject primary color heavily
  const colorWeight = `${primaryColor} ${primaryColor} ${primaryColor} ${primaryColor} ${primaryColor} ${secondaryColor} ${secondaryColor} ${secondaryColor}`
  semanticQuery = `${colorWeight} ${semanticQuery} ${primaryColor} ${secondaryColor}`
  
  // Append original query if provided (may contain additional context)
  if (query && query.trim() && query !== semanticQuery) {
    semanticQuery = `${semanticQuery} ${query}`
  }
  
  console.log(`   🎯 ASOS-style query: occasion="${occasion}" style="${styleKey}"`)
  console.log(`   📦 Product types: [${topProductTypes.join(', ')}]`)
  console.log(`   👗 Fabrics: [${allowedFabrics.join(', ')}]`)
  console.log(`   👟 Shoes: [${allowedShoes.join(', ')}]`)
  console.log(`   🎨 Colors: primary="${primaryColor}" secondary="${secondaryColor}"`)
  
  return semanticQuery.trim()
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
 * MAIN SEARCH ENDPOINT (V5 - AI ENHANCED)
 * ✅ KEY CHANGES:
 * - Accepts full quiz profile data OR simple query
 * - Generates AI-powered ASOS-style queries internally
 * - Applies fabric + shoe style rules
 * - Single endpoint handles everything
 */
app.post("/api/search", async (req, res) => {
  try {
    const {
      // Simple mode (backwards compatible)
      query = null,
      // V5: Full profile mode
      profile = null,
      // Common params
      limit = 80,
      category = "general",
      occasion = "everyday",
      priceRange = null,
      totalBudget = null,
      style = null,
      mood = null,
      userColors = null,  // Array of color names OR full allowedColors object
    } = req.body

    console.log(`\n🔍 VECTOR SEARCH V5 (AI Enhanced):`)
    console.log(`   Category: ${category}`)
    console.log(`   Occasion: ${occasion}`)
    if (style) console.log(`   Style: ${style}`)
    if (mood) console.log(`   Mood: ${mood}`)
    console.log(`   Limit: ${limit}`)
    
    let finalQuery = query
    
    // V5: If profile data provided, generate AI query
    if (profile || (style && userColors)) {
      console.log(`   🤖 AI Query Mode: Generating optimized query...`)
      
      // Extract color names for this category
      let categoryColors = []
      if (userColors) {
        if (Array.isArray(userColors) && typeof userColors[0] === 'string') {
          // Simple array of color names
          categoryColors = userColors
        } else if (userColors[category]) {
          // Full allowedColors object with category keys
          categoryColors = userColors[category].map(c => c.name || c).filter(Boolean)
        } else if (userColors.top || userColors.tops) {
          // Alternate key format
          const catKey = category === 'tops' ? 'top' : category === 'bottoms' ? 'bottom' : category
          categoryColors = (userColors[catKey] || []).map(c => c.name || c).filter(Boolean)
        }
      }
      
      if (categoryColors.length > 0) {
        console.log(`   🎨 Category colors: ${categoryColors.slice(0, 4).join(', ')}`)
      }
      
      // Get style rules
      const styleKey = (style || "casual").toLowerCase()
      const shoeRules = AI_STYLE_SHOE_RULES[styleKey] || AI_STYLE_SHOE_RULES.casual
      const fabricRules = AI_STYLE_FABRIC_RULES[styleKey] || AI_STYLE_FABRIC_RULES.casual
      
      // Build AI-optimized query based on ASOS title pattern:
      // "[fit] [fabric] [item] in [color]"
      const primaryColor = categoryColors[0] || "black"
      const secondaryColor = categoryColors[1] || primaryColor
      
      // Get occasion-specific product types
      const occasionKey = (occasion || "everyday").toLowerCase()
      const occasionConfig = OCCASION_PRODUCT_MAPPING[occasionKey] || OCCASION_PRODUCT_MAPPING.everyday
      const productTypes = occasionConfig[category]?.slice(0, 3) || []
      
      // Get style adjectives
      const styleConfig = STYLE_PRODUCT_MODIFIERS[styleKey] || STYLE_PRODUCT_MODIFIERS.casual
      const styleAdj = styleConfig?.adjectives?.slice(0, 2) || ["comfortable"]
      
      // Get allowed fabrics
      const allowedFabrics = fabricRules.allow.split(",").slice(0, 2).map(f => f.trim())
      
      // Build ASOS-style query
      if (category === "shoes") {
        const allowedShoes = shoeRules.allow.split(",").slice(0, 2).map(s => s.trim())
        finalQuery = `${primaryColor} ${styleAdj[0]} ${allowedShoes.join(" ")} in ${primaryColor} ${secondaryColor} ${productTypes.join(" ")} ${primaryColor}`
      } else {
        finalQuery = `${primaryColor} ${styleAdj[0]} ${allowedFabrics[0]} ${productTypes[0] || category} in ${primaryColor} ${styleAdj.join(" ")} ${secondaryColor} ${productTypes.join(" ")} ${primaryColor}`
      }
      
      console.log(`   📝 AI Query: "${finalQuery.substring(0, 80)}..."`)
      
      // Add weighted color injection (5x/3x/1x)
      if (categoryColors.length > 0) {
        const colorPrefix = categoryColors.slice(0, 3).join(" ")
        const weighted = []
        categoryColors.slice(0, 3).forEach((c, i) => {
          const weight = [5, 3, 1][i] || 1
          for (let j = 0; j < weight; j++) weighted.push(c)
        })
        finalQuery = `${colorPrefix} ${weighted.join(" ")} ${finalQuery} ${categoryColors.slice(0, 2).join(" ")}`
        console.log(`   🎨 Color-enhanced query length: ${finalQuery.length} chars`)
      }
    }
    
    if (!finalQuery) {
      return res.status(400).json({
        success: false,
        error: "Query or profile data is required",
      })
    }

    // Build semantic query with occasion/style context
    const semanticQuery = buildSemanticQuery(finalQuery, occasion, category, style, userColors)
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
        query: semanticQuery,  // ✅ FIXED: Use semanticQuery, not null query
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
        .withHybrid({ query: semanticQuery, alpha: 0.7 })  // ✅ FIXED
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
          .withHybrid({ query: semanticQuery, alpha: 0.7 })  // ✅ FIXED
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
            .withHybrid({ query: semanticQuery, alpha: 0.7 })  // ✅ FIXED
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

    // ✅ UPDATED: Pass user colors to diversity scoring
    products = calculateDiversityScore(products, userColors)
    console.log(`   ✓ Diversity scoring applied (with color matching)`)

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

            // ✅ IMPROVED v3: Extract color and add to embedding (prefix + suffix)
            const extractedColor = extractProductColor(name, desc)
            const colorText = extractedColor?.normalized || ''
            
            // ✅ CRITICAL: Build embedding with COLOR PREFIX + SUFFIX for semantic matching
            // Format: [color] [product details] [color] - double mention boosts color signal in vector space
            const embeddingText = `${colorText} ${name}. ${desc}. Main category: ${category}. ${subcategory ? `Product type: ${subcategory} ${category}.` : ''} Color: ${colorText}. Heel height: ${heelType}. Material: ${extractMaterials(product.materials || product.materials_description || desc)}. Neckline: ${extractNeckline(name, desc)}. Sleeve: ${extractSleeveType(name, desc)}. Pattern: ${extractPattern(name, desc)}. Fit: ${extractFit(name, desc)}. Cut: ${heelType}. Suitable for: ${occasions.join(", ")}. Formality: ${formalityLevel}. Occasion emphasis: ${occasionBoost[primaryOccasion]} ${primaryOccasion}. Heel type: ${heelType}. ${colorText}`

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
// AI QUERY GENERATION (V5)
// ============================================================================

// ASOS title examples for AI context
const ASOS_TITLE_EXAMPLES = {
  tops: [
    "ASOS DESIGN oversized t-shirt in black",
    "ASOS DESIGN slim fit shirt in white cotton",
    "ASOS DESIGN relaxed fit knit sweater in cream",
    "ASOS DESIGN wrap front blouse in red",
    "ASOS DESIGN muscle fit polo in navy"
  ],
  bottoms: [
    "ASOS DESIGN high waisted wide leg jeans in blue wash",
    "ASOS DESIGN tailored trousers in black",
    "ASOS DESIGN pleated midi skirt in cream",
    "ASOS DESIGN slim fit chinos in khaki",
    "ASOS DESIGN relaxed cargo pants in olive"
  ],
  shoes: [
    "ASOS DESIGN chunky sole sneakers in white",
    "ASOS DESIGN strappy heeled sandals in black",
    "ASOS DESIGN leather loafers in tan",
    "ASOS DESIGN pointed court shoes in nude",
    "ASOS DESIGN ankle boots with block heel in black"
  ]
}

// Style → shoe type mapping for AI enforcement
const AI_STYLE_SHOE_RULES = {
  casual: { allow: "sneaker, flat, loafer, sandal, slip-on, slipper", forbid: "heel, stiletto, pump" },
  sporty: { allow: "sneaker, trainer, athletic, running", forbid: "heel, stiletto, pump, oxford, loafer" },
  elegant: { allow: "heel, pump, stiletto, oxford, loafer", forbid: "sneaker, trainer, athletic, slipper" },
  romantic: { allow: "heel, strappy sandal, ballet flat, kitten heel", forbid: "sneaker, combat boot, chunky, slipper" },
  minimalist: { allow: "flat, loafer, sneaker, mule, slip-on, slipper", forbid: "embellished, sparkle, chunky platform" },
  bohemian: { allow: "sandal, flat, espadrille, ankle boot", forbid: "stiletto, formal pump, athletic" },
  edgy: { allow: "boot, combat, platform, chunky, ankle boot", forbid: "ballet, delicate, kitten heel, slipper" },
  glamorous: { allow: "stiletto, platform, embellished, statement", forbid: "sneaker, athletic, loafer, slipper" },
  classic: { allow: "pump, loafer, oxford, ballet flat", forbid: "athletic, flip flop, chunky sneaker, slipper" },
  preppy: { allow: "loafer, oxford, ballet flat, boat shoe", forbid: "stiletto, platform, combat, slipper" },
  nordic: { allow: "boot, loafer, flat, sneaker minimal, ankle boot, wool slipper", forbid: "stiletto, embellished, flashy platform" },
  modern: { allow: "loafer, mule, flat, ankle boot, sleek sneaker", forbid: "chunky platform, overly embellished, flip flop" },
  // HOME & COMFORT STYLES
  home: { allow: "slipper, house shoe, slide, cozy slipper, indoor shoe", forbid: "heel, stiletto, formal, outdoor boot" },
  lounge: { allow: "slipper, soft slide, cozy slipper, house shoe", forbid: "heel, formal, outdoor, athletic" },
  cozy: { allow: "slipper, ugg, fuzzy slide, house shoe, soft boot", forbid: "heel, stiletto, formal pump" }
}

// ============================================================================
// STYLE → FABRIC/MATERIAL RULES (V5.1)
// Prevents casual styles from returning satin, silk, velvet, etc.
// ============================================================================
const AI_STYLE_FABRIC_RULES = {
  casual: { 
    allow: "cotton, jersey, denim, canvas, linen, fleece, knit, chambray, terry, twill",
    forbid: "satin, silk, velvet, sequin, lace, chiffon, organza, brocade, taffeta, lamé, mesh evening"
  },
  sporty: { 
    allow: "jersey, mesh, nylon, lycra, performance, technical, stretch, fleece, cotton",
    forbid: "satin, silk, velvet, sequin, lace, chiffon, organza, leather, wool"
  },
  elegant: { 
    allow: "satin, silk, velvet, chiffon, lace, crepe, wool, cashmere, tweed, organza",
    forbid: "jersey, fleece, denim, canvas, nylon, athletic mesh"
  },
  romantic: { 
    allow: "lace, chiffon, silk, organza, tulle, voile, satin, eyelet, broderie",
    forbid: "denim, canvas, nylon, fleece, leather, athletic mesh"
  },
  minimalist: { 
    allow: "cotton, linen, wool, cashmere, silk, jersey, crepe",
    forbid: "sequin, glitter, embellished, brocade, lace, tulle, velvet"
  },
  bohemian: { 
    allow: "cotton, linen, crochet, embroidered, fringe, suede, leather, gauze, cheesecloth",
    forbid: "satin formal, sequin, nylon athletic, lycra"
  },
  edgy: { 
    allow: "leather, denim, mesh, vinyl, studded, distressed, coated, patent",
    forbid: "lace delicate, chiffon, tulle, pastel silk, eyelet"
  },
  glamorous: { 
    allow: "sequin, satin, silk, velvet, metallic, lamé, beaded, crystal, sparkle",
    forbid: "cotton casual, denim, fleece, jersey, canvas"
  },
  classic: { 
    allow: "cotton, wool, cashmere, silk, linen, tweed, leather, suede",
    forbid: "sequin, glitter, mesh athletic, nylon sporty"
  },
  preppy: { 
    allow: "cotton, oxford cloth, cable knit, wool, seersucker, madras, piqué",
    forbid: "sequin, glitter, mesh, vinyl, distressed, ripped"
  },
  nordic: { 
    allow: "wool, cashmere, cotton, linen, knit, fleece, canvas",
    forbid: "sequin, glitter, satin, velvet flashy, mesh"
  },
  modern: { 
    allow: "cotton, wool, silk, leather, cashmere, crepe, structured fabrics",
    forbid: "sequin, glitter, fringe, overly embellished"
  },
  // HOME & COMFORT STYLES
  home: { 
    allow: "cotton, fleece, jersey, soft knit, plush, terry, flannel, modal",
    forbid: "silk formal, sequin, leather, structured, stiff fabrics"
  },
  lounge: { 
    allow: "soft cotton, modal, jersey, cashmere, bamboo, fleece, brushed fabric",
    forbid: "structured, formal, sequin, stiff, scratchy"
  },
  cozy: { 
    allow: "fleece, sherpa, plush, soft knit, fuzzy, teddy, chenille, waffle knit",
    forbid: "structured, formal, silk dressy, leather"
  }
}

/**
 * AI Query Generation Endpoint (V5)
 * Uses OpenAI to generate ASOS-style search queries from quiz data
 */
app.post("/api/generate-ai-queries", async (req, res) => {
  console.log("\n🤖 ========================================")
  console.log("🤖 AI QUERY GENERATION - V5")
  console.log("🤖 ========================================")
  
  try {
    const { style, occasion, mood, colors, bodyType, priceRange } = req.body
    
    console.log(`   Style: ${style || 'not set'}`)
    console.log(`   Occasion: ${occasion || 'not set'}`)
    console.log(`   Mood: ${mood || 'not set'}`)
    
    // Extract color names for each category
    const topColors = colors?.tops?.map(c => c.name).join(", ") || "black, white"
    const bottomColors = colors?.bottoms?.map(c => c.name).join(", ") || "black, navy"
    const shoeColors = colors?.shoes?.map(c => c.name).join(", ") || "black, tan"
    
    console.log(`   🎨 Top colors: ${topColors}`)
    console.log(`   🎨 Bottom colors: ${bottomColors}`)
    console.log(`   🎨 Shoe colors: ${shoeColors}`)
    
    // Get style-shoe and fabric rules
    const styleKey = (style || "casual").toLowerCase()
    const shoeRules = AI_STYLE_SHOE_RULES[styleKey] || AI_STYLE_SHOE_RULES.casual
    const fabricRules = AI_STYLE_FABRIC_RULES[styleKey] || AI_STYLE_FABRIC_RULES.casual
    
    // Get style modifiers from existing config
    const styleConfig = STYLE_PRODUCT_MODIFIERS[styleKey] || STYLE_PRODUCT_MODIFIERS.casual
    const styleAdjectives = styleConfig?.adjectives?.slice(0, 5).join(", ") || "comfortable, relaxed"
    
    // Get occasion products from existing config
    const occasionKey = (occasion || "everyday").toLowerCase()
    const occasionConfig = OCCASION_PRODUCT_MAPPING[occasionKey] || OCCASION_PRODUCT_MAPPING.everyday
    const occasionTops = occasionConfig.tops?.slice(0, 4).join(", ") || "top, shirt"
    const occasionBottoms = occasionConfig.bottoms?.slice(0, 4).join(", ") || "pant, jean"
    const occasionShoes = occasionConfig.shoes?.slice(0, 4).join(", ") || "shoe, sneaker"
    
    const batchPrompt = `You are a fashion search query specialist. Generate 3 search queries for finding products from an ASOS-style database.

## USER PROFILE
- Style: ${style || "casual"}
- Occasion: ${occasion || "everyday"}  
- Mood: ${mood || "general"}
- Body Type: ${bodyType || "not specified"}
- Budget: $${priceRange?.min || 0} - $${priceRange?.max || 200}

## CATEGORY COLORS
- Tops: ${topColors}
- Bottoms: ${bottomColors}
- Shoes: ${shoeColors}

## ASOS TITLE PATTERN
Products follow: "[Modifiers] [Core Item] in [Color]"
Examples:
${ASOS_TITLE_EXAMPLES.tops.slice(0, 2).join("\n")}
${ASOS_TITLE_EXAMPLES.bottoms.slice(0, 2).join("\n")}
${ASOS_TITLE_EXAMPLES.shoes.slice(0, 2).join("\n")}

## STYLE GUIDANCE FOR "${style || "casual"}"
Style adjectives: ${styleAdjectives}
Occasion tops: ${occasionTops}
Occasion bottoms: ${occasionBottoms}
Occasion shoes: ${occasionShoes}

## CRITICAL FABRIC/MATERIAL RULES FOR "${style || "casual"}" STYLE
✅ PREFERRED FABRICS: ${fabricRules.allow}
❌ FORBIDDEN FABRICS: ${fabricRules.forbid}

## CRITICAL SHOE RULES FOR "${style || "casual"}" STYLE
✅ ONLY USE: ${shoeRules.allow}
❌ NEVER USE: ${shoeRules.forbid}

## OUTPUT FORMAT (JSON)
Return ONLY valid JSON:
{
  "tops": "query for tops here",
  "bottoms": "query for bottoms here", 
  "shoes": "query for shoes here"
}

Each query should:
1. Mirror ASOS title structure ("[modifiers] [item] in [color]")
2. Include primary color at START and END
3. Be under 15 words
4. Use style-appropriate modifiers: ${styleAdjectives}
5. For tops/bottoms: Use ONLY fabrics from: ${fabricRules.allow.split(",").slice(0, 4).join(", ")}
6. For tops/bottoms: NEVER include: ${fabricRules.forbid.split(",").slice(0, 4).join(", ")}
7. Shoes query MUST use ONLY these types: ${shoeRules.allow}`

    console.log(`   🤖 Calling OpenAI for query generation...`)
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You output only valid JSON. No markdown, no explanation, no code blocks." },
        { role: "user", content: batchPrompt }
      ],
      temperature: 0.3,
      max_tokens: 300
    })
    
    const content = completion.choices?.[0]?.message?.content?.trim() || "{}"
    
    // Clean up potential markdown formatting
    const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    
    console.log(`   📝 Raw AI response: ${cleanContent.substring(0, 150)}...`)
    
    try {
      const queries = JSON.parse(cleanContent)
      
      // Validate we got all three
      if (!queries.tops || !queries.bottoms || !queries.shoes) {
        throw new Error("Missing category in AI response")
      }
      
      console.log("\n🤖 AI Queries Generated:")
      console.log(`   Tops: "${queries.tops}"`)
      console.log(`   Bottoms: "${queries.bottoms}"`)
      console.log(`   Shoes: "${queries.shoes}"`)
      console.log("🤖 ========================================\n")
      
      res.json({
        success: true,
        queries: {
          tops: queries.tops,
          bottoms: queries.bottoms,
          shoes: queries.shoes
        }
      })
      
    } catch (parseError) {
      console.error("   ❌ JSON parse failed:", parseError.message)
      console.log("   Raw content:", cleanContent.substring(0, 200))
      
      // Return fallback queries
      res.json({
        success: true,
        queries: {
          tops: `${topColors.split(",")[0]} ${styleAdjectives.split(",")[0]} top ${topColors.split(",")[0]}`,
          bottoms: `${bottomColors.split(",")[0]} ${styleAdjectives.split(",")[0]} pant ${bottomColors.split(",")[0]}`,
          shoes: `${shoeColors.split(",")[0]} ${shoeRules.allow.split(",")[0]} ${shoeColors.split(",")[0]}`
        },
        fallback: true
      })
    }
    
  } catch (error) {
    console.error("❌ AI query generation error:", error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// ============================================================================

// START SERVER

// ============================================================================

app.listen(PORT, () => {
  console.log("\n========================================")
  console.log("🚀 IMPROVED VECTOR SEARCH SERVER (v5 - AI Enhanced)")
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
  console.log(`   POST /api/generate-ai-queries    - AI query generation (V5) ✨`)
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
 * ✅ IMPROVED: Calculate diversity score with COLOR MATCHING
 * Now includes user color preferences in scoring
 */
function calculateDiversityScore(products, userColors = null) {
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

  // ✅ NEW: Group by detected color for color diversity
  const colorCounts = {}
  products.forEach((p) => {
    const colorInfo = extractProductColor(p.product_name || '', p.description || '')
    const baseColor = colorInfo ? colorInfo.normalized : 'unknown'
    colorCounts[baseColor] = (colorCounts[baseColor] || 0) + 1
  })

  // ✅ NEW: Normalize user colors if provided
  const normalizedUserColors = userColors ? normalizeUserColors(userColors) : []
  const hasUserColorPref = normalizedUserColors.length > 0
  
  if (hasUserColorPref) {
    console.log(`   🎨 Scoring with user colors: ${normalizedUserColors.join(', ')}`)
  }

  // Score each product for diversity
  const scoredProducts = products.map((product, index) => {
    let diversityScore = 0

    // Price diversity (20% weight - reduced from 25%)
    const priceRange =
      product.price < 50 ? "budget" : product.price < 150 ? "mid" : product.price < 300 ? "premium" : "luxury"
    const rangeCount = priceRanges[priceRange].length
    diversityScore += (1 / rangeCount) * 20

    // Brand diversity (15% weight - reduced from 20%)
    const brand = product.brand || "unknown"
    const brandFrequency = brandCounts[brand] / products.length
    diversityScore += (1 - brandFrequency) * 15

    // Name uniqueness (15% weight - reduced from 20%)
    const baseName = (product.product_name || "").toLowerCase().split(" ").slice(0, 3).join(" ")
    const nameFrequency = nameCounts[baseName] / products.length
    diversityScore += (1 - nameFrequency) * 15

    // ✅ BOOSTED: Color matching score (35% weight - increased from 25%)
    const colorInfo = extractProductColor(product.product_name || '', product.description || '')
    const productBaseColor = colorInfo ? colorInfo.normalized : null
    
    if (hasUserColorPref && productBaseColor) {
      // Score based on user color preference match
      const colorMatchScore = scoreProductColorMatch(colorInfo, normalizedUserColors)
      diversityScore += (colorMatchScore / 100) * 35
      
      // Store color info for debugging
      product._colorMatch = {
        detected: productBaseColor,
        score: colorMatchScore,
        matchesUser: normalizedUserColors.includes(productBaseColor)
      }
    } else if (productBaseColor) {
      // No user preference - score for color variety
      const colorFrequency = colorCounts[productBaseColor] / products.length
      diversityScore += (1 - colorFrequency) * 20 // Higher weight for variety when no preference
    } else {
      // No color detected - neutral score
      diversityScore += 10
    }

    // Relevance order (10% weight - unchanged)
    diversityScore += (1 - index / products.length) * 10

    return {
      ...product,
      diversityScore,
      _debug: {
        priceRange,
        brand,
        baseName,
        color: productBaseColor || 'unknown',
        score: Math.round(diversityScore),
      },
    }
  })

  // Log color distribution
  const colorDistribution = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([color, count]) => `${color}:${count}`)
    .join(', ')
  console.log(`   🎨 Color distribution: ${colorDistribution}`)

  return scoredProducts
    .sort((a, b) => b.diversityScore - a.diversityScore)
    .map(({ _debug, diversityScore, _colorMatch, ...product }) => product)
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

// ============================================================================
// QUALITY CHECKER COLOR SCORING API
// ============================================================================

/**
 * ✅ NEW: Score outfit color match for quality checker
 * Call this endpoint to get programmatic color scores for outfits
 */
app.post("/api/score-outfit-colors", async (req, res) => {
  try {
    const { outfit, userColors } = req.body
    
    if (!outfit || !userColors || userColors.length === 0) {
      return res.json({ colorScore: 50, details: "No colors to score" })
    }
    
    console.log(`🎨 Quality Checker Color Scoring:`)
    console.log(`   User colors: ${userColors.join(', ')}`)
    
    // Normalize user colors
    const normalizedUserColors = userColors.map(c => 
      COLOR_NORMALIZATION_MAP[c.toLowerCase()] || c.toLowerCase()
    )
    
    // Extract colors from each outfit piece
    const pieces = [
      { type: 'top', name: outfit.top?.product_name || outfit.topName || '' },
      { type: 'bottom', name: outfit.bottom?.product_name || outfit.bottomName || '' },
      { type: 'shoes', name: outfit.shoes?.product_name || outfit.shoeName || '' }
    ]
    
    let totalScore = 0
    let matchedPieces = 0
    let harmonyBonus = 0
    const pieceColors = []
    
    pieces.forEach(piece => {
      const colorInfo = extractProductColor(piece.name, '')
      if (colorInfo) {
        pieceColors.push({
          type: piece.type,
          original: colorInfo.original,
          normalized: colorInfo.normalized
        })
        
        // Direct match score (40 points max per piece)
        if (normalizedUserColors.includes(colorInfo.normalized)) {
          totalScore += 40
          matchedPieces++
          console.log(`   ✅ ${piece.type}: "${colorInfo.original}" → ${colorInfo.normalized} (MATCHES USER PREF)`)
        } else {
          // Partial score for harmonious colors
          const harmonyScore = checkColorHarmony(colorInfo.normalized, normalizedUserColors)
          totalScore += harmonyScore * 20 // Up to 20 points for harmony
          console.log(`   🎯 ${piece.type}: "${colorInfo.original}" → ${colorInfo.normalized} (harmony: ${harmonyScore})`)
        }
      } else {
        // Neutral/unknown color - small penalty
        console.log(`   ⚪ ${piece.type}: no color detected`)
        totalScore += 10
      }
    })
    
    // Outfit harmony bonus (colors work well together)
    if (pieceColors.length >= 2) {
      const outfitHarmony = calculateOutfitHarmony(pieceColors)
      harmonyBonus = outfitHarmony * 15 // Up to 15 bonus points
      totalScore += harmonyBonus
    }
    
    // Normalize to 0-100 scale
    // Max possible: 3 pieces * 40 + 15 harmony = 135, so scale accordingly
    const normalizedScore = Math.min(100, Math.round((totalScore / 135) * 100))
    
    // Apply floor based on match count
    let finalScore = normalizedScore
    if (matchedPieces >= 2) finalScore = Math.max(70, normalizedScore)
    else if (matchedPieces === 1) finalScore = Math.max(55, normalizedScore)
    else finalScore = Math.max(40, normalizedScore)
    
    console.log(`   📊 Color Score: ${finalScore} (${matchedPieces}/3 pieces match user colors)`)
    
    res.json({
      colorScore: finalScore,
      matchedPieces,
      pieceColors,
      harmonyBonus: Math.round(harmonyBonus),
      details: `${matchedPieces}/3 pieces match user colors (${userColors.join(', ')})`
    })
    
  } catch (error) {
    console.error("Color scoring error:", error)
    res.json({ colorScore: 50, error: error.message })
  }
})

/**
 * ✅ Check if a color is harmonious with user preferences
 * Returns 0-1 score
 */
function checkColorHarmony(productColor, userColors) {
  if (!productColor || userColors.length === 0) return 0
  
  // Check if it's a neutral (always harmonious)
  if (COLOR_HARMONY.neutrals.includes(productColor)) {
    return 0.7 // Neutrals are always acceptable
  }
  
  for (const userColor of userColors) {
    // Check complementary
    if (COLOR_HARMONY.complementary[userColor]?.includes(productColor)) {
      return 1.0
    }
    // Check analogous
    if (COLOR_HARMONY.analogous[userColor]?.includes(productColor)) {
      return 0.8
    }
    // Check triadic
    if (COLOR_HARMONY.triadic[userColor]?.includes(productColor)) {
      return 0.6
    }
  }
  
  // Check temperature match
  const productTemp = getColorTemperature(productColor)
  const userTemps = userColors.map(getColorTemperature)
  if (userTemps.includes(productTemp)) {
    return 0.4 // Same temperature family
  }
  
  return 0.2 // No harmony match
}

/**
 * ✅ Get color temperature (warm/cool/neutral)
 */


/**
 * ✅ Calculate how well outfit pieces harmonize with each other
 * Returns 0-1 score
 */
function calculateOutfitHarmony(pieceColors) {
  if (pieceColors.length < 2) return 0.5
  
  const colors = pieceColors.map(p => p.normalized).filter(Boolean)
  if (colors.length < 2) return 0.5
  
  let harmonyScore = 0
  let comparisons = 0
  
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      comparisons++
      const c1 = colors[i]
      const c2 = colors[j]
      
      // Same color family
      if (c1 === c2) {
        harmonyScore += 0.8
        continue
      }
      
      // One is neutral
      if (COLOR_HARMONY.neutrals.includes(c1) || COLOR_HARMONY.neutrals.includes(c2)) {
        harmonyScore += 0.9
        continue
      }
      
      // Complementary
      if (COLOR_HARMONY.complementary[c1]?.includes(c2) || 
          COLOR_HARMONY.complementary[c2]?.includes(c1)) {
        harmonyScore += 1.0
        continue
      }
      
      // Analogous
      if (COLOR_HARMONY.analogous[c1]?.includes(c2) || 
          COLOR_HARMONY.analogous[c2]?.includes(c1)) {
        harmonyScore += 0.85
        continue
      }
      
      // Same temperature
      if (getColorTemperature(c1) === getColorTemperature(c2)) {
        harmonyScore += 0.6
        continue
      }
      
      // Clashing (different temps, not complementary)
      harmonyScore += 0.3
    }
  }
  
  return comparisons > 0 ? harmonyScore / comparisons : 0.5
}
