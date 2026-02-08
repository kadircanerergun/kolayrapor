import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Server,
} from "lucide-react";
import { getPlaywrightAPI } from "@/utils/playwright-api-loader";
import { useCredentials } from "@/contexts/credentials-context";

interface SystemStatusState {
  status: "checking" | "ready" | "error" | "initializing" | "validating";
  message: string;
  browserInstalled?: boolean;
  currentUrl?: string;
}

// Module-level cache: persists across mounts within the same session
let cachedState: SystemStatusState | null = null;

interface SystemStatusProps {
  maxRetries?: number;
}

export function SystemStatus({ maxRetries = 5 }: SystemStatusProps) {
  const [state, setState] = useState<SystemStatusState>(
    cachedState ?? {
      status: "checking",
      message: "Sistem durumu kontrol ediliyor...",
    }
  );
  const [isRetrying, setIsRetrying] = useState(false);
  const { credentials } = useCredentials();

  const checkStatusOnce = async (): Promise<SystemStatusState> => {
    const api = getPlaywrightAPI();

    const initResult = await api.initialize();
    console.log("[SystemStatus] Initialize result:", initResult);

    if (!initResult?.success) {
      return {
        status: "error",
        message: "Sistem başlatılamadı",
        browserInstalled: false,
      };
    }

    // Check if we have credentials
    if (!credentials?.username || !credentials?.password) {
      return {
        status: "ready",
        message: "Sistem hazır (kimlik bilgileri gerekli)",
        browserInstalled: true,
      };
    }

    await api.setCredentials(credentials);

    const navResult = await api.navigateToSGK();
    console.log("[SystemStatus] Navigation result:", navResult);

    if (navResult?.success) {
      return {
        status: "ready",
        message: "Sistem hazır - SGK portalına bağlı",
        browserInstalled: true,
        currentUrl: navResult.currentUrl,
      };
    }

    return {
      status: "error",
      message: "SGK portalına bağlanılamadı",
      browserInstalled: true,
    };
  };

  const checkStatus = async () => {
    setState({
      status: "checking",
      message: "Sistem durumu kontrol ediliyor...",
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        setState({
          status: attempt === 1 ? "initializing" : "checking",
          message:
            attempt === 1
              ? "Sistem başlatılıyor..."
              : `Tekrar deneniyor (${attempt}/${maxRetries})...`,
        });

        const result = await checkStatusOnce();

        if (result.status === "ready") {
          cachedState = result;
          setState(result);
          return;
        }

        // Got an error result — retry unless this was the last attempt
        if (attempt === maxRetries) {
          cachedState = result;
          setState(result);
          return;
        }

        console.log(`[SystemStatus] Attempt ${attempt} failed, retrying...`);
      } catch (err) {
        console.error(`[SystemStatus] Attempt ${attempt} error:`, err);

        if (attempt === maxRetries) {
          const errorState: SystemStatusState = {
            status: "error",
            message: "Sistem durumu kontrol edilemedi",
          };
          cachedState = errorState;
          setState(errorState);
          return;
        }
      }

      // Brief delay before next retry
      await new Promise((r) => setTimeout(r, 2000));
    }
  };

  useEffect(() => {
    // Only run the check if we don't have a cached result from this session
    if (!cachedState) {
      checkStatus();
    }
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
              <p>Sistem hazır, sorgulama yapabilirsiniz.</p>
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
