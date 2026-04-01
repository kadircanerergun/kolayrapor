/** KDV (Katma Deger Vergisi) rate: 20% for digital services in Turkey */
export const KDV_RATE = 0.2;

/** Calculate KDV amount from a base (VAT-exclusive) price */
export function calculateKdv(basePrice: number): number {
  return Math.round(basePrice * KDV_RATE * 100) / 100;
}

/** Calculate VAT-inclusive price from a base (VAT-exclusive) price */
export function priceWithKdv(basePrice: number): number {
  return Math.round(basePrice * (1 + KDV_RATE) * 100) / 100;
}

/** Format a price as Turkish Lira string */
export function formatPrice(amount: number): string {
  return `₺${amount.toFixed(2)}`;
}
