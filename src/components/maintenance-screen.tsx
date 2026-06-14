import { Wrench, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMaintenance } from "@/contexts/maintenance-context";
import { useState } from "react";

export function MaintenanceScreen() {
  const { message, endsAt, retry } = useMaintenance();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retry();
    } finally {
      setRetrying(false);
    }
  };

  const endsAtText = endsAt
    ? new Date(endsAt).toLocaleString("tr-TR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <Wrench className="h-9 w-9 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Sistem Bakımda</h1>
        <p className="max-w-md text-muted-foreground">
          {message ||
            "Şu anda sistemde bakım çalışması yapıyoruz. Kısa süre içinde tekrar hizmetinizdeyiz."}
        </p>
        {endsAtText && (
          <p className="text-sm text-muted-foreground">
            Tahmini bitiş: <span className="font-medium">{endsAtText}</span>
          </p>
        )}
      </div>

      <Button onClick={handleRetry} disabled={retrying} variant="outline">
        <RefreshCw
          className={`mr-2 h-4 w-4 ${retrying ? "animate-spin" : ""}`}
        />
        {retrying ? "Kontrol ediliyor..." : "Tekrar Dene"}
      </Button>
    </div>
  );
}
