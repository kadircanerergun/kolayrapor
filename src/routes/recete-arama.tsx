import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import MainLayout from "@/layouts/main-layout";
import { usePlaywright } from "@/hooks/usePlaywright";

function ReceteAramaPage() {
  const [receteNumarasi, setReceteNumarasi] = useState("");
  const playwright = usePlaywright();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!receteNumarasi.trim()) return;
    
    try {
      // Initialize Playwright if not ready
      if (!playwright.isReady) {
        console.log("Initializing Playwright...");
        const initResult = await playwright.initialize();
        if (!initResult.success) {
          alert(`Playwright başlatılırken hata: ${initResult.error}`);
          return;
        }
      }

      // Navigate to SGK portal (with automatic login handling)
      console.log("Navigating to SGK portal...");
      const navResult = await playwright.navigateToSGK();
      
      if (!navResult.success) {
        alert(`SGK portalına erişilirken hata: ${navResult.error}`);
        return;
      }

      // Search prescription
      console.log("Searching prescription:", receteNumarasi);
      const searchResult = await playwright.searchPrescription(receteNumarasi);
      
      if (searchResult.success) {
        alert(`Reçete arama tamamlandı! Sonuç: ${JSON.stringify(searchResult.prescriptionData)}`);
      } else {
        alert(`Reçete arama hatası: ${searchResult.error}`);
      }
      
    } catch (error) {
      console.error("Search error:", error);
      alert(`Beklenmeyen hata: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    }
  };

  return (
    <MainLayout>
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Reçete Arama</h1>
          <p className="text-muted-foreground">
            SGK sisteminde reçete bilgilerini sorgulayın
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Reçete Sorgulama
            </CardTitle>
            <CardDescription>
              Aramak istediğiniz reçete numarasını girin
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="receteNumarasi">Reçete Numarası</Label>
                <Input
                  id="receteNumarasi"
                  type="text"
                  value={receteNumarasi}
                  onChange={(e) => setReceteNumarasi(e.target.value)}
                  placeholder="Reçete numarasını girin"
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full"
                disabled={playwright.isLoading || !receteNumarasi.trim()}
              >
                {playwright.isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {playwright.isReady ? 'Aranıyor...' : 'Başlatılıyor...'}
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Ara
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        {/* Status indicator */}
        {playwright.error && (
          <Card className="mt-4 border-destructive">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Hata: {playwright.error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {playwright.lastResult && playwright.lastResult.success && (
          <Card className="mt-4 border-green-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  İşlem başarılı! {playwright.lastResult.currentUrl && `(${playwright.lastResult.currentUrl})`}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 p-4 bg-muted/30 rounded-lg">
          <h3 className="font-medium mb-2">
            Sistem Durumu: {' '}
            {playwright.isReady ? (
              <span className="text-green-600">Hazır</span>
            ) : (
              <span className="text-yellow-600">Başlatılmadı</span>
            )}
          </h3>
          <p className="text-sm text-muted-foreground">
            Bu özellik SGK eczane portalında otomatik arama yaparak reçete bilgilerini getirecektir.
            Lütfen giriş yaptığınız kullanıcı bilgilerinin doğru olduğundan emin olun.
          </p>
        </div>
        </div>
      </div>
    </MainLayout>
  );
}

export const Route = createFileRoute("/recete-arama")({
  component: ReceteAramaPage,
});