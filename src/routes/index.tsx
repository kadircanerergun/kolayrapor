import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";

interface InstallProgress {
  status: "checking" | "installing" | "done" | "error";
  message: string;
  progress?: number;
  details?: string;
}

function LandingPage() {
  const navigate = useNavigate();
  const [installProgress, setInstallProgress] = useState<InstallProgress>({
    status: "checking",
    message: "Uygulama hazırlanıyor...",
  });
  const [isReady, setIsReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const initializeApp = useCallback(async () => {
    let cleanup: (() => void) | undefined;

    try {
      // Subscribe to progress updates
      cleanup = window.playwrightAPI.onBrowserInstallProgress((progress) => {
        setInstallProgress(progress);
      });

      // Ensure browsers are installed
      setInstallProgress({
        status: "checking",
        message: "Gerekli dosyalar kontrol ediliyor...",
      });

      const result = await window.playwrightAPI.ensureBrowsers();

      // Check if result indicates an error
      if (result && !result.success && result.error) {
        throw new Error(result.error);
      }

      setInstallProgress({
        status: "done",
        message: "Hazır",
        progress: 100,
      });

      setIsReady(true);
    } catch (error) {
      console.error("Initialization error:", error);
      const errorMessage = error instanceof Error ? error.message : "Bir hata oluştu";
      setInstallProgress({
        status: "error",
        message: "Başlatma hatası",
        details: errorMessage,
      });
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  useEffect(() => {
    initializeApp();
  }, [initializeApp, retryCount]);

  const handleRetry = () => {
    setInstallProgress({
      status: "checking",
      message: "Tekrar deneniyor...",
    });
    setRetryCount((c) => c + 1);
  };

  useEffect(() => {
    if (!isReady) return;

    // Go directly to home - credentials can be set in Settings when needed
    navigate({ to: "/home" });
  }, [isReady, navigate]);

  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-3xl font-bold text-center">
          Eczane Rapor Doğrulama
        </h1>
        <p className="text-muted-foreground text-center">
          {installProgress.message}
        </p>
        {installProgress.status === "installing" &&
          installProgress.progress !== undefined && (
            <div className="w-64 bg-secondary rounded-full h-2.5">
              <div
                className="bg-primary h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${installProgress.progress}%` }}
              />
            </div>
          )}
        {installProgress.status === "error" ? (
          <div className="flex flex-col items-center gap-4">
            <div className="text-destructive text-center">
              <p className="font-medium">{installProgress.message}</p>
              {installProgress.details && (
                <p className="text-sm mt-1 max-w-md">{installProgress.details}</p>
              )}
            </div>
            <Button onClick={handleRetry} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Tekrar Dene
            </Button>
          </div>
        ) : (
          <Spinner size="lg" />
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: LandingPage,
});
