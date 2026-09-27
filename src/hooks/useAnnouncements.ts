import { useCallback, useEffect, useRef, useState } from "react";
import {
  announcementApiService,
  type Announcement,
} from "@/services/announcement-api";
import { useSeenObserver } from "@/components/announcement-content";

/**
 * Duyuruları yükler ve ekranda görülenleri okundu olarak işaretler.
 * Anasayfadaki duyuru kartı ile Duyurular sayfası aynı davranışı paylaşsın diye
 * ortak hook.
 */
export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // İçerik göründüğü an okundu işaretleniyor; ama "yeni" vurgusu bu ziyaret
  // boyunca kalsın diye açılıştaki okunmamışlar ayrıca tutuluyor.
  const [unreadOnLoad, setUnreadOnLoad] = useState<Set<string>>(new Set());
  /** Okundu isteği gönderilmiş/gerekmeyen duyurular — mükerrer istek olmasın. */
  const markedRef = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await announcementApiService.getAnnouncements();
        if (cancelled) return;
        setAnnouncements(data);
        setUnreadOnLoad(
          new Set(data.filter((a) => !a.isRead).map((a) => a.id)),
        );
        // Sunucuda zaten okunmuş olanlara tekrar istek gitmesin.
        for (const a of data) {
          if (a.isRead) markedRef.current.add(a.id);
        }
      } catch {
        // Duyurular ikincil içerik — hata sayfayı bozmasın.
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** İyimser güncelleme: kart ekranda görüldüğünde arka planda okundu olur. */
  const markRead = useCallback((id: string) => {
    if (markedRef.current.has(id)) return;
    markedRef.current.add(id);
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)),
    );
    // Idempotent uç nokta; bir sonraki açılışta yeniden denenir.
    announcementApiService.markAsRead(id).catch(() => {
      // Başarısız olursa tekrar denenebilsin.
      markedRef.current.delete(id);
    });
  }, []);

  const seenRef = useSeenObserver(markRead);

  return { announcements, loading, failed, unreadOnLoad, seenRef };
}
