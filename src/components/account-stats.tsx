import { useEffect, useState } from "react";
import {
  CalendarClock,
  CalendarRange,
  FileSearch,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/utils/tailwind";
import { getAllCachedAnalysisRows } from "@/lib/db";
import { useAppSelector } from "@/store";

type Accent = "brand" | "green" | "orange" | "red" | "muted";

const accentClasses: Record<Accent, string> = {
  brand: "bg-brand/10 text-brand",
  green: "bg-green-500/10 text-green-600 dark:text-green-500",
  orange: "bg-orange-500/10 text-orange-600 dark:text-orange-500",
  red: "bg-red-500/10 text-red-600 dark:text-red-500",
  muted: "bg-muted text-muted-foreground",
};

/** Aylık çubuktaki dilim renkleri — uygulamanın 3'lü eşik renkleriyle aynı. */
const segmentClasses = {
  uygun: "bg-green-500",
  supheli: "bg-orange-500",
  uygunDegil: "bg-red-500",
} as const;

/** Çubuğun altındaki sayıların renkleri; dilim renkleriyle eşleşir. */
const segmentTextClasses = {
  uygun: "text-green-600 dark:text-green-500",
  supheli: "text-orange-600 dark:text-orange-500",
  uygunDegil: "text-red-600 dark:text-red-500",
} as const;

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "muted",
}: {
  icon: typeof FileSearch;
  label: string;
  value: string;
  hint?: string;
  accent?: Accent;
}) {
  return (
    // Kutular dar bir ızgarada duruyor: içerik tek satırda kırpılır,
    // tamamı title ile görünür.
    <Card className="h-full">
      <CardContent className="flex items-center gap-2.5 p-3">
        <div className={cn("shrink-0 rounded-md p-1.5", accentClasses[accent])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground truncate text-[11px]">{label}</p>
          <p
            className="truncate text-base leading-tight font-semibold"
            title={value}
          >
            {value}
          </p>
          {hint && (
            <p
              className="text-muted-foreground truncate text-[11px]"
              title={hint}
            >
              {hint}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Kontrolün yapıldığı an: sunucu `processedAt`'i, yoksa yerel kayıt zamanı. */
function reportTime(processedAt: string | undefined, cachedAt: number): number {
  if (processedAt) {
    const t = new Date(processedAt).getTime();
    if (!isNaN(t)) return t;
  }
  return cachedAt;
}

/** Anasayfada gösterilen aylık kontrol kutucuğu sayısı (bu ay dahil). */
const MONTH_COUNT = 6;

interface Breakdown {
  total: number;
  uygun: number;
  supheli: number;
  uygunDegil: number;
}

interface MonthBucket extends Breakdown {
  /** O ay kontrol edilen farklı reçete sayısı (`total` ise ilaç sayısı). */
  recete: number;
  /** Ay başlangıcının zaman damgası — kova eşleştirmesi ve React key'i için. */
  start: number;
  /** "Ağu" gibi kısa ay adı; geçen yıla sarkarsa "Ağu 25". */
  label: string;
  isCurrent: boolean;
}

/** Son {@link MONTH_COUNT} ayın boş kovaları, eskiden yeniye. */
function buildMonthBuckets(): MonthBucket[] {
  const now = new Date();
  const thisYear = now.getFullYear();
  const buckets: MonthBucket[] = [];

  for (let i = MONTH_COUNT - 1; i >= 0; i--) {
    const date = new Date(thisYear, now.getMonth() - i, 1);
    const short = date.toLocaleDateString("tr-TR", { month: "short" });
    buckets.push({
      start: date.getTime(),
      // Geçen yıla sarkan aylarda yıl da yazılsın, karışmasın.
      label:
        date.getFullYear() === thisYear
          ? short
          : `${short} ${String(date.getFullYear()).slice(-2)}`,
      isCurrent: i === 0,
      recete: 0,
      total: 0,
      uygun: 0,
      supheli: 0,
      uygunDegil: 0,
    });
  }
  return buckets;
}

/** Gösterilen her rakam aylık olduğu için genel toplam tutulmuyor. */
interface LocalStats {
  months: MonthBucket[];
}

const EMPTY_STATS: LocalStats = {
  months: [],
};

/** Ayın uygun/şüpheli/geçersiz dağılımını tek çubukta gösterir. */
function MonthBar({ month }: { month: MonthBucket }) {
  const segments = [
    { key: "uygun", value: month.uygun, className: segmentClasses.uygun },
    { key: "supheli", value: month.supheli, className: segmentClasses.supheli },
    {
      key: "uygunDegil",
      value: month.uygunDegil,
      className: segmentClasses.uygunDegil,
    },
  ];

  return (
    <div className="bg-muted flex h-1.5 w-full overflow-hidden rounded-full">
      {month.total > 0 &&
        segments.map((segment) =>
          segment.value > 0 ? (
            <div
              key={segment.key}
              className={segment.className}
              style={{ width: `${(segment.value / month.total) * 100}%` }}
            />
          ) : null,
        )}
    </div>
  );
}

/**
 * Yerel kontrol istatistikleri: bu ayki ve toplam kontrol sayıları ile son
 * ayların uygun/şüpheli/geçersiz dağılımı. Abonelik bilgileri yan menüde
 * gösterildiği için burada tekrarlanmaz.
 */
export function AccountStats() {
  // Kontrol sayıları Dexie'de tutuluyor; Redux'taki analiz sonuçları yalnızca
  // yeni bir kontrol bittiğinde değiştiği için tetikleyici olarak kullanılıyor.
  const analizSonuclari = useAppSelector((s) => s.recete.analizSonuclari);

  const [stats, setStats] = useState<LocalStats>(EMPTY_STATS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getAllCachedAnalysisRows();
        if (cancelled) return;

        const next: LocalStats = {
          ...EMPTY_STATS,
          months: buildMonthBuckets(),
        };
        // Aynı reçetenin birden çok ilacı var; ay bazında tekilleştirmek için
        // her kovanın kendi reçete kümesi tutulur.
        const monthReceteNos = next.months.map(() => new Set<string>());

        for (const row of rows) {
          // Uygulamanın geri kalanıyla aynı 3'lü eşik: >=80 uygun,
          // >=60 şüpheli, altı uygun değil.
          const score = row.result?.validityScore ?? 0;
          const bucketKey =
            score >= 80 ? "uygun" : score >= 60 ? "supheli" : "uygunDegil";

          // Kovalar eskiden yeniye sıralı; sondan başlayınca ilk eşleşen ay
          // kaydın ayıdır. Daha eski kayıtlar hiçbir kovaya girmez.
          const at = reportTime(row.result?.processedAt, row.cachedAt);
          for (let i = next.months.length - 1; i >= 0; i--) {
            if (at >= next.months[i].start) {
              next.months[i].total++;
              next.months[i][bucketKey]++;
              monthReceteNos[i].add(row.receteNo);
              break;
            }
          }
        }

        for (let i = 0; i < next.months.length; i++) {
          next.months[i].recete = monthReceteNos[i].size;
        }
        setStats(next);
      } catch {
        // İstatistikler ikincil içerik — hata anasayfayı bozmasın.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [analizSonuclari]);

  const num = (n: number) => n.toLocaleString("tr-TR");
  const localValue = (n: number) => (loaded ? num(n) : "—");

  const months = stats.months.length ? stats.months : buildMonthBuckets();
  const current = months[months.length - 1];
  const previous = months.length > 1 ? months[months.length - 2] : undefined;

  const monthDelta = current.total - (previous?.total ?? 0);
  const monthDeltaPct =
    previous && previous.total > 0
      ? Math.round((monthDelta / previous.total) * 100)
      : null;

  return (
    <>
      <h2 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
        Kontrol İstatistikleri
      </h2>

      {/* Anasayfada yarım genişlikte durduğu için kutular 2'li ızgarada. */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={CalendarRange}
          label="Bu Ay"
          value={loaded ? `${num(current.recete)} reçete` : "—"}
          hint={loaded ? `${num(current.total)} ilaç` : undefined}
          accent="brand"
        />
        <StatCard
          icon={CalendarClock}
          label="Geçen Ay"
          value={loaded ? `${num(previous?.recete ?? 0)} reçete` : "—"}
          hint={loaded ? `${num(previous?.total ?? 0)} ilaç` : undefined}
          accent="muted"
        />
      </div>

      {/* Üç kutunun tamamı bu aya ait; başlık tek yerde yazılıyor. */}
      <p className="text-muted-foreground mt-4 mb-2 text-[11px] font-medium tracking-wide uppercase">
        Bu Ay
      </p>

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={ShieldCheck}
          label="Uygun"
          value={localValue(current.uygun)}
          accent="green"
        />
        <StatCard
          icon={ShieldAlert}
          label="Şüpheli"
          value={localValue(current.supheli)}
          accent="orange"
        />
        <StatCard
          icon={ShieldX}
          label="Geçersiz"
          value={localValue(current.uygunDegil)}
          accent="red"
        />
      </div>

      {/* Aylık dağılım: her ayın kontrol sayısı ve sonuç kırılımı. */}
      <Card className="mt-3">
        <CardContent className="p-3">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Aylık Kontroller
            </p>
            {loaded && (monthDeltaPct != null || monthDelta !== 0) && (
              <span
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                  monthDelta >= 0 ? accentClasses.green : accentClasses.orange,
                )}
                title="Geçen aya göre değişim"
              >
                {monthDelta >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {monthDeltaPct != null
                  ? `%${num(Math.abs(monthDeltaPct))}`
                  : `${monthDelta > 0 ? "+" : ""}${num(monthDelta)}`}
              </span>
            )}
          </div>

          {/* Son 6 ay; içinde bulunulan ay vurgulu. */}
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {months.map((month) => (
              <div
                key={month.start}
                className={cn(
                  "rounded-md border p-1.5",
                  month.isCurrent && "border-brand/60 bg-brand/5",
                )}
                title={
                  loaded
                    ? `${month.label}: ${num(month.total)} kontrol · ${num(month.uygun)} uygun · ${num(month.supheli)} şüpheli · ${num(month.uygunDegil)} geçersiz`
                    : undefined
                }
              >
                <p className="text-muted-foreground truncate text-center text-[10px] uppercase">
                  {month.label}
                </p>
                <p className="text-center text-sm leading-tight font-semibold">
                  {loaded ? num(month.total) : "—"}
                </p>
                <div className="mt-1">
                  <MonthBar month={month} />
                </div>
                {/* Çubuğun dilimleri dar kutuda okunmuyor; sayılar da yazılır. */}
                <div className="mt-1 flex items-center justify-center gap-1 text-[10px] leading-none font-medium tabular-nums">
                  <span className={segmentTextClasses.uygun} title="Uygun">
                    {loaded ? num(month.uygun) : "—"}
                  </span>
                  <span className="text-muted-foreground/50">·</span>
                  <span className={segmentTextClasses.supheli} title="Şüpheli">
                    {loaded ? num(month.supheli) : "—"}
                  </span>
                  <span className="text-muted-foreground/50">·</span>
                  <span
                    className={segmentTextClasses.uygunDegil}
                    title="Geçersiz"
                  >
                    {loaded ? num(month.uygunDegil) : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-muted-foreground mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
            <span className="flex items-center gap-1">
              <span
                className={cn("h-2 w-2 rounded-full", segmentClasses.uygun)}
              />
              Uygun
            </span>
            <span className="flex items-center gap-1">
              <span
                className={cn("h-2 w-2 rounded-full", segmentClasses.supheli)}
              />
              Şüpheli
            </span>
            <span className="flex items-center gap-1">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  segmentClasses.uygunDegil,
                )}
              />
              Geçersiz
            </span>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
