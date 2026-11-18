import {
  ActivityEvent,
  ArchivedReport,
  Batch,
  Bill,
  DailySalesPoint,
  Offer,
  Product,
  Recommendation,
  Reservation,
  Sale,
  Shop,
  Supplier,
} from './retail-types';

export const PRIMARY_SHOP_ID = 'shop-annapoorna-01';

/**
 * Builds clean store configuration with ZERO demo inventory items or batches.
 * Products, batches, sales, bills, offers, and recommendations start completely clean
 * and are populated dynamically as real items and batches are onboarded.
 */
export function buildSeedData(now: Date = new Date()): {
  shop: Shop;
  nearbyShops: Shop[];
  suppliers: Supplier[];
  products: Product[];
  batches: Batch[];
  sales: Sale[];
  bills: Bill[];
  archivedReports: ArchivedReport[];
  offers: Offer[];
  reservations: Reservation[];
  recommendations: Recommendation[];
  activities: ActivityEvent[];
  salesSeries: DailySalesPoint[];
} {
  const shop: Shop = {
    id: PRIMARY_SHOP_ID,
    name: 'Annapoorna Provision Stores',
    ownerName: 'Ramesh Kumar',
    address: '12th Main, HAL 2nd Stage, Indiranagar, Bengaluru 560038',
    lat: 12.9784,
    lng: 77.6408,
    defaultRadiusM: 2000,
    phone: '+91 98450 11223',
  };

  const nearbyShops: Shop[] = [
    shop,
    {
      id: 'shop-krishna-02',
      name: 'Sri Krishna Supermarket',
      ownerName: 'Suresh Shetty',
      address: '100 Feet Road, Indiranagar, Bengaluru',
      lat: 12.9735,
      lng: 77.6419,
      defaultRadiusM: 2000,
      phone: '+91 98450 22334',
    },
    {
      id: 'shop-nandini-03',
      name: 'Nandini Milk Parlour & Daily Needs',
      ownerName: 'Manjunath Gowda',
      address: '80 Feet Road, CMH Road, Bengaluru',
      lat: 12.9825,
      lng: 77.6321,
      defaultRadiusM: 1500,
      phone: '+91 98450 33445',
    },
    {
      id: 'shop-lakshmi-04',
      name: 'Lakshmi Daily Needs',
      ownerName: 'Lakshmi Narayanan',
      address: 'Domlur Layout, Bengaluru',
      lat: 12.9632,
      lng: 77.6388,
      defaultRadiusM: 2000,
      phone: '+91 98450 44556',
    },
  ];

  const suppliers: Supplier[] = [
    {
      id: 'sup-01',
      shopId: PRIMARY_SHOP_ID,
      name: 'KMF Nandini Distributors',
      phone: '+91 80 2345 6789',
      leadTimeDays: 1,
      packSize: 12,
    },
    {
      id: 'sup-02',
      shopId: PRIMARY_SHOP_ID,
      name: 'Bengaluru FMCG Wholesale',
      phone: '+91 80 4123 9876',
      leadTimeDays: 2,
      packSize: 10,
    },
    {
      id: 'sup-03',
      shopId: PRIMARY_SHOP_ID,
      name: 'Sri Balaji Grains & Oils',
      phone: '+91 80 2678 1234',
      leadTimeDays: 3,
      packSize: 5,
    },
    {
      id: 'sup-04',
      shopId: PRIMARY_SHOP_ID,
      name: 'Metro Bakery & Snacks Co.',
      phone: '+91 80 3987 6543',
      leadTimeDays: 1,
      packSize: 6,
    },
  ];

  // Clean empty inventory state — no mock/demo products or batches
  return {
    shop,
    nearbyShops,
    suppliers,
    products: [],
    batches: [],
    sales: [],
    bills: [],
    archivedReports: [],
    offers: [],
    reservations: [],
    recommendations: [],
    activities: [],
    salesSeries: [],
  };
}
