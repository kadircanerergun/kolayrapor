import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, Search } from "lucide-react";
import { tr } from "react-day-picker/locale";
import { usePlaywright } from "@/hooks/usePlaywright";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { sub } from "date-fns";
import dayjs from "dayjs";
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
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>();
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

    // Check if credentials are set
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
      selectedRange!.from!.toDateString(),
      selectedRange!.to!.toDateString(),
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
          Aramak istediğiniz reçete numarasını girin
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex space-y-4">
          <div className={"flex flex-1 flex-col gap-3"}>
            <div className={"flex flex-1 flex-row gap-2"}>
              <div className={'flex-1'}>
                <Calendar
                  disableNavigation={true}
                  disabled={(DateBefore) =>
                    DateBefore < sub(new Date(), { months: 2 })
                  }
                  selected={selectedRange}
                  locale={tr}
                  weekStartsOn={1}
                  numberOfMonths={2}
                  endMonth={sub(new Date(), { months: 0 })}
                  mode="range"
                  onSelect={(dateRange) => {
                    setSelectedRange(dateRange);
                  }}
                  className="w-full rounded-lg border"
                />
              </div>
              <div className={"flex flex-col gap-2"}>
                <Button
                  type={"button"}
                  variant={"outline"}
                  onClick={() => {
                    setSelectedRange({
                      from: dayjs().startOf("week").toDate(),
                      to: dayjs().endOf("week").toDate(),
                    });
                  }}
                >
                  Bu Hafta
                </Button>
                <Button
                  type={"button"}
                  variant={"outline"}
                  onClick={() => {
                    setSelectedRange({
                      from: dayjs()
                        .subtract(1, "week")
                        .startOf("week")
                        .toDate(),
                      to: dayjs().subtract(1, "week").endOf("week").toDate(),
                    });
                  }}
                >
                  Geçen Hafta
                </Button>
                <Button
                  type={"button"}
                  variant={"outline"}
                  onClick={() => {
                    setSelectedRange({
                      from: dayjs().startOf("month").toDate(),
                      to: dayjs().endOf("month").toDate(),
                    });
                  }}
                >
                  Bu Ay
                </Button>
                <Button
                  type={"button"}
                  onClick={() => {
                    setSelectedRange({
                      from: dayjs()
                        .subtract(1, "month")
                        .startOf("month")
                        .toDate(),
                      to: dayjs().subtract(1, "month").endOf("month").toDate(),
                    });
                  }}
                  variant={"outline"}
                >
                  Geçen Ay
                </Button>
              </div>
            </div>
            <Button
              type="submit"
              className="mt-4"
              disabled={
                playwright.isLoading ||
                !selectedRange?.from ||
                !selectedRange?.to
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
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export { SearchByDateRange };
