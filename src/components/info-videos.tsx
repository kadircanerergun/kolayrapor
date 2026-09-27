import { useEffect, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { openExternalLink } from "@/actions/shell";
import { cn } from "@/utils/tailwind";
import { videoApiService, type Video } from "@/services/video-api";

/**
 * YouTube video kimliğini watch / youtu.be / embed / shorts biçimlerinden
 * çıkarır. Kapak görseli olmayan videolar için küçük resim buradan üretilir.
 */
function extractYoutubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return parsed.pathname.slice(1).split("/")[0] || null;
    }
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const v = parsed.searchParams.get("v");
      if (v) return v;
      const match = parsed.pathname.match(/^\/(embed|shorts|v|live)\/([^/?]+)/);
      if (match) return match[2];
    }
    return null;
  } catch {
    return null;
  }
}

function thumbnailFor(video: Video): string | null {
  if (video.imageUrl) return video.imageUrl;
  const id = extractYoutubeId(video.youtubeUrl);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

function VideoThumbnail({ video }: { video: Video }) {
  const [src, setSrc] = useState<string | null>(() => thumbnailFor(video));

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-muted">
      {src && (
        <img
          src={src}
          alt={video.title}
          loading="lazy"
          onError={() => setSrc(null)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      )}
      {/* Görsel yoksa da tıklanabilir olduğu belli olsun diye play katmanı
          her zaman duruyor. */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/40">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
          <Play className="ml-0.5 h-5 w-5 fill-black text-black" />
        </span>
      </div>
    </div>
  );
}

export function InfoVideos() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await videoApiService.getVideos();
        if (!cancelled) {
          // Sunucu sıralı döndürse de garantiye al.
          setVideos(
            [...data].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
          );
        }
      } catch {
        // Videolar ikincil içerik — hata anasayfayı bozmasın.
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Video yoksa ya da alınamadıysa bölümü hiç gösterme.
  if (failed || (!loading && videos.length === 0)) return null;

  return (
    <>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Bilgilendirme Videoları
      </h2>

      {loading ? (
        <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Videolar yükleniyor...
        </Card>
      ) : (
        // Tek satır: ekranda 3 kart görünür, fazlası yatay kaydırmayla gelir.
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
          {videos.map((video) => (
            <Card
              key={video.id}
              role="button"
              tabIndex={0}
              // Uygulama içinde gömmek yerine sistem tarayıcısında açılır.
              onClick={() => openExternalLink(video.youtubeUrl)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openExternalLink(video.youtubeUrl);
                }
              }}
              className={cn(
                "group cursor-pointer overflow-hidden p-0 transition-colors hover:border-brand/50",
                // gap-4 → 3 kart arasında 2 boşluk (2rem) düşülüyor.
                "w-[calc((100%-2rem)/3)] shrink-0 snap-start",
              )}
            >
              <VideoThumbnail video={video} />
            
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
