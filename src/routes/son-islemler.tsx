import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SonIslemlerTable } from "@/components/son-islemler-table";
import { toast } from "sonner";

function SonIslemler() {
  const refreshRef = useRef<(() => Promise<void>) | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshRef.current?.();
      toast.success("Veriler güncellendi");
    } catch {
      toast.error("Yenileme sırasında bir hata oluştu");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Kontrol Geçmişi</h1>
            <p className="text-muted-foreground">
              Daha önce sorgulanan ve analiz edilen reçeteler
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Yenileniyor..." : "Yenile ve Senkronize Et"}
          </Button>
        </div>

        <SonIslemlerTable showHeader={false} refreshRef={refreshRef} />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/son-islemler")({
  component: SonIslemler,
});
