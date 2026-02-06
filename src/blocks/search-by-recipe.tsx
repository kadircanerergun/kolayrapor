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
import { useDialogContext } from "@/contexts/dialog-context";
import { useModal } from "@/hooks/useModal";
import { ModalProvider } from "@/components/modal-provider";
import { PrescriptionMedicinesModal } from "@/components/prescription-medicines-modal";
import { Recete } from "@/types/recete";
import { useNavigate } from "@tanstack/react-router";
import { useCredentials } from "@/contexts/credentials-context";
import { cacheDetail } from "@/lib/db";
import { useAppDispatch } from "@/store";
import { detayFetched } from "@/store/slices/receteSlice";

const SearchByRecipe = () => {
  const playwright = usePlaywright();
  const dispatch = useAppDispatch();
  const [recipeCode, setRecipeCode] = useState("");
  const dialog = useDialogContext();
  const modal = useModal();
  const navigate = useNavigate();
  const { credentials } = useCredentials();

  const checkCredentials = (): boolean => {
    if (!credentials || !credentials.username || !credentials.password) {
      dialog.showConfirmDialog({
        title: "Kimlik Bilgileri Gerekli",
        description: "SGK portalına giriş için kimlik bilgilerinizi ayarlamalısınız. Ayarlar sayfasına gitmek ister misiniz?",
        confirmText: "Ayarlara Git",
        cancelText: "İptal",
        onConfirm: () => navigate({ to: "/ayarlar" }),
      });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipeCode.trim()) return;

    // Check if credentials are set
    if (!checkCredentials()) return;

    // Initialize Playwright if not ready
    if (!playwright.isReady) {
      console.log("Initializing Playwright...");
      const initResult = await playwright.initialize();
      if (!initResult.success) {
        dialog.showAlert({
          title: "Başlatma Hatası",
          description: `Playwright başlatılırken hata oluştu: ${initResult.error}`,
        });
        return;
      }
    }
    const searchResult = await playwright.searchPrescription(recipeCode);

    if (searchResult.success && searchResult.prescriptionData) {
      const prescriptionData = searchResult.prescriptionData as Recete;

      // Save to Dexie cache and Redux
      await cacheDetail(prescriptionData);
      dispatch(detayFetched(prescriptionData));

      modal.openModal(
        <PrescriptionMedicinesModal
          prescriptionData={prescriptionData}
          onQueryMedicine={(medicine) => {
            console.log('Querying medicine:', medicine);
          }}
        />,
        {
          title: "Reçete Detayları",
          size: "6xl",
        }
      );
    } else {
      dialog.showAlert({
        title: "Hata",
        description: `SGK portalına giderken hata: ${searchResult.error}`,
      });
    }
  };
  return (
    <>
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

    <ModalProvider modal={modal.modal} onClose={modal.closeModal} />
    </>
  );
};

export { SearchByRecipe };
