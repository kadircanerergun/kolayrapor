import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CalendarIcon,
  ClipboardList,
  AlertTriangle,
  Building2,
  Clock,
} from "lucide-react";
import { SystemStatus } from "@/components/system-status";
import { AccountStats } from "@/components/account-stats";
import { SearchByRecipe } from "@/blocks/search-by-recipe";
import { Announcements } from "@/components/announcements";
import { InfoVideos } from "@/components/info-videos";
import { SuggestionCard } from "@/components/suggestion-card";
import { useSubscription } from "@/hooks/useSubscription";
import { Spinner } from "@/components/ui/spinner";

function KontrolMerkezi() {
  const { pharmacy, isPending, ipAddress, loading } = useSubscription();

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
            <h1 className="text-2xl font-bold">Anasayfa</h1>
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
            <CardContent className="space-y-4 flex flex-col">
              <p className="text-sm text-muted-foreground">
                Reçete sorgulama, rapor doğrulama ve diğer işlemleri
                yapabilmek için eczanenizin sistemde kayıtlı olması
                gerekmektedir. Kayıt işlemi tamamlandıktan sonra tüm
                özelliklere erişebilirsiniz.
              </p>
              {ipAddress && (
                <p className="text-lg text-muted-foreground font-mono px-2 py-1 rounded inline-block w-fit">
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
            <h1 className="text-2xl font-bold">Anasayfa</h1>
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
          <h1 className="text-2xl font-bold">Anasayfa</h1>
          <p className="text-muted-foreground">
            Reçete doğrulama ve analiz işlemlerinizi yönetin
          </p>
        </div>

        {/* System status + prescription search, side by side */}
        {/* items-stretch (varsayılan) + kartlarda h-full → iki kart eşit boy */}
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <SystemStatus />
          <SearchByRecipe />
        </div>

        {/* İstatistikler ve duyurular yan yana. items-stretch (varsayılan) +
            sütunlarda h-full → duyuru kartı istatistiklerle aynı boya uzar,
            taşan içerik kendi içinde kayar. */}
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="flex h-full flex-col">
            <AccountStats />
          </div>
          <div className="flex h-full flex-col">
            <Announcements />
          </div>
        </div>


        {/* Suggestion */}
        <div className="mb-6">
          <SuggestionCard />
        </div>

        {/* Bilgilendirme videoları (sunucudan) */}
        <div className="mb-6">
          <InfoVideos />
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/home")({
  component: KontrolMerkezi,
});
