import { apiClient } from '@/lib/axios';
import { Recete, ReceteIlac } from '@/types/recete';

export interface GenerateReportRequest {
  barkod: string;
  recete: Recete;
}

export interface ReportResult {
  success: boolean;
  data?: ReceteReportResponse;
  error?: string;
}

export interface ReceteReportResponse {
  isValid: boolean;
  validityScore: number;
  reportEvolutionDetails: string;
  processedAt: string;
  pharmacyId: string;
}

class ReportApiService {
  private baseUrl = 'http://localhost:3000';

  async generateReport(barkod: string, recete: Recete): Promise<ReportResult> {
    try {
      const requestData: GenerateReportRequest = {
        barkod,
        recete
      };

      const response = await apiClient.post(`${this.baseUrl}/report/generate`, requestData);

      return {
        success: true,
        data: response.data as ReceteReportResponse,
      };
    } catch (error: any) {
      console.error('Report generation failed:', error);

      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Report generation failed',
      };
    }
  }
}

export const reportApiService = new ReportApiService();
