import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileCheck, Users } from "lucide-react";

function HomePage() {
  return (
      <div className="p-6">
        <div className="mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Hoş Geldiniz</h1>
            <p className="text-muted-foreground">
              Eczane rapor doğrulama sistemine hoş geldiniz
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Bugünkü Raporlar
                </CardTitle>
                <FileCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">
                  Henüz rapor doğrulanmadı
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Toplam Hasta
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">
                  Kayıtlı hasta sayısı
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Sistem Durumu
                </CardTitle>
                <div className="h-2 w-2 bg-green-500 rounded-full" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Aktif</div>
                <p className="text-xs text-muted-foreground">
                  SGK bağlantısı hazır
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Hızlı İşlemler</CardTitle>
              <CardDescription>
                Sık kullanılan işlemlere hızlı erişim
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full sm:w-auto">
                <FileCheck className="mr-2 h-4 w-4" />
                Yeni Rapor Doğrula
              </Button>
              <Button variant="outline" className="w-full sm:w-auto ml-0 sm:ml-2">
                <Users className="mr-2 h-4 w-4" />
                Hasta Ekle
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
  );
}

export const Route = createFileRoute("/home")({
  component: HomePage,
});
