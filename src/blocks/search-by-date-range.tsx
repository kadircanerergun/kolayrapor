import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { useDialogContext } from "@/contexts/dialog-context";
import { useNavigate } from "@tanstack/react-router";
import { useCredentials } from "@/contexts/credentials-context";
import { useAppDispatch, useAppSelector } from "@/store";
import { searchByDateRange } from "@/store/slices/playwrightSlice";
import { cn } from "@/utils/tailwind";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

const SearchByDateRange = () => {
  const dispatch = useAppDispatch();
  const { isLoading, isReady } = useAppSelector((s) => s.playwright);
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const dialog = useDialogContext();
  const navigate = useNavigate();
  const { credentials } = useCredentials();

  const checkCredentials = (): boolean => {
    if (!credentials || !credentials.username || !credentials.password) {
      dialog.showConfirmDialog({
        title: "Kimlik Bilgileri Gerekli",
        description:
          "SGK portalına giriş için kimlik bilgilerinizi ayarlamalısınız. Ayarlar sayfasına gitmek ister misiniz?",
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
        startDate: fromDate!.toDateString(),
        endDate: toDate!.toDateString(),
      }),
    );

    if (searchByDateRange.rejected.match(result)) {
      dialog.showAlert({
        title: "Hata",
        description:
          "Sorgulama sirasinda bir hata oluştu: " +
          (result.error.message || "Bilinmeyen hata"),
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
          Toplu Kontrol
        </CardTitle>
        <CardDescription>
          Baslangic ve bitis tarihi secin ve recete arayin
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          <div className="flex items-center gap-3">
            {/* Start Date Picker */}
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium">Baslangic Tarihi</label>
              <Popover open={fromOpen} onOpenChange={setFromOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !fromDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fromDate
                      ? format(fromDate, "dd MMMM yyyy", { locale: tr })
                      : "Tarih secin"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fromDate}
                    onSelect={(date) => {
                      setFromDate(date);
                      setFromOpen(false);
                      if (date && toDate && date > toDate) {
                        setToDate(undefined);
                      }
                    }}
                    disabled={(date) => date > new Date()}
                    locale={tr}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date Picker */}
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium">Bitis Tarihi</label>
              <Popover open={toOpen} onOpenChange={setToOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !toDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {toDate
                      ? format(toDate, "dd MMMM yyyy", { locale: tr })
                      : "Tarih secin"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={toDate}
                    onSelect={(date) => {
                      setToDate(date);
                      setToOpen(false);
                    }}
                    disabled={(date) =>
                      date > new Date() || (fromDate ? date < fromDate : false)
                    }
                    locale={tr}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Button type="submit" disabled={isLoading || !fromDate || !toDate}>
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
