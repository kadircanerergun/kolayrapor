import { apiClient } from "@/lib/axios";
import { API_BASE_URL } from "@/lib/constants";
import type {
  ApiProduct,
  ApiSubscription,
  ApiCredit,
  CardInfo,
  ChangePlanOptions,
  CreditPackage,
  PlanChangeOption,
  PlanChangeResult,
  StoreMySubscription,
  SubscriptionProduct,
  SubscriptionResponse,
  SavedCard,
  ThreeDStatus,
} from "@/types/subscription";

const BILLING_CYCLE_LABELS: Record<string, { name: string; duration: string }> =
  {
    monthly: { name: "Aylık", duration: "1 Ay" },
    yearly: { name: "Yıllık", duration: "12 Ay" },
  };

/**
 * The store endpoints already answer in Turkish ("Zaten bu plana abonesiniz",
 * "Yenileme işlemi sürüyor…"), so prefer the server's own wording and only
 * fall back when there is none.
 */
function apiErrorMessage(error: any, fallback: string): string {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    fallback
  );
}

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
    description: plan.description ?? undefined,
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
  const visiblePlans = (product.plans || []).filter(
    (p) => p.isActive && p.isPurchasable && !p.isDemo,
  );

  return {
    id: product.id,
    name: product.name,
    description: product.description || "",
    features: product.features || [],
    variants: visiblePlans.map(mapPlanToVariant),
    isRecommended: product.isRecommended,
    tier: Number(product.tier ?? 0),
  };
}

export interface ApiPharmacy {
  id: string;
  name: string;
  nameSurname: string;
  pharmacyPhone: string;
  glnNumber: string;
  tcNumber: string | null;
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
  tcNumber?: string;
  address?: string;
  phone?: string;
  email?: string;
  ipAddress?: string;
  acceptedAgreementVersionIds?: string[];
}

export interface PendingAgreement {
  id: string;
  categoryId: string;
  version: string;
  title: string;
  content: string;
  requiresReApproval: boolean;
  isActive: boolean;
  publishedAt: string;
  category?: {
    id: string;
    slug: string;
    name: string;
  };
}

export interface AgreementStatus {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  activeVersionId: string;
  activeVersionTitle: string;
  accepted: boolean;
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
    data: Partial<Pick<ApiPharmacy, "name" | "nameSurname" | "pharmacyPhone" | "glnNumber" | "tcNumber" | "address" | "phone" | "email">>,
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
      .map(mapProductToSubscriptionProduct)
      .filter((p) => p.variants.length > 0);
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
    options?: { savedCardId?: string },
  ): Promise<SubscriptionResponse> {
    try {
      const body: Record<string, unknown> = { planId };
      if (options?.savedCardId) {
        body.savedCardId = options.savedCardId;
      } else {
        body.cardInfo = cardInfo;
      }

      const response = await apiClient.post(
        `${API_BASE_URL}/store/subscribe`,
        body,
      );
      const data = response.data ?? {};

      // 3D Secure flow — API returns { url, html, merchantOrderId }
      if (data.url || data.html) {
        return {
          success: true,
          message: "3D doğrulama gerekiyor",
          threeDUrl: data.url,
          threeDHtml: data.html,
          merchantOrderId: data.merchantOrderId,
        };
      }

      return {
        success: true,
        message: "Lisans başarıyla oluşturuldu!",
        data: {
          subscriptionId: data.subscription?.id,
          status: data.subscription?.status,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.message ||
          "Lisans işlemi başarısız oldu",
      };
    }
  }

  // ─── Plan change (upgrade / downgrade) ─────────────────

  /**
   * Everything the plan-change screen needs in one call: the current
   * subscription, any scheduled downgrade, and every plan with its direction,
   * prorated charge and bonus credits already worked out by the server.
   *
   * Plans that cannot be switched to are still in `options`, with
   * `available: false` and a Turkish `reason` — grey them out, don't hide them.
   */
  async getChangePlanOptions(): Promise<ChangePlanOptions> {
    const response = await apiClient.get<ChangePlanOptions>(
      `${API_BASE_URL}/store/change-plan/options`,
    );
    return {
      current: response.data?.current ?? null,
      pendingChange: response.data?.pendingChange ?? null,
      options: response.data?.options ?? [],
    };
  }

  /**
   * A freshly recalculated offer for one plan, asked for as the confirmation
   * dialog opens — so payment is never taken against an offer made minutes ago.
   */
  async previewPlanChange(
    planId: string,
  ): Promise<{ option: PlanChangeOption | null; error?: string }> {
    try {
      const response = await apiClient.post<PlanChangeOption>(
        `${API_BASE_URL}/store/change-plan/preview`,
        { planId },
      );
      return { option: response.data ?? null };
    } catch (error: any) {
      return {
        option: null,
        error: apiErrorMessage(error, "Plan değişikliği hesaplanamadı"),
      };
    }
  }

  /**
   * Apply a plan change. The server decides the direction — we never say
   * "upgrade" or "downgrade".
   *
   * `acknowledgedChargeAmount` is the KDV-included figure the user was just
   * shown. If the server recalculates a different one it answers 409 with a
   * fresh offer instead of charging: `{ conflict: true, freshOption }`.
   *
   * A card is only needed when the offer said `requiresPayment` — a free
   * upgrade and every downgrade go through without one.
   */
  async changePlan(
    planId: string,
    options?: {
      acknowledgedChargeAmount?: number;
      cardInfo?: CardInfo;
      savedCardId?: string;
    },
  ): Promise<PlanChangeResult> {
    try {
      const body: Record<string, unknown> = { planId };
      if (options?.acknowledgedChargeAmount !== undefined) {
        body.acknowledgedChargeAmount = options.acknowledgedChargeAmount;
      }
      if (options?.savedCardId) {
        body.savedCardId = options.savedCardId;
      } else if (options?.cardInfo) {
        body.cardInfo = options.cardInfo;
      }

      const response = await apiClient.post(
        `${API_BASE_URL}/store/change-plan`,
        body,
      );
      const data = response.data ?? {};

      // 3D Secure flow — API returns { url, html, merchantOrderId }
      if (data.url || data.html) {
        return {
          success: true,
          message: "3D doğrulama gerekiyor",
          threeDUrl: data.url,
          threeDHtml: data.html,
          merchantOrderId: data.merchantOrderId,
        };
      }

      // Downgrade — nothing charged, queued for the end of the period.
      if (data.scheduled) {
        return {
          success: true,
          scheduled: true,
          effectiveAt: data.effectiveAt,
          message: "Plan değişikliği dönem sonunda uygulanacak.",
        };
      }

      return {
        success: true,
        applied: true,
        charged: Number(data.charged ?? 0),
        message: "Lisans planı başarıyla değiştirildi!",
        data: {
          subscriptionId: data.subscription?.id,
          status: data.subscription?.status,
        },
      };
    } catch (error: any) {
      // 409 — the offer moved under us. Hand the fresh one back so the caller
      // can redraw; the user is never charged an amount they did not see.
      if (error.response?.status === 409) {
        const body = error.response.data ?? {};
        const freshOption: PlanChangeOption | undefined =
          body.option ?? body.freshOption ?? body.preview ?? undefined;
        return {
          success: false,
          conflict: true,
          freshOption,
          error: apiErrorMessage(
            error,
            "Tutar güncellendi. Lütfen yeni tutarı onaylayın.",
          ),
        };
      }

      return {
        success: false,
        error: apiErrorMessage(error, "Plan değişikliği başarısız oldu"),
      };
    }
  }

  /** Cancels a downgrade that was queued for the end of the period. */
  async cancelPendingPlanChange(): Promise<SubscriptionResponse> {
    try {
      await apiClient.delete(`${API_BASE_URL}/store/change-plan/pending`);
      return {
        success: true,
        message: "Planlanmış değişiklik iptal edildi.",
      };
    } catch (error: any) {
      return {
        success: false,
        error: apiErrorMessage(error, "Planlanmış değişiklik iptal edilemedi"),
      };
    }
  }

  async purchaseCredits(
    productId: string,
    cardInfo?: CardInfo,
    options?: { savedCardId?: string },
  ): Promise<SubscriptionResponse> {
    try {
      const body: Record<string, unknown> = { productId };
      if (options?.savedCardId) {
        body.savedCardId = options.savedCardId;
      } else {
        body.cardInfo = cardInfo;
      }

      const response = await apiClient.post(
        `${API_BASE_URL}/store/purchase`,
        body,
      );
      const data = response.data ?? {};

      // 3D Secure flow — API returns { url, html, merchantOrderId }
      if (data.url || data.html) {
        return {
          success: true,
          message: "3D doğrulama gerekiyor",
          threeDUrl: data.url,
          threeDHtml: data.html,
          merchantOrderId: data.merchantOrderId,
        };
      }

      // Server can return HTTP 200 but indicate failure in the body. Detect any
      // of the common shapes and surface the message to the UI.
      const status = String(data.purchase?.status ?? "").toUpperCase();
      const failedByStatus = status === "FAILED" || status === "REJECTED" || status === "ERROR";
      if (data.success === false || data.error || failedByStatus) {
        return {
          success: false,
          error:
            data.message ||
            data.error ||
            data.purchase?.message ||
            "Satın alma işlemi başarısız oldu",
        };
      }

      return {
        success: true,
        message: "Ek kredi satın alma işlemi başarılı!",
        data: {
          subscriptionId: data.purchase?.id,
          status: data.purchase?.status,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.response?.data?.error ||
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
        message: "Lisans başarıyla iptal edildi.",
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

  async resumeSubscription(): Promise<SubscriptionResponse> {
    try {
      await apiClient.post(`${API_BASE_URL}/store/resume-subscription`);
      return {
        success: true,
        message: "Lisansınız devam ettirildi.",
      };
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.message ||
          "Lisans devam ettirilemedi",
      };
    }
  }

  // ─── Agreements ──────────────────────────────────────────

  async getRegistrationAgreements(
    slugs?: string[],
  ): Promise<PendingAgreement[]> {
    try {
      const params = slugs?.length ? `?slugs=${slugs.join(",")}` : "";
      const response = await apiClient.get<PendingAgreement[]>(
        `${API_BASE_URL}/my-pharmacy/registration-agreements${params}`,
      );
      return response.data;
    } catch {
      return [];
    }
  }

  async getAgreementVersion(
    versionId: string,
  ): Promise<PendingAgreement | null> {
    try {
      const response = await apiClient.get<PendingAgreement>(
        `${API_BASE_URL}/my-pharmacy/agreements/versions/${versionId}`,
      );
      return response.data;
    } catch {
      return null;
    }
  }

  async getPendingAgreements(): Promise<PendingAgreement[]> {
    try {
      const response = await apiClient.get<PendingAgreement[]>(
        `${API_BASE_URL}/my-pharmacy/agreements/pending`,
      );
      return response.data;
    } catch {
      return [];
    }
  }

  async getAgreementStatus(): Promise<AgreementStatus[]> {
    try {
      const response = await apiClient.get<AgreementStatus[]>(
        `${API_BASE_URL}/my-pharmacy/agreements/status`,
      );
      return response.data;
    } catch {
      return [];
    }
  }

  async acceptAgreement(versionId: string): Promise<boolean> {
    try {
      await apiClient.post(
        `${API_BASE_URL}/my-pharmacy/agreements/${versionId}/accept`,
      );
      return true;
    } catch {
      return false;
    }
  }

  // ─── 3D Secure ─────────────────────────────────────────

  /**
   * Where a 3D payment actually stands, according to the server.
   *
   * The webview navigation event is only a hint — it can be missed, and the
   * user can close the window mid-flow. This is what we trust.
   *
   * Returns null when the answer is not yet knowable (offline, transient
   * error), so callers keep polling instead of treating it as a failure.
   */
  async get3DStatus(merchantOrderId: string): Promise<ThreeDStatus | null> {
    try {
      const response = await apiClient.get<ThreeDStatus>(
        `${API_BASE_URL}/store/3d-status/${encodeURIComponent(merchantOrderId)}`,
      );
      return response.data;
    } catch {
      return null;
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
