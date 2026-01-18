import { useState, useEffect } from 'react';
import { subscriptionApiService } from '@/services/subscription-api';
import { SubscriptionProduct } from '@/types/subscription';

export interface UserSubscription {
  productId: string;
  variantId: string;
  status: 'active' | 'expired' | 'cancelled' | 'none';
  startDate?: string;
  endDate?: string;
}

export function useSubscription() {
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [availableProducts, setAvailableProducts] = useState<SubscriptionProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);

      // TODO: Replace with actual API call to get user's current subscription
      // const userSub = await subscriptionApiService.getCurrentSubscription();

      // Mock current subscription - replace with real data
      const mockSubscription: UserSubscription = {
        productId: 'basic',
        variantId: 'basic-monthly',
        status: 'active',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
      };

      setCurrentSubscription(mockSubscription);

      // Load all available products
      const products = await subscriptionApiService.getProducts();
      setAvailableProducts(products);
    } catch (error) {
      console.error('Failed to load subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentProduct = () => {
    if (!currentSubscription) return null;
    return availableProducts.find(p => p.id === currentSubscription.productId);
  };

  const getCurrentVariant = () => {
    const product = getCurrentProduct();
    if (!product || !currentSubscription) return null;
    return product.variants.find(v => v.id === currentSubscription.variantId);
  };

  const getUpgradeOptions = () => {
    if (!currentSubscription || currentSubscription.status !== 'active') {
      return availableProducts; // Show all plans if no active subscription
    }

    const currentProduct = getCurrentProduct();
    if (!currentProduct) return [];

    // Find plans that are higher tier than current
    const currentIndex = availableProducts.findIndex(p => p.id === currentProduct.id);
    return availableProducts.slice(currentIndex + 1);
  };

  const hasUpgradeOptions = () => {
    return getUpgradeOptions().length > 0;
  };

  return {
    currentSubscription,
    currentProduct: getCurrentProduct(),
    currentVariant: getCurrentVariant(),
    availableProducts,
    upgradeOptions: getUpgradeOptions(),
    hasUpgradeOptions: hasUpgradeOptions(),
    loading,
    refresh: loadSubscriptionData,
  };
}
