import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { subscriptionApiService } from "@/services/subscription-api";
import { reportApiService } from "@/services/report-api";
import { syncReportsFromServer } from "@/lib/db";
import { SYNC_DEFAULT_LOOKBACK_DAYS } from "@/lib/constants";
import type { ApiPharmacy } from "@/services/subscription-api";
import type {
  ApiSubscription,
  ApiCredit,
  CreditPackage,
  SubscriptionProduct,
} from "@/types/subscription";

interface PharmacyContextType {
  pharmacy: ApiPharmacy | null;
  isPending: boolean;
  ipAddress: string | null;
  subscription: ApiSubscription | null;
  creditBalance: ApiCredit | null;
  products: SubscriptionProduct[];
  creditPackages: CreditPackage[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const PharmacyContext = createContext<PharmacyContextType | null>(null);

export function PharmacyProvider({ children }: { children: ReactNode }) {
  const [pharmacy, setPharmacy] = useState<ApiPharmacy | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<ApiSubscription | null>(
    null,
  );
  const [creditBalance, setCreditBalance] = useState<ApiCredit | null>(null);
  const [products, setProducts] = useState<SubscriptionProduct[]>([]);
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch products (public endpoint, always works)
      const [productsData, creditPackagesData] = await Promise.all([
        subscriptionApiService.getProducts(),
        subscriptionApiService.getCreditPackages().catch(() => []),
      ]);
      setProducts(productsData);
      setCreditPackages(creditPackagesData);

      // Try to identify pharmacy by IP (includes pending pharmacies)
      const statusData = await subscriptionApiService.getRegistrationStatus();
      const pharmacyData = statusData.registered
        ? statusData.pharmacy ?? null
        : null;
      setPharmacy(pharmacyData);
      setIsPending(pharmacyData ? !pharmacyData.isActive : false);
      setIpAddress(statusData.ipAddress ?? null);

      if (pharmacyData && pharmacyData.isActive) {
        // Use store endpoint for subscription + credit in one call
        try {
          const mySubData = await subscriptionApiService.getMySubscription();
          setSubscription(mySubData.subscription);
          setCreditBalance(mySubData.credit);
        } catch {
          // Fallback to separate calls
          try {
            const sub = await subscriptionApiService.getActiveSubscription(
              pharmacyData.id,
            );
            setSubscription(sub);
          } catch {
            setSubscription(null);
          }
          try {
            const credit = await subscriptionApiService.getCreditBalance(
              pharmacyData.id,
            );
            setCreditBalance(credit);
          } catch {
            setCreditBalance(null);
          }
        }
      } else {
        setSubscription(null);
        setCreditBalance(null);
      }
    } catch (err) {
      console.error("Failed to load pharmacy data:", err);
      setError("Eczane bilgileri yüklenirken hata oluştu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync reports from server after pharmacy loads
  useEffect(() => {
    if (!pharmacy || !pharmacy.isActive) return;

    const syncReports = async () => {
      try {
        const SYNC_KEY = "kolayrapor_lastSyncedAt";
        const lastSyncedAt = localStorage.getItem(SYNC_KEY);
        const since =
          lastSyncedAt ||
          new Date(Date.now() - SYNC_DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
        const reports = await reportApiService.getMyReports(since);
        if (reports.length > 0) {
          await syncReportsFromServer(reports);
        }
        localStorage.setItem(SYNC_KEY, new Date().toISOString());
      } catch (err) {
        console.error("Report sync failed:", err);
      }
    };

    syncReports();
  }, [pharmacy]);

  // Deduct 1 credit locally when a report is generated
  useEffect(() => {
    const handleCreditDeducted = () => {
      setCreditBalance((prev) =>
        prev ? { ...prev, balance: prev.balance - 1 } : prev,
      );
    };
    window.addEventListener("credit-deducted", handleCreditDeducted);
    return () =>
      window.removeEventListener("credit-deducted", handleCreditDeducted);
  }, []);

  return (
    <PharmacyContext.Provider
      value={{
        pharmacy,
        isPending,
        ipAddress,
        subscription,
        creditBalance,
        products,
        creditPackages,
        loading,
        error,
        refresh: loadData,
      }}
    >
      {children}
    </PharmacyContext.Provider>
  );
}

export function usePharmacy() {
  const context = useContext(PharmacyContext);
  if (!context) {
    throw new Error("usePharmacy must be used within a PharmacyProvider");
  }
  return context;
}
