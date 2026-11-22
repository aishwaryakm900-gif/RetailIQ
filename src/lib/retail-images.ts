export interface ProductImageDefinition {
  id: string;
  name: string;
  category: string;
  url: string;
  keywords: string[];
}

export const CATEGORY_DEFAULT_IMAGES: Record<string, string> = {
  Dairy: '/products/milk-carton.jpg',
  Bakery: '/products/bread.jpg',
  Snacks: '/products/chips.jpg',
  Beverages: '/products/juice.jpg',
  Grains: '/products/rice.jpg',
  'Oils and Fats': '/products/oil.jpg',
  'Packaged Foods': '/products/maggi-noodles.jpg',
  'Daily Essentials': '/products/honey.jpg',
  'Spices and Condiments': '/products/spices.jpg',
  'Personal Care': '/products/toothpaste.jpg',
  Household: '/products/detergent.jpg',
};

export const PRODUCT_IMAGES_CATALOGUE: ProductImageDefinition[] = [
  {
    id: 'amul-taaza',
    name: 'Amul Taaza Milk',
    category: 'Dairy',
    url: '/products/amul-taaza.jpg',
    keywords: ['amul', 'taaza', 'nandini', 'milk', 'goodlife', 'dairy'],
  },
  {
    id: 'milk-carton',
    name: 'Fresh Milk Carton',
    category: 'Dairy',
    url: '/products/milk-carton.jpg',
    keywords: ['milk', 'carton', 'cow milk', 'toned milk'],
  },
  {
    id: 'cheese',
    name: 'Cheese Slices / Paneer',
    category: 'Dairy',
    url: '/products/cheese.jpg',
    keywords: ['cheese', 'paneer', 'slice', 'cheddar', 'mozzarella'],
  },
  {
    id: 'curd',
    name: 'Fresh Curd (Dahi)',
    category: 'Dairy',
    url: '/products/curd.jpg',
    keywords: ['curd', 'dahi', 'yogurt', 'masti curd'],
  },
  {
    id: 'bread',
    name: 'White Sandwich Bread',
    category: 'Bakery',
    url: '/products/bread.jpg',
    keywords: ['bread', 'sandwich', 'white bread', 'loaf', 'pav'],
  },
  {
    id: 'bread2',
    name: 'Brown / Wheat Bread',
    category: 'Bakery',
    url: '/products/bread2.jpg',
    keywords: ['brown bread', 'wheat bread', 'atta bread', 'multigrain'],
  },
  {
    id: 'britannia-good-day',
    name: 'Britannia Good Day',
    category: 'Snacks',
    url: '/products/britannia-good-day.png',
    keywords: ['good day', 'britannia', 'butter cookie', 'cashew cookie'],
  },
  {
    id: 'biscuits',
    name: 'Parle-G / Biscuits',
    category: 'Snacks',
    url: '/products/biscuits.jpg',
    keywords: ['parle', 'parle-g', 'biscuit', 'biscuits', 'glucose', 'marie'],
  },
  {
    id: 'cookies',
    name: 'Choco Chip Cookies',
    category: 'Snacks',
    url: '/products/cookies.jpg',
    keywords: ['cookie', 'cookies', 'choco chip', 'biscotti'],
  },
  {
    id: 'lays-classic',
    name: 'Lay\'s Classic Salted Chips',
    category: 'Snacks',
    url: '/products/lays-classic.jpg',
    keywords: ['lays', "lay's", 'chips', 'potato chips', 'wafer', 'salted'],
  },
  {
    id: 'chips',
    name: 'Crispy Snack Chips',
    category: 'Snacks',
    url: '/products/chips.jpg',
    keywords: ['chips', 'snack', 'kurkure', 'namkeen', 'crisps'],
  },
  {
    id: 'coca-cola',
    name: 'Coca-Cola 250ml Can',
    category: 'Beverages',
    url: '/products/coca-cola-250ml.png',
    keywords: ['coca', 'cola', 'coke', 'pepsi', 'thums up', 'cold drink', 'soda'],
  },
  {
    id: 'juice',
    name: 'Real Fruit Juice',
    category: 'Beverages',
    url: '/products/juice.jpg',
    keywords: ['juice', 'real', 'tropicana', 'mixed fruit', 'mango', 'frooti', 'slice'],
  },
  {
    id: 'tea',
    name: 'Tata Tea / Tea Leaves',
    category: 'Beverages',
    url: '/products/tea.jpg',
    keywords: ['tea', 'chai', 'tata tea', 'red label', 'taj mahal', 'gold tea', 'tea powder'],
  },
  {
    id: 'coffee',
    name: 'Instant Coffee Jar',
    category: 'Beverages',
    url: '/products/coffee.jpg',
    keywords: ['coffee', 'nescafe', 'bru', 'sunrise', 'espresso'],
  },
  {
    id: 'horlicks',
    name: 'Horlicks Health Drink',
    category: 'Beverages',
    url: '/products/horlicks.jpg',
    keywords: ['horlicks', 'bournvita', 'boost', 'complan', 'malt'],
  },
  {
    id: 'maggi-noodles',
    name: 'Maggi 2-Minute Noodles',
    category: 'Snacks',
    url: '/products/maggi-noodles.jpg',
    keywords: ['maggi', 'noodle', 'noodles', 'masala noodles', '2-minute'],
  },
  {
    id: 'noodles',
    name: 'Instant Noodles Pack',
    category: 'Snacks',
    url: '/products/noodles.jpg',
    keywords: ['noodle', 'noodles', 'yippee', 'top ramen', 'hakka noodles'],
  },
  {
    id: 'rice',
    name: 'Basmati Rice',
    category: 'Grains',
    url: '/products/rice.jpg',
    keywords: ['rice', 'basmati', 'chawal', 'daawat', 'india gate', 'sona masoori'],
  },
  {
    id: 'oats',
    name: 'Rolled Oats',
    category: 'Grains',
    url: '/products/oats.jpg',
    keywords: ['oat', 'oats', 'quaker', 'kellogg', 'porridge'],
  },
  {
    id: 'oil',
    name: 'Sunflower Cooking Oil',
    category: 'Oils and Fats',
    url: '/products/oil.jpg',
    keywords: ['oil', 'fortune', 'sunflower', 'mustard', 'refined oil', 'groundnut', 'ghee'],
  },
  {
    id: 'tata-salt',
    name: 'Tata Salt 1kg Pack',
    category: 'Spices and Condiments',
    url: '/products/tata-salt.png',
    keywords: ['tata salt', 'salt', 'namak', 'iodized'],
  },
  {
    id: 'salt',
    name: 'Cooking Salt',
    category: 'Spices and Condiments',
    url: '/products/salt.jpg',
    keywords: ['salt', 'rock salt', 'sendha namak'],
  },
  {
    id: 'spices',
    name: 'Assorted Indian Spices',
    category: 'Spices and Condiments',
    url: '/products/spices.jpg',
    keywords: ['spice', 'spices', 'masala', 'haldi', 'turmeric', 'chilli', 'mirchi', 'jeera', 'garam masala'],
  },
  {
    id: 'honey',
    name: 'Pure Dabur Honey',
    category: 'Daily Essentials',
    url: '/products/honey.jpg',
    keywords: ['honey', 'dabur honey', 'shahad', 'sweetener'],
  },
  {
    id: 'toothpaste',
    name: 'Colgate / Toothpaste',
    category: 'Personal Care',
    url: '/products/toothpaste.jpg',
    keywords: ['toothpaste', 'colgate', 'pepsodent', 'sensodyne', 'dabur red', 'close up', 'brush', 'oral'],
  },
  {
    id: 'surf-excel',
    name: 'Surf Excel Washing Powder',
    category: 'Household',
    url: '/products/surf-excel.png',
    keywords: ['surf', 'surf excel', 'detergent', 'washing powder', 'tide', 'aerial'],
  },
  {
    id: 'detergent',
    name: 'Household Detergent',
    category: 'Household',
    url: '/products/detergent.jpg',
    keywords: ['detergent', 'cleaner', 'dishwash', 'vim', 'liquid soap'],
  },
];

/**
 * Intelligent helper to resolve the most accurate product photography based on product name,
 * category, and any user-provided or uploaded image.
 */
export function resolveProductImage(
  productName: string,
  category?: string,
  uploadedImage?: string | null
): string {
  // 1. If an image was explicitly uploaded/captured by the retailer or selected from presets
  if (uploadedImage && (uploadedImage.startsWith('data:') || uploadedImage.startsWith('/products/'))) {
    return uploadedImage;
  }

  const query = (productName || '').toLowerCase().trim();

  // 2. Exact or partial keyword match in catalog
  if (query) {
    for (const item of PRODUCT_IMAGES_CATALOGUE) {
      if (item.keywords.some((kw) => query.includes(kw))) {
        return item.url;
      }
    }
  }

  // 3. Category fallback
  if (category && CATEGORY_DEFAULT_IMAGES[category]) {
    return CATEGORY_DEFAULT_IMAGES[category];
  }

  // 4. Default graceful fallback
  return '/products/honey.jpg';
}
