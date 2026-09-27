import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/utils/tailwind";

/**
 * Duyuruların ortak parçaları: markdown gövdesi, görsel ve "görüldü" izleyicisi.
 * Hem anasayfadaki duyuru kartı hem de Duyurular sayfası bunları kullanır.
 */

export function formatAnnouncementDate(iso: string) {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Başlık gibi tek satırlık alanlar için markdown. Başlıklara da `**kalın**`
 * yazılabildiği için düz metin basmak yıldızları ekranda bırakıyordu; burada
 * blok elemanlar (p, h1…) span'e indirgenerek satır tek parça kalıyor.
 */
export function InlineMarkdown({ text }: { text: string }) {
  const asSpan = ({ node: _n, ...p }: { node?: unknown }) => <span {...p} />;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: asSpan,
        h1: asSpan,
        h2: asSpan,
        h3: asSpan,
        h4: asSpan,
        h5: asSpan,
        h6: asSpan,
        strong: ({ node: _n, ...p }) => <strong className="font-bold" {...p} />,
        em: ({ node: _n, ...p }) => <em className="italic" {...p} />,
        del: ({ node: _n, ...p }) => <del className="line-through" {...p} />,
        code: ({ node: _n, ...p }) => (
          <code
            className="bg-muted rounded px-1 py-0.5 font-mono text-[0.9em]"
            {...p}
          />
        ),
        a: ({ node: _n, ...p }) => (
          <a
            className="text-brand underline"
            target="_blank"
            rel="noreferrer noopener"
            {...p}
          />
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

/**
 * Markdown içeriği; ham HTML render edilmez (react-markdown varsayılanı).
 *
 * Tailwind preflight başlık/liste/alıntı gibi elemanların tarayıcı
 * varsayılanlarını sıfırladığı için her eleman burada tek tek biçimlendirilir —
 * aksi halde `## Başlık` düz metinden ayırt edilemez. `remark-gfm` ise tablo,
 * üstü çizili metin, görev listesi ve otomatik link desteğini ekler.
 */
export function AnnouncementBody({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={cn("text-sm leading-relaxed", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node: _n, ...p }) => (
            <h1 className="mt-4 mb-2 text-lg font-semibold first:mt-0" {...p} />
          ),
          h2: ({ node: _n, ...p }) => (
            <h2
              className="mt-4 mb-2 text-base font-semibold first:mt-0"
              {...p}
            />
          ),
          h3: ({ node: _n, ...p }) => (
            <h3 className="mt-3 mb-1 text-sm font-semibold first:mt-0" {...p} />
          ),
          h4: ({ node: _n, ...p }) => (
            <h4 className="mt-3 mb-1 text-sm font-semibold first:mt-0" {...p} />
          ),
          h5: ({ node: _n, ...p }) => (
            <h5 className="mt-3 mb-1 text-sm font-semibold first:mt-0" {...p} />
          ),
          h6: ({ node: _n, ...p }) => (
            <h6
              className="text-muted-foreground mt-3 mb-1 text-xs font-semibold tracking-wide uppercase first:mt-0"
              {...p}
            />
          ),
          p: ({ node: _n, ...p }) => (
            <p className="my-2 first:mt-0 last:mb-0" {...p} />
          ),
          strong: ({ node: _n, ...p }) => (
            <strong className="font-semibold" {...p} />
          ),
          em: ({ node: _n, ...p }) => <em className="italic" {...p} />,
          del: ({ node: _n, ...p }) => <del className="line-through" {...p} />,
          ul: ({ node: _n, ...p }) => (
            <ul className="my-2 list-disc pl-5" {...p} />
          ),
          ol: ({ node: _n, ...p }) => (
            <ol className="my-2 list-decimal pl-5" {...p} />
          ),
          // Görev listesi maddelerinde madde imi yerine kutu görünsün.
          li: ({ node: _n, ...p }) => (
            <li className="my-0.5 [&:has(>input)]:list-none" {...p} />
          ),
          input: ({ node: _n, ...p }) => (
            <input className="mr-1 align-middle" disabled {...p} />
          ),
          blockquote: ({ node: _n, ...p }) => (
            <blockquote
              className="border-brand/40 text-muted-foreground my-2 border-l-2 pl-3"
              {...p}
            />
          ),
          code: ({ node: _n, className: c, ...p }) => {
            // Blok kodu <pre> sarar; satır içi kod tek başına gelir.
            const isBlock = /language-/.test(c ?? "");
            return (
              <code
                className={cn(
                  isBlock
                    ? "block"
                    : "bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]",
                  c,
                )}
                {...p}
              />
            );
          },
          pre: ({ node: _n, ...p }) => (
            <pre
              className="bg-muted my-2 overflow-x-auto rounded-md p-3 font-mono text-xs"
              {...p}
            />
          ),
          hr: ({ node: _n, ...p }) => <hr className="my-3 border-t" {...p} />,
          a: ({ node: _n, ...p }) => (
            <a
              className="text-brand underline"
              target="_blank"
              rel="noreferrer noopener"
              {...p}
            />
          ),
          img: ({ node: _n, ...p }) => (
            <img
              className="my-2 h-auto max-w-full rounded-md border"
              loading="lazy"
              {...p}
            />
          ),
          // Tablolar dar kartlarda taşmasın: kendi içinde yatay kayar.
          table: ({ node: _n, ...p }) => (
            <div className="my-2 w-full overflow-x-auto">
              <table className="w-full border-collapse text-xs" {...p} />
            </div>
          ),
          th: ({ node: _n, ...p }) => (
            <th
              className="border-border bg-muted border px-2 py-1 text-left font-semibold"
              {...p}
            />
          ),
          td: ({ node: _n, ...p }) => (
            <td className="border-border border px-2 py-1 align-top" {...p} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/** Kartın "görüldü" sayılması için ekranda kalması gereken süre (ms). */
const SEEN_DWELL_MS = 800;

/**
 * Bir duyurunun ekranda gerçekten görünmesini izler. Dönen ref fonksiyonu
 * izlenecek elemana verilir; eleman yeterince görünür olup {@link SEEN_DWELL_MS}
 * kadar orada kalırsa `onSeen` bir kez çağrılır. Sayfayı açar açmaz değil,
 * kullanıcı kartı gerçekten gördüğünde okundu işaretlemek için.
 */
export function useSeenObserver(onSeen: (id: string) => void) {
  const onSeenRef = useRef(onSeen);
  onSeenRef.current = onSeen;

  const idsRef = useRef(new WeakMap<Element, string>());
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const observerRef = useRef<IntersectionObserver | null>(null);

  if (!observerRef.current && typeof IntersectionObserver !== "undefined") {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = idsRef.current.get(entry.target);
          if (!id) continue;

          // Karttan uzun duyurularda oran hiçbir zaman %50'ye ulaşmaz;
          // görünen yükseklik de yeterli bir ölçüt.
          const seenEnough =
            entry.intersectionRatio >= 0.5 ||
            entry.intersectionRect.height >= 160;

          if (entry.isIntersecting && seenEnough) {
            if (timersRef.current.has(id)) continue;
            timersRef.current.set(
              id,
              setTimeout(() => {
                timersRef.current.delete(id);
                observerRef.current?.unobserve(entry.target);
                onSeenRef.current(id);
              }, SEEN_DWELL_MS),
            );
          } else {
            // Görüş alanından çıktıysa sayaç sıfırlanır.
            const timer = timersRef.current.get(id);
            if (timer) {
              clearTimeout(timer);
              timersRef.current.delete(id);
            }
          }
        }
      },
      { threshold: [0, 0.5, 1] },
    );
  }

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      observerRef.current?.disconnect();
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  return useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (!el) return;
      idsRef.current.set(el, id);
      observerRef.current?.observe(el);
    },
    [],
  );
}

/** Görseli olmayan duyurular da var; yüklenemezse alanı tamamen gizle. */
export function AnnouncementImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
