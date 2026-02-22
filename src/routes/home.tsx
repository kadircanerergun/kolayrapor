import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Database,
  FlaskConical,
  Search,
  CalendarIcon,
  ClipboardList,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  Building2,
  Clock,
} from "lucide-react";
import { SonIslemlerTable } from "@/components/son-islemler-table";
import { SystemStatus } from "@/components/system-status";
import { SearchByRecipe } from "@/blocks/search-by-recipe";
import { useSubscription } from "@/hooks/useSubscription";
import { Spinner } from "@/components/ui/spinner";
import type { CachedRecete } from "@/lib/db";
import type { ReceteReportResponse } from "@/services/report-api";

function KontrolMerkezi() {
  const { pharmacy, isPending, ipAddress, loading } = useSubscription();

  const [stats, setStats] = useState({
    totalCached: 0,
    totalAnalyzed: 0,
    validCount: 0,
    invalidCount: 0,
  });

  const handleDataLoaded = (data: {
    cachedReceteler: CachedRecete[];
    analizSonuclari: Record<string, Record<string, ReceteReportResponse>>;
  }) => {
    const totalCached = data.cachedReceteler.length;

    let totalAnalyzed = 0;
    let validCount = 0;
    let invalidCount = 0;

    for (const sonuclar of Object.values(data.analizSonuclari)) {
      for (const report of Object.values(sonuclar)) {
        totalAnalyzed++;
        if (report.isValid) {
          validCount++;
        } else {
          invalidCount++;
        }
      }
    }

    setStats({ totalCached, totalAnalyzed, validCount, invalidCount });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner size="lg" />
      </div>
    );
  }

  // No pharmacy registered
  if (!pharmacy) {
    return (
      <div className="p-6">
        <div className="mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Kontrol Merkezi</h1>
            <p className="text-muted-foreground">
              Reçete doğrulama ve analiz işlemlerinizi yönetin
            </p>
          </div>

          <Card className="border-yellow-300 dark:border-yellow-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Eczane Kaydı Gerekli
              </CardTitle>
              <CardDescription>
                Uygulamayı kullanabilmek için önce eczanenizi kaydetmeniz
                gerekmektedir.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Reçete sorgulama, rapor doğrulama ve diğer işlemleri
                yapabilmek için eczanenizin sistemde kayıtlı olması
                gerekmektedir. Kayıt işlemi tamamlandıktan sonra tüm
                özelliklere erişebilirsiniz.
              </p>
              {ipAddress && (
                <p className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded inline-block">
                  IP Adresiniz: {ipAddress}
                </p>
              )}
              <Link to="/kayit">
                <Button>
                  <Building2 className="h-4 w-4 mr-2" />
                  Eczane Kaydına Git
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Pharmacy pending approval
  if (isPending) {
    return (
      <div className="p-6">
        <div className="mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Kontrol Merkezi</h1>
            <p className="text-muted-foreground">
              Reçete doğrulama ve analiz işlemlerinizi yönetin
            </p>
          </div>

          <Card className="border-yellow-300 dark:border-yellow-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                Eczane Kaydınız Onay Bekliyor
              </CardTitle>
              <CardDescription>
                Eczane kaydınız incelenmektedir. Onaylandıktan sonra tüm
                özelliklere erişebilirsiniz.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Kayıt onay süreciniz devam ediyor. Durumu Ayarlar sayfasından
                kontrol edebilirsiniz.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Kontrol Merkezi</h1>
          <p className="text-muted-foreground">
            Reçete doğrulama ve analiz işlemlerinizi yönetin
          </p>
        </div>

        {/* System Status */}
        <div className="mb-6">
          <SystemStatus />
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Hızlı İşlemler
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <SearchByRecipe />
            <div className="flex flex-col gap-2">
              <Link to="/search-report">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <CalendarIcon className="h-4 w-4" />
                  Toplu Kontrol
                </Button>
              </Link>
              <Link to="/son-islemler">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <ClipboardList className="h-4 w-4" />
                  Tüm İşlemler
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/home")({
  component: KontrolMerkezi,
});
