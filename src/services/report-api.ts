import { apiClient } from "@/lib/axios";
import { API_BASE_URL } from "@/lib/constants";
import { encryptJson, decryptJson } from "@/lib/crypto";
import { Recete } from "@/types/recete";
import { maskSurname } from "@/utils/mask-name";
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
  reportId: string;
  isValid: boolean;
  validityScore: number;
  reportEvolutionDetails: string;
  processedAt: string;
  pharmacyId: string;
}

export interface SyncedReport {
  id: string;
  receteNo: string;
  barkod: string;
  raporNo: string | null;
  ilacAd: string | null;
  isValid: boolean;
  validityScore: number;
  reportEvolutionDetails: string;
  reportIssues: string[] | null;
  processedAt: string;
  /**
   * Patient name for cross-computer synced records. The surname is sent to the
   * server already masked (see generateReport); the client masks it again on
   * the way in so older records stored before masking never surface a full
   * surname.
   */
  hastaAd?: string | null;
  hastaSoyad?: string | null;
  /** Reçete tarihi — cross-computer kayıtların listede tarihli görünmesi için. */
  receteTarihi?: string | null;
}

export interface ReportFeedbackResponse {
  id: string;
  pharmacyId: string;
  pharmacyReportId: string;
  rating: number;
  message: string | null;
  createdAt: string;
  updatedAt: string;
}

class ReportApiService {
  private baseUrl = API_BASE_URL;

  async generateReport(
    barkod: string,
    recete: Recete,
    signal?: AbortSignal,
  ): Promise<ReportResult> {
    // Son kapı: eksik toplanmış reçete analize GÖNDERİLMEZ. Scraper
    // katmanındaki bir gerileme yüzünden doz/rapor gibi alanlar eksik kalsa
    // bile kontrol eksik veriyle yapılmasın diye burada durduruluyor.
    if (recete.eksikVeriler?.length) {
      const alanlar = recete.eksikVeriler.map((g) => g.alan).join(", ");
      console.error(
        `[report/generate] ${recete.receteNo} eksik veriyle gönderilmedi: ${alanlar}`,
      );
      return {
        success: false,
        error:
          "Reçetenin bazı bilgileri Medula'dan okunamadı, bu yüzden kontrol yapılmadı. Lütfen reçeteyi tekrar sorgulayın.",
      };
    }

    try {
      // Hasta soyadı sunucuya açık gitmez: ilk harf dışında maskelenir
      // ("Ahmet Selami" → "Ahmet S*****"). Uygulama içinde tam ad soyad
      // görünmeye devam eder; maskeleme yalnızca bu istek gövdesine uygulanır.
      const requestData: GenerateReportRequest = {
        barkod,
        recete: {
          ...recete,
          soyad: recete.soyad ? maskSurname(recete.soyad) : recete.soyad,
        },
      };

      // Gövde şifrelenerek gittiği için ağ sekmesinden okunamıyor; şifrelemeden
      // önce olduğu gibi logla.
      console.log(
        "[report/generate] body:",
        JSON.stringify(requestData, null, 2),
      );

      const encrypted = await encryptJson(requestData);

      const response = await apiClient.post(
        `${this.baseUrl}/report/generate`,
        { encrypted },
        { timeout: 120_000, signal },
      );

      const data = await decryptJson<ReceteReportResponse>(
        response.data.encrypted,
      );

      window.dispatchEvent(new Event("credit-deducted"));

      return {
        success: true,
        data,
      };
    } catch (error: any) {
      console.error("Report generation failed:", error);

      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.message ||
          "Report generation failed",
      };
    }
  }

  async submitFeedback(
    reportId: string,
    rating: number,
    message?: string,
  ): Promise<ReportFeedbackResponse> {
    const response = await apiClient.post(
      `${this.baseUrl}/report/${reportId}/feedback`,
      { rating, message },
    );
    return response.data;
  }

  async getFeedback(reportId: string): Promise<ReportFeedbackResponse | null> {
    const response = await apiClient.get(
      `${this.baseUrl}/report/${reportId}/feedback`,
    );
    return response.data || null;
  }

  async getMyReports(since?: string): Promise<SyncedReport[]> {
    const params = since ? { since } : {};
    const response = await apiClient.get(
      `${this.baseUrl}/report/my-reports`,
      { params },
    );
    return response.data;
  }
}

export const reportApiService = new ReportApiService();
