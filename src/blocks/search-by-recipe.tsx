import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Search } from "lucide-react";
import { usePlaywright } from "@/hooks/usePlaywright";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const SearchByRecipe = () => {
  const playwright = usePlaywright();
  const [recipeCode, setRecipeCode] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipeCode.trim()) return;

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

      const searchResult = await playwright.searchPrescription(recipeCode);

      if (searchResult.success) {
        alert(
          `Reçete arama tamamlandı! Sonuç: ${JSON.stringify(searchResult.prescriptionData)}`,
        );
      } else {
        alert(`Reçete arama hatası: ${searchResult.error}`);
      }
    } catch (error) {
      console.error("Search error:", error);
      alert(
        `Beklenmeyen hata: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`,
      );
    }
  };
  return (
    <Card className={"flex-1"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Reçete Numarası Sorgulama
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
              value={recipeCode}
              onChange={(e) => setRecipeCode(e.target.value)}
              placeholder="Reçete numarasını girin"
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={playwright.isLoading || !recipeCode.trim()}
          >
            {playwright.isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {playwright.isReady ? "Aranıyor..." : "Başlatılıyor..."}
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
  );
};

export { SearchByRecipe };
