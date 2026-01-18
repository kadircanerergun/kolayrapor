export interface SubscriptionVariant {
  id: string;
  name: string;
  duration: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  isPopular?: boolean;
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
