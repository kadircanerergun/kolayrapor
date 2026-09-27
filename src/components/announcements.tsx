import { Link } from "@tanstack/react-router";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/tailwind";
import {
  AnnouncementBody,
  AnnouncementImage,
  formatAnnouncementDate,
  InlineMarkdown,
} from "@/components/announcement-content";
import { useAnnouncements } from "@/hooks/useAnnouncements";

/**
 * Anasayfa duyuru bölümü: yalnızca en güncel duyuru tam içeriğiyle gösterilir,
 * geri kalanı için altındaki bağlantı Duyurular sayfasına götürür.
 */
export function Announcements() {
  const { announcements, loading, failed, unreadOnLoad, seenRef } =
    useAnnouncements();

  const unreadCount = unreadOnLoad.size;
  const latest = announcements[0];

  // Duyuru yoksa ya da alınamadıysa bölümü hiç gösterme.
  if (failed || (!loading && announcements.length === 0)) return null;

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
          Duyurular
        </h2>
        {unreadCount > 0 && (
          <Badge variant="default" className="h-5 px-1.5 text-[10px]">
            {unreadCount} yeni
          </Badge>
        )}
      </div>

      {loading || !latest ? (
        <Card className="min-h-0 flex-1">
          <CardContent className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Duyurular yükleniyor...
          </CardContent>
        </Card>
      ) : (
        <Card
          ref={seenRef(latest.id)}
          className={cn(
            // flex-1: sütun istatistiklerle aynı boya uzasın; min-h-0 olmadan
            // uzun içerik kartı büyütür, kaydırma çalışmaz.
            "relative flex min-h-0 flex-1 flex-col overflow-hidden",
            unreadOnLoad.has(latest.id) && "border-brand/60 bg-brand/5",
          )}
        >
          {/* Okunmamış işareti: kartın sağ üstünde kırmızı nokta. Görselin
              üstüne de denk gelebildiği için halka ile ayrılıyor. */}
          {unreadOnLoad.has(latest.id) && (
            <span
              className="ring-background absolute top-2 right-2 z-10 h-2.5 w-2.5 rounded-full bg-red-500 ring-2"
              aria-label="Okunmadı"
            />
          )}
          {/* Kart yarım genişlikte olduğu için görsel yanda değil üstte:
              yandaki görsel metne çok dar bir sütun bırakırdı. */}
          {latest.imageUrl && (
            <AnnouncementImage
              src={latest.imageUrl}
              alt={latest.title}
              className="bg-muted h-32 w-full shrink-0 object-cover"
            />
          )}
          <CardHeader className="pb-2">
            <CardTitle className="flex items-start gap-2 pr-6 text-base">
              <span className="min-w-0 flex-1">
                <InlineMarkdown text={latest.title} />
              </span>
              {/* Tarih başlıkla aynı satırda sağ üstte durur. */}
              <span className="text-muted-foreground shrink-0 pt-0.5 text-xs font-normal">
                {formatAnnouncementDate(latest.createdAt)}
              </span>
            </CardTitle>
          </CardHeader>
          {/* Uzun duyuru kartı büyütmesin: metin kartın içinde kayar,
              başlık ve tarih sabit kalır. */}
          <CardContent className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <AnnouncementBody content={latest.content} />
          </CardContent>
        </Card>
      )}

      <Link
        to="/duyurular"
        className="text-brand mt-2 inline-flex shrink-0 items-center gap-1 self-start text-xs hover:underline"
      >
        Tüm duyuruları gör
        {announcements.length > 0 && ` (${announcements.length})`}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </>
  );
}
