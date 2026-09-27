import { apiClient } from "@/lib/axios";
import { API_BASE_URL } from "@/lib/constants";

/**
 * Eczaneye (IP ile çözülen) gösterilen duyuru. `content` Markdown, `imageUrl`
 * opsiyonel — duyurunun görseli olmayabilir.
 */
export interface Announcement {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

class AnnouncementApiService {
  private baseUrl = API_BASE_URL;

  /** Yayında olan duyurular (sunucu tarih/aktiflik filtresini kendisi uygular). */
  async getAnnouncements(): Promise<Announcement[]> {
    const response = await apiClient.get(
      `${this.baseUrl}/my-pharmacy/announcements`,
    );
    return Array.isArray(response.data) ? response.data : [];
  }

  async getUnreadCount(): Promise<number> {
    const response = await apiClient.get(
      `${this.baseUrl}/my-pharmacy/announcements/unread-count`,
    );
    return Number(response.data?.count ?? 0);
  }

  /** Idempotent — aynı duyuru için tekrar çağrılması sorun değil. */
  async markAsRead(id: string): Promise<void> {
    await apiClient.post(
      `${this.baseUrl}/my-pharmacy/announcements/${id}/read`,
    );
  }
}

export const announcementApiService = new AnnouncementApiService();
