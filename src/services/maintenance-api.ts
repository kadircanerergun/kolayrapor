import { apiClient } from "@/lib/axios";
import { API_BASE_URL } from "@/lib/constants";

export interface MaintenanceStatus {
  isEnabled: boolean;
  message: string | null;
  endsAt: string | null;
}

class MaintenanceApiService {
  /**
   * Public maintenance status — never blocked by the maintenance guard.
   * Used to poll for recovery while the maintenance screen is shown.
   */
  async getStatus(): Promise<MaintenanceStatus> {
    const response = await apiClient.get<MaintenanceStatus>(
      `${API_BASE_URL}/maintenance/status`,
    );
    return response.data;
  }
}

export const maintenanceApiService = new MaintenanceApiService();
