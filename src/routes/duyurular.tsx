import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Megaphone } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PharmacyRequired } from "@/components/pharmacy-required";
import { cn } from "@/utils/tailwind";
import {
  AnnouncementBody,
  AnnouncementImage,
  formatAnnouncementDate,
  InlineMarkdown,
} from "@/components/announcement-content";
import { useAnnouncements } from "@/hooks/useAnnouncements";

function Duyurular() {
  const { announcements, loading, failed, unreadOnLoad, seenRef } =
    useAnnouncements();

  return (
    <PharmacyRequired>
      <div className="p-6">
        <div className="mx-auto">
          <div className="mb-6 flex items-center gap-2">
            <div>
              <h1 className="text-2xl font-bold">Duyurular</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Tüm duyurular en yeniden eskiye doğru listelenir.
              </p>
            </div>
            {unreadOnLoad.size > 0 && (
              <Badge variant="default" className="ml-2">
                {unreadOnLoad.size} yeni
              </Badge>
            )}
          </div>

          {loading ? (
            <Card>
              <CardContent className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Duyurular yükleniyor...
              </CardContent>
            </Card>
          ) : failed ? (
            <Card>
              <CardContent className="text-muted-foreground py-8 text-sm">
                Duyurular alınamadı. Lütfen daha sonra tekrar deneyin.
              </CardContent>
            </Card>
          ) : announcements.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
                <Megaphone className="h-4 w-4" />
                Henüz duyuru yok.
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {announcements.map((announcement) => (
                <Card
                  key={announcement.id}
                  ref={seenRef(announcement.id)}
                  className={cn(
                    "relative overflow-hidden",
                    unreadOnLoad.has(announcement.id) &&
                      "border-brand/60 bg-brand/5",
                  )}
                >
                  {announcement.imageUrl && (
                    <AnnouncementImage
                      src={announcement.imageUrl}
                      alt={announcement.title}
                      className="bg-muted max-h-64 w-full object-cover"
                    />
                  )}
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-start gap-2 text-base">
                      <span className="min-w-0 flex-1">
                        <InlineMarkdown text={announcement.title} />
                      </span>
                      {unreadOnLoad.has(announcement.id) && (
                        <Badge
                          variant="default"
                          className="h-5 shrink-0 px-1.5 text-[10px]"
                        >
                          Yeni
                        </Badge>
                      )}
                      {/* Tarih başlıkla aynı satırda sağ üstte durur. */}
                      <span className="text-muted-foreground shrink-0 pt-0.5 text-xs font-normal">
                        {formatAnnouncementDate(announcement.createdAt)}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="min-w-0">
                    <AnnouncementBody content={announcement.content} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </PharmacyRequired>
  );
}

export const Route = createFileRoute("/duyurular")({
  component: Duyurular,
});
