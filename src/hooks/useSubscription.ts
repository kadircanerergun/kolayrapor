import { usePharmacy } from "@/contexts/pharmacy-context";
import type { SubscriptionProduct } from "@/types/subscription";

export function useSubscription() {
  const {
    pharmacy,
    isPending,
    ipAddress,
    subscription: currentSubscription,
    creditBalance,
    products: availableProducts,
    creditPackages,
    loading,
    error,
    refresh,
  } = usePharmacy();

  const getCurrentProduct = (): SubscriptionProduct | null => {
    if (!currentSubscription) return null;
    return (
      availableProducts.find((p) =>
        p.variants.some((v) => v.id === currentSubscription.planId),
      ) ?? null
    );
  };

  const getCurrentVariant =
    (): SubscriptionProduct["variants"][number] | null => {
      const product = getCurrentProduct();
      if (!product || !currentSubscription) return null;
      return (
        product.variants.find(
          (v) => v.id === currentSubscription.planId,
        ) ?? null
      );
    };

  const getUpgradeOptions = (): SubscriptionProduct[] => {
    if (!currentSubscription || currentSubscription.status !== "active") {
      return availableProducts;
    }

    const currentProduct = getCurrentProduct();
    if (!currentProduct) return availableProducts;

    const currentIndex = availableProducts.findIndex(
      (p) => p.id === currentProduct.id,
    );
    return availableProducts.slice(currentIndex + 1);
  };

  const currentProduct = getCurrentProduct();
  const currentVariant = getCurrentVariant();
  const upgradeOptions = getUpgradeOptions();

  return {
    pharmacy,
    isPending,
    ipAddress,
    currentSubscription,
    creditBalance,
    currentProduct,
    currentVariant,
    availableProducts,
    creditPackages,
    upgradeOptions,
    hasUpgradeOptions: upgradeOptions.length > 0,
    loading,
    error,
    refresh,
  };
}
