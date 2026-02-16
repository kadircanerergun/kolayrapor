import { apiClient } from "@/lib/axios";
import { API_BASE_URL } from "@/lib/constants";
import type {
  ApiProduct,
  ApiSubscription,
  ApiCredit,
  CardInfo,
  CreditPackage,
  StoreMySubscription,
  SubscriptionProduct,
  SubscriptionResponse,
  SavedCard,
} from "@/types/subscription";

const BILLING_CYCLE_LABELS: Record<string, { name: string; duration: string }> =
  {
    monthly: { name: "Aylık", duration: "1 Ay" },
    yearly: { name: "Yıllık", duration: "12 Ay" },
  };

function mapPlanToVariant(
  plan: ApiProduct["plans"][number],
): SubscriptionProduct["variants"][number] {
  const label = BILLING_CYCLE_LABELS[plan.billingCycle] ?? {
    name: plan.name,
    duration: plan.billingCycle,
  };

  return {
    id: plan.id,
    name: plan.name || label.name,
    duration: label.duration,
    price: Number(plan.price),
    originalPrice: plan.originalPrice ? Number(plan.originalPrice) : undefined,
    discount: plan.discount ?? undefined,
    isPopular: plan.isPopular,
    billingCycle: plan.billingCycle,
    maxRequests: plan.maxRequests,
    includedCreditAmount: Number(plan.includedCreditAmount),
  };
}

function mapProductToSubscriptionProduct(
  product: ApiProduct,
): SubscriptionProduct {
  const activePlans = (product.plans || []).filter((p) => p.isActive);

  return {
    id: product.id,
    name: product.name,
    description: product.description || "",
    features: product.features || [],
    variants: activePlans.map(mapPlanToVariant),
    isRecommended: product.isRecommended,
  };
}

export interface ApiPharmacy {
  id: string;
  name: string;
  nameSurname: string;
  pharmacyPhone: string;
  glnNumber: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
}

export interface RegistrationStatus {
  registered: boolean;
  pharmacy?: ApiPharmacy;
  ipAddress: string;
}

export interface RegisterPharmacyData {
  name: string;
  nameSurname: string;
  pharmacyPhone: string;
  glnNumber: string;
  address?: string;
  phone?: string;
  email?: string;
  ipAddress?: string;
}

class SubscriptionApiService {
  async getMyPharmacy(): Promise<ApiPharmacy | null> {
    try {
      const response = await apiClient.get<ApiPharmacy>(
        `${API_BASE_URL}/my-pharmacy`,
      );
      return response.data;
    } catch {
      return null;
    }
  }

  async getRegistrationStatus(): Promise<RegistrationStatus> {
    try {
      const response = await apiClient.get<RegistrationStatus>(
        `${API_BASE_URL}/my-pharmacy/status`,
      );
      return response.data;
    } catch {
      return { registered: false };
    }
  }

  async updateMyPharmacy(
    data: Partial<Pick<ApiPharmacy, "name" | "nameSurname" | "pharmacyPhone" | "glnNumber" | "address" | "phone" | "email">>,
  ): Promise<ApiPharmacy> {
    const response = await apiClient.patch<ApiPharmacy>(
      `${API_BASE_URL}/my-pharmacy`,
      data,
    );
    return response.data;
  }

  async registerPharmacy(data: RegisterPharmacyData): Promise<ApiPharmacy> {
    const response = await apiClient.post<ApiPharmacy>(
      `${API_BASE_URL}/my-pharmacy/register`,
      data,
    );
    return response.data;
  }

  async getProducts(): Promise<SubscriptionProduct[]> {
    const response = await apiClient.get<ApiProduct[]>(
      `${API_BASE_URL}/products`,
    );
    return response.data
      .filter((p) => p.type === "subscription")
      .map(mapProductToSubscriptionProduct);
  }

  async getCreditPackages(): Promise<CreditPackage[]> {
    const response = await apiClient.get<ApiProduct[]>(
      `${API_BASE_URL}/store/products`,
    );
    return response.data.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      creditAmount: Number(p.creditAmount),
      isActive: p.isActive,
    }));
  }

  async getMySubscription(): Promise<StoreMySubscription> {
    const response = await apiClient.get<StoreMySubscription>(
      `${API_BASE_URL}/store/my-subscription`,
    );
    return response.data;
  }

  async getActiveSubscription(
    pharmacyId: string,
  ): Promise<ApiSubscription | null> {
    try {
      const response = await apiClient.get<ApiSubscription>(
        `${API_BASE_URL}/subscriptions/pharmacy/${pharmacyId}/active`,
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getCreditBalance(pharmacyId: string): Promise<ApiCredit> {
    const response = await apiClient.get<ApiCredit>(
      `${API_BASE_URL}/credits/pharmacy/${pharmacyId}`,
    );
    return response.data;
  }

  async subscribe(
    planId: string,
    cardInfo?: CardInfo,
    options?: { savedCardId?: string; saveCard?: boolean },
  ): Promise<SubscriptionResponse> {
    try {
      const body: Record<string, unknown> = { planId };
      if (options?.savedCardId) {
        body.savedCardId = options.savedCardId;
      } else {
        body.cardInfo = cardInfo;
        if (options?.saveCard) {
          body.saveCard = "true";
        }
      }

      const response = await apiClient.post(
        `${API_BASE_URL}/store/subscribe`,
        body,
      );
      return {
        success: true,
        message: "Abonelik başarıyla oluşturuldu!",
        data: {
          subscriptionId: response.data.subscription?.id,
          status: response.data.subscription?.status,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.message ||
          "Abonelik işlemi başarısız oldu",
      };
    }
  }

  async purchaseCredits(
    productId: string,
    cardInfo?: CardInfo,
    options?: { savedCardId?: string; saveCard?: boolean },
  ): Promise<SubscriptionResponse> {
    try {
      const body: Record<string, unknown> = { productId };
      if (options?.savedCardId) {
        body.savedCardId = options.savedCardId;
      } else {
        body.cardInfo = cardInfo;
        if (options?.saveCard) {
          body.saveCard = "true";
        }
      }

      const response = await apiClient.post(
        `${API_BASE_URL}/store/purchase`,
        body,
      );
      return {
        success: true,
        message: "Kredi satın alma işlemi başarılı!",
        data: {
          subscriptionId: response.data.purchase?.id,
          status: response.data.purchase?.status,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.message ||
          "Satın alma işlemi başarısız oldu",
      };
    }
  }

  async cancelSubscription(): Promise<SubscriptionResponse> {
    try {
      await apiClient.post(`${API_BASE_URL}/store/cancel-subscription`);
      return {
        success: true,
        message: "Abonelik başarıyla iptal edildi.",
      };
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.message ||
          "İptal işlemi başarısız oldu",
      };
    }
  }

  // ─── Saved Cards ───────────────────────────────────────

  async getSavedCards(): Promise<SavedCard[]> {
    try {
      const response = await apiClient.get<SavedCard[]>(
        `${API_BASE_URL}/store/cards`,
      );
      return response.data;
    } catch {
      return [];
    }
  }

  async addCard(cardInfo: CardInfo): Promise<SavedCard> {
    const response = await apiClient.post<SavedCard>(
      `${API_BASE_URL}/store/cards`,
      { cardInfo },
    );
    return response.data;
  }

  async removeCard(cardId: string): Promise<boolean> {
    try {
      await apiClient.delete(`${API_BASE_URL}/store/cards/${cardId}`);
      return true;
    } catch {
      return false;
    }
  }
}

export const subscriptionApiService = new SubscriptionApiService();
