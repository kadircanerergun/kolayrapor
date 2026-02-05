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
import { useState } from "react";
import { useDialogContext } from "@/contexts/dialog-context";
import { useNavigate } from "@tanstack/react-router";
import { useCredentials } from "@/contexts/credentials-context";
import { useAppDispatch, useAppSelector } from "@/store";
import { searchByDateRange } from "@/store/slices/playwrightSlice";

const SearchByDateRange = () => {
  const dispatch = useAppDispatch();
  const { isLoading, isReady } = useAppSelector((s) => s.playwright);
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

    const result = await dispatch(
      searchByDateRange({
        startDate: dateRange!.from.toDateString(),
        endDate: dateRange!.to!.toDateString(),
      }),
    );

    if (searchByDateRange.rejected.match(result)) {
      dialog.showAlert({
        title: "Hata",
        description:
          "Sorgulama sirasinda bir hata oluştu: " + (result.error.message || "Bilinmeyen hata"),
      });
    }

    if (searchByDateRange.fulfilled.match(result)) {
      if (!result.payload?.prescriptions?.length) {
        dialog.showAlert({
          title: "Sonuç Bulunamadı",
          description:
            "Belirtilen tarih aralığında herhangi bir reçete bulunamadı.",
        });
      }
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
              isLoading ||
              !dateRange?.from ||
              !dateRange?.to
            }
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isReady ? "Aranıyor..." : "Başlatılıyor..."}
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
