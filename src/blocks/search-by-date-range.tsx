import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { CalendarIcon, Loader2, Search } from "lucide-react";
import { usePlaywright } from "@/hooks/usePlaywright";
import { useState } from "react";
import { useDialogContext } from "@/contexts/dialog-context";
import { ReceteOzet } from "@/types/recete";
import { useNavigate } from "@tanstack/react-router";
import { useCredentials } from "@/contexts/credentials-context";

type SearchByDateRangeProps = {
  onSearchComplete?: (results: ReceteOzet[]) => void;
  onSearchStart?: () => void;
  onError?: (error: string) => void;
};

const SearchByDateRange = (props: SearchByDateRangeProps) => {
  const playwright = usePlaywright();
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date | undefined;
  } | null>(null);
  const dialog = useDialogContext();
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

    if (!checkCredentials()) return;

    props.onSearchStart?.();

    if (!playwright.isReady) {
      const initResult = await playwright.initialize();
      if (!initResult.success) {
        dialog.showAlert({
          title: "Başlatma Hatası",
          description:
            "Sistem başlatılamadı. Lütfen ayarlarınızı kontrol edin ve tekrar deneyin.",
        });
        props.onError?.("Sistem başlatılamadı");
        return;
      }
    }
    const searchResult = await playwright.searchByDateRange(
      dateRange!.from.toDateString(),
      dateRange!.to!.toDateString(),
    );
    if (searchResult.error) {
      dialog.showAlert({
        title: "Hata",
        description:
          "Sorgulama sirasinda bir hata oluştu: " + searchResult.error,
      });
      props.onError?.(searchResult.error);
    }
    if (searchResult.success) {
      if (!searchResult.prescriptions?.length) {
        dialog.showAlert({
          title: "Sonuç Bulunamadı",
          description:
            "Belirtilen tarih aralığında herhangi bir reçete bulunamadı.",
        });
      }
      props.onSearchComplete?.(searchResult.prescriptions);
    }
  };

  return (
    <Card className={"flex-1"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          Tarih ile Sorgulama
        </CardTitle>
        <CardDescription>
          Tarih araligi secin ve recete arayın
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          <DateRangePicker
            onUpdate={(values) => {
              setDateRange(values.range);
            }}
            showCompare={false}
            align="start"
          />
          <Button
            type="submit"
            disabled={
              playwright.isLoading ||
              !dateRange?.from ||
              !dateRange?.to
            }
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

export { SearchByDateRange };
