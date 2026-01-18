import {
  SubscriptionPlan,
  SubscriptionProduct,
  SubscriptionResponse,
} from "@/types/subscription";

class SubscriptionApiService {
  private baseUrl = "http://localhost:3000";

  // Mock data for now - replace with actual API call when backend is ready
  async getProducts(): Promise<SubscriptionProduct[]> {
    // TODO: Replace with actual API call
    // const response = await apiClient.get(`${this.baseUrl}/subscription/products`);
    // return response.data;

    return [
      {
        id: "basic",
        name: "Temel Plan",
        description: "Küçük eczaneler için ideal başlangıç paketi",
        features: [
          "100 reçete sorgulama/ay",
          "Temel rapor kontrolü",
          "E-posta desteği",
          "7/24 sistem erişimi",
        ],
        variants: [
          {
            id: "basic-monthly",
            name: "Aylık",
            duration: "1 Ay",
            price: 299,
          },
          {
            id: "basic-quarterly",
            name: "Üç Aylık",
            duration: "3 Ay",
            price: 799,
            originalPrice: 897,
            discount: 11,
          },
          {
            id: "basic-yearly",
            name: "Yıllık",
            duration: "12 Ay",
            price: 2990,
            originalPrice: 3588,
            discount: 17,
            isPopular: true,
          },
        ],
      },
      {
        id: "professional",
        name: "Profesyonel Plan",
        description: "Orta ölçekli eczaneler için kapsamlı çözüm",
        features: [
          "500 reçete sorgulama/ay",
          "Gelişmiş rapor kontrolü",
          "İlaç stok takibi",
          "Öncelikli destek",
          "API erişimi",
          "Toplu işlem desteği",
        ],
        variants: [
          {
            id: "pro-monthly",
            name: "Aylık",
            duration: "1 Ay",
            price: 699,
          },
          {
            id: "pro-quarterly",
            name: "Üç Aylık",
            duration: "3 Ay",
            price: 1899,
            originalPrice: 2097,
            discount: 9,
          },
          {
            id: "pro-yearly",
            name: "Yıllık",
            duration: "12 Ay",
            price: 6990,
            originalPrice: 8388,
            discount: 17,
            isPopular: true,
          },
        ],
        isRecommended: true,
      },
      {
        id: "enterprise",
        name: "Kurumsal Plan",
        description: "Büyük eczane zincirleri için kurumsal çözüm",
        features: [
          "Sınırsız reçete sorgulama",
          "Tüm özellikler aktif",
          "Özel rapor şablonları",
          "7/24 telefon desteği",
          "Özel entegrasyonlar",
          "Çoklu şube yönetimi",
          "Özel eğitim desteği",
          "SLA garantisi",
        ],
        variants: [
          {
            id: "ent-monthly",
            name: "Aylık",
            duration: "1 Ay",
            price: 1999,
          },
          {
            id: "ent-quarterly",
            name: "Üç Aylık",
            duration: "3 Ay",
            price: 5499,
            originalPrice: 5997,
            discount: 8,
          },
          {
            id: "ent-yearly",
            name: "Yıllık",
            duration: "12 Ay",
            price: 19990,
            originalPrice: 23988,
            discount: 17,
            isPopular: true,
          },
        ],
      },
    ];
  }

  async subscribe(plan: SubscriptionPlan): Promise<SubscriptionResponse> {
    try {
      // TODO: Replace with actual API call when payment is implemented
      // const response = await apiClient.post(`${this.baseUrl}/subscription/subscribe`, plan);

      // Mock response for now
      console.log("Subscription request:", plan);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return {
        success: true,
        message:
          "Abonelik talebiniz alındı. Ödeme sayfasına yönlendiriliyorsunuz...",
        data: {
          subscriptionId: `sub_${Date.now()}`,
          status: "pending",
        },
      };
    } catch (error: any) {
      console.error("Subscription failed:", error);

      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.message ||
          "Abonelik işlemi başarısız oldu",
      };
    }
  }
}

export const subscriptionApiService = new SubscriptionApiService();
