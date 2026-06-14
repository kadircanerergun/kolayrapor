import { apiClient } from "@/lib/axios";
import { API_BASE_URL } from "@/lib/constants";

export type FeatureFlagMap = Record<string, boolean>;

class FeatureFlagsApiService {
  /**
   * Resolved feature flags for this pharmacy (by client IP). Returns an empty
   * map if the pharmacy is unregistered or the request fails.
   */
  async getFlags(): Promise<FeatureFlagMap> {
    try {
      const response = await apiClient.get<FeatureFlagMap>(
        `${API_BASE_URL}/my-pharmacy/feature-flags`,
      );
      return response.data ?? {};
    } catch {
      return {};
    }
  }
}

export const featureFlagsApiService = new FeatureFlagsApiService();
