import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  featureFlagsApiService,
  type FeatureFlagMap,
} from "@/services/feature-flags-api";

interface FeatureFlagsContextType {
  flags: FeatureFlagMap;
  loading: boolean;
  /** True only if the flag exists and is enabled for this pharmacy. */
  isEnabled: (key: string) => boolean;
  refresh: () => Promise<void>;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | null>(null);

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlagMap>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await featureFlagsApiService.getFlags();
    setFlags(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_INTERVAL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const isEnabled = useCallback((key: string) => flags[key] === true, [flags]);

  return (
    <FeatureFlagsContext.Provider
      value={{ flags, loading, isEnabled, refresh: load }}
    >
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error(
      "useFeatureFlags must be used within a FeatureFlagsProvider",
    );
  }
  return context;
}

/** Convenience hook: returns whether a single flag is enabled. */
export function useFeatureFlag(key: string): boolean {
  return useFeatureFlags().isEnabled(key);
}
