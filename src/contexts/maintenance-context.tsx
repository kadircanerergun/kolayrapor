import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { MAINTENANCE_EVENT, type MaintenanceDetail } from "@/lib/axios";
import { maintenanceApiService } from "@/services/maintenance-api";

interface MaintenanceContextType {
  active: boolean;
  message: string | null;
  endsAt: string | null;
  /** Re-check status now (used by the "try again" button). */
  retry: () => Promise<void>;
}

const MaintenanceContext = createContext<MaintenanceContextType | null>(null);

const POLL_INTERVAL_MS = 30 * 1000;

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const checking = useRef(false);

  // Activation is driven by real 503 responses, so bypass-listed pharmacies
  // (which get 200s) never see the screen.
  useEffect(() => {
    const onMaintenance = (e: Event) => {
      const detail = (e as CustomEvent<MaintenanceDetail>).detail;
      setActive(true);
      setMessage(detail?.message ?? null);
      setEndsAt(detail?.endsAt ?? null);
    };
    window.addEventListener(MAINTENANCE_EVENT, onMaintenance);
    return () => window.removeEventListener(MAINTENANCE_EVENT, onMaintenance);
  }, []);

  const checkStatus = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      const status = await maintenanceApiService.getStatus();
      if (!status.isEnabled) {
        setActive(false);
        setMessage(null);
        setEndsAt(null);
      } else {
        setMessage(status.message);
        setEndsAt(status.endsAt);
      }
    } catch {
      // Network/API still down — stay on the maintenance screen.
    } finally {
      checking.current = false;
    }
  }, []);

  // While active, poll for recovery.
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(checkStatus, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active, checkStatus]);

  return (
    <MaintenanceContext.Provider
      value={{ active, message, endsAt, retry: checkStatus }}
    >
      {children}
    </MaintenanceContext.Provider>
  );
}

export function useMaintenance() {
  const context = useContext(MaintenanceContext);
  if (!context) {
    throw new Error("useMaintenance must be used within a MaintenanceProvider");
  }
  return context;
}
