import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Database,
  FlaskConical,
  Search,
  CalendarIcon,
  ClipboardList,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { SonIslemlerTable } from "@/components/son-islemler-table";
import { SystemStatus } from "@/components/system-status";
import { SearchByRecipe } from "@/blocks/search-by-recipe";
import type { CachedRecete } from "@/lib/db";
import type { ReceteReportResponse } from "@/services/report-api";

function KontrolMerkezi() {
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

        {/* Stats */}
        {/* <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Kayıtlı Reçete
              </CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCached}</div>
              <p className="text-xs text-muted-foreground">
                Önbellekte kayıtlı reçete
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Analiz Edilen
              </CardTitle>
              <FlaskConical className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAnalyzed}</div>
              <p className="text-xs text-muted-foreground">
                Toplam analiz edilen ilaç
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Geçerli Rapor
              </CardTitle>
              <ShieldCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.validCount}
              </div>
              <p className="text-xs text-muted-foreground">
                Geçerli analiz sonucu
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Geçersiz Rapor
              </CardTitle>
              <ShieldX className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.invalidCount}
              </div>
              <p className="text-xs text-muted-foreground">
                Geçersiz analiz sonucu
              </p>
            </CardContent>
          </Card>
        </div> */}

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
                  Tarih ile Ara
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

        {/* Son İşlemler Table
        <SonIslemlerTable
          showHeader={true}
          onDataLoaded={handleDataLoaded}
        /> */}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/home")({
  component: KontrolMerkezi,
});
