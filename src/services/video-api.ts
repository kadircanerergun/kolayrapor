import { apiClient } from "@/lib/axios";
import { API_BASE_URL } from "@/lib/constants";

/** Anasayfada gösterilen bilgilendirme videoları için `type` değeri. */
export const VIDEO_TYPE_MAINPAGE = "mainpage";

export interface Video {
  id: string;
  type: string;
  title: string;
  /** watch / youtu.be / embed / shorts biçimlerinden biri olabilir. */
  youtubeUrl: string;
  /** Kapak görseli; yoksa YouTube'un kendi küçük resmine düşülür. */
  imageUrl: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

class VideoApiService {
  private baseUrl = API_BASE_URL;

  async getVideos(type: string = VIDEO_TYPE_MAINPAGE): Promise<Video[]> {
    const response = await apiClient.get(`${this.baseUrl}/my-pharmacy/videos`, {
      params: { type },
    });
    return Array.isArray(response.data) ? response.data : [];
  }
}

export const videoApiService = new VideoApiService();
