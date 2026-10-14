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

export type PricingModel = "fixed" | "dynamic";

/**
 * One row of a dynamic plan's price list. `unitPrice` is per credit, KDV
 * excluded; `upTo` is inclusive and `null` means no upper limit. Display only —
 * totals always come from the server's quote.
 */
export interface CreditTier {
  upTo: number | null;
  unitPrice: number;
}

/** The picker limits of a dynamic plan. `creditStep` counts from `minCredits`. */
export interface DynamicPlanFields {
  /** Older servers omit it; treat a missing value as "fixed". */
  pricingModel?: PricingModel;
  creditTiers?: CreditTier[] | null;
  minCredits?: number | null;
  maxCredits?: number | null;
  creditStep?: number | null;
}

export interface ApiSubscriptionPlan extends DynamicPlanFields {
  id: string;
  name: string;
  productId: string;
  description: string | null;
  /** On a dynamic plan: the figure for `minCredits` — "starting from" only. */
  price: number;
  /** On a dynamic plan: the figure for `minCredits` — "starting from" only. */
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
  /**
   * Granted from the admin panel rather than bought — true for the demo
   * licence. Older servers omit it; rely on `plan.isDemo` for the demo.
   */
  isAdminGrant?: boolean;
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

/**
 * What the pharmacy actually pays and receives each month. On a dynamic plan
 * `subscription.plan.price` is only the "starting from" figure, so read these.
 */
export interface SubscriptionTerms {
  price: number;
  priceWithKdv: number;
  includedCreditAmount: number;
  /** The chosen monthly amount on a dynamic plan; null on a fixed one. */
  creditQuantity: number | null;
}

/** `POST /store/quote` — the server's price for one plan at one amount. */
export interface PlanQuote {
  planId: string;
  planName: string;
  pricingModel: PricingModel;
  billingCycle: "monthly" | "yearly";
  creditQuantity: number | null;
  includedCreditAmount: number;
  /** Per credit, KDV excluded. */
  unitPrice: number | null;
  /** Monthly, KDV excluded. */
  price: number;
  /** Monthly, KDV included — the amount to show and to acknowledge. */
  priceWithKdv: number;
}

// Store endpoint response for my-subscription
export interface StoreMySubscription {
  subscription: ApiSubscription | null;
  credit: ApiCredit;
  /** Older servers omit it. */
  terms?: SubscriptionTerms | null;
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
export interface SubscriptionVariant extends DynamicPlanFields {
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
  /**
   * 409 `QUOTE_CHANGED`: the price moved since the user saw it. Nothing was
   * charged — redraw with the fresh figures and ask again.
   */
  conflict?: boolean;
  /** The fresh quote that came with a `conflict` on subscribe. */
  freshQuote?: PlanQuote;
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
  /** Set when the scheduled change is to (or within) a dynamic plan. */
  creditQuantity?: number | null;
  priceWithKdv?: number | null;
  includedCreditAmount?: number | null;
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
  pricingModel?: PricingModel;
  creditQuantity?: number | null;
}

export interface PlanChangeOption extends DynamicPlanFields {
  planId: string;
  planName: string;
  productId: string;
  productName: string;
  tier: number;
  billingCycle: "monthly" | "yearly";
  price: number;
  priceWithKdv: number;
  includedCreditAmount: number;
  /** The amount this offer was priced for, on a dynamic plan. */
  creditQuantity?: number | null;
  /**
   * The pharmacy's own dynamic plan comes back as `current` — still selectable,
   * to change the credit amount.
   */
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
  /** The server's ready Turkish sentence for a scheduled change, if it sent one. */
  serverMessage?: string;
  freshOption?: PlanChangeOption;
}
