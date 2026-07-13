// server/utils/templateDefinitions.js
// Registry of 20 distinct poster templates with unique layouts, colors, positions, and styles.

export const TEMPLATES = {
  grand_opening_luxury: {
    id: "grand_opening_luxury",
    category: "Grand Opening",
    colors: { primary: "#D4AF37", accent: "#DC2626", bg: "#0A0907", text: "#FFFFFF" },
    layout: {
      titleAlign: "center",
      titlePos: { x: 540, y: 200 },
      titleSize: 75,
      subtitlePos: { x: 540, y: 320 },
      subtitleSize: 22,
      heroArea: { type: "frame", x: 100, y: 400, width: 880, height: 480 },
      ctaStyle: { type: "rounded-glow", x: 540, y: 1060, width: 320, height: 75, color: "#D4AF37", textColor: "#FFFFFF" },
      cardsGrid: { x: 100, y: 900, columns: 3, cardHeight: 120 },
      footerPos: { x: 540, y: 1210 }
    },
    decorations: ["gold_frame", "balloons", "ribbons", "confetti"]
  },
  grand_opening_modern: {
    id: "grand_opening_modern",
    category: "Grand Opening",
    colors: { primary: "#3B82F6", accent: "#FBBF24", bg: "#0F172A", text: "#FFFFFF" },
    layout: {
      titleAlign: "left",
      titlePos: { x: 100, y: 220 },
      titleSize: 70,
      subtitlePos: { x: 100, y: 330 },
      subtitleSize: 20,
      heroArea: { type: "right-split", x: 600, y: 180, width: 380, height: 850 },
      ctaStyle: { type: "rounded-glow", x: 260, y: 1060, width: 300, height: 70, color: "#3B82F6", textColor: "#FFFFFF" },
      cardsGrid: { x: 100, y: 400, columns: 1, cardHeight: 140, width: 440 },
      footerPos: { x: 100, y: 1210 }
    },
    decorations: ["abstract_lines", "glow_dots"]
  },
  grand_opening_celebration: {
    id: "grand_opening_celebration",
    category: "Grand Opening",
    colors: { primary: "#EC4899", accent: "#8B5CF6", bg: "#1E1B4B", text: "#FFFFFF" },
    layout: {
      titleAlign: "center",
      titlePos: { x: 540, y: 240 },
      titleSize: 80,
      subtitlePos: { x: 540, y: 360 },
      subtitleSize: 24,
      heroArea: { type: "circle", x: 540, y: 640, radius: 220 },
      ctaStyle: { type: "rounded-glow", x: 540, y: 1100, width: 340, height: 80, color: "#EC4899", textColor: "#FFFFFF" },
      cardsGrid: { x: 100, y: 920, columns: 2, cardHeight: 130 },
      footerPos: { x: 540, y: 1230 }
    },
    decorations: ["confetti", "sparkles", "celebration_lights"]
  },
  hiring_tech: {
    id: "hiring_tech",
    category: "Hiring",
    colors: { primary: "#3B82F6", accent: "#8B5CF6", bg: "#090D1A", text: "#FFFFFF" },
    layout: {
      titleAlign: "left",
      titlePos: { x: 100, y: 200 },
      titleSize: 72,
      subtitlePos: { x: 100, y: 310 },
      subtitleSize: 22,
      heroArea: { type: "right-screen", x: 580, y: 380, width: 400, height: 500 },
      ctaStyle: { type: "rounded-glow", x: 260, y: 1080, width: 300, height: 75, color: "#3B82F6", textColor: "#FFFFFF" },
      cardsGrid: { x: 100, y: 380, columns: 1, cardHeight: 180, width: 440 },
      footerPos: { x: 100, y: 1220 }
    },
    decorations: ["circuit_pattern", "binary_overlay", "brackets"]
  },
  hiring_corporate: {
    id: "hiring_corporate",
    category: "Hiring",
    colors: { primary: "#3B82F6", accent: "#8B5CF6", bg: "#090D1A", text: "#FFFFFF" },
    layout: {
      titleAlign: "center",
      titlePos: { x: 540, y: 180 },
      titleSize: 68,
      subtitlePos: { x: 540, y: 280 },
      subtitleSize: 20,
      heroArea: { type: "center-panel", x: 100, y: 340, width: 880, height: 400 },
      ctaStyle: { type: "rounded-glow", x: 540, y: 1040, width: 320, height: 75, color: "#3B82F6", textColor: "#FFFFFF" },
      cardsGrid: { x: 100, y: 780, columns: 3, cardHeight: 200 },
      footerPos: { x: 540, y: 1200 }
    },
    decorations: ["corporate_stripes", "clean_borders"]
  },
  hiring_startup: {
    id: "hiring_startup",
    category: "Hiring",
    colors: { primary: "#3B82F6", accent: "#8B5CF6", bg: "#090D1A", text: "#FFFFFF" },
    layout: {
      titleAlign: "left",
      titlePos: { x: 100, y: 220 },
      titleSize: 80,
      subtitlePos: { x: 100, y: 340 },
      subtitleSize: 22,
      heroArea: { type: "diagonal-split", x: 560, y: 200, width: 420, height: 780 },
      ctaStyle: { type: "rounded-glow", x: 260, y: 1080, width: 300, height: 70, color: "#3B82F6", textColor: "#FFFFFF" },
      cardsGrid: { x: 100, y: 440, columns: 1, cardHeight: 160, width: 420 },
      footerPos: { x: 100, y: 1220 }
    },
    decorations: ["neon_glow", "startup_stars"]
  },
  restaurant_food: {
    id: "restaurant_food",
    category: "Restaurant",
    colors: { primary: "#F97316", accent: "#EF4444", bg: "#1A120B", text: "#FAF6EE" },
    layout: {
      titleAlign: "center",
      titlePos: { x: 540, y: 180 },
      titleSize: 78,
      subtitlePos: { x: 540, y: 290 },
      subtitleSize: 22,
      heroArea: { type: "food-display", x: 100, y: 360, width: 880, height: 500 },
      ctaStyle: { type: "rounded-glow", x: 540, y: 1080, width: 340, height: 75, color: "#F97316", textColor: "#FFFFFF" },
      cardsGrid: { x: 100, y: 900, columns: 3, cardHeight: 140 },
      footerPos: { x: 540, y: 1220 }
    },
    decorations: ["warm_lights", "steam_waves", "cutlery_accent"]
  },
  restaurant_cafe: {
    id: "restaurant_cafe",
    category: "Restaurant",
    colors: { primary: "#F97316", accent: "#EF4444", bg: "#1A120B", text: "#FAF6EE" },
    layout: {
      titleAlign: "left",
      titlePos: { x: 120, y: 200 },
      titleSize: 75,
      subtitlePos: { x: 120, y: 310 },
      subtitleSize: 20,
      heroArea: { type: "right-panel", x: 620, y: 180, width: 360, height: 850 },
      ctaStyle: { type: "rounded-glow", x: 270, y: 1050, width: 300, height: 70, color: "#F97316", textColor: "#FFFFFF" },
      cardsGrid: { x: 120, y: 400, columns: 1, cardHeight: 180, width: 440 },
      footerPos: { x: 120, y: 1210 }
    },
    decorations: ["coffee_mug_glow", "botanical_leaves"]
  },
  offer_sale: {
    id: "offer_sale",
    category: "Sale / Offer",
    colors: { primary: "#EF4444", accent: "#FBBF24", bg: "#0B0F19", text: "#FFFFFF" },
    layout: {
      titleAlign: "center",
      titlePos: { x: 540, y: 170 },
      titleSize: 90,
      subtitlePos: { x: 540, y: 290 },
      subtitleSize: 24,
      heroArea: { type: "discount-burst", x: 540, y: 580, width: 400, height: 400 },
      ctaStyle: { type: "rounded-glow", x: 540, y: 1060, width: 350, height: 80, color: "#EF4444", textColor: "#FFFFFF" },
      cardsGrid: { x: 100, y: 840, columns: 2, cardHeight: 160 },
      footerPos: { x: 540, y: 1210 }
    },
    decorations: ["burst_badge", "sparkles", "diagonal_slash"]
  },
  offer_discount: {
    id: "offer_discount",
    category: "Sale / Offer",
    colors: { primary: "#F59E0B", accent: "#EF4444", bg: "#0F172A", text: "#FFFFFF" },
    layout: {
      titleAlign: "left",
      titlePos: { x: 100, y: 220 },
      titleSize: 80,
      subtitlePos: { x: 100, y: 340 },
      subtitleSize: 22,
      heroArea: { type: "right-badge", x: 600, y: 220, width: 380, height: 760 },
      ctaStyle: { type: "rounded-glow", x: 260, y: 1060, width: 300, height: 70, color: "#EF4444", textColor: "#FFFFFF" },
      cardsGrid: { x: 100, y: 440, columns: 1, cardHeight: 170, width: 440 },
      footerPos: { x: 100, y: 1210 }
    },
    decorations: ["price_tag", "neon_borders"]
  },
  training_corporate: {
    id: "training_corporate",
    category: "Education",
    colors: { primary: "#10B981", accent: "#3B82F6", bg: "#1F2937", text: "#FFFFFF" },
    layout: {
      titleAlign: "center",
      titlePos: { x: 540, y: 190 },
      titleSize: 72,
      subtitlePos: { x: 540, y: 300 },
      subtitleSize: 20,
      heroArea: { type: "center-panel", x: 100, y: 360, width: 880, height: 420 },
      ctaStyle: { type: "rounded-glow", x: 540, y: 1050, width: 320, height: 75, color: "#3B82F6", textColor: "#FFFFFF" },
      cardsGrid: { x: 100, y: 820, columns: 3, cardHeight: 180 },
      footerPos: { x: 540, y: 1200 }
    },
    decorations: ["knowledge_icons", "clean_grids"]
  },
  training_tech: {
    id: "training_tech",
    category: "Education",
    colors: { primary: "#06B6D4", accent: "#F472B6", bg: "#090D1A", text: "#FFFFFF" },
    layout: {
      titleAlign: "left",
      titlePos: { x: 100, y: 200 },
      titleSize: 75,
      subtitlePos: { x: 100, y: 310 },
      subtitleSize: 22,
      heroArea: { type: "right-panel", x: 580, y: 200, width: 400, height: 800 },
      ctaStyle: { type: "rounded-glow", x: 260, y: 1060, width: 300, height: 75, color: "#06B6D4", textColor: "#FFFFFF" },
      cardsGrid: { x: 100, y: 380, columns: 1, cardHeight: 190, width: 440 },
      footerPos: { x: 100, y: 1210 }
    },
    decorations: ["circuit", "binary_code_glow"]
  },
  business_event: {
    id: "business_event",
    category: "Event",
    colors: { primary: "#3B82F6", accent: "#EC4899", bg: "#0F172A", text: "#FFFFFF" },
    layout: {
      titleAlign: "center",
      titlePos: { x: 540, y: 200 },
      titleSize: 74,
      subtitlePos: { x: 540, y: 310 },
      subtitleSize: 20,
      heroArea: { type: "calendar-frame", x: 100, y: 380, width: 880, height: 460 },
      ctaStyle: { type: "rounded-glow", x: 540, y: 1060, width: 340, height: 75, color: "#3B82F6", textColor: "#FFFFFF" },
      cardsGrid: { x: 100, y: 880, columns: 3, cardHeight: 140 },
      footerPos: { x: 540, y: 1220 }
    },
    decorations: ["calendar_accent", "location_pin_glow"]
  },
  festival: {
    id: "festival",
    category: "Festival",
    colors: { primary: "#FFD700", accent: "#EF4444", bg: "#2A0815", text: "#FBBF24" },
    layout: {
      titleAlign: "center",
      titlePos: { x: 540, y: 230 },
      titleSize: 85,
      subtitlePos: { x: 540, y: 350 },
      subtitleSize: 22,
      heroArea: { type: "center-glow-circle", x: 540, y: 640, radius: 240 },
      ctaStyle: { type: "rounded-glow", x: 540, y: 1080, width: 320, height: 75, color: "#FFD700", textColor: "#FFFFFF" },
      cardsGrid: { x: 100, y: 920, columns: 3, cardHeight: 120 },
      footerPos: { x: 540, y: 1225 }
    },
    decorations: ["lights", "diyas", "confetti", "traditional_kolam"]
  },
  education: {
    id: "education",
    category: "Education",
    colors: { primary: "#3B82F6", accent: "#10B981", bg: "#0F172A", text: "#FFFFFF" },
    layout: {
      titleAlign: "center",
      titlePos: { x: 540, y: 180 },
      titleSize: 76,
      subtitlePos: { x: 540, y: 290 },
      subtitleSize: 22,
      heroArea: { type: "center-display", x: 100, y: 360, width: 880, height: 460 },
      ctaStyle: { type: "rounded-glow", x: 540, y: 1060, width: 320, height: 75, color: "#3B82F6", textColor: "#FFFFFF" },
      cardsGrid: { x: 100, y: 860, columns: 3, cardHeight: 150 },
      footerPos: { x: 540, y: 1210 }
    },
    decorations: ["clean_borders", "grid_lines"]
  },
  healthcare: {
    id: "healthcare",
    category: "Healthcare",
    colors: { primary: "#10B981", accent: "#3B82F6", bg: "#0B1E19", text: "#FFFFFF" },
    layout: {
      titleAlign: "center",
      titlePos: { x: 540, y: 190 },
      titleSize: 72,
      subtitlePos: { x: 540, y: 290 },
      subtitleSize: 20,
      heroArea: { type: "wellness-frame", x: 100, y: 360, width: 880, height: 480 },
      ctaStyle: { type: "rounded-glow", x: 540, y: 1080, width: 340, height: 75, color: "#10B981", textColor: "#FFFFFF" },
      cardsGrid: { x: 100, y: 880, columns: 3, cardHeight: 160 },
      footerPos: { x: 540, y: 1210 }
    },
    decorations: ["heartbeat_line", "stethoscope_glow"]
  },
  real_estate: {
    id: "real_estate",
    category: "Real Estate",
    colors: { primary: "#D4AF37", accent: "#F5F2EB", bg: "#0A0A0A", text: "#FFFFFF" },
    layout: {
      titleAlign: "left",
      titlePos: { x: 100, y: 200 },
      titleSize: 78,
      subtitlePos: { x: 100, y: 310 },
      subtitleSize: 20,
      heroArea: { type: "real-estate-hero", x: 100, y: 160, width: 880, height: 550 },
      ctaStyle: { type: "rounded-glow", x: 260, y: 1050, width: 300, height: 75, color: "#D4AF37", textColor: "#FFFFFF" },
      cardsGrid: { x: 100, y: 400, columns: 1, cardHeight: 180, width: 420 },
      footerPos: { x: 100, y: 1210 }
    },
    decorations: ["luxury_gold_borders", "luxury_gold_frame", "gold_accents"]
  },
  product_launch: {
    id: "product_launch",
    category: "Product Launch",
    colors: { primary: "#EF4444", accent: "#3B82F6", bg: "#0A0B10", text: "#FFFFFF" },
    layout: {
      titleAlign: "center",
      titlePos: { x: 540, y: 200 },
      titleSize: 84,
      subtitlePos: { x: 540, y: 320 },
      subtitleSize: 22,
      heroArea: { type: "podium-display", x: 100, y: 400, width: 880, height: 500 },
      ctaStyle: { type: "rounded-glow", x: 540, y: 1080, width: 330, height: 75, color: "#EF4444", textColor: "#FFFFFF" },
      cardsGrid: { x: 100, y: 940, columns: 3, cardHeight: 110 },
      footerPos: { x: 540, y: 1220 }
    },
    decorations: ["spotlights", "beams_glow", "product_ring"]
  },
  birthday: {
    id: "birthday",
    category: "Birthday",
    colors: { primary: "#FBBF24", accent: "#EF4444", bg: "#1E1B4B", text: "#FFFFFF" },
    layout: {
      titleAlign: "center",
      titlePos: { x: 540, y: 220 },
      titleSize: 80,
      subtitlePos: { x: 540, y: 330 },
      subtitleSize: 22,
      heroArea: { type: "festive-center", x: 100, y: 400, width: 880, height: 500 },
      ctaStyle: { type: "rounded-glow", x: 540, y: 1080, width: 300, height: 75, color: "#EF4444", textColor: "#FFFFFF" },
      cardsGrid: { x: 100, y: 940, columns: 3, cardHeight: 110 },
      footerPos: { x: 540, y: 1220 }
    },
    decorations: ["balloons", "confetti_stars", "party_ribbons"]
  },
  invitation: {
    id: "invitation",
    category: "Invitation",
    colors: { primary: "#0EA5E9", accent: "#F59E0B", bg: "#0F172A", text: "#FFFFFF" },
    layout: {
      titleAlign: "center",
      titlePos: { x: 540, y: 200 },
      titleSize: 74,
      subtitlePos: { x: 540, y: 310 },
      subtitleSize: 20,
      heroArea: { type: "invitation-card", x: 120, y: 380, width: 840, height: 500 },
      ctaStyle: { type: "rounded-glow", x: 540, y: 1080, width: 320, height: 75, color: "#0EA5E9", textColor: "#FFFFFF" },
      cardsGrid: { x: 100, y: 920, columns: 2, cardHeight: 120 },
      footerPos: { x: 540, y: 1220 }
    },
    decorations: ["ribbons_deco", "sparkles_glow"]
  }
};

// Map category to possible template lists
export const CATEGORY_MAP = {
  "Grand Opening": ["grand_opening_luxury", "grand_opening_modern", "grand_opening_celebration"],
  "Hiring": ["hiring_tech", "hiring_corporate", "hiring_startup"],
  "Restaurant": ["restaurant_food", "restaurant_cafe"],
  "Sale / Offer": ["offer_sale", "offer_discount"],
  "Offer": ["offer_sale", "offer_discount"],
  "Education": ["training_corporate", "training_tech", "education"],
  "Training": ["training_corporate", "training_tech", "education"],
  "Event": ["business_event"],
  "Festival": ["festival"],
  "Healthcare": ["healthcare"],
  "Real Estate": ["real_estate"],
  "Product Launch": ["product_launch"],
  "Birthday": ["birthday"],
  "Invitation": ["invitation"]
};

// Select template dynamically
export function selectTemplate(category, customLayoutId = null) {
  if (customLayoutId && TEMPLATES[customLayoutId]) {
    return TEMPLATES[customLayoutId];
  }
  const keys = CATEGORY_MAP[category] || CATEGORY_MAP["Grand Opening"]; // default fallback
  const chosenKey = keys[Math.floor(Math.random() * keys.length)];
  return TEMPLATES[chosenKey] || TEMPLATES.grand_opening_luxury;
}
