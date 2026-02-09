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
  billingCycle: "monthly" | "yearly";
  maxRequests: number;
  originalPrice: number | null;
  discount: number | null;
  isPopular: boolean;
  isActive: boolean;
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
}
