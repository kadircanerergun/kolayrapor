import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Lock,
  Loader2,
  LogIn,
  CheckCircle2,
  AlertCircle,
  FlaskConical,
} from "lucide-react";
import { useCredentials } from "@/contexts/credentials-context";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/utils/tailwind";
import { toast } from "sonner";
import type { ReceteReportResponse } from "@/services/report-api";
import { useAppDispatch, useAppSelector } from "@/store";
import { searchPrescriptionDetail, analyzePrescription } from "@/store/slices/playwrightSlice";
import { ReportResultModal } from "@/components/report-result-modal";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type LoginStatus = "idle" | "logging-in" | "logged-in" | "error";

const MEDULA_URL = "https://medeczane.sgk.gov.tr/eczane";
const DEFAULT_MAX_LOGIN_ATTEMPTS = 5;

function getMaxLoginAttempts(): number {
  try {
    const stored = localStorage.getItem("maxLoginAttempts");
    if (stored) {
      const val = parseInt(stored, 10);
      if (!isNaN(val) && val > 0) return val;
    }
  } catch { /* ignore */ }
  return DEFAULT_MAX_LOGIN_ATTEMPTS;
}

// Detect if we're on a Recete Detay page
const DETECT_RECETE_DETAY_JS = `
(() => {
  const table = document.querySelector('table#f\\\\:tbl1');
  const receteNo = document.querySelector('#f\\\\:t13');
  return !!(table && receteNo && receteNo.textContent && receteNo.textContent.trim());
})();
`;

// Extract just the receteNo from the page
const GET_RECETE_NO_JS = `
(() => {
  const el = document.querySelector('#f\\\\:t13');
  return el ? (el.textContent || '').replace(/\\u00a0/g, ' ').trim() : null;
})();
`;

// Inject analyze icons next to report text in the medicine table
const INJECT_REPORT_ICONS_JS = `
(() => {
  document.querySelectorAll('.kolay-rapor-icon').forEach(el => el.remove());

  const table = document.querySelector('table#f\\\\:tbl1');
  if (!table) return;

  const rows = table.querySelectorAll('tr.rowClass1, tr.rowClass2');
  rows.forEach(row => {
    const barkodInput = row.querySelector('input[id$=":t1"]');
    if (!barkodInput) return;
    const barkodId = barkodInput.id || '';
    const m = barkodId.match(/^f:tbl1:(\\d+):t1$/);
    if (!m) return;
    const i = Number(m[1]);

    const raporSpan = row.querySelector('span[id="f:tbl1:' + i + ':t9"]');
    if (!raporSpan || !raporSpan.textContent.trim()) return;

    const btn = document.createElement('span');
    btn.className = 'kolay-rapor-icon';
    btn.dataset.barkod = barkodInput.value || '';
    btn.title = 'Raporu Analiz Et';
    btn.style.cssText = 'cursor:pointer;margin-left:4px;display:inline-flex;vertical-align:middle;';
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v6l-2 1"/><path d="M15 2v6l2 1"/><path d="M12 8v4"/><path d="M7 14.5A7 7 0 1 0 17 14.5"/><circle cx="12" cy="17" r="3"/></svg>';

    raporSpan.parentElement.appendChild(btn);
  });
})();
`;

export function BrowserView() {
  const webviewRef = useRef<Electron.WebviewTag | null>(null);
  const [currentUrl, setCurrentUrl] = useState(MEDULA_URL);
  const [isLoading, setIsLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loginStatus, setLoginStatus] = useState<LoginStatus>("idle");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isOnReceteDetay, setIsOnReceteDetay] = useState(false);
  const [currentReceteNo, setCurrentReceteNo] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReAnalyzing, setIsReAnalyzing] = useState(false);
  const [reportResult, setReportResult] = useState<ReceteReportResponse | null>(null);
  const [viewingMedicineName, setViewingMedicineName] = useState("");
  const [viewingBarkod, setViewingBarkod] = useState("");
  const loginAttemptRef = useRef(0);
  const autoLoginAttempted = useRef(false);
  const performLoginRef = useRef<(skipReload?: boolean) => void>(() => {});
  const analyzeSingleRef = useRef<(barkod: string) => void>(() => {});
  const { credentials } = useCredentials();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Get analysis results from Redux for current prescription
  const analizSonuclari = useAppSelector((s) =>
    currentReceteNo ? s.recete.analizSonuclari[currentReceteNo] ?? {} : {}
  );

  const updateNavState = useCallback(() => {
    const webview = webviewRef.current;
    if (!webview) return;
    try {
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
    } catch {
      // webview not ready yet
    }
  }, []);

  const checkPageState = useCallback(async () => {
    const webview = webviewRef.current;
    if (!webview) return;
    try {
      const isDetay: boolean = await webview.executeJavaScript(DETECT_RECETE_DETAY_JS);
      setIsOnReceteDetay(isDetay);

      if (isDetay) {
        const receteNo: string | null = await webview.executeJavaScript(GET_RECETE_NO_JS);
        setCurrentReceteNo(receteNo);
        await webview.executeJavaScript(INJECT_REPORT_ICONS_JS);
      } else {
        setCurrentReceteNo(null);
      }

      // Auto-detect logged-in state & auto-login on first load
      const hasLoginForm: boolean = await webview.executeJavaScript(`
        !!document.querySelector('input[type="submit"][value="Giriş Yap"]')
      `);
      if (!hasLoginForm && loginStatus === "idle") {
        setLoginStatus("logged-in");
      } else if (hasLoginForm && loginStatus === "idle" && !autoLoginAttempted.current && credentials) {
        autoLoginAttempted.current = true;
        // Defer so state updates settle before login starts; skip reload since page is already loaded
        setTimeout(() => performLoginRef.current(true), 0);
      }
    } catch {
      setIsOnReceteDetay(false);
      setCurrentReceteNo(null);
    }
  }, [loginStatus]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const onDidNavigate = (e: Electron.DidNavigateEvent) => {
      setCurrentUrl(e.url);
      updateNavState();
    };

    const onDidStartLoading = () => setIsLoading(true);
    const onDidStopLoading = () => {
      setIsLoading(false);
      updateNavState();
      checkPageState();
    };

    const onConsoleMessage = (e: Electron.ConsoleMessageEvent) => {
      if (e.message.startsWith("KOLAY_ANALYZE_MEDICINE:")) {
        const barkod = e.message.replace("KOLAY_ANALYZE_MEDICINE:", "");
        analyzeSingleRef.current(barkod);
      }
    };

    webview.addEventListener("did-navigate", onDidNavigate);
    webview.addEventListener("did-navigate-in-page", onDidNavigate as any);
    webview.addEventListener("did-start-loading", onDidStartLoading);
    webview.addEventListener("did-stop-loading", onDidStopLoading);
    webview.addEventListener("console-message", onConsoleMessage);

    return () => {
      webview.removeEventListener("did-navigate", onDidNavigate);
      webview.removeEventListener("did-navigate-in-page", onDidNavigate as any);
      webview.removeEventListener("did-start-loading", onDidStartLoading);
      webview.removeEventListener("did-stop-loading", onDidStopLoading);
      webview.removeEventListener("console-message", onConsoleMessage);
    };
  }, [updateNavState, checkPageState]);

  // Attach click handlers to injected icons
  useEffect(() => {
    if (!isOnReceteDetay) return;
    const webview = webviewRef.current;
    if (!webview) return;

    const attach = async () => {
      try {
        await webview.executeJavaScript(`
          document.querySelectorAll('.kolay-rapor-icon').forEach(btn => {
            if (btn.dataset.listenerAttached) return;
            btn.dataset.listenerAttached = 'true';
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              console.log('KOLAY_ANALYZE_MEDICINE:' + btn.dataset.barkod);
            });
          });
        `);
      } catch { /* ignore */ }
    };
    attach();
  }, [isOnReceteDetay]);

  const goBack = () => webviewRef.current?.goBack();
  const goForward = () => webviewRef.current?.goForward();
  const reload = () => webviewRef.current?.reload();

  const waitForLoadStop = (): Promise<void> => {
    return new Promise((resolve) => {
      const webview = webviewRef.current;
      if (!webview) return resolve();
      const handler = () => {
        webview.removeEventListener("did-stop-loading", handler);
        resolve();
      };
      webview.addEventListener("did-stop-loading", handler);
    });
  };

  /**
   * Analyze the current prescription by delegating to Playwright in the background.
   * Playwright searches the same prescription, scrapes all report/detay data, then calls the API.
   */
  const handleAnalyzeAll = async () => {
    if (isAnalyzing || !currentReceteNo) return;

    setIsAnalyzing(true);
    const toastId = toast.loading("Reçete verileri toplanıyor...");

    try {
      // 1. Use Playwright to fetch full prescription detail (with rapor + detay)
      toast.loading("Reçete detayları Playwright ile alınıyor...", { id: toastId });
      await dispatch(searchPrescriptionDetail({ receteNo: currentReceteNo, force: true })).unwrap();

      // 2. Run analysis for all raporlu medicines
      toast.loading("İlaçlar analiz ediliyor...", { id: toastId });
      const results = await dispatch(analyzePrescription({ receteNo: currentReceteNo, force: true })).unwrap();

      const count = Object.keys(results).length;
      if (count > 0) {
        toast.success(`Analiz tamamlandı (${count} ilaç)`, {
          id: toastId,
          action: count === 1
            ? {
                label: "Sonucu Gör",
                onClick: () => {
                  const barkod = Object.keys(results)[0];
                  setReportResult(results[barkod]);
                  setViewingMedicineName(barkod);
                  setViewingBarkod(barkod);
                },
              }
            : undefined,
          duration: 10000,
        });
      } else {
        toast.info("Bu reçetede analiz edilecek raporlu ilaç bulunamadı.", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err?.message || "Analiz sırasında hata oluştu.", { id: toastId });
    } finally {
      setIsAnalyzing(false);
    }
  };

  /** Analyze a single medicine — same flow, the thunk handles individual medicines */
  const handleAnalyzeSingleMedicine = async (barkod: string) => {
    if (isAnalyzing || !currentReceteNo) return;

    // If already analyzed, show result directly
    if (analizSonuclari[barkod]) {
      setReportResult(analizSonuclari[barkod]);
      setViewingMedicineName(barkod);
      setViewingBarkod(barkod);
      return;
    }

    setIsAnalyzing(true);
    const toastId = toast.loading("Analiz ediliyor...");

    try {
      // Ensure prescription detail is fetched
      await dispatch(searchPrescriptionDetail({ receteNo: currentReceteNo })).unwrap();

      // Run full analysis (analyzes all raporlu medicines)
      const results = await dispatch(analyzePrescription({ receteNo: currentReceteNo })).unwrap();

      if (results[barkod]) {
        toast.success("Analiz tamamlandı", {
          id: toastId,
          action: {
            label: "Sonucu Gör",
            onClick: () => {
              setReportResult(results[barkod]);
              setViewingMedicineName(barkod);
              setViewingBarkod(barkod);
            },
          },
          duration: 10000,
        });
      } else {
        toast.info("Bu ilaç için analiz sonucu üretilemedi.", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err?.message || "Analiz sırasında hata oluştu.", { id: toastId });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Keep ref updated so console-message listener always calls latest version
  analyzeSingleRef.current = handleAnalyzeSingleMedicine;

  /** Re-analyze: re-fetch prescription data then re-run analysis */
  const handleReAnalyze = async () => {
    if (!currentReceteNo || !viewingBarkod) return;

    setIsReAnalyzing(true);
    try {
      await dispatch(searchPrescriptionDetail({ receteNo: currentReceteNo, force: true })).unwrap();
      const results = await dispatch(analyzePrescription({ receteNo: currentReceteNo, force: true })).unwrap();

      if (results[viewingBarkod]) {
        setReportResult(results[viewingBarkod]);
        toast.success("Yeniden analiz tamamlandı");
      } else {
        toast.info("Bu ilaç için analiz sonucu üretilemedi.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Yeniden analiz sırasında hata oluştu.");
    } finally {
      setIsReAnalyzing(false);
    }
  };

  // --- Login ---

  const performLogin = async (skipReload = false) => {
    const webview = webviewRef.current;
    if (!webview) return;

    if (!credentials) {
      const goToSettings = confirm(
        "Giriş bilgileri bulunamadı. Ayarlar sayfasına gitmek ister misiniz?"
      );
      if (goToSettings) {
        navigate({ to: "/ayarlar" });
      }
      return;
    }

    setLoginStatus("logging-in");
    setLoginError(null);
    loginAttemptRef.current = 0;

    if (!skipReload) {
      webview.loadURL(MEDULA_URL);
      await waitForLoadStop();
    }
    await attemptLogin(webview);
  };

  // Keep ref updated for auto-login from checkPageState
  performLoginRef.current = performLogin;

  const attemptLogin = async (webview: Electron.WebviewTag) => {
    loginAttemptRef.current += 1;

    if (loginAttemptRef.current > getMaxLoginAttempts()) {
      setLoginStatus("error");
      setLoginError("Maksimum giriş denemesi aşıldı. Lütfen tekrar deneyin.");
      return;
    }

    try {
      await webview.executeJavaScript(`
        new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject('Login form not found'), 10000);
          const check = () => {
            if (document.querySelector('input[name*="text1"]')) {
              clearTimeout(timeout);
              resolve(true);
            } else {
              setTimeout(check, 200);
            }
          };
          check();
        });
      `);

      await webview.executeJavaScript(`
        (() => {
          const field = document.querySelector('input[name*="text1"]');
          if (field) {
            field.value = ${JSON.stringify(credentials!.username)};
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
          }
        })();
      `);

      await webview.executeJavaScript(`
        (() => {
          const field = document.querySelector('input[type="password"][name*="secret1"]');
          if (field) {
            field.value = ${JSON.stringify(credentials!.password)};
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
          }
        })();
      `);

      const base64Image: string | null = await webview.executeJavaScript(`
        (() => {
          const img = document.querySelector('img[src="/eczane/SayiUretenImageYeniServlet"]');
          if (!img) return null;
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          return canvas.toDataURL('image/png').split(',')[1];
        })();
      `);

      if (!base64Image) {
        setLoginStatus("error");
        setLoginError("Captcha resmi bulunamadı.");
        return;
      }

      const captchaResult = await window.captchaAPI.solve(base64Image);
      if (!captchaResult.success || !captchaResult.code) {
        setLoginStatus("error");
        setLoginError("Captcha çözülemedi. Lütfen tekrar deneyin.");
        return;
      }

      await webview.executeJavaScript(`
        (() => {
          const field = document.querySelector('input[name*="j_id_jsp_2072829783_5"]');
          if (field) {
            field.value = ${JSON.stringify(captchaResult.code)};
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
          }
        })();
      `);

      await webview.executeJavaScript(`
        (() => {
          const checkbox = document.querySelector('input[name*="kvkkTaahhut"]');
          if (checkbox && !checkbox.checked) checkbox.click();
        })();
      `);

      await webview.executeJavaScript(`
        (() => {
          const btn = document.querySelector('input[type="submit"][value="Giriş Yap"]');
          if (btn) btn.click();
        })();
      `);

      await waitForLoadStop();

      const errorText: string | null = await webview.executeJavaScript(`
        (() => {
          const errorEl = document.querySelector('table#box1');
          if (errorEl) return errorEl.textContent?.trim() || null;
          return null;
        })();
      `);

      if (errorText) {
        if (errorText.includes("IP bu eczane için giriş yapmaya yetkili değildir")) {
          setLoginStatus("error");
          setLoginError("IP adresi bu eczane için yetkili değil.");
          return;
        }
        if (errorText.includes("Geçersiz güvenlik kodu")) {
          webview.loadURL(MEDULA_URL);
          await waitForLoadStop();
          await attemptLogin(webview);
          return;
        }
        setLoginStatus("error");
        setLoginError(errorText);
        return;
      }

      const stillOnLogin: boolean = await webview.executeJavaScript(`
        !!document.querySelector('input[type="submit"][value="Giriş Yap"]')
      `);

      if (stillOnLogin) {
        webview.loadURL(MEDULA_URL);
        await waitForLoadStop();
        await attemptLogin(webview);
        return;
      }

      setLoginStatus("logged-in");
    } catch (err) {
      setLoginStatus("error");
      setLoginError(err instanceof Error ? err.message : "Giriş sırasında hata oluştu.");
    }
  };

  const isHttps = currentUrl.startsWith("https://");

  const statusConfig = {
    idle: { icon: LogIn, label: "Otomatik Giriş", variant: "default" as const },
    "logging-in": { icon: Loader2, label: "Giriş yapılıyor...", variant: "secondary" as const },
    "logged-in": { icon: CheckCircle2, label: "Giriş yapıldı", variant: "secondary" as const },
    error: { icon: AlertCircle, label: "Tekrar Dene", variant: "destructive" as const },
  };

  const status = statusConfig[loginStatus];
  const StatusIcon = status.icon;

  return (
    <div className="flex h-full flex-col">
      {/* Navigation toolbar */}
      <div className="bg-muted/30 flex items-center gap-1 border-b px-3 py-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goBack} disabled={!canGoBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goForward} disabled={!canGoForward}>
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={reload}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>

        {/* URL bar */}
        <div className="bg-background flex min-w-0 flex-1 items-center gap-2 rounded-md border px-3 py-1.5">
          {isHttps && <Lock className="text-green-600 h-3.5 w-3.5 flex-shrink-0" />}
          <span className="text-muted-foreground truncate text-sm">{currentUrl}</span>
        </div>

        {/* Analyze button — only when on Recete Detay page */}
        {isOnReceteDetay && (
          <Button
            variant="default"
            size="sm"
            className="ml-1 gap-1.5"
            onClick={handleAnalyzeAll}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            Analiz Et
          </Button>
        )}

        {/* Login button — hidden once logged in */}
        {loginStatus !== "logged-in" && (
          <Button
            variant={status.variant}
            size="sm"
            className="ml-1 gap-1.5"
            onClick={loginStatus === "logging-in" ? undefined : () => performLogin()}
            disabled={loginStatus === "logging-in"}
          >
            <StatusIcon className={cn("h-4 w-4", loginStatus === "logging-in" && "animate-spin")} />
            {status.label}
          </Button>
        )}
      </div>

      {/* Login error message */}
      {loginError && (
        <div className="bg-destructive/10 text-destructive flex items-center gap-2 border-b px-3 py-1.5 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {loginError}
        </div>
      )}

      {/* Webview */}
      <webview
        ref={webviewRef as any}
        src={MEDULA_URL}
        partition="persist:medula"
        className="flex-1"
        style={{ width: "100%", height: "100%" }}
      />

      {/* Report Result Sheet */}
      <Sheet
        open={!!reportResult}
        onOpenChange={(open) => {
          if (!open) {
            setReportResult(null);
            setViewingMedicineName("");
            setViewingBarkod("");
          }
        }}
      >
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Rapor Sonuçları</SheetTitle>
          </SheetHeader>
          {reportResult && (
            <ReportResultModal
              reportData={reportResult}
              medicineName={viewingMedicineName || "Seçili İlaç"}
              onBack={() => {
                setReportResult(null);
                setViewingMedicineName("");
                setViewingBarkod("");
              }}
              onReAnalyze={handleReAnalyze}
              isReAnalyzing={isReAnalyzing}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
