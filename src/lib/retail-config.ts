/**
 * Centralized configuration for RetailIQ business rules, risk thresholds,
 * and Store Health Score weights (Hard Rules R2, R3, R8).
 */

export const RETAIL_CONFIG = {
  // Store Health Score weights (must sum to 1.0)
  healthScoreWeights: {
    stockAccuracy: 0.35,
    fastMoverShare: 0.25,
    freshStockShare: 0.25,
    lowRiskShare: 0.15,
  },

  // Category-based auto-withdrawal margin in days before batch expiry (Hard Rule R2)
  categoryWithdrawMarginDays: {
    Dairy: 2,
    Bakery: 2,
    'Packaged Foods': 7,
    Beverages: 7,
    Snacks: 7,
    Grains: 7,
    'Oils and Fats': 7,
    'Daily Essentials': 0, // Non-food
  } as Record<string, number>,

  // Expiry risk calendar classification (in days left)
  expiryRiskThresholds: {
    criticalDays: 3,
    highDays: 7,
    moderateDays: 30,
  },

  // Leftover share tolerance: if projected leftover / onHand exceeds this, escalate risk level by 1
  leftoverEscalationTolerance: 0.35,

  // Reservation hold window in hours
  reservationHoldHours: 2,

  // Default price elasticity for discount simulation
  defaultPriceElasticity: 1.65,
} as const;

export type ProductCategory =
  | 'Dairy'
  | 'Bakery'
  | 'Snacks'
  | 'Beverages'
  | 'Grains'
  | 'Oils and Fats'
  | 'Packaged Foods'
  | 'Daily Essentials';

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  'Dairy',
  'Bakery',
  'Snacks',
  'Beverages',
  'Grains',
  'Oils and Fats',
  'Packaged Foods',
  'Daily Essentials',
];

