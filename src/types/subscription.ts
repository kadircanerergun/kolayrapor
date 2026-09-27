// Backend API response types
export interface ApiProduct {
  id: string;
  name: string;
  description: string;
  type: "subscription" | "one_time";
  price: number | null;
  creditAmount: number | null;
  features: string[] | null;
  isRecommended: boolean;
  isActive: boolean;
  /**
   * Package level, managed from the admin panel. The only authority on
   * upgrade vs. downgrade — price says nothing, since Basic Yearly is
   * cheaper per month than Basic Monthly. Legacy products come back as 0.
   */
  tier: number;
  plans: ApiSubscriptionPlan[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiSubscriptionPlan {
  id: string;
  name: string;
  productId: string;
  description: string | null;
  price: number;
  includedCreditAmount: number;
  creditValidityDays: number;
  billingCycle: "monthly" | "yearly";
  maxRequests: number;
  originalPrice: number | null;
  discount: number | null;
  isPopular: boolean;
  isActive: boolean;
  isPurchasable: boolean;
  isDemo: boolean;
  product?: ApiProduct;
  createdAt: string;
  updatedAt: string;
}

export interface ApiSubscription {
  id: string;
  pharmacyId: string;
  planId: string;
  plan: ApiSubscriptionPlan & { product?: ApiProduct };
  status: "active" | "expired" | "cancelled" | "suspended";
  startDate: string;
  endDate: string | null;
  requestCount: number;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  nextBillingDate: string | null;
  renewalRetryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiCredit {
  balance: number;
}

export interface CardInfo {
  cardNumber: string;
  cardHolderName: string;
  expireMonth: string;
  expireYear: string;
  cvc: string;
}

// Store endpoint response for my-subscription
export interface StoreMySubscription {
  subscription: ApiSubscription | null;
  credit: ApiCredit;
  /** A downgrade waiting for the current period to end, if any. */
  pendingChange?: PendingPlanChange | null;
}

// Credit package = ONE_TIME product from /store/products
export interface CreditPackage {
  id: string;
  name: string;
  description: string | null;
  price: number;
  creditAmount: number;
  isActive: boolean;
}

// Frontend display types (mapped from API)
export interface SubscriptionVariant {
  id: string;
  name: string;
  description?: string;
  duration: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  isPopular?: boolean;
  billingCycle: "monthly" | "yearly";
  maxRequests: number;
  includedCreditAmount: number;
}

export interface SubscriptionProduct {
  id: string;
  name: string;
  description: string;
  features: string[];
  variants: SubscriptionVariant[];
  isRecommended?: boolean;
  /** @see ApiProduct.tier */
  tier: number;
}

export interface SubscriptionPlan {
  productId: string;
  variantId: string;
}

export interface SubscriptionResponse {
  success: boolean;
  message?: string;
  data?: {
    subscriptionId: string;
    status: string;
  };
  error?: string;
  /** 3D Secure HTML — if present, show in a webview for card verification */
  threeDHtml?: string;
  /** Hosted 3D page; preferred over threeDHtml (real https origin) */
  threeDUrl?: string;
  merchantOrderId?: string;
}

/** Server-side truth for a 3D payment, polled while the bank page is open. */
export interface ThreeDStatus {
  merchantOrderId: string;
  status: "pending" | "processing" | "completed" | "failed";
  pending: boolean;
  success: boolean;
  message: string | null;
}

export interface SavedCard {
  id: string;
  maskedCardNumber: string;
  cardHolderName: string;
  cardType: string;
  expireMonth: string;
  expireYear: string;
  isDefault: boolean;
}

// ─── Plan change (upgrade / downgrade) ──────────────────
// Every number below is calculated on the server. The client never does
// price arithmetic — it shows what the server sent and echoes it back as
// `acknowledgedChargeAmount` so the bank can only ever charge an amount the
// user actually saw.

export type PlanChangeDirection =
  | "upgrade"
  | "downgrade"
  | "current"
  | "unavailable";

/** `immediate` — applied now. `period_end` — queued for the renewal. */
export type PlanChangeEffect = "immediate" | "period_end";

export interface PendingPlanChange {
  planId: string;
  planName: string;
  /** The `endDate` at the moment the change was scheduled. */
  effectiveAt: string;
  requestedAt: string;
}

/** The subscription as the change-plan screen sees it. */
export interface PlanChangeCurrent {
  subscriptionId: string;
  planId: string;
  planName: string;
  productId: string;
  productName: string;
  tier: number;
  billingCycle: "monthly" | "yearly";
  price: number;
  priceWithKdv: number;
  includedCreditAmount: number;
  startDate: string;
  endDate: string | null;
  nextBillingDate: string | null;
  remainingDays: number;
  /** Unused value of the current period, KDV excluded. */
  unusedValue: number;
  isAdminGrant: boolean;
  cancelAtPeriodEnd: boolean;
  creditBalance: number;
}

export interface PlanChangeOption {
  planId: string;
  planName: string;
  productId: string;
  productName: string;
  tier: number;
  billingCycle: "monthly" | "yearly";
  price: number;
  priceWithKdv: number;
  includedCreditAmount: number;
  direction: PlanChangeDirection;
  effect: PlanChangeEffect;
  /** Unused value of the old plan, deducted from the new price. */
  proratedDiscount: number;
  chargeNow: number;
  chargeNowWithKdv: number;
  bonusCredits: number;
  effectiveAt: string;
  newEndDate: string | null;
  requiresPayment: boolean;
  /** Unavailable plans are returned too, greyed out with a Turkish reason. */
  available: boolean;
  reason: string | null;
}

export interface ChangePlanOptions {
  current: PlanChangeCurrent | null;
  pendingChange: PendingPlanChange | null;
  options: PlanChangeOption[];
}

/**
 * Outcome of `POST /store/change-plan`.
 *
 * `conflict` is the 409: the server recalculated and the amount no longer
 * matches what the user acknowledged. `freshOption` is the new offer — redraw,
 * never charge.
 */
export interface PlanChangeResult extends SubscriptionResponse {
  /** Upgrade applied immediately. */
  applied?: boolean;
  charged?: number;
  /** Downgrade queued for the end of the current period. */
  scheduled?: boolean;
  effectiveAt?: string;
  conflict?: boolean;
  freshOption?: PlanChangeOption;
}
