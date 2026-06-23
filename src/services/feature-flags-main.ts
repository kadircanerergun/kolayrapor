// Main-process feature flag reader.
//
// The renderer has its own FeatureFlagsProvider (React context), but some gates
// run in the main process (e.g. the captcha-solver download/spawn at startup),
// where hooks aren't available. This fetches the same per-pharmacy flag map
// (`GET /my-pharmacy/feature-flags`, resolved server-side by client IP — no auth
// header needed) and caches it briefly so repeated checks are cheap.

import { API_BASE_URL } from "@/lib/constants";

export type FeatureFlagMap = Record<string, boolean>;

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { flags: FeatureFlagMap; at: number } | null = null;

/** Fetch the flag map (cached for CACHE_TTL_MS). Never throws — on failure it
 *  returns the last known flags, or an empty map. */
export async function getFlags(force = false): Promise<FeatureFlagMap> {
  const now = Date.now();
  if (!force && cache && now - cache.at < CACHE_TTL_MS) {
    return cache.flags;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/my-pharmacy/feature-flags`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const flags = ((await res.json()) ?? {}) as FeatureFlagMap;
    cache = { flags, at: now };
    return flags;
  } catch (err) {
    console.warn("[FeatureFlags] fetch failed, using cached/empty:", err);
    return cache?.flags ?? {};
  }
}

/** True only if the flag exists and is enabled for this pharmacy. */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  return (await getFlags())[key] === true;
}
