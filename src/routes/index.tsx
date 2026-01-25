import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Spinner } from "@/components/ui/spinner";
import { useEffect, useState } from "react";

interface InstallProgress {
  status: "checking" | "installing" | "done" | "error";
  message: string;
  progress?: number;
}

function LandingPage() {
  const navigate = useNavigate();
  const [installProgress, setInstallProgress] = useState<InstallProgress>({
    status: "checking",
    message: "Uygulama hazırlanıyor...",
  });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const initializeApp = async () => {
      try {
        // Subscribe to progress updates
        cleanup = window.playwrightAPI.onBrowserInstallProgress((progress) => {
          setInstallProgress(progress);
        });

        // Ensure browsers are installed
        setInstallProgress({
          status: "checking",
          message: "Tarayıcı kontrol ediliyor...",
        });

        await window.playwrightAPI.ensureBrowsers();

        setInstallProgress({
          status: "done",
          message: "Hazır",
          progress: 100,
        });

        setIsReady(true);
      } catch (error) {
        setInstallProgress({
          status: "error",
          message: error instanceof Error ? error.message : "Bir hata oluştu",
        });
      }
    };

    initializeApp();

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;

    // Check if user is already authenticated
    const checkAuth = () => {
      const stored = localStorage.getItem("credentials");
      if (stored) {
        try {
          const creds = JSON.parse(stored);
          if (creds.username && creds.password) {
            navigate({ to: "/home" });
            return;
          }
        } catch {
          // Invalid credentials, continue to login
        }
      }

      // If no valid credentials, go to login
      navigate({ to: "/login" });
    };

    checkAuth();
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
          <p className="text-destructive text-sm">{installProgress.message}</p>
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
