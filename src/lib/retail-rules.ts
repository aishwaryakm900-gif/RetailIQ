import { RETAIL_CONFIG, ProductCategory } from './retail-config';
import {
  Batch,
  BatchDeductionDetail,
  BillItem,
  DailySalesPoint,
  Offer,
  Product,
  Sale,
  SaleItem,
} from './retail-types';

/**
 * Compute whole days difference from today (local calendar day) to target YYYY-MM-DD date.
 */
export function daysUntil(dateIso: string, now: Date = new Date()): number {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetParts = dateIso.split('-').map(Number);
  const target = new Date(targetParts[0], targetParts[1] - 1, targetParts[2]).getTime();
  return Math.round((target - start) / (1000 * 60 * 60 * 24));
}

/**
 * Add days to a Date and return YYYY-MM-DD string.
 */
export function addDaysIso(base: Date, days: number): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Hard Rule R2: Compute offer auto-withdrawal date using category-based margin.
 * Dairy/Bakery: 2 days before expiry; Packaged food/Beverages/Snacks: 7 days; Non-food: 0 days.
 */
export function computeWithdrawAt(expiryDateIso: string, category: ProductCategory): string {
  const marginDays = RETAIL_CONFIG.categoryWithdrawMarginDays[category] ?? 0;
  const parts = expiryDateIso.split('-').map(Number);
  const expiry = new Date(parts[0], parts[1] - 1, parts[2]);
  return addDaysIso(expiry, -marginDays);
}

/**
 * Hard Rule R2: Verify an offer is valid to display in the Stock Rescue marketplace.
 * Never shows anything past its batch expiry date or its auto-withdrawal date.
 */
export function isOfferEligibleForMarketplace(
  offer: Offer,
  batch?: Batch,
  now: Date = new Date()
): boolean {
  if (offer.status !== 'PUBLISHED') return false;
  if (offer.qtyAvailable <= 0) return false;
  if (daysUntil(offer.withdrawAt, now) < 0) return false;
  if (daysUntil(offer.validTo, now) < 0) return false;
  if (batch && (batch.qtyOnHand <= 0 || daysUntil(batch.expiryDate, now) <= 0)) {
    return false;
  }
  return true;
}

export interface ExpiryRiskAssessment {
  batchId: string;
  productId: string;
  productName: string;
  category: ProductCategory;
  batchNo: string;
  expiryDate: string;
  daysLeft: number;
  onHand: number;
  predictedSold: number;
  predictedLeftover: number;
  estimatedLoss: number;
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  recommendedAction: string;
  recommendedDiscountPct: number;
  priceFloorCleared: boolean;
}

/**
 * Evaluate batch expiry risk with leftover projection and escalation tolerance (Part E).
 */
export function assessBatchExpiryRisk(
  batch: Batch,
  product: Product,
  now: Date = new Date()
): ExpiryRiskAssessment {
  const daysLeft = Math.max(0, daysUntil(batch.expiryDate, now));
  const onHand = batch.qtyOnHand;
  const expectedSold = Math.min(onHand, Math.round(product.dailyDemandAvg * daysLeft));
  const predictedLeftover = Math.max(0, onHand - expectedSold);
  const estimatedLoss = Math.round(predictedLeftover * batch.costPrice);

  let riskLevel: 'Critical' | 'High' | 'Medium' | 'Low' = 'Low';
  if (daysLeft <= RETAIL_CONFIG.expiryRiskThresholds.criticalDays) {
    riskLevel = 'Critical';
  } else if (daysLeft <= RETAIL_CONFIG.expiryRiskThresholds.highDays) {
    riskLevel = 'High';
  } else if (daysLeft <= RETAIL_CONFIG.expiryRiskThresholds.moderateDays) {
    riskLevel = 'Medium';
  }

  // Escalate one risk tier if projected leftover share exceeds tolerance
  const leftoverShare = onHand > 0 ? predictedLeftover / onHand : 0;
  if (leftoverShare > RETAIL_CONFIG.leftoverEscalationTolerance) {
    if (riskLevel === 'Low') riskLevel = 'Medium';
    else if (riskLevel === 'Medium') riskLevel = 'High';
    else if (riskLevel === 'High') riskLevel = 'Critical';
  }

  const discountRec = calculateProtectedDiscount(
    product.sellingPrice,
    product.purchasePrice,
    onHand,
    product.dailyDemandAvg,
    daysLeft
  );

  return {
    batchId: batch.id,
    productId: product.id,
    productName: product.name,
    category: product.category,
    batchNo: batch.batchNo,
    expiryDate: batch.expiryDate,
    daysLeft,
    onHand,
    predictedSold: expectedSold,
    predictedLeftover,
    estimatedLoss,
    riskLevel,
    recommendedAction: discountRec.clearsFloor
      ? `Apply ${discountRec.recommendedDiscountPct}% discount`
      : 'Create bundle / Stock Rescue',
    recommendedDiscountPct: discountRec.recommendedDiscountPct,
    priceFloorCleared: discountRec.clearsFloor,
  };
}

export interface DiscountSimulationResult {
  recommendedDiscountPct: number;
  offerPrice: number;
  clearsFloor: boolean;
  expectedLeftoverWithout: number;
  expectedLeftoverWith: number;
  estimatedRecoveryRs: number;
  remainingLossRs: number;
  suggestBundle: boolean;
}

/**
 * Hard Rule R3: Grid-search discounts in 5% steps; keep the smallest discount whose
 * expected leftover is acceptable and whose discounted price >= purchasePrice.
 */
export function calculateProtectedDiscount(
  sellingPrice: number,
  purchasePrice: number,
  onHand: number,
  dailyDemand: number,
  daysLeft: number
): DiscountSimulationResult {
  const effectiveDays = Math.max(1, daysLeft);
  const baseSold = Math.min(onHand, Math.round(dailyDemand * effectiveDays));
  const leftoverWithout = Math.max(0, onHand - baseSold);

  let bestPct = 0;
  let bestPrice = sellingPrice;
  let bestLeftoverWith = leftoverWithout;
  let clearsFloor = false;

  for (let pct = 5; pct <= 50; pct += 5) {
    const candidatePrice = Math.round(sellingPrice * (1 - pct / 100));
    // Hard Rule R3: Never sell below purchase price
    if (candidatePrice < purchasePrice) {
      break;
    }
    clearsFloor = true;
    const demandMultiplier = 1 + (pct / 100) * RETAIL_CONFIG.defaultPriceElasticity;
    const projectedSoldWith = Math.min(
      onHand,
      Math.round(dailyDemand * demandMultiplier * effectiveDays)
    );
    const leftoverWith = Math.max(0, onHand - projectedSoldWith);

    bestPct = pct;
    bestPrice = candidatePrice;
    bestLeftoverWith = leftoverWith;

    // Stop at the smallest 5% step that clears at least 75% of at-risk leftover
    if (leftoverWithout === 0 || leftoverWith <= Math.floor(leftoverWithout * 0.25)) {
      break;
    }
  }

  if (!clearsFloor) {
    // Even 5% discount breaches purchase price floor
    return {
      recommendedDiscountPct: 0,
      offerPrice: sellingPrice,
      clearsFloor: false,
      expectedLeftoverWithout: leftoverWithout,
      expectedLeftoverWith: leftoverWithout,
      estimatedRecoveryRs: 0,
      remainingLossRs: Math.round(leftoverWithout * purchasePrice),
      suggestBundle: true,
    };
  }

  const extraCleared = Math.max(0, leftoverWithout - bestLeftoverWith);
  const estimatedRecoveryRs = Math.round(extraCleared * bestPrice);
  const remainingLossRs = Math.round(bestLeftoverWith * purchasePrice);

  return {
    recommendedDiscountPct: bestPct,
    offerPrice: bestPrice,
    clearsFloor: true,
    expectedLeftoverWithout: leftoverWithout,
    expectedLeftoverWith: bestLeftoverWith,
    estimatedRecoveryRs,
    remainingLossRs,
    suggestBundle: bestLeftoverWith > Math.ceil(onHand * 0.4),
  };
}

/**
 * Hard Rule R6: Deduct stock earliest-expiry-first (FEFO).
 * Guarantees stock never goes negative and returns atomic batch deductions.
 */
export function deductStockFEFO(
  allBatches: Batch[],
  productId: string,
  qtyToSell: number
): { ok: true; updatedBatches: Batch[]; saleItems: SaleItem[] } | { ok: false; error: string } {
  if (qtyToSell <= 0) {
    return { ok: false, error: 'Quantity must be greater than zero.' };
  }

  const productBatches = allBatches
    .filter((b) => b.productId === productId && b.qtyOnHand > 0)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  const totalAvailable = productBatches.reduce((sum, b) => sum + b.qtyOnHand, 0);
  if (totalAvailable < qtyToSell) {
    return {
      ok: false,
      error: `Insufficient stock. Requested ${qtyToSell}, available ${totalAvailable}.`,
    };
  }

  let remaining = qtyToSell;
  const deductions = new Map<string, number>();
  const saleItems: SaleItem[] = [];

  for (const batch of productBatches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.qtyOnHand, remaining);
    deductions.set(batch.id, take);
    saleItems.push({
      productId,
      batchId: batch.id,
      qty: take,
      unitPrice: batch.costPrice, // Overridden by sellingPrice/offerPrice at caller
    });
    remaining -= take;
  }

  const updatedBatches = allBatches.map((b) => {
    const taken = deductions.get(b.id);
    if (!taken) return b;
    return { ...b, qtyOnHand: b.qtyOnHand - taken };
  });

  return { ok: true, updatedBatches, saleItems };
}

/**
 * Hard Rule R7: Great-circle Haversine distance in km (never expose raw customer coords).
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Compute Store Health Score (0-100) using centralized config weights.
 */
export function computeStoreHealthScore(
  products: Product[],
  batches: Batch[],
  now: Date = new Date()
): number {
  if (products.length === 0) return 100;
  const w = RETAIL_CONFIG.healthScoreWeights;

  const stockByProduct = new Map<string, number>();
  batches.forEach((b) => {
    stockByProduct.set(b.productId, (stockByProduct.get(b.productId) ?? 0) + b.qtyOnHand);
  });

  const healthyStockCount = products.filter(
    (p) => (stockByProduct.get(p.id) ?? 0) >= p.minStock
  ).length;
  const stockAccuracy = (healthyStockCount / products.length) * 100;

  const fastMovers = products.filter(
    (p) => p.moverState === 'fresh' || p.moverState === 'normal'
  ).length;
  const fastMoverShare = (fastMovers / products.length) * 100;

  const totalUnits = batches.reduce((s, b) => s + b.qtyOnHand, 0);
  const freshUnits = batches
    .filter((b) => daysUntil(b.expiryDate, now) > 7)
    .reduce((s, b) => s + b.qtyOnHand, 0);
  const freshStockShare = totalUnits > 0 ? (freshUnits / totalUnits) * 100 : 100;

  const lowRiskProducts = products.filter((p) => p.moverState !== 'near-expiry' && p.moverState !== 'dead stock').length;
  const lowRiskShare = (lowRiskProducts / products.length) * 100;

  const weighted =
    stockAccuracy * w.stockAccuracy +
    fastMoverShare * w.fastMoverShare +
    freshStockShare * w.freshStockShare +
    lowRiskShare * w.lowRiskShare;

  return Math.max(0, Math.min(100, Math.round(weighted)));
}

/**
 * Part D & R5: Parse English, Kannada, or Hindi typed intake sentence into structured
 * preview before shopkeeper confirmation.
 */
export interface ParsedIntakeResult {
  matchedProduct: Product | null;
  productNameQuery: string;
  quantity: number;
  unitPrice: number | null;
  confidence: number;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  twelve: 12, fifteen: 15, twenty: 20, twentyfive: 25, thirty: 30, fifty: 50, hundred: 100,
  // Kannada number words
  ಒಂದು: 1, ಎರಡು: 2, ಮೂರು: 3, ನಾಲ್ಕು: 4, ಐದು: 5, ಆರು: 6, ಏಳು: 7, ಎಂಟು: 8, ಒಂಬತ್ತು: 9, ಹತ್ತು: 10,
  ಇಪ್ಪತ್ತು: 20, ಐವತ್ತು: 50,
  // Hindi number words
  एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5, छह: 6, सात: 7, आठ: 8, नौ: 9, दस: 10,
  बीस: 20, पचास: 50,
};

const ALIAS_MAP: Record<string, string> = {
  'ಪಾರ್ಲೆ': 'Parle-G',
  'ಪಾರ್ಲೆ ಜಿ': 'Parle-G',
  'पारले': 'Parle-G',
  'पारले-जी': 'Parle-G',
  'ಹಾಲು': 'Milk',
  'दूध': 'Milk',
  'ಬ್ರೆಡ್': 'Bread',
  'ब्रेड': 'Bread',
  'ಅಕ್ಕಿ': 'Rice',
  'चावल': 'Rice',
  'ಎಣ್ಣೆ': 'Oil',
  'तेल': 'Oil',
  'ಬೆಣ್ಣೆ': 'Butter',
  'मक्खन': 'Butter',
  'ಬಿಸ್ಕತ್': 'Biscuits',
  'बिस्कुट': 'Biscuits',
  'ಆಟಾ': 'Atta',
  'आटा': 'Atta',
};

export function parseSentenceIntake(sentence: string, products: Product[]): ParsedIntakeResult {
  const cleaned = sentence.trim();
  const lower = cleaned.toLowerCase();

  // Extract digits
  const digitMatches = cleaned.match(/\d+/g)?.map(Number) ?? [];
  let quantity = digitMatches[0] ?? 0;
  let unitPrice: number | null = digitMatches.length > 1 ? digitMatches[1] : null;

  // Check word numbers if digits missing
  if (!quantity) {
    const tokens = lower.split(/[\s,।.]+/);
    for (const tok of tokens) {
      if (NUMBER_WORDS[tok]) {
        if (!quantity) quantity = NUMBER_WORDS[tok];
        else if (unitPrice === null) unitPrice = NUMBER_WORDS[tok];
      }
    }
  }
  if (!quantity) quantity = 10;

  // Match product using aliases or fuzzy token overlap
  let searchTerm = lower;
  for (const [alias, eng] of Object.entries(ALIAS_MAP)) {
    if (cleaned.includes(alias) || lower.includes(alias)) {
      searchTerm += ' ' + eng.toLowerCase();
    }
  }

  let bestProduct: Product | null = null;
  let bestScore = 0;

  for (const product of products) {
    const pWords = product.name.toLowerCase().replace(/[()]/g, '').split(/\s+/);
    let score = 0;
    for (const w of pWords) {
      if (w.length >= 3 && searchTerm.includes(w)) {
        score += w.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestProduct = product;
    }
  }

  return {
    matchedProduct: bestProduct,
    productNameQuery: bestProduct ? bestProduct.name : cleaned.slice(0, 32),
    quantity,
    unitPrice: unitPrice ?? bestProduct?.purchasePrice ?? null,
    confidence: bestProduct ? Math.min(98, 65 + bestScore * 3) : 35,
  };
}

/**
 * Hard Rule R4: Predefined read-only assistant tools.
 * Every number returned originates strictly from live shop-scoped state.
 */
export type AssistantToolName =
  | 'getLowStockForecast'
  | 'getExpiringBatches'
  | 'getTopSellers'
  | 'getReorderSuggestions'
  | 'getAtRiskValue';

export interface AssistantResponse {
  tool: AssistantToolName;
  summary: string;
  columns: string[];
  rows: (string | number)[][];
}

export function runReadOnlyAssistant(
  query: string,
  locale: string,
  shopId: string,
  products: Product[],
  batches: Batch[],
  sales: Sale[]
): AssistantResponse {
  // Hard Rule R1: Strictly scope all arrays to caller's shopId
  const shopProducts = products.filter((p) => p.shopId === shopId);
  const shopBatches = batches.filter((b) => b.shopId === shopId);
  const shopSales = sales.filter((s) => s.shopId === shopId);

  const q = query.toLowerCase();

  // Intent Detection across EN / KN / HI
  const isExpiringIntent =
    q.includes('expir') ||
    q.includes('ಅವಧಿ') ||
    q.includes('ಮುಕ್ತಾಯ') ||
    q.includes('एक्सपायर') ||
    q.includes('खराब');

  const isTopSellerIntent =
    q.includes('top') ||
    q.includes('most') ||
    q.includes('sold') ||
    q.includes('best') ||
    q.includes('ಹೆಚ್ಚು ಮಾರಾಟ') ||
    q.includes('ज्यादा बिका') ||
    q.includes('बिक्री');

  const isReorderIntent =
    q.includes('buy') ||
    q.includes('reorder') ||
    q.includes('order') ||
    q.includes('ಖರೀದಿ') ||
    q.includes('ಮರುಖರೀದಿ') ||
    q.includes('मंगाना') ||
    q.includes('ऑर्डर');

  const isRiskValueIntent =
    q.includes('risk') ||
    q.includes('loss') ||
    q.includes('value') ||
    q.includes('ನಷ್ಟ') ||
    q.includes('ಅಪಾಯ') ||
    q.includes('नुकसान') ||
    q.includes('जोखिम');

  const stockMap = new Map<string, number>();
  shopBatches.forEach((b) => {
    stockMap.set(b.productId, (stockMap.get(b.productId) ?? 0) + b.qtyOnHand);
  });

  if (isExpiringIntent) {
    const expiring = shopBatches
      .filter((b) => b.qtyOnHand > 0 && daysUntil(b.expiryDate) <= 10)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
      .slice(0, 5)
      .map((b) => {
        const prod = shopProducts.find((p) => p.id === b.productId);
        const dLeft = Math.max(0, daysUntil(b.expiryDate));
        return [prod?.name ?? b.productId, b.batchNo, b.qtyOnHand, `${dLeft}d`];
      });

    const msg =
      locale === 'kn'
        ? `ಮುಂದಿನ 10 ದಿನಗಳಲ್ಲಿ ${expiring.length} ಬ್ಯಾಚ್‌ಗಳ ಅವಧಿ ಮುಗಿಯಲಿದೆ. ದಯವಿಟ್ಟು ತಕ್ಷಣ ರಿಯಾಯಿತಿ ಅಥವಾ ಸ್ಟಾಕ್ ರೆಸ್ಕ್ಯೂ ಪರಿಗಣಿಸಿ.`
        : locale === 'hi'
        ? `अगले 10 दिनों में ${expiring.length} बैच एक्सपायर होने वाले हैं। कृपया स्मार्ट डिस्काउंट या स्टॉक रेस्क्यू पर विचार करें।`
        : `${expiring.length} active batches expire within the next 10 days. Review the verified batch quantities and days left below.`;

    return {
      tool: 'getExpiringBatches',
      summary: msg,
      columns: ['Product', 'Batch', 'Qty On Hand', 'Days Left'],
      rows: expiring,
    };
  }

  if (isTopSellerIntent) {
    const unitsSoldMap = new Map<string, { units: number; rev: number }>();
    shopSales.forEach((s) => {
      s.items.forEach((it) => {
        const prev = unitsSoldMap.get(it.productId) ?? { units: 0, rev: 0 };
        unitsSoldMap.set(it.productId, {
          units: prev.units + it.qty,
          rev: prev.rev + it.qty * it.unitPrice,
        });
      });
    });

    const ranked = shopProducts
      .map((p) => {
        const stat = unitsSoldMap.get(p.id) ?? {
          units: Math.round(p.dailyDemandAvg * 7),
          rev: Math.round(p.dailyDemandAvg * 7 * p.sellingPrice),
        };
        return { name: p.name, units: stat.units, rev: stat.rev };
      })
      .sort((a, b) => b.units - a.units)
      .slice(0, 5)
      .map((x) => [x.name, x.units, `₹${x.rev}`]);

    const topName = ranked[0]?.[0] ?? 'N/A';
    const topUnits = ranked[0]?.[1] ?? 0;
    const msg =
      locale === 'kn'
        ? `ಈ ವಾರ ಅತಿ ಹೆಚ್ಚು ಮಾರಾಟವಾದ ಉತ್ಪನ್ನ ${topName} (${topUnits} ಘಟಕಗಳು). ವಿವರವಾದ ಪಟ್ಟಿ ಕೆಳಗಿದೆ.`
        : locale === 'hi'
        ? `इस सप्ताह सबसे ज्यादा बिकने वाला उत्पाद ${topName} (${topUnits} यूनिट) रहा। नीचे पूरी सूची देखें।`
        : `Your top-selling item this week is ${topName} with ${topUnits} units sold. See the top 5 verified performers below.`;

    return {
      tool: 'getTopSellers',
      summary: msg,
      columns: ['Product', 'Units Sold', 'Revenue'],
      rows: ranked,
    };
  }

  if (isRiskValueIntent) {
    const assessments = shopBatches
      .filter((b) => b.qtyOnHand > 0)
      .map((b) => {
        const p = shopProducts.find((pr) => pr.id === b.productId)!;
        return assessBatchExpiryRisk(b, p);
      })
      .filter((a) => a.estimatedLoss > 0)
      .sort((a, b) => b.estimatedLoss - a.estimatedLoss);

    const totalLoss = assessments.reduce((sum, a) => sum + a.estimatedLoss, 0);
    const rows = assessments
      .slice(0, 5)
      .map((a) => [a.productName, a.predictedLeftover, `₹${a.estimatedLoss}`, a.riskLevel]);

    const msg =
      locale === 'kn'
        ? `ಪ್ರಸ್ತುತ ${assessments.length} ಬ್ಯಾಚ್‌ಗಳಿಂದ ಅಂದಾಜು ₹${totalLoss} ಮೌಲ್ಯದ ಸ್ಟಾಕ್ ನಷ್ಟದ ಅಪಾಯದಲ್ಲಿದೆ.`
        : locale === 'hi'
        ? `वर्तमान में ${assessments.length} बैचों से अनुमानित ₹${totalLoss} मूल्य का स्टॉक नुकसान के जोखिम में है।`
        : `Total estimated at-risk inventory value across ${assessments.length} batches is ₹${totalLoss}.`;

    return {
      tool: 'getAtRiskValue',
      summary: msg,
      columns: ['Product', 'Proj. Leftover', 'Est. Loss', 'Risk'],
      rows,
    };
  }

  if (isReorderIntent) {
    const suggestions = shopProducts
      .map((p) => {
        const stock = stockMap.get(p.id) ?? 0;
        const cover7 = Math.ceil(p.dailyDemandAvg * 7);
        const safety = p.minStock;
        const suggested = Math.max(0, cover7 + safety - stock);
        return { name: p.name, stock, cover7, suggested };
      })
      .filter((x) => x.suggested > 0)
      .sort((a, b) => b.suggested - a.suggested)
      .slice(0, 5)
      .map((x) => [x.name, x.stock, x.cover7, x.suggested]);

    const msg =
      locale === 'kn'
        ? `ನಾಳೆಯ ಮರುಖರೀದಿಗಾಗಿ ${suggestions.length} ಉತ್ಪನ್ನಗಳನ್ನು ಶಿಫಾರಸು ಮಾಡಲಾಗಿದೆ.`
        : locale === 'hi'
        ? `कल के रीऑर्डर के लिए ${suggestions.length} उत्पादों की सिफारिश की गई है।`
        : `${suggestions.length} products are recommended for tomorrow's purchase order based on 7-day demand + safety stock.`;

    return {
      tool: 'getReorderSuggestions',
      summary: msg,
      columns: ['Product', 'On Hand', '7d Demand', 'Suggested Qty'],
      rows: suggestions,
    };
  }

  // Default: getLowStockForecast
  const lowStockRows = shopProducts
    .map((p) => {
      const stock = stockMap.get(p.id) ?? 0;
      const daysCover = p.dailyDemandAvg > 0 ? Math.round((stock / p.dailyDemandAvg) * 10) / 10 : 99;
      return { name: p.name, stock, min: p.minStock, daysCover };
    })
    .filter((x) => x.stock <= x.min * 1.5 || x.daysCover <= 5)
    .sort((a, b) => a.daysCover - b.daysCover)
    .slice(0, 5)
    .map((x) => [x.name, x.stock, x.min, `${x.daysCover}d`]);

  const msg =
    locale === 'kn'
      ? `ಪ್ರಸ್ತುತ ${lowStockRows.length} ಉತ್ಪನ್ನಗಳು ಶೀಘ್ರದಲ್ಲೇ ಖಾಲಿಯಾಗುವ ಹಂತದಲ್ಲಿವೆ.`
      : locale === 'hi'
      ? `वर्तमान में ${lowStockRows.length} उत्पाद जल्द ही खत्म होने वाले हैं।`
      : `${lowStockRows.length} products have low stock cover and may run out soon.`;

  return {
    tool: 'getLowStockForecast',
    summary: msg,
    columns: ['Product', 'On Hand', 'Min Stock', 'Days Cover'],
    rows: lowStockRows,
  };
}

export interface AtomicBillingRequestItem {
  productId: string;
  qty: number;
}

export type AtomicBillingResult =
  | {
      ok: true;
      billItems: BillItem[];
      saleItems: SaleItem[];
      updatedBatches: Batch[];
      updatedProducts: Product[];
      subtotal: number;
      discountPct: number;
      discountAmount: number;
      taxAmount: number;
      grandTotal: number;
      totalUnits: number;
    }
  | {
      ok: false;
      error: string;
      failedProductId?: string;
    };

/**
 * Atomic multi-item FEFO billing transaction.
 * - Uses authoritative product prices from inventory (never trusts client prices/totals).
 * - Deducts earliest-expiry batches first (FEFO – First Expired, First Out).
 * - All-or-nothing: if any item has insufficient stock, zero stock is deducted.
 */
export function executeAtomicBillingFEFO(
  products: Product[],
  batches: Batch[],
  requestedItems: AtomicBillingRequestItem[],
  rawDiscountPct: number = 0,
  billId: string = `bill-${Date.now()}`,
  now: Date = new Date()
): AtomicBillingResult {
  if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
    return { ok: false, error: 'Add at least one product before generating a bill.' };
  }

  // Merge duplicate product rows cleanly before validating stock
  const mergedMap = new Map<string, number>();
  for (const item of requestedItems) {
    if (!item.productId || typeof item.qty !== 'number' || !Number.isFinite(item.qty)) {
      return { ok: false, error: 'Invalid product or quantity in bill.' };
    }
    const qty = Math.floor(item.qty);
    if (qty <= 0) {
      return {
        ok: false,
        error: 'Quantity must be at least 1 for every product.',
        failedProductId: item.productId,
      };
    }
    mergedMap.set(item.productId, (mergedMap.get(item.productId) ?? 0) + qty);
  }

  // Work on cloned batches so failures never cause partial deductions
  let workingBatches: Batch[] = batches.map((b) => ({ ...b }));
  const productMap = new Map(products.map((p) => [p.id, p]));
  const billItems: BillItem[] = [];
  const saleItems: SaleItem[] = [];
  const soldQtyByProduct = new Map<string, number>();

  let subtotal = 0;
  let totalUnits = 0;
  let lineIndex = 0;

  for (const [productId, qty] of Array.from(mergedMap.entries())) {
    const product = productMap.get(productId);
    if (!product) {
      return {
        ok: false,
        error: `Selected product (${productId}) was not found in inventory.`,
        failedProductId: productId,
      };
    }

    // Earliest-expiry-first (FEFO) batch selection
    const eligibleBatches = workingBatches
      .filter((b) => b.productId === productId && b.qtyOnHand > 0)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

    const availableStock = eligibleBatches.reduce((sum, b) => sum + b.qtyOnHand, 0);
    if (availableStock < qty) {
      return {
        ok: false,
        error: `Insufficient stock for ${product.name}. Requested ${qty}, available ${availableStock}.`,
        failedProductId: productId,
      };
    }

    let remaining = qty;
    const deductions = new Map<string, number>();
    const batchDeductions: BatchDeductionDetail[] = [];
    const authoritativePrice = Number(product.sellingPrice) || 0;

    for (const batch of eligibleBatches) {
      if (remaining <= 0) break;
      const take = Math.min(batch.qtyOnHand, remaining);
      deductions.set(batch.id, take);
      batchDeductions.push({
        batchId: batch.id,
        batchNo: batch.batchNo,
        expiryDate: batch.expiryDate,
        qty: take,
        costPrice: batch.costPrice,
      });
      saleItems.push({
        productId,
        batchId: batch.id,
        qty: take,
        unitPrice: authoritativePrice,
      });
      remaining -= take;
    }

    workingBatches = workingBatches.map((b) => {
      const taken = deductions.get(b.id);
      if (!taken) return b;
      return { ...b, qtyOnHand: b.qtyOnHand - taken };
    });

    const lineSubtotal = Math.round(authoritativePrice * qty * 100) / 100;
    subtotal += lineSubtotal;
    totalUnits += qty;
    soldQtyByProduct.set(productId, qty);
    lineIndex += 1;

    billItems.push({
      id: `${billId}-item-${lineIndex}`,
      billId,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      barcode: product.barcode,
      category: product.category,
      qty,
      unitPrice: authoritativePrice,
      subtotal: lineSubtotal,
      batchDeductions,
    });
  }

  subtotal = Math.round(subtotal * 100) / 100;
  const discountPct = Math.min(50, Math.max(0, Number(rawDiscountPct) || 0));
  const discountAmount = Math.round(subtotal * (discountPct / 100) * 100) / 100;
  const taxAmount = 0; // No tax configuration exists in RetailIQ
  const grandTotal = Math.max(0, Math.round((subtotal - discountAmount + taxAmount) * 100) / 100);

  // Update product movement & daily demand avg cleanly for sold items
  const updatedProducts: Product[] = products.map((p) => {
    const soldQty = soldQtyByProduct.get(p.id);
    if (!soldQty) return p;

    const remainingBatches = workingBatches
      .filter((b) => b.productId === p.id && b.qtyOnHand > 0)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

    const earliestDays = remainingBatches[0] ? daysUntil(remainingBatches[0].expiryDate, now) : 999;
    const nextDemandAvg = Math.round((p.dailyDemandAvg * 0.85 + soldQty * 0.15) * 10) / 10;

    let nextMoverState = p.moverState;
    if (remainingBatches.length > 0 && earliestDays <= RETAIL_CONFIG.expiryRiskThresholds.highDays) {
      nextMoverState = 'near-expiry';
    } else if (soldQty > 0 && (p.moverState === 'dead stock' || p.moverState === 'slow-moving')) {
      nextMoverState = 'normal';
    }

    return {
      ...p,
      dailyDemandAvg: Math.max(0.5, nextDemandAvg),
      moverState: nextMoverState,
    };
  });

  return {
    ok: true,
    billItems,
    saleItems,
    updatedBatches: workingBatches,
    updatedProducts,
    subtotal,
    discountPct,
    discountAmount,
    taxAmount,
    grandTotal,
    totalUnits,
  };
}

/**
 * Updates or creates today's DailySalesPoint so Dashboard & Reports charts update immediately.
 */
export function upsertDailySalesSeries(
  series: DailySalesPoint[],
  revenueDelta: number,
  unitsDelta: number,
  wasteAvoidedDelta: number = 0,
  now: Date = new Date()
): DailySalesPoint[] {
  const todayIso = addDaysIso(now, 0);
  const label = now.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  const exists = series.some((pt) => pt.date === todayIso);

  if (exists) {
    return series.map((pt) =>
      pt.date === todayIso
        ? {
            ...pt,
            revenue: Math.round((pt.revenue + revenueDelta) * 100) / 100,
            units: pt.units + unitsDelta,
            wasteAvoided: Math.round((pt.wasteAvoided + wasteAvoidedDelta) * 100) / 100,
          }
        : pt
    );
  }

  return [
    ...series.slice(-13),
    {
      date: todayIso,
      label,
      revenue: Math.round(revenueDelta * 100) / 100,
      units: unitsDelta,
      wasteAvoided: Math.round(wasteAvoidedDelta * 100) / 100,
    },
  ];
}

