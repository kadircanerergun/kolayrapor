import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { subscriptionApiService } from "@/services/subscription-api";
import { runReportSync, type SyncMode } from "@/lib/report-sync";
import { historyRequirementsApiService } from "@/services/history-requirements-api";
import {
  PENDING_RECHECK_INTERVAL_MS,
  SYNC_INTERVAL_MS,
} from "@/lib/constants";
import type { ApiPharmacy } from "@/services/subscription-api";
import type {
  ApiSubscription,
  ApiCredit,
  CreditPackage,
  PendingPlanChange,
  SubscriptionProduct,
  SubscriptionTerms,
} from "@/types/subscription";

interface PharmacyContextType {
  pharmacy: ApiPharmacy | null;
  isPending: boolean;
  ipAddress: string | null;
  subscription: ApiSubscription | null;
  /**
   * What is actually paid and received each month. On a dynamic plan this, not
   * `subscription.plan`, holds the real price and credit amount.
   */
  terms: SubscriptionTerms | null;
  /** A downgrade queued for the end of the period, if one is scheduled. */
  pendingChange: PendingPlanChange | null;
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
  const [terms, setTerms] = useState<SubscriptionTerms | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingPlanChange | null>(
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
        // Ilaç/rapor geçmişi gereken ilaçlar — her yüklemede baştan yazılır.
        // Beklenmez; hata olursa önceki liste korunur.
        historyRequirementsApiService.refresh().catch((err) => {
          console.error("History requirements fetch failed:", err);
        });

        // Use store endpoint for subscription + credit in one call
        try {
          const mySubData = await subscriptionApiService.getMySubscription();
          setSubscription(mySubData.subscription);
          setCreditBalance(mySubData.credit);
          setTerms(mySubData.terms ?? null);
          setPendingChange(mySubData.pendingChange ?? null);
        } catch {
          // Fallback to separate calls
          setTerms(null);
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
        setTerms(null);
        setPendingChange(null);
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

  // The pharmacy is identified by IP once at startup, so an account that gets
  // activated afterwards — the usual case, since registering through the
  // KolayAsistan form activates immediately — would keep showing "onay
  // bekliyor" until the app was restarted. While it still looks pending,
  // re-check quietly (no `loading` flip, so the pending screens don't flicker)
  // and pull the full data as soon as the server reports it active.
  const recheckRegistration = useCallback(async () => {
    try {
      const statusData = await subscriptionApiService.getRegistrationStatus();
      const pharmacyData = statusData.registered
        ? statusData.pharmacy ?? null
        : null;
      if (pharmacyData?.isActive) await loadData();
    } catch {
      // Offline or a transient failure — the next tick tries again.
    }
  }, [loadData]);

  // Renewals and changes are applied by the server (scheduled downgrades,
  // monthly renewals at the current price list) — pull them quietly when the
  // user comes back to the app.
  useEffect(() => {
    if (!pharmacy?.isActive) return;
    const refreshSubscription = async () => {
      try {
        const mySubData = await subscriptionApiService.getMySubscription();
        setSubscription(mySubData.subscription);
        setCreditBalance(mySubData.credit);
        setTerms(mySubData.terms ?? null);
        setPendingChange(mySubData.pendingChange ?? null);
      } catch {
        // Offline or a transient failure — keep what is on screen.
      }
    };
    window.addEventListener("focus", refreshSubscription);
    return () => window.removeEventListener("focus", refreshSubscription);
  }, [pharmacy?.isActive]);

  useEffect(() => {
    if (!isPending) return;
    // Also on focus: the user typically finishes activation in a browser and
    // comes back to the app expecting it to know.
    window.addEventListener("focus", recheckRegistration);
    const timer = setInterval(
      recheckRegistration,
      PENDING_RECHECK_INTERVAL_MS,
    );
    return () => {
      window.removeEventListener("focus", recheckRegistration);
      clearInterval(timer);
    };
  }, [isPending, recheckRegistration]);

  // Sync reports from server after pharmacy loads, then every SYNC_INTERVAL_MS.
  // The first sync of an app launch pulls the full window; `pharmacy` is
  // replaced on every loadData() refresh, so a ref keeps that to once.
  const didStartupSyncRef = useRef(false);
  useEffect(() => {
    if (!pharmacy || !pharmacy.isActive) return;

    const syncReports = async (mode: SyncMode) => {
      try {
        await runReportSync(mode);
      } catch (err) {
        console.error("Report sync failed:", err);
      }
    };

    if (!didStartupSyncRef.current) {
      didStartupSyncRef.current = true;
      syncReports("full");
    } else {
      syncReports("incremental");
    }
    const timer = setInterval(() => syncReports("incremental"), SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pharmacy]);

  // Deduct credit locally when a report is generated (optimistic), then
  // reconcile with the server so the displayed balance always matches truth.
  const pharmacyRef = useRef(pharmacy);
  useEffect(() => {
    pharmacyRef.current = pharmacy;
  }, [pharmacy]);

  useEffect(() => {
    const handleCreditDeducted = async () => {
      setCreditBalance((prev) =>
        prev ? { ...prev, balance: Number(prev.balance) - 1 } : prev,
      );
      const id = pharmacyRef.current?.id;
      if (!id) return;
      try {
        const mySubData = await subscriptionApiService.getMySubscription();
        setCreditBalance(mySubData.credit);
      } catch {
        try {
          const credit = await subscriptionApiService.getCreditBalance(id);
          setCreditBalance(credit);
        } catch {
          /* ignore — keep optimistic value */
        }
      }
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
        terms,
        pendingChange,
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
