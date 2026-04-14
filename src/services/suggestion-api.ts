import { apiClient } from "@/lib/axios";
import { API_BASE_URL } from "@/lib/constants";

export interface Suggestion {
  id: string;
  title: string;
  message: string;
  category: "feature" | "bug" | "improvement" | "other";
  status: "pending" | "reviewed" | "resolved" | "dismissed";
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSuggestionData {
  title: string;
  message: string;
  category?: Suggestion["category"];
}

class SuggestionApiService {
  async create(data: CreateSuggestionData): Promise<Suggestion> {
    const response = await apiClient.post<Suggestion>(
      `${API_BASE_URL}/my-pharmacy/suggestions`,
      data,
    );
    return response.data;
  }

  async getMySuggestions(): Promise<Suggestion[]> {
    try {
      const response = await apiClient.get<Suggestion[]>(
        `${API_BASE_URL}/my-pharmacy/suggestions`,
      );
      return response.data;
    } catch {
      return [];
    }
  }
}

export const suggestionApiService = new SuggestionApiService();
