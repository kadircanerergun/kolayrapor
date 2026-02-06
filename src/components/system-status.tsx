import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Server,
} from "lucide-react";
import { getPlaywrightAPI } from "@/utils/playwright-api-loader";
import { useCredentials } from "@/contexts/credentials-context";

interface SystemStatusState {
  status: "checking" | "ready" | "error" | "initializing" | "validating";
  message: string;
  error?: string;
  browserInstalled?: boolean;
  currentUrl?: string;
}

export function SystemStatus() {
  const [state, setState] = useState<SystemStatusState>({
    status: "checking",
    message: "Sistem durumu kontrol ediliyor...",
  });
  const [isRetrying, setIsRetrying] = useState(false);
  const { credentials } = useCredentials();

  const checkStatus = async () => {
    setState({
      status: "checking",
      message: "Sistem durumu kontrol ediliyor...",
    });

    try {
      const api = getPlaywrightAPI();

      // First try to initialize if not ready
      setState({
        status: "initializing",
        message: "Tarayıcı başlatılıyor...",
      });

      console.log("[SystemStatus] Initializing Playwright...");
      const initResult = await api.initialize();
      console.log("[SystemStatus] Initialize result:", initResult);

      if (!initResult?.success) {
        setState({
          status: "error",
          message: "Tarayıcı başlatılamadı",
          error: initResult?.error || "Bilinmeyen hata",
          browserInstalled: false,
        });
        return;
      }

      // Now validate by actually trying to navigate to SGK portal
      setState({
        status: "validating",
        message: "SGK portalına bağlanılıyor...",
      });

      // Check if we have credentials
      if (!credentials?.username || !credentials?.password) {
        setState({
          status: "ready",
          message: "Sistem hazır (kimlik bilgileri gerekli)",
          browserInstalled: true,
        });
        return;
      }

      // Set credentials in playwright
      console.log("[SystemStatus] Setting credentials...");
      await api.setCredentials(credentials);

      // Try to navigate to SGK portal (this will trigger login if needed)
      console.log("[SystemStatus] Navigating to SGK portal...");
      const navResult = await api.navigateToSGK();
      console.log("[SystemStatus] Navigation result:", navResult);

      if (navResult?.success) {
        setState({
          status: "ready",
          message: "Sistem hazır - SGK portalına bağlı",
          browserInstalled: true,
          currentUrl: navResult.currentUrl,
        });
      } else {
        setState({
          status: "error",
          message: "SGK portalına bağlanılamadı",
          error: navResult?.error || "Bağlantı hatası",
          browserInstalled: true,
        });
      }
    } catch (err) {
      console.error("[SystemStatus] Error:", err);
      setState({
        status: "error",
        message: "Sistem durumu kontrol edilemedi",
        error: err instanceof Error ? err.message : "Bilinmeyen hata",
      });
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    await checkStatus();
    setIsRetrying(false);
  };

  const getStatusIcon = () => {
    switch (state.status) {
      case "checking":
      case "initializing":
      case "validating":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case "ready":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (state.status) {
      case "checking":
      case "initializing":
      case "validating":
        return "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950";
      case "ready":
        return "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950";
      case "error":
        return "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950";
    }
  };

  return (
    <Card className={`${getStatusColor()} transition-colors duration-300`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Server className="h-4 w-4" />
          Sistem Durumu
        </CardTitle>
        {getStatusIcon()}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{state.message}</span>
          </div>

          {state.status === "error" && state.error && (
            <Alert variant="destructive" className="mt-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Hata Detayı</AlertTitle>
              <AlertDescription className="text-xs break-all">
                {state.error}
              </AlertDescription>
            </Alert>
          )}

          {state.status === "error" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full mt-2"
            >
              {isRetrying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deneniyor...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Tekrar Dene
                </>
              )}
            </Button>
          )}

          {state.status === "ready" && (
            <div className="text-xs text-muted-foreground">
              <p>Tarayıcı hazır, sorgulama yapabilirsiniz.</p>
              {state.currentUrl && (
                <p className="mt-1 truncate" title={state.currentUrl}>
                  URL: {state.currentUrl}
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
