// Lazy import of Playwright to avoid Electron startup issues
import type { ChromiumBrowser, Locator, Page } from "playwright";
import { ELEMENT_SELECTORS } from "@/constants";
import dayjs from "dayjs";
import { WrongIpException } from "@/exceptions/wrong-ip.exception";
import { WrongCaptchaException } from "@/exceptions/wrong-captcha.exception";
import { InvalidLoginException } from "@/exceptions/invalid-login.exception";
import { PlaywrightErrorCode, PlaywrightException, } from "@/exceptions/playwright.exception";
import { URLS } from "@/constants/urls";
import { UnsuccessfulLoginException } from "@/exceptions/unsuccessful-login.exception";
import { app } from "electron";
import path from "path";
import fs from "fs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);
import { createRequire } from "module";
import { AsyncLocalStorage } from "async_hooks";
import * as Sentry from "@sentry/electron/main";
import {
  RECETE_VERI_SURUMU,
  DataGap,
  DataGapSebep,
  EReceteBaslik,
  EReceteBilgi,
  EReceteIlac,
  EsdegerBilgi,
  IlacBilgi,
  IlacMesaj,
  IlacOzet,
  OzelDurum,
  RaporAciklama,
  RaporDoktor,
  RaporEtkenMadde,
  RaporHasta,
  RaporIlaveDeger,
  RaporTani,
  Recete,
  ReceteIlac,
  ReceteOzet,
  ReceteRapor,
  ReceteSertifika,
  ReceteTani,
  ReceteUyariKodu,
} from "@/types/recete";
import { isEmpty } from "lodash";
import { solveCaptcha } from "@/services/captcha-solver";

let chromium: typeof import("playwright").chromium;

interface NavigationResult {
  success: boolean;
  currentUrl?: string;
  redirectedToLogin?: boolean;
  error?: string;
}

/**
 * Tek bir reçete toplama turunda biriken eksik alanlar — bkz.
 * withGapCollection(). Yalnızca OKUMA HATALARI birikir; sayfada gerçekten
 * olmayan alanlar (anchor doğrulandıktan sonra) eksik sayılmaz.
 */
type GapCollector = {
  receteNo?: string;
  gaps: DataGap[];
  /** O an hangi ilacın alt sayfası okunuyor; eksik kaydına barkod eklenir. */
  aktifBarkod?: string;
};

/** "Sorgula" sonrası sayfanın vardığı durum — bkz. waitForSearchOutcome(). */
type SearchOutcome =
  | { type: "detail" }
  | { type: "message"; text: string }
  | { type: "login" }
  | { type: "timeout" };

interface LoginResult {
  success: boolean;
  currentUrl?: string;
  redirectedToLogin?: boolean;
  error?: string;
}

interface SearchByDateResult {
  prescriptions?: ReceteOzet[];
  success: boolean;
  currentUrl?: string;
  error?: string;
}

export type FaturaTuru = "1" | "28";

interface LoginCredentials {
  username: string;
  password: string;
}

export type IlacRow = {
  rowIndex: number;
  checked: boolean;

  barkod: string;

  adet: string;
  periyotSayi: string;
  periyotTipi: string; // Günde/Haftada/Ayda/Yılda
  doz: string;
  carpim: string; // "x"
  doz2: string; // sağdaki sayı (ör: 100,0)

  adi: string;
  tutar: string;
  fark: string;
  rapor: string;
  verilebilecegi: string;
  msj: string;
  raporlar?: Record<string, any>;
};

type RaporData = {
  hakSahibi: {
    cinsiyet?: string;
    dogumTarihi?: string;
  };
  raporBilgileri: {
    raporNumarasi?: string;
    raporTarihi?: string;
    protokolNo?: string;
    duzenlemeTuru?: string;
    aciklama?: string;
    kayitSekli?: string;
    tesisKodu?: string;
    raporTakipNo?: string;
    tesisUnvani?: string;
    kullaniciAdi?: string;
    aciklamalar: Array<{ aciklama: string; eklenmeZamani: string }>;
  };
  taniBilgileri: Array<{
    grupBasligi: string;
    kodlar: Array<{ icd10: string; tanim: string }>;
    baslangic: string;
    bitis: string;
  }>;
  doktorBilgileri: Array<{
    diplomaNo: string;
    diplomaTescilNo: string;
    brans: string;
    adi: string;
    soyadi: string;
  }>;
  etkinMaddeBilgileri: Array<{
    kodu: string;
    adi: string;
    form: string;
    tedaviSema: string;
    adetMiktar: string;
    icerikMiktari: string;
    eklenmeZamani: string;
  }>;
};

function getPlaywrightPath(): string {
  const inDevelopment = process.env.NODE_ENV === "development";

  if (inDevelopment) {
    return "playwright-core";
  } else {
    // In production, playwright-core is in resources folder (via extraResource)
    return path.join(process.resourcesPath, "playwright-core");
  }
}

async function loadPlaywright() {
  if (!chromium) {
    try {
      const playwrightPath = getPlaywrightPath();
      console.log("Loading Playwright from:", playwrightPath);

      // Use createRequire to bypass Vite's module transformation
      // This allows loading modules from dynamic paths at runtime
      const nodeRequire = createRequire(import.meta.url);
      const pw = nodeRequire(playwrightPath);
      chromium = pw.chromium;
    } catch (error) {
      console.error("Playwright load error:", error);
      throw new Error(
        `Failed to load Playwright: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

function getBrowsersPath(): string {
  const inDevelopment = process.env.NODE_ENV === "development";

  if (inDevelopment) {
    // In development, use the local playwright-browsers folder if it exists
    return path.join(process.cwd(), "playwright-browsers");
  } else {
    // In production, browsers are downloaded on first launch to userData
    return path.join(app.getPath("userData"), "playwright-browsers");
  }
}

function checkBrowsersExist(): boolean {
  const browsersPath = getBrowsersPath();

  if (!fs.existsSync(browsersPath)) {
    return false;
  }

  const dirs = fs.readdirSync(browsersPath);
  const hasMarker = (prefix: string) =>
    dirs.some(dir => {
      if (!dir.startsWith(prefix)) return false;
      const markerFile = path.join(browsersPath, dir, "INSTALLATION_COMPLETE");
      return fs.existsSync(markerFile);
    });

  // Both chromium and chromium_headless_shell are required
  return hasMarker("chromium-") && hasMarker("chromium_headless_shell");
}

export interface BrowserInstallProgress {
  status: "checking" | "installing" | "done" | "error";
  message: string;
  progress?: number;
}

export type ProgressCallback = (progress: BrowserInstallProgress) => void;

async function installBrowsers(onProgress?: ProgressCallback): Promise<void> {
  const browsersPath = getBrowsersPath();

  if (!fs.existsSync(browsersPath)) {
    fs.mkdirSync(browsersPath, { recursive: true });
  }

  process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;

  onProgress?.({
    status: "installing",
    message: "Gerekli dosyalar indiriliyor, lütfen bekleyin...",
    progress: 0,
  });

  try {
    const playwrightPath = getPlaywrightPath();
    const nodeRequire = createRequire(import.meta.url);

    // Read browsers.json to get revision numbers
    const browsersJson = nodeRequire(path.join(playwrightPath, "browsers.json"));

    // Get extract function from playwright-core's bundled zip utilities
    const { extract } = nodeRequire(
      path.join(playwrightPath, "lib", "zipBundle")
    );

    const CDN_BASE = "https://cdn.playwright.dev/dbazure/download/playwright";

    // Determine what needs to be installed
    // dirName: Playwright uses underscores in directory names (e.g. chromium_headless_shell-1200)
    const toInstall: Array<{ name: string; dirName: string; revision: string; downloadPath: string }> = [];

    const chromiumInfo = browsersJson.browsers.find((b: any) => b.name === "chromium");
    if (chromiumInfo) {
      toInstall.push({
        name: "chromium",
        dirName: "chromium",
        revision: chromiumInfo.revision,
        downloadPath: `builds/chromium/${chromiumInfo.revision}/chromium-win64.zip`,
      });
    }

    // chromium-headless-shell is required for headless mode in Playwright v1.49+
    const headlessShellInfo = browsersJson.browsers.find((b: any) => b.name === "chromium-headless-shell");
    if (headlessShellInfo) {
      toInstall.push({
        name: "chromium-headless-shell",
        dirName: "chromium_headless_shell",
        revision: headlessShellInfo.revision,
        downloadPath: `builds/chromium/${headlessShellInfo.revision}/chromium-headless-shell-win64.zip`,
      });
    }

    // winldd is required on Windows for playwright to work
    if (process.platform === "win32") {
      const winlddInfo = browsersJson.browsers.find((b: any) => b.name === "winldd");
      if (winlddInfo) {
        toInstall.push({
          name: "winldd",
          dirName: "winldd",
          revision: winlddInfo.revision,
          downloadPath: `builds/winldd/${winlddInfo.revision}/winldd-win64.zip`,
        });
      }
    }

    for (let i = 0; i < toInstall.length; i++) {
      const item = toInstall[i];
      const browserDir = path.join(browsersPath, `${item.dirName}-${item.revision}`);
      const markerFile = path.join(browserDir, "INSTALLATION_COMPLETE");

      // Skip if already installed
      if (fs.existsSync(markerFile)) {
        console.log(`[Playwright] ${item.name} already installed, skipping`);
        continue;
      }

      onProgress?.({
        status: "installing",
        message: `Gerekli dosyalar indiriliyor (${i + 1}/${toInstall.length})...`,
        progress: Math.round((i / toInstall.length) * 50),
      });

      const url = `${CDN_BASE}/${item.downloadPath}`;
      console.log(`[Playwright] Downloading ${item.name} from: ${url}`);

      const tempDir = path.join(browsersPath, `_temp_${item.name}_${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });
      const zipPath = path.join(tempDir, `${item.name}.zip`);

      try {
        // Download the zip file in-process (no child_process.fork needed)
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        fs.writeFileSync(zipPath, Buffer.from(arrayBuffer));
        console.log(`[Playwright] Downloaded ${item.name} (${arrayBuffer.byteLength} bytes)`);

        // Extract the zip
        if (!fs.existsSync(browserDir)) {
          fs.mkdirSync(browserDir, { recursive: true });
        }

        onProgress?.({
          status: "installing",
          message: `Dosyalar çıkartılıyor (${i + 1}/${toInstall.length})...`,
          progress: Math.round(((i + 0.5) / toInstall.length) * 100),
        });

        await extract(zipPath, { dir: browserDir });
        console.log(`[Playwright] Extracted ${item.name} to ${browserDir}`);

        // Write the installation marker that playwright expects
        fs.writeFileSync(markerFile, "");
        console.log(`[Playwright] ${item.name} installation complete`);
      } finally {
        // Cleanup temp directory
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    onProgress?.({
      status: "done",
      message: "Kurulum tamamlandı",
      progress: 100,
    });
  } catch (error) {
    console.error("[Playwright] Download error:", error);
    onProgress?.({
      status: "error",
      message: "Dosya indirme sırasında hata oluştu",
    });
    throw error;
  }
}

export async function ensureBrowsersInstalled(onProgress?: ProgressCallback): Promise<void> {
  onProgress?.({
    status: "checking",
    message: "Gerekli dosyalar kontrol ediliyor..."
  });

  if (checkBrowsersExist()) {
    onProgress?.({
      status: "done",
      message: "Hazır",
      progress: 100
    });
    return;
  }

  console.log("Browsers not found, installing...");
  await installBrowsers(onProgress);
}

export class PlaywrightAutomationService {
  private browser: ChromiumBrowser | null = null;
  private page: Page | null = null;
  private isInitialized = false;
  private debugMode: boolean = false;
  private storedCredentials: LoginCredentials | null = null;
  private loginCounter = 0;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  // Depth counter so nested operations (e.g. searchPrescription → navigateToSGKPortal → navigateTo)
  // compose safely. Keep-alive only fires when depth === 0.
  private operationDepth = 0;
  private initializePromise: Promise<void> | null = null;
  private loginPromise: Promise<LoginResult> | null = null;
  /** Serializes browser operations; see withOperation(). */
  private lockQueue: Promise<void> = Promise.resolve();
  private readonly lockContext = new AsyncLocalStorage<true>();
  /** captureIssue()'nun aynı hatayı iki kez Sentry'ye göndermesini engeller. */
  private readonly capturedErrors = new WeakSet<Error>();
  /** Aktif reçete toplama turunun eksik alanları; bkz. withGapCollection(). */
  private readonly gapContext = new AsyncLocalStorage<GapCollector>();

  private static readonly KEEP_ALIVE_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
  /** "Sorgula" sonrası detay sayfası / uyarı / login için toplam bekleme. */
  private static readonly SEARCH_OUTCOME_TIMEOUT_MS = 30000;
  /** Login formunu ekrana getirmek için kaç kez navigasyon denenecek. */
  private static readonly LOGIN_FORM_ATTEMPTS = 3;
  /** Tek denemede login formunun render olması için beklenen süre. */
  private static readonly LOGIN_FORM_TIMEOUT_MS = 15000;
  /** Portal sol menüsünü ekrana getirmek için kaç kez denenecek. */
  private static readonly PORTAL_MENU_ATTEMPTS = 3;
  /** Tek denemede sol menünün render olması için beklenen süre. */
  private static readonly PORTAL_MENU_TIMEOUT_MS = 20000;
  /** Tek bir alan okunamazsa kaç kez daha denenecek; bkz. readField(). */
  private static readonly FIELD_RETRIES = 2;
  /** Alan retry'ları arasında JSF'in DOM'u tamamlaması için verilen ara. */
  private static readonly FIELD_RETRY_DELAY_MS = 300;
  /**
   * Tek bir alan okuması için üst sınır. Playwright'ın 30 sn'lik varsayılanı
   * retry'larla çarpılınca reçete başına dakikalara çıkıyor; alan zaten
   * sayfadaysa bu süre fazlasıyla yeter.
   */
  private static readonly FIELD_READ_TIMEOUT_MS = 4000;
  /** Bir alanın "sayfada yok" sayılabilmesi için sayfa doğrulama süresi. */
  private static readonly ANCHOR_TIMEOUT_MS = 15000;
  /**
   * Eksik alan kalırsa reçetenin baştan sorgulanma sayısı (ilk tur dahil).
   * İkinci tur da eksik dönerse reçete bloke edilir.
   */
  private static readonly RECETE_ATTEMPTS = 2;
  /**
   * Teknik alan yolunu kullanıcıya gösterilecek etikete çevirir; en uzun
   * eşleşen önek kazanır.
   */
  private static readonly GAP_ETIKETLERI: ReadonlyArray<[string, string]> = [
    ["ilaclar", "ilaç listesi"],
    ["ilac.rapor", "ilaç raporu"],
    ["ilac.detay", "ilaç bilgisi"],
    ["ilacBilgi.ayaktanMaksKullanimDoz", "doz bilgisi"],
    ["ilacBilgi.yatanMaksKullanimDoz", "doz bilgisi"],
    ["ilacBilgi.tekDoz", "doz bilgisi"],
    ["ilacBilgi", "ilaç bilgisi"],
    ["rapor", "rapor bilgileri"],
    ["eRecete", "e-Reçete bilgisi"],
    ["receteUyariKodlari", "uyarı kodları"],
    ["tanilar", "tanılar"],
    ["hasta", "hasta bilgisi"],
    ["recete", "reçete bilgileri"],
  ];
  /**
   * Hangi sayfada olduğumuzu kanıtlayan seçiciler. Bir alanın yokluğuna ancak
   * ilgili anchor doğrulandıktan SONRA karar verilebilir — yüklenmemiş sayfada
   * `count() === 0` yokluk değil, okuma hatasıdır.
   */
  private static readonly ANCHORS = {
    receteDetay: "#f\\:t13",
    ilacBilgi: 'td.menuHeader:has-text("İlaç Bilgileri")',
    rapor: 'td.menuHeader:has-text("Rapor Görme")',
    /** e-Reçete sayfasının kendi "Geri Dön" butonu (`form1:` prefix'li). */
    erecete: "input#form1\\:buttonGeriDon",
  } as const;

  private get operationInProgress(): boolean {
    return this.operationDepth > 0;
  }

  // Wraps any high-level browser operation. Everything shares a single Page,
  // so operations are serialized through a queue: a deeplink check firing
  // while a bulk run is mid-flight used to navigate the page out from under
  // it, surfacing as a 30s "waiting for #f:t13" timeout.
  //
  // Reentrancy matters — searchPrescription() calls navigateToSGKPortal(),
  // which wraps itself too. AsyncLocalStorage tells us we already hold the
  // lock so nested calls run inline instead of deadlocking on their caller.
  private async withOperation<T>(fn: () => Promise<T>): Promise<T> {
    if (this.lockContext.getStore()) {
      return this.runTracked(fn);
    }

    const run = this.lockQueue.then(
      () => this.lockContext.run(true, () => this.runTracked(fn)),
      () => this.lockContext.run(true, () => this.runTracked(fn)),
    );
    // Keep the chain alive when an operation rejects, otherwise every later
    // operation would inherit the rejection.
    this.lockQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /** Depth/keep-alive bookkeeping, shared by locked and nested runs. */
  private async runTracked<T>(fn: () => Promise<T>): Promise<T> {
    this.operationDepth++;
    try {
      return await fn();
    } finally {
      this.operationDepth--;
      if (this.operationDepth === 0) {
        this.restartKeepAliveTimer();
      }
    }
  }

  private restartKeepAliveTimer(): void {
    // Only reset cadence if keep-alive is actually active (post-login).
    if (this.keepAliveTimer !== null) {
      this.startKeepAlive();
    }
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    // If changing debug mode while browser is running, we need to restart
    if (this.isInitialized) {
      console.log(
        `Debug mode changed to ${enabled}, browser will restart on next action`,
      );
    }
  }

  getDebugMode(): boolean {
    return this.debugMode;
  }

  setCredentials(credentials: LoginCredentials): void {
    this.storedCredentials = credentials;
  }

  getStoredCredentials(): LoginCredentials | null {
    return this.storedCredentials;
  }

  hasCredentials(): boolean {
    return this.storedCredentials !== null;
  }

  startKeepAlive(): void {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(async () => {
      if (!this.isReady()) return;
      try {
        // Medula's own pages hold the session open by pinging /sessionCheck
        // every 4 min (204 while alive). Doing the same with a request instead
        // of a navigation means keep-alive can never pull the page out from
        // under a running search — the old goto() did exactly that.
        const response = await this.page!.request.get(URLS.SESSION_CHECK, {
          timeout: 15000,
          failOnStatusCode: false,
        });
        if (response.status() === 204) return;

        console.log(
          `[Playwright] Keep-alive: session check returned ${response.status()}, re-logging in...`,
        );
        if (!this.hasCredentials()) return;

        // Re-login navigates, so it must queue behind any real work.
        try {
          await this.withOperation(async () => {
            await this.page!.goto(URLS.MEDULA_HOME, {
              waitUntil: "load",
              timeout: 30000,
            });
            if (this.page!.url().includes("/login")) {
              await this.performLogin(this.storedCredentials!);
            }
            console.log("[Playwright] Keep-alive: session restored");
          });
        } catch (err) {
          // Ping hatası ağ dalgalanması olabilir ve gürültü yapar; ama oturum
          // yenilenemiyorsa sonraki tüm işlemler patlar — bunu bilmek gerek.
          this.captureIssue(err, {
            operation: "keepAlive",
            outcome: "relogin-failed",
          });
          throw err;
        }
      } catch (err) {
        console.warn("[Playwright] Keep-alive failed:", err);
      }
    }, PlaywrightAutomationService.KEEP_ALIVE_INTERVAL_MS);
    console.log("[Playwright] Keep-alive started (every 2 min)");
  }

  stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
      console.log("[Playwright] Keep-alive stopped");
    }
  }

  /**
   * Otomasyon hatalarını bağlamıyla birlikte Sentry'ye gönderir. Bu hataların
   * teşhisi "hangi sayfada takıldık"a bağlı olduğu için URL ve portal mesajı
   * da eklenir. Hasta adı gibi kişisel veri gönderilmez.
   */
  private captureIssue(
    error: unknown,
    context: {
      operation: string;
      outcome?: string;
      receteNo?: string;
      /** Portalın o an ekranda gösterdiği uyarı metni. */
      pageMessage?: string;
      /** İşleme özgü ek bağlam (dönem, tarih aralığı vb.). */
      detail?: string;
    },
  ): void {
    try {
      // Aynı hata iç içe katmanlarda tekrar yakalanabiliyor (ör. ensureLoginForm
      // → performLogin). İlk yakalayan en zengin bağlama sahip olduğu için
      // sonrakiler sessizce atlanıyor; aksi halde Sentry'de çift issue açılıyor.
      if (error instanceof Error) {
        if (this.capturedErrors.has(error)) return;
        this.capturedErrors.add(error);
      }

      // page.url() senkron ve güvenli; title() gibi çağrılar meşgul sayfada
      // asılabileceği için bilinçli olarak kullanılmıyor.
      let currentUrl: string | undefined;
      try {
        currentUrl = this.page?.isClosed() ? undefined : this.page?.url();
      } catch {
        currentUrl = undefined;
      }

      const outcome = context.outcome ?? "exception";
      Sentry.captureException(
        error instanceof Error ? error : new Error(String(error)),
        {
          tags: {
            component: "playwright",
            operation: context.operation,
            outcome,
          },
          extra: {
            receteNo: context.receteNo,
            currentUrl,
            pageMessage: context.pageMessage,
            detail: context.detail,
          },
          // Aynı türdeki hatalar tek issue altında toplansın; aksi halde her
          // reçete numarası ayrı bir issue açar.
          fingerprint: ["playwright", context.operation, outcome],
        },
      );
    } catch (err) {
      console.warn("[Playwright] Sentry capture failed:", err);
    }
  }

  /**
   * Bir reçete toplama turunu sarmalar ve tur boyunca okunamayan alanları
   * biriktirir. Amaç, hata anında sessizce boş değere düşüp reçeteyi "tamam"
   * saymayı imkânsız kılmak: turun sonunda `gaps` doluysa reçete eksiktir.
   */
  private async withGapCollection<T>(
    receteNo: string,
    fn: () => Promise<T>,
  ): Promise<{ value: T; gaps: DataGap[] }> {
    const collector: GapCollector = { receteNo, gaps: [] };
    const value = await this.gapContext.run(collector, fn);
    return { value, gaps: collector.gaps };
  }

  /**
   * Okunamayan bir alanı kaydeder. Buraya YALNIZCA okuma/gezinme hataları
   * düşer; sayfada gerçekten bulunmayan alanlar (anchor doğrulandıktan sonra)
   * kaydedilmez, aksi halde her opsiyonel alan reçeteyi bloke ederdi.
   */
  private recordGap(gap: DataGap): void {
    const collector = this.gapContext.getStore();
    if (collector) {
      // İlaç alt sayfalarındaki alanlar hangi ilaca ait olduğunu bilmiyor;
      // barkodu turu başlatan ilaclaraRaporEkle bırakıyor.
      const kayit: DataGap = {
        ...gap,
        barkod: gap.barkod ?? collector.aktifBarkod,
      };
      // Aynı alan hem satır hem üst katmandan düşebiliyor; ilk kayıt yeterli.
      const zatenVar = collector.gaps.some(
        (g) => g.alan === kayit.alan && g.barkod === kayit.barkod,
      );
      if (!zatenVar) collector.gaps.push(kayit);
    }
    console.warn(
      `[Playwright] Eksik veri: ${gap.alan} (${gap.sebep})${gap.detay ? ` — ${gap.detay}` : ""}`,
    );
  }

  /** Eksik alanları kullanıcıya gösterilecek kısa bir özete çevirir. */
  private gapOzeti(gaps: DataGap[]): string {
    const etiketler: string[] = [];
    for (const gap of gaps) {
      const eslesme = PlaywrightAutomationService.GAP_ETIKETLERI.filter(
        ([onek]) => gap.alan.startsWith(onek),
      ).sort((a, b) => b[0].length - a[0].length)[0];
      const etiket = eslesme ? eslesme[1] : gap.alan;
      if (!etiketler.includes(etiket)) etiketler.push(etiket);
    }
    const gosterilen = etiketler.slice(0, 3).join(", ");
    return etiketler.length > 3
      ? `${gosterilen} ve ${etiketler.length - 3} alan daha`
      : gosterilen;
  }

  private gapReason(error: unknown): DataGapSebep {
    const message = error instanceof Error ? error.message : String(error);
    return /timeout/i.test(message) ? "timeout" : "read-failed";
  }

  /**
   * Tek bir alanı okur; okuma patlarsa {@link FIELD_RETRIES} kez daha dener.
   * Hepsi başarısızsa alan eksik olarak kaydedilir ve fallback döner — eski
   * `catch { return "" }` davranışının aksine bu sessiz kalmaz, reçete
   * eksik işaretlenir. Fallback yalnızca akışın devam edip kalan alanları da
   * toplayabilmesi için var; sonuç yine de gönderilmeyecek.
   */
  private async readField<T>(
    alan: string,
    read: () => Promise<T>,
    opts: { fallback: T; barkod?: string; retries?: number },
  ): Promise<T> {
    const retries = opts.retries ?? PlaywrightAutomationService.FIELD_RETRIES;
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await read();
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          await this.page
            ?.waitForTimeout(PlaywrightAutomationService.FIELD_RETRY_DELAY_MS)
            .catch(() => undefined);
        }
      }
    }
    this.recordGap({
      alan,
      sebep: this.gapReason(lastError),
      detay:
        lastError instanceof Error
          ? lastError.message.split("\n")[0]
          : String(lastError),
      barkod: opts.barkod,
    });
    return opts.fallback;
  }

  /**
   * readField üzerinden metin okur. Sayfa anchor'ı doğrulandıktan sonra
   * elemanın hiç bulunmaması gerçek yokluktur; eleman varken okuma patlarsa
   * alan eksik kaydedilir.
   */
  private readText(alan: string, locator: Locator, barkod?: string) {
    return this.readField(
      alan,
      async () => {
        if ((await locator.count()) === 0) return "";
        return (
          (await locator.textContent({
            timeout: PlaywrightAutomationService.FIELD_READ_TIMEOUT_MS,
          })) ?? ""
        );
      },
      { fallback: "", barkod },
    );
  }

  /**
   * Yokluğu olağan olan metin alanları için: okunamazsa eksik KAYDETMEZ, boş
   * döner. Yalnızca reçetenin klinik geçerliliğini etkilemeyen ve Medula'nın
   * bazı sayfalarda hiç basmadığı alanlarda kullanılır.
   */
  private async readOptionalText(locator: Locator): Promise<string> {
    try {
      return (
        (await locator.textContent({
          timeout: PlaywrightAutomationService.FIELD_READ_TIMEOUT_MS,
        })) ?? ""
      );
    } catch {
      return "";
    }
  }

  /** readField üzerinden input değeri okur; okunamazsa alan eksik kaydedilir. */
  private readInput(alan: string, locator: Locator, barkod?: string) {
    return this.readField(
      alan,
      async () => {
        if ((await locator.count()) === 0) return "";
        return await locator.inputValue({
          timeout: PlaywrightAutomationService.FIELD_READ_TIMEOUT_MS,
        });
      },
      { fallback: "", barkod },
    );
  }

  /**
   * Beklenen sayfada olduğumuzu doğrular. `false` dönerse o sayfadan okunacak
   * hiçbir şeyin yokluğuna güvenilemez, bu yüzden eksik olarak kaydedilir.
   */
  private async ensureAnchor(
    anchor: string,
    alan: string,
    timeout = PlaywrightAutomationService.ANCHOR_TIMEOUT_MS,
  ): Promise<boolean> {
    if (!this.page) return false;
    try {
      await this.page.waitForSelector(anchor, { state: "attached", timeout });
      return true;
    } catch {
      this.recordGap({ alan, sebep: "wrong-page", detay: anchor });
      return false;
    }
  }

  /** Reçete detay sayfasında mıyız? Alt sayfa turlarından dönüşü doğrular. */
  private async isOnDetailPage(timeout = 5000): Promise<boolean> {
    if (!this.page) return false;
    return await this.page
      .waitForSelector(PlaywrightAutomationService.ANCHORS.receteDetay, {
        state: "attached",
        timeout,
      })
      .then(() => true)
      .catch(() => false);
  }

  /**
   * Alt sayfada (Rapor / İlaç Bilgi / e-Reçete) takılı kaldıysak detay
   * sayfasına dönmeye çalışır. Dönemezse `false` — o durumda tek çıkış yolu
   * reçeteyi baştan sorgulamaktır, bunu searchPrescription üstleniyor.
   */
  private async recoverToDetailPage(operation: string): Promise<boolean> {
    if (!this.page) return false;
    try {
      if (await this.isOnDetailPage()) return true;
      const back = this.page.locator(
        'input[id$=":buttonGeriDon"], input[type="submit"][value="Geri Dön"]',
      );
      if ((await back.count()) === 0) return false;
      await back.first().click();
      return await this.isOnDetailPage();
    } catch (err) {
      this.captureIssue(err, { operation, outcome: "recover-failed" });
      return false;
    }
  }

  /**
   * Detay sayfasından ayrılıp geri dönen alt sayfa turlarını sarmalar. Tur
   * yarıda kalırsa detay sayfasına dönülüp bir kez daha denenir; ikinci deneme
   * de olmazsa hata yukarı verilir — çağıran alanı eksik kaydeder.
   */
  private async withSubPageRetry<T>(
    operation: string,
    run: () => Promise<T>,
  ): Promise<T> {
    try {
      return await run();
    } catch (err) {
      this.captureIssue(err, { operation, outcome: "subpage-retry" });
      if (!(await this.recoverToDetailPage(operation))) throw err;
      return await run();
    }
  }

  private normalizeText(s: string | null | undefined) {
    return (s ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async performAutoLogin(): Promise<NavigationResult> {
    if (!this.hasCredentials()) {
      return {
        success: false,
        error: "No stored credentials available for auto-login",
      };
    }

    return this.withOperation(() => this.performLogin(this.storedCredentials!));
  }

  async initialize(forceRestart: boolean = false, onProgress?: ProgressCallback): Promise<void> {
    // Fast path: already initialized and not restarting
    if (this.isInitialized && !forceRestart) {
      console.log("[Playwright] Already initialized, skipping...");
      return;
    }

    // Dedupe concurrent callers: share the in-flight initialization promise so
    // we don't end up launching multiple browser instances when several routes
    // / hooks call initialize() at the same time.
    if (this.initializePromise && !forceRestart) {
      console.log("[Playwright] Initialization already in progress, awaiting existing call...");
      return this.initializePromise;
    }

    this.initializePromise = this._doInitialize(forceRestart, onProgress).finally(() => {
      this.initializePromise = null;
    });
    return this.initializePromise;
  }

  private async _doInitialize(forceRestart: boolean, onProgress?: ProgressCallback): Promise<void> {
    try {
      console.log("[Playwright] Starting initialization...");

      // Set Playwright browsers path before loading
      const browsersPath = getBrowsersPath();
      process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;
      console.log("[Playwright] Using browsers path:", browsersPath);

      // Check if browsers path exists
      if (!fs.existsSync(browsersPath)) {
        console.log("[Playwright] Browsers path does not exist, will install...");
      }

      // Ensure browsers are installed before proceeding
      console.log("[Playwright] Ensuring browsers are installed...");
      await ensureBrowsersInstalled(onProgress);
      console.log("[Playwright] Browsers check complete");

      // Load Playwright dynamically
      console.log("[Playwright] Loading Playwright module...");
      await loadPlaywright();
      console.log("[Playwright] Playwright module loaded");

      // Re-check after async work in case another caller finished initializing
      if (this.isInitialized && !forceRestart) {
        console.log("[Playwright] Initialized while we waited, skipping launch...");
        return;
      }

      // Close existing browser if restarting
      if (forceRestart && this.browser) {
        console.log("[Playwright] Closing existing browser for restart...");
        await this.close();
      }

      console.log("[Playwright] Launching browser...");
      this.browser = await chromium.launch({
        headless: !this.debugMode, // Show browser when debug mode is enabled
        slowMo: this.debugMode ? 100 : 100, // Slower when debugging
        devtools: this.debugMode, // Open devtools in debug mode
        args: this.debugMode
          ? [
              "--start-maximized",
              "--disable-web-security",
              "--disable-features=VizDisplayCompositor",
            ]
          : [],
      });
      console.log("[Playwright] Browser launched");

      console.log("[Playwright] Creating context...");
      const context = await this.browser.newContext();
      console.log("[Playwright] Creating page...");
      this.page = await context.newPage();
      this.isInitialized = true;

      console.log("[Playwright] Initialization complete - service ready");
    } catch (error) {
      console.error("[Playwright] Failed to initialize:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Playwright initialization failed: ${errorMessage}`);
    }
  }

  async navigateTo(url: string): Promise<NavigationResult> {
    if (!this.page) {
      throw new Error("Playwright not initialized");
    }

    return this.withOperation(async () => {
      // Retry goto on ERR_ABORTED (common with SGK portal during concurrent navigations)
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await this.page!.goto(url, { waitUntil: "load" });
          break;
        } catch (err: any) {
          if (attempt < 2 && err?.message?.includes("ERR_ABORTED")) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          throw err;
        }
      }
      await this.page!.waitForLoadState("networkidle").catch(() => {
        // networkidle timeout is non-fatal — page is already loaded
      });
      const currentUrl = this.page!.url();

      // Check if redirected to login page
      const redirectedToLogin =
        currentUrl.includes("/login") && !url.includes("/login");
      // Note: Auto-login will be handled by the caller (renderer) since it has access to credentials
      if (redirectedToLogin) {
        // storedCredentials null iken performLogin'e girmek _doLogin içinde
        // "Cannot read properties of null" TypeError'ına dönüşüyordu; anlamlı
        // bir hata döndürmek teşhis için de UI için de daha iyi.
        if (!this.hasCredentials()) {
          return {
            success: false,
            currentUrl,
            redirectedToLogin: true,
            error: "Medula oturumu düştü ve kayıtlı kimlik bilgisi yok.",
          };
        }
        const result = await this.performLogin(this.storedCredentials!);
        if (result.success) {
          return this.navigateTo(url);
        } else {
          return {
            success: false,
            error: result.error,
          };
        }
      }

      return {
        success: true,
        currentUrl,
        redirectedToLogin,
      };
    });
  }

  async performLogin(credentials: LoginCredentials): Promise<LoginResult> {
    // Dedupe concurrent callers: when navigateTo() detects a redirect to /login
    // and triggers performLogin from multiple in-flight operations, share the
    // single in-flight login attempt instead of racing on the same page.
    if (this.loginPromise) {
      console.log("[Playwright] Login already in progress, awaiting existing call...");
      return this.loginPromise;
    }
    // Login drives the same page as everything else, so it goes through the
    // operation lock too. When an already-running operation triggers it
    // (navigateTo → /login redirect), withOperation detects the nesting and
    // runs it inline instead of queueing behind itself.
    this.loginPromise = this.withOperation(() => this._doLogin(credentials))
      .catch((err) => {
        // Yanlış kullanıcı/parola, yanlış IP ve "5 denemede giremedi" zaten
        // UI'da anlamlı şekilde gösteriliyor. Geri kalanı (selector timeout,
        // navigasyon hatası) sessizce kaybolmasın — login patlayınca sonraki
        // her işlem de patlıyor, teşhis için sayfa bağlamı şart.
        if (
          !(err instanceof InvalidLoginException) &&
          !(err instanceof WrongIpException) &&
          !(err instanceof UnsuccessfulLoginException)
        ) {
          this.captureIssue(err, { operation: "login", outcome: "failed" });
        }
        throw err;
      })
      .finally(() => {
        this.loginPromise = null;
      });
    return this.loginPromise;
  }

  /**
   * Login formunun ekranda olduğunu garanti eder.
   *
   * _doLogin() sayfanın zaten login formunda olduğunu varsayamaz: initialize()
   * sonrası sayfa `about:blank`, SGK ara sıra bomboş bir sayfa döndürüyor,
   * çağıran taraf (autoLogin / playwright:login IPC) hiç navigasyon yapmamış
   * olabiliyor ya da oturum hâlâ açık olabiliyor. Bu durumların hepsi eskiden
   * `waitForSelector('input[name*="text1"]')` üzerinde TimeoutError'a dönüyordu.
   *
   * @param forceReload Ekrandaki form kabul edilmesin, mutlaka yeniden
   *   yüklensin. Captcha / "hâlâ login sayfasındayız" retry'larında şart:
   *   eldeki form bayat captcha ve tükenmiş JSF view state taşıyor.
   * @returns "form" — login formu ekranda; "logged-in" — oturum zaten açık.
   */
  private async ensureLoginForm(
    forceReload = false,
  ): Promise<"form" | "logged-in"> {
    if (!this.page) {
      throw new PlaywrightException(PlaywrightErrorCode.NOT_INITIALIZED);
    }

    const hasForm = async () =>
      (await this.page!.$('input[name*="text1"]').catch(() => null)) !== null;

    if (!forceReload && (await hasForm())) return "form";

    let lastFailure = "";
    for (
      let attempt = 1;
      attempt <= PlaywrightAutomationService.LOGIN_FORM_ATTEMPTS;
      attempt++
    ) {
      try {
        await this.page.goto(URLS.MEDULA_HOME, {
          waitUntil: "load",
          timeout: 30000,
        });
      } catch (err) {
        lastFailure = `navigasyon hatası: ${
          err instanceof Error ? err.message : String(err)
        }`;
        console.warn(
          `[Playwright] Login form navigation attempt ${attempt} failed:`,
          err,
        );
        await this.page.waitForTimeout(2000);
        continue;
      }

      // Form JSF ile render ediliyor; "load" bazen erken tetikleniyor.
      const appeared = await this.page
        .waitForSelector('input[name*="text1"]', {
          timeout: PlaywrightAutomationService.LOGIN_FORM_TIMEOUT_MS,
        })
        .then(() => true)
        .catch(() => false);
      if (appeared) return "form";

      // Form yoksa iki ihtimal var: oturum zaten açık (giriş yapacak bir şey
      // yok), ya da SGK boş/arıza sayfası döndürdü — ikincisinde
      // navigateToSGKPortal ile aynı kurtarmayı uygulayıp tekrar deniyoruz.
      const url = this.page.url();
      const blank = await this.isPageBlank();
      if (!url.includes("login") && !blank) {
        console.log(
          "[Playwright] Session already active, login form not needed",
        );
        return "logged-in";
      }

      lastFailure = blank
        ? "SGK boş sayfa döndürdü"
        : `login sayfası formsuz geldi (${url})`;
      console.warn(
        `[Playwright] Login form not ready (attempt ${attempt}): ${lastFailure}`,
      );
      await this.resetBrowserState();
      await this.page.waitForTimeout(2000);
    }

    const error = new Error(
      "Medula giriş sayfası yüklenemedi. Lütfen tekrar deneyin.",
    );
    this.captureIssue(error, {
      operation: "login",
      outcome: "login-form-not-loaded",
      pageMessage: await this.readPageMessage(),
      detail: `${PlaywrightAutomationService.LOGIN_FORM_ATTEMPTS} denemede form gelmedi — son durum: ${lastFailure}`,
    });
    throw error;
  }

  /**
   * @param forceReload Retry'lardan gelirken true — bkz. ensureLoginForm().
   */
  private async _doLogin(
    credentials: LoginCredentials,
    forceReload = false,
  ): Promise<LoginResult> {
    if (!this.page) {
      throw new PlaywrightException(PlaywrightErrorCode.NOT_INITIALIZED);
    }

    // Store credentials for future use
    this.setCredentials(credentials);

    // Formun ekranda olduğunu varsaymak yerine garanti altına alıyoruz.
    if ((await this.ensureLoginForm(forceReload)) === "logged-in") {
      this.loginCounter = 0;
      this.startKeepAlive();
      return {
        success: true,
        currentUrl: this.page.url(),
        redirectedToLogin: false,
      };
    }

    await this.page.waitForSelector('input[name*="secret1"]', {
      timeout: PlaywrightAutomationService.LOGIN_FORM_TIMEOUT_MS,
    });

    // Fill username - specific SGK selector
    const usernameField = await this.page.$('input[name*="text1"]');
    if (!usernameField) {
      throw new Error("Could not find username field");
    }

    await usernameField.fill(credentials.username);

    // Fill password - specific SGK selector
    const passwordField = await this.page.$(
      'input[type="password"][name*="secret1"]',
    );
    if (!passwordField) {
      throw new Error("Could not find password field");
    }

    await passwordField.fill(credentials.password);

    // Handle captcha
    const captchaResult = await this.handleCaptcha();
    if (!captchaResult.success) {
      console.warn(`[Playwright] Captcha failed: ${captchaResult.error}, retrying login...`);
      this.loginCounter += 1;
      if (this.loginCounter >= 5) {
        this.loginCounter = 0;
        throw new UnsuccessfulLoginException();
      }
      // Navigasyonu _doLogin içindeki ensureLoginForm() yapıyor; buradaki
      // goto formun geleceğini varsaydığı için boş sayfa dönen denemelerde
      // 10sn'lik selector timeout'una dönüşüyordu.
      await this.page.context().clearCookies();
      return await this._doLogin(credentials, true);
    }

    // Fill captcha solution
    const captchaField = await this.page.$(
      'input[name*="j_id_jsp_2072829783_5"]',
    );
    if (!captchaField) {
      throw new Error("Could not find captcha field");
    }

    await captchaField.fill(captchaResult.solution!);

    // Check KVKK consent checkbox (skip if already checked)
    const consentCheckbox = await this.page.$('input[name*="kvkkTaahhut"]');
    if (consentCheckbox) {
      const alreadyChecked = await consentCheckbox.isChecked();
      if (!alreadyChecked) {
        await consentCheckbox.check();
      }
    }

    // Click login button
    const loginButton = await this.page.$(
      'input[type="submit"][value="Giriş Yap"]',
    );
    if (!loginButton) {
      throw new Error("Could not find login button");
    }

    await loginButton.click();
    await this.page.waitForLoadState("load");

    try {
      await this.checkPageError(this.page);
    } catch (error) {
      if (error instanceof WrongIpException) {
        throw error;
      }
      // Wrong username/password is fatal — stop retrying and surface it so the
      // UI can alert the user.
      if (error instanceof InvalidLoginException) {
        this.loginCounter = 0;
        throw new InvalidLoginException();
      }
      // Wrong captcha — fetch a fresh captcha and retry.
      if (error instanceof WrongCaptchaException) {
        console.warn("[Playwright] Wrong captcha code, retrying login...");
        this.loginCounter += 1;
        if (this.loginCounter >= 5) {
          this.loginCounter = 0;
          throw new UnsuccessfulLoginException();
        }
        // Navigasyonu ensureLoginForm() üstleniyor — bkz. yukarıdaki captcha
        // retry'ı.
        await this.page.context().clearCookies();
        return await this._doLogin(credentials, true);
      }
      // Any other warning (e.g. "Yeniden Giriş Yapınız." session-expiry) is NOT
      // a credential error — fall through to the re-login retry below.
    }
    await this.page.goto(URLS.MEDULA_HOME);
    await this.page.waitForLoadState('load');
    const currentUrl = this.page.url();
    const stillOnLogin = currentUrl.includes("login");
    if (stillOnLogin) {
      this.loginCounter += 1;
      console.warn(
        `Login attempt #${this.loginCounter} failed, still on login page`,
      );
      if (this.loginCounter >= 5) {
        this.loginCounter = 0;
        throw new UnsuccessfulLoginException();
      }
      await this.page.context().clearCookies();
      return await this._doLogin(credentials, true);
    }
    this.loginCounter = 0;
    this.startKeepAlive();

    return {
      success: !stillOnLogin,
      currentUrl,
      redirectedToLogin: stillOnLogin,
      error: stillOnLogin ? "Login failed - still on login page" : undefined,
    };
  }

  private async handleCaptcha(): Promise<{
    success: boolean;
    solution?: string;
    error?: string;
  }> {
    try {
      if (!this.page) {
        throw new Error("Page not initialized");
      }

      // Fetch captcha image directly via page context instead of screenshotting
      // the DOM element — element screenshots fail when the app is minimized to tray
      // because the renderer throttles and the node is not considered "visible".
      const base64Image = await this.page.evaluate(async () => {
        const img = document.querySelector(
          'img[src="/eczane/SayiUretenImageYeniServlet"]',
        ) as HTMLImageElement | null;
        if (!img) throw new Error("Could not find captcha image");

        // If the image hasn't loaded yet, wait for it
        if (!img.complete) {
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Captcha image failed to load"));
            setTimeout(() => reject(new Error("Captcha image load timeout")), 10000);
          });
        }

        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create canvas context");
        ctx.drawImage(img, 0, 0);
        return canvas.toDataURL("image/png").split(",")[1];
      });

      if (!base64Image) {
        throw new Error("Could not capture captcha image");
      }

      // Send captcha to renderer for debugging
      if (this.debugMode) {
        // We'll send this via IPC in the next step
        console.log("Debug mode: Captcha detected");
      }

      // Yalnızca yerel (bundled EasyOCR) çözücü — uzak API fallback'i yok.
      const outcome = await solveCaptcha(base64Image);

      if (!outcome.success || !outcome.code) {
        throw new Error(outcome.error || "No captcha solution received");
      }

      return {
        success: true,
        solution: outcome.code,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Captcha handling failed",
      };
    }
  }

  async navigateToSGKPortal(): Promise<NavigationResult> {
    return this.withOperation(async () => {
      const sgkUrl = URLS.MEDULA_HOME;
      const result = await this.navigateTo(sgkUrl);

      if (result.success && this.page && (await this.isPageBlank())) {
        console.warn(
          "[Playwright] SGK portal returned a blank page — clearing storage and retrying",
        );
        await this.resetBrowserState();
        return this.navigateTo(sgkUrl);
      }

      return result;
    });
  }

  private async isPageBlank(): Promise<boolean> {
    if (!this.page) return true;
    try {
      return await this.page.evaluate(() => {
        const body = document.body;
        if (!body) return true;
        const text = (body.innerText ?? "").trim();
        return text.length === 0 && body.children.length === 0;
      });
    } catch {
      // If evaluation itself fails (e.g. page in weird state), treat as blank
      return true;
    }
  }

  private async resetBrowserState(): Promise<void> {
    if (!this.page) return;
    try {
      await this.page.context().clearCookies();
    } catch (err) {
      console.warn("[Playwright] clearCookies failed during recovery:", err);
    }
    try {
      await this.page.evaluate(() => {
        try {
          localStorage.clear();
        } catch {}
        try {
          sessionStorage.clear();
        } catch {}
      });
    } catch (err) {
      console.warn("[Playwright] storage clear failed during recovery:", err);
    }
  }

  /**
   * Portal sayfasının hangi hâlde olduğunu belirler: sol menü geldi mi, oturum
   * düşüp login formuna mı döndük, portal bir uyarı mı bastı. waitForSearchOutcome()
   * ile aynı mantık — tek `evaluate` ile hepsini yoklayıp hangisi önce gelirse
   * ona göre dallanıyoruz.
   */
  private async waitForPortalOutcome(
    timeoutMs: number,
  ): Promise<
    | { type: "menu" }
    | { type: "login" }
    | { type: "message"; text: string }
    | { type: "blank" }
    | { type: "timeout" }
  > {
    const deadline = Date.now() + timeoutMs;
    let lastBlank = false;

    while (Date.now() < deadline) {
      const state = await this.page!.evaluate(() => {
        const clean = (el: Element | null) =>
          (el?.textContent ?? "").replace(/\s+/g, " ").trim();
        // getElementById iki nokta üst üsteyi CSS kaçışı olmadan kabul eder.
        const menu = document.getElementById("form1:menu");
        if (menu && menu.getClientRects().length > 0) {
          return { kind: "menu" as const, text: "" };
        }
        if (document.querySelector('input[type="password"]')) {
          return { kind: "login" as const, text: "" };
        }
        const message =
          clean(document.querySelector("td.message span.outputText")) ||
          clean(document.querySelector("table#box1"));
        if (message) return { kind: "message" as const, text: message };
        const body = document.body;
        const empty =
          !body ||
          ((body.innerText ?? "").trim().length === 0 &&
            body.children.length === 0);
        return { kind: "pending" as const, text: "", empty };
        // Navigasyon sırasında context yok olabilir → yut, tekrar bak.
      }).catch(() => null);

      if (state?.kind === "menu") return { type: "menu" };
      if (state?.kind === "login") return { type: "login" };
      if (state?.kind === "message") {
        return { type: "message", text: state.text };
      }
      // Boş gövde navigasyon ortasında da görülebiliyor; erken karar vermek
      // yerine son duruma bakıp süre dolduğunda raporluyoruz.
      lastBlank = state?.empty ?? false;

      await this.page!.waitForTimeout(250);
    }

    return lastBlank ? { type: "blank" } : { type: "timeout" };
  }

  /**
   * Portalın sol menüsünün (`#form1:menu`) ekranda olduğunu garanti eder.
   *
   * navigateToSGKPortal() yalnızca "goto patlamadı" garantisi veriyor: oturum
   * düşmüşse, SGK boş sayfa döndürmüşse ya da portal bir uyarı sayfası bastıysa
   * da `success: true` dönüyor. Çağıranlar hemen ardından menüyü beklediği için
   * bunların hepsi 30 saniyelik `#form1:menu` timeout'una dönüşüyor, asıl sebep
   * (oturum düştü / portal mesajı) kayboluyordu.
   */
  private async ensurePortalMenu(operation: string): Promise<void> {
    if (!this.page) {
      throw new PlaywrightException(PlaywrightErrorCode.NOT_INITIALIZED);
    }

    let lastFailure = "";
    let lastMessage = "";

    for (
      let attempt = 1;
      attempt <= PlaywrightAutomationService.PORTAL_MENU_ATTEMPTS;
      attempt++
    ) {
      const outcome = await this.waitForPortalOutcome(
        PlaywrightAutomationService.PORTAL_MENU_TIMEOUT_MS,
      );

      if (outcome.type === "menu") return;

      // Oturum düştü: login formu ya da "Yeniden Giriş Yapınız." ara sayfası.
      const sessionExpired =
        outcome.type === "login" ||
        (outcome.type === "message" &&
          /yeniden giriş|oturum/i.test(outcome.text));

      if (sessionExpired) {
        if (!this.hasCredentials()) {
          lastFailure = "oturum düştü, kayıtlı kimlik bilgisi yok";
          break;
        }
        console.warn(
          `[Playwright] ${operation}: session lost before menu, re-logging in...`,
        );
        const login = await this.performLogin(this.storedCredentials!);
        if (!login.success) {
          lastFailure = `yeniden giriş başarısız: ${login.error ?? "bilinmiyor"}`;
          break;
        }
        await this.navigateTo(URLS.MEDULA_HOME);
        continue;
      }

      if (outcome.type === "message") {
        // Portalın kendi uyarısı — 30sn selector timeout'u yerine metni ver.
        lastMessage = outcome.text;
        lastFailure = `portal mesajı: ${outcome.text}`;
        break;
      }

      // Boş sayfa / menü hiç gelmedi: navigateToSGKPortal ile aynı kurtarma.
      lastFailure =
        outcome.type === "blank"
          ? "SGK boş sayfa döndürdü"
          : "menü verilen sürede render olmadı";
      console.warn(
        `[Playwright] ${operation}: portal menu not ready (attempt ${attempt}): ${lastFailure}`,
      );
      // State temizliği oturumu da düşürüyor; ancak yeniden giriş yapabilecek
      // durumdaysak anlamlı.
      if (this.hasCredentials()) {
        await this.resetBrowserState();
      }
      await this.navigateTo(URLS.MEDULA_HOME);
    }

    const error = new Error(
      lastMessage
        ? `Medula: ${lastMessage}`
        : "Medula portalı açılamadı. Lütfen tekrar deneyin.",
    );
    this.captureIssue(error, {
      operation,
      outcome: "portal-menu-not-loaded",
      pageMessage: lastMessage || (await this.readPageMessage()),
      detail: `${PlaywrightAutomationService.PORTAL_MENU_ATTEMPTS} denemede sol menü gelmedi — son durum: ${lastFailure}`,
    });
    throw error;
  }

  /**
   * Navigate to the prescription search page, fill the recipe number, and click search.
   * Does NOT parse the result — just visually navigates the browser.
   */
  async navigateToPrescription(prescriptionNumber: string): Promise<NavigationResult> {
    return this.withOperation(async () => {
      try {
        if (!this.page) {
          throw new Error("System is not ready.");
        }
        await this.navigateToSGKPortal();
        await this.ensurePortalMenu("navigateToPrescription");
        const menu = this.page
          .locator(`${ELEMENT_SELECTORS.SOL_MENU_SELECTOR} tr`)
          .nth(5);
        await menu.click();
        await this.page.waitForSelector('input[name="form1:text2"]', {
          timeout: 3000,
        });

        const prescriptionField = await this.page.$('input[name="form1:text2"]');
        if (!prescriptionField) {
          throw new Error("Could not find prescription number field");
        }
        await prescriptionField.fill(prescriptionNumber);

        const searchButton = await this.page.$(
          'input[type="submit"][value="Sorgula"]#form1\\:buttonReceteNoSorgula',
        );
        if (!searchButton) {
          throw new Error("Could not find search button");
        }

        await searchButton.click();
        await this.page.waitForLoadState("load");

        return {
          success: true,
          currentUrl: this.page.url(),
        };
      } catch (error: any) {
        this.captureIssue(error, {
          operation: "navigateToPrescription",
          receteNo: prescriptionNumber,
        });
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Navigation failed",
        };
      }
    });
  }

  /**
   * Reçeteyi Medula'da sorgular ve detaylarını toplar. Alanlardan biri
   * okunamazsa (alan ve alt sayfa retry'ları da yetmediyse) reçete BAŞTAN
   * sorgulanır; ikinci turda da eksik kalırsa `success: false` döner —
   * eksik veriyle "başarılı" sonuç dönmez, çünkü o sonuç doğrudan analize
   * gidiyor.
   */
  async searchPrescription(
    prescriptionNumber: string,
    retryOnSessionLoss = true,
    attempt = 1,
  ): Promise<
    NavigationResult & { prescriptionData?: Recete; eksikVeriler?: DataGap[] }
  > {
    return this.withOperation(async () => {
      try {
        if (!this.page) {
          throw new Error("System is not ready.");
        }
        await this.navigateToSGKPortal();
        await this.ensurePortalMenu("searchPrescription");
        const menu = this.page
          .locator(`${ELEMENT_SELECTORS.SOL_MENU_SELECTOR} tr`)
          .nth(5);
        await menu.click();
        await this.page.waitForSelector('input[name="form1:text2"]', {
          timeout: 3000,
        });

        const prescriptionField = await this.page.$('input[name="form1:text2"]');
        if (!prescriptionField) {
          throw new Error("Could not find prescription number field");
        }
        await prescriptionField.fill(prescriptionNumber);

        // Click the search button
        const searchButton = await this.page.$(
          'input[type="submit"][value="Sorgula"]#form1\\:buttonReceteNoSorgula',
        );
        if (!searchButton) {
          throw new Error("Could not find search button");
        }

        // Any message already on the search form (rare, but a stale one would
        // otherwise be read as this search's outcome).
        const previousMessage = await this.readPageMessage();

        await searchButton.click();

        // Don't blind-wait for the detail page: watch for the detail page, a
        // portal message ("... reçete bulunamadı") and the login form at the
        // same time, so a lost session or a warning doesn't turn into a silent
        // 30s "waiting for #f:t13" timeout.
        const outcome = await this.waitForSearchOutcome(previousMessage);

        if (outcome.type === "login") {
          if (!retryOnSessionLoss || !this.hasCredentials()) {
            this.captureIssue(
              new Error("Prescription search landed on the login page"),
              {
                operation: "searchPrescription",
                outcome: "session-lost",
                receteNo: prescriptionNumber,
              },
            );
            return {
              success: false,
              currentUrl: this.page.url(),
              error: "Medula oturumu düştü. Lütfen tekrar deneyin.",
            };
          }
          console.warn(
            "[Playwright] Session lost during prescription search, re-logging in...",
          );
          const login = await this.performLogin(this.storedCredentials!);
          if (!login.success) {
            this.captureIssue(
              new Error(
                `Re-login after session loss failed: ${login.error ?? "unknown"}`,
              ),
              {
                operation: "searchPrescription",
                outcome: "relogin-failed",
                receteNo: prescriptionNumber,
              },
            );
            return {
              success: false,
              currentUrl: this.page.url(),
              error: login.error ?? "Medula oturumu yenilenemedi.",
            };
          }
          return this.searchPrescription(prescriptionNumber, false, attempt);
        }

        if (outcome.type === "message") {
          return {
            success: false,
            currentUrl: this.page.url(),
            error: outcome.text,
          };
        }

        if (outcome.type === "timeout") {
          this.captureIssue(
            new Error("Prescription detail page did not open after Sorgula"),
            {
              operation: "searchPrescription",
              outcome: "timeout",
              receteNo: prescriptionNumber,
              pageMessage: await this.readPageMessage(),
            },
          );
          return {
            success: false,
            currentUrl: this.page.url(),
            error: `Reçete detay sayfası açılmadı (${this.page.url()}). Medula yanıt vermiyor olabilir, lütfen tekrar deneyin.`,
          };
        }

        // Reçetenin bütün alanları tek bir toplama turunda okunuyor;
        // okunamayan her alan collector'a düşüyor (bkz. withGapCollection).
        const { value: recete, gaps } = await this.withGapCollection(
          prescriptionNumber,
          async () => {
            const parsed =
              await this.parseReceteFromCurrentPage(prescriptionNumber);
            await this.ilaclaraRaporEkle(parsed);
            // e-Reçete sayfası ve uyarı kodları dialogu en sona bırakıldı:
            // ikisi de detay sayfasından ayrılıp geri döndüğü için burada bir
            // aksilik çıksa bile reçetenin geri kalanı (rapor, ilaç bilgisi)
            // çoktan toplanmış olur.
            parsed.eRecete = await this.getEReceteBilgiFromDetailPage();
            parsed.receteUyariKodlari = await this.getReceteUyariKodlari();
            return parsed;
          },
        );

        if (gaps.length > 0) {
          // Alan ve alt sayfa retry'ları yetmedi: sayfa/oturum durumu bozulmuş
          // olabilir, tek çıkış yolu reçeteyi baştan sorgulamak.
          if (attempt < PlaywrightAutomationService.RECETE_ATTEMPTS) {
            console.warn(
              `[Playwright] ${gaps.length} alan okunamadı, reçete baştan sorgulanıyor (${prescriptionNumber})`,
            );
            return this.searchPrescription(
              prescriptionNumber,
              retryOnSessionLoss,
              attempt + 1,
            );
          }

          this.captureIssue(
            new Error("Reçete eksik veriyle toplandı"),
            {
              operation: "searchPrescription",
              outcome: "eksik-veri",
              receteNo: prescriptionNumber,
              detail: gaps.map((g) => `${g.alan}:${g.sebep}`).join(", "),
            },
          );
          recete.eksikVeriler = gaps;
          return {
            success: false,
            currentUrl: this.page.url(),
            prescriptionData: recete,
            eksikVeriler: gaps,
            error: `Reçetenin bazı bilgileri Medula'dan okunamadı (${this.gapOzeti(gaps)}). Eksik veriyle kontrol yapılmaması için işlem durduruldu; lütfen tekrar deneyin.`,
          };
        }

        return {
          success: true,
          currentUrl: this.page.url(),
          prescriptionData: recete,
        };
      } catch (error: any) {
        const msg = error?.message || "";
        if (msg.includes("Cannot find context") || msg.includes("Target page, context or browser has been closed")) {
          console.warn("[Playwright] Context/page lost during prescription search, retrying...");
          try {
            return await this.searchPrescription(
              prescriptionNumber,
              retryOnSessionLoss,
              attempt + 1,
            );
          } catch {
            // fall through to error return below
          }
        }
        this.captureIssue(error, {
          operation: "searchPrescription",
          receteNo: prescriptionNumber,
        });
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Prescription search failed",
        };
      }
    });
  }

  /**
   * "Uyarı Kodu (Yeni)" dialogunu açıp reçeteye eklenmiş uyarı kodlarını
   * okur, sonra Vazgeç ile kapatır. İki POST'luk bir tur olduğu için akışın
   * en sonunda çalıştırılır: burada bir aksilik olursa reçetenin geri kalanı
   * (rapor, ilaç bilgisi) çoktan toplanmış olur.
   *
   * `[]` → dialog açıldı, kod yok. `undefined` → dialog açılamadı/okunamadı.
   */
  async getReceteUyariKodlari(): Promise<ReceteUyariKodu[] | undefined> {
    if (!this.page) {
      throw new Error("Page is not available");
    }

    // Butonun yokluğuna ancak detay sayfasında olduğumuz doğrulandıktan sonra
    // güvenilebilir.
    if (
      !(await this.ensureAnchor(
        PlaywrightAutomationService.ANCHORS.receteDetay,
        "receteUyariKodlari.detaySayfasi",
      ))
    ) {
      return undefined;
    }

    const button = this.page.locator("input#f\\:buttonReceteTeshis");
    // Buton gerçekten yok: bu reçetede uyarı kodu sorgulanamıyor.
    if ((await button.count()) === 0) return undefined;

    try {
      return await this.withSubPageRetry("receteUyariKodlari", () =>
        this.readUyariKodlari(),
      );
    } catch (error) {
      this.captureIssue(error, {
        operation: "receteUyariKodlari",
        outcome: "dialog-failed",
      });
      this.recordGap({
        alan: "receteUyariKodlari",
        sebep: this.gapReason(error),
        detay:
          error instanceof Error ? error.message.split("\n")[0] : undefined,
      });
      return undefined;
    }
  }

  /**
   * Uyarı kodu dialogunu açıp okur ve Vazgeç ile kapatır. Okunamazsa hatayı
   * yukarı verir; `[]` = dialog açıldı, kod yok.
   */
  private async readUyariKodlari(): Promise<ReceteUyariKodu[]> {
    if (!this.page) {
      throw new Error("Page is not available");
    }

    const button = this.page.locator("input#f\\:buttonReceteTeshis");
    let kodlar: ReceteUyariKodu[] | undefined;
    try {
      await button.first().click();
      // Dialog sayfada gizli durmuyor, POST sonrası sunucudan geliyor.
      await this.page.waitForSelector("#f\\:dialogUyari", {
        state: "visible",
        timeout: 15000,
      });

      kodlar = await this.page.evaluate(() => {
        const clean = (s: string | null | undefined) =>
          (s ?? "").replace(/\s+/g, " ").trim();

        const table = document.getElementById("f:tableExUyariSecim");
        // Kod yoksa Medula tabloyu hiç basmıyor, yerine kırmızı bir mesaj
        // gösteriyor ("İlaçlarla uyumlu uyarı kodu bulunamamıştır.").
        if (!table) return [];

        return Array.from(table.querySelectorAll(":scope > tbody > tr"))
          .map((row) => {
            const ilacAdi = clean(row.querySelector("td")?.textContent);
            // Satırda iki select var: menu100Uyari = eklenebilecek kodlar,
            // menu101Uyari = eklenmiş olan. Bizi ikincisinin ekranda görünen
            // (seçili) değeri ilgilendiriyor.
            const selected = row.querySelector(
              'select[id$=":menu101Uyari"]',
            ) as HTMLSelectElement | null;
            const option =
              selected?.selectedOptions?.[0] ??
              (selected ? selected.options[selected.selectedIndex] : null);
            return { ilacAdi, secilenUyariKodu: clean(option?.textContent) };
          })
          .filter((r) => r.ilacAdi || r.secilenUyariKodu);
      });
    } finally {
      await this.closeUyariDialog();
    }

    if (!kodlar) {
      throw new Error("Uyarı kodu dialogu okunamadı");
    }
    return kodlar;
  }

  /**
   * Uyarı kodu dialogunu kapatır. DİKKAT: "Kaydet" butonunun id'si
   * `f:buttonReceteTeshisPanelKapatUyari` — içinde "Kapat" geçiyor. Yanlışlıkla
   * ona basmak canlı reçeteyi değiştirir, bu yüzden yalnızca Vazgeç'in tam
   * id'si kullanılıyor; etiket/kısmi eşleşme ile seçici yazılmamalı.
   */
  private async closeUyariDialog(): Promise<void> {
    if (!this.page) return;
    try {
      const cancel = this.page.locator(
        "input#f\\:buttonReceteTeshisPanelVazgecUyari",
      );
      if ((await cancel.count()) === 0) return;
      await cancel.first().click();
      // Detay sayfasına döndüğümüzü doğrula.
      await this.page.waitForSelector("#f\\:t13", {
        state: "attached",
        timeout: 15000,
      });
    } catch (error) {
      this.captureIssue(error, {
        operation: "receteUyariKodlari",
        outcome: "cancel-failed",
      });
    }
  }

  /**
   * Reçete detay sayfasındaki "Sertifika" seçimi (`select#f:m7`). Seçili
   * option'ın hem değeri hem etiketi alınır ("109" / "Aile Hekimliği");
   * sertifika yoksa Medula "Yok" (kod "0") gösterir ve o da olduğu gibi
   * gönderilir — bilgi eksiltmek yerine backend karar versin.
   */
  async getSertifikaFromDetailPage(): Promise<ReceteSertifika | undefined> {
    if (!this.page) {
      throw new Error("Page is not available");
    }
    const page = this.page;

    // evaluate patlarsa (sayfa değişti / context düştü) alan eksik kaydedilir;
    // `null` dönmesi ise sertifika alanı olmayan reçete demektir — o sessizce
    // undefined'a düşebilir, çünkü sayfada gerçekten yok.
    const sertifika = await this.readField(
      "recete.sertifika",
      () =>
        page.evaluate(() => {
          const select = document.getElementById(
            "f:m7",
          ) as HTMLSelectElement | null;
          if (!select) return null;
          const option =
            select.selectedOptions?.[0] ?? select.options[select.selectedIndex];
          return {
            kod: select.value ?? "",
            ad: (option?.textContent ?? "").replace(/\s+/g, " ").trim(),
          };
        }),
      { fallback: null as ReceteSertifika | null },
    );

    if (!sertifika || (!sertifika.kod && !sertifika.ad)) return undefined;
    return sertifika;
  }

  /** Portalın uyarı/hata kutularındaki metin (yoksa boş string). */
  private async readPageMessage(): Promise<string> {
    if (!this.page) return "";
    return this.page
      .evaluate(() => {
        const clean = (el: Element | null) =>
          (el?.textContent ?? "").replace(/\s+/g, " ").trim();
        return (
          clean(document.querySelector("td.message span.outputText")) ||
          clean(document.querySelector("table#box1"))
        );
      })
      .catch(() => "");
  }

  /**
   * "Sorgula" tıklandıktan sonra sayfanın hangi hâle geldiğini belirler:
   * reçete detayı mı açıldı, portal bir uyarı mı bastı, yoksa oturum düşüp
   * login formuna mı döndük. Tek bir `evaluate` ile üçünü birden yokladığı
   * için hangisi önce gelirse ona göre dallanabiliyoruz.
   */
  private async waitForSearchOutcome(
    previousMessage = "",
    timeoutMs = PlaywrightAutomationService.SEARCH_OUTCOME_TIMEOUT_MS,
  ): Promise<SearchOutcome> {
    const deadline = Date.now() + timeoutMs;
    let lastMessage = "";

    while (Date.now() < deadline) {
      const state = await this.page!.evaluate(() => {
        const clean = (el: Element | null) =>
          (el?.textContent ?? "").replace(/\s+/g, " ").trim();
        // `f:t13` (Reçete No) yalnızca reçete detay sayfasında var.
        if (document.getElementById("f:t13")) {
          return { kind: "detail" as const, text: "" };
        }
        // Detay sayfasında parola alanı yok; varsa login formundayız.
        if (document.querySelector('input[type="password"]')) {
          return { kind: "login" as const, text: "" };
        }
        const message =
          clean(document.querySelector("td.message span.outputText")) ||
          clean(document.querySelector("table#box1"));
        return message
          ? { kind: "message" as const, text: message }
          : { kind: "pending" as const, text: "" };
        // Navigasyon sırasında context yok olabilir → catch ile yut, tekrar bak.
      }).catch(() => null);

      if (state?.kind === "detail") return { type: "detail" };
      if (state?.kind === "login") return { type: "login" };
      if (state?.kind === "message") {
        lastMessage = state.text;
        if (state.text !== previousMessage) {
          return { type: "message", text: state.text };
        }
      }

      await this.page!.waitForTimeout(250);
    }

    // Süre dolduysa ama ekranda (tıklamadan önce de duran) bir mesaj varsa,
    // "sayfa açılmadı" demek yerine mesajı bildirmek daha faydalı.
    return lastMessage
      ? { type: "message", text: lastMessage }
      : { type: "timeout" };
  }

  async ilaclaraRaporEkle(recete: Recete): Promise<void> {
    if (!this.page) {
      throw new Error("Page is not available");
    }
    const collector = this.gapContext.getStore();
    for (let i = 0; i < (recete.ilaclar?.length || 0); i++) {
      const ilac = recete.ilaclar![i];
      if (!ilac.raporluMu) continue;

      // Use the real Medula JSF row index captured during scraping, not the
      // array position — they diverge when rows are skipped (empty name) or
      // Medula renders non-contiguous row indices, which would otherwise
      // scrape the wrong medicine's report/info. Fall back to the array
      // index for safety if rowIndex is somehow missing.
      const rowIndex = ilac.rowIndex ?? i;
      if (collector) collector.aktifBarkod = ilac.barkod;

      // Rapor ve ilaç bilgisi ayrı sayfalara gidip geri dönüyor. Tur yarıda
      // kalırsa detay sayfasına dönülüp bir kez daha denenir; yine olmazsa
      // ilaç eksik kaydedilip KALAN ilaçlara devam edilir, böylece kullanıcı
      // eksiklerin tamamını tek seferde görür.
      try {
        ilac.rapor = await this.withSubPageRetry("raporGoruntule", () =>
          this.getReportForMedicine(rowIndex),
        );
      } catch (error) {
        this.captureIssue(error, {
          operation: "raporGoruntule",
          receteNo: recete.receteNo,
        });
        this.recordGap({
          alan: "ilac.rapor",
          sebep: this.gapReason(error),
          detay:
            error instanceof Error ? error.message.split("\n")[0] : undefined,
          barkod: ilac.barkod,
        });
      }

      try {
        ilac.detay = await this.withSubPageRetry("ilacBilgi", () =>
          this.getIlacBilgiForMedicine(rowIndex),
        );
      } catch (error) {
        this.captureIssue(error, {
          operation: "ilacBilgi",
          receteNo: recete.receteNo,
        });
        this.recordGap({
          alan: "ilac.detay",
          sebep: this.gapReason(error),
          detay:
            error instanceof Error ? error.message.split("\n")[0] : undefined,
          barkod: ilac.barkod,
        });
      }
    }
    if (collector) collector.aktifBarkod = undefined;
  }

  async parseReceteFromCurrentPage(
    prescriptionNumber: string,
  ): Promise<Recete> {
    if (!this.page) {
      throw new Error("Page is not available");
    }

    // Temel reçete bilgilerini çıkar
    const receteNoElement = this.page.locator("#f\\:t13");
    const hastaAdElement = this.page.locator("#f\\:t15");
    const hastaSoyadElement = this.page.locator("#f\\:t16");
    const tesisKoduElement = this.page.locator("#f\\:t33");
    const receteTarihiElement = this.page.locator("#f\\:t29");
    // "İlaç Alım Tarihi" — geriye dönük uyumluluk için sonIslemTarihi alanına
    // da yazılmaya devam ediyor (tablo/45 gün kontrolü onu kullanıyor).
    const ilacAlimTarihiElement = this.page.locator("#f\\:t31");
    const doktorBransElement = this.page.locator("#f\\:t45");

    // Alanlar tek tek readField ile okunuyor: biri okunamazsa reçete "eksik"
    // işaretlenir; eskiden sessizce boş string kalıyor ve reçete eksik veriyle
    // analize gidiyordu.
    const receteNo =
      (await this.readText("recete.receteNo", receteNoElement)) ||
      prescriptionNumber;
    // Hasta adı/soyadı bilinçli olarak "opsiyonel" okunuyor: kontrolün klinik
    // sonucunu etkilemiyor, thunk gerekirse listeden (ReceteOzet) tamamlıyor
    // ve eski kodun burada catch kullanması bu alanların bazı sayfalarda
    // gelmeyebildiğine işaret ediyor — reçeteyi bu yüzden bloke etmiyoruz.
    const ad = await this.readOptionalText(hastaAdElement);
    const soyad = await this.readOptionalText(hastaSoyadElement);
    const tesisKodu = await this.readInput("recete.tesisKodu", tesisKoduElement);
    const receteTarihi = await this.readInput(
      "recete.receteTarihi",
      receteTarihiElement,
    );
    const ilacAlimTarihi = await this.readInput(
      "recete.ilacAlimTarihi",
      ilacAlimTarihiElement,
    );
    const doktorBrans = await this.readText(
      "recete.doktorBrans",
      doktorBransElement,
    );

    // İlaç listesini getIlacOzetFromDetailPage kullanarak çıkar
    const ilaclar = (await this.getIlacOzetFromDetailPage()) as ReceteIlac[];

    const tanilar = await this.getReceteTanilariFromDetailPage();
    const sertifika = await this.getSertifikaFromDetailPage();

    const recete: Recete = {
      receteNo: receteNo.trim(),
      receteTarihi,
      sonIslemTarihi: ilacAlimTarihi,
      ilacAlimTarihi,
      tesisKodu,
      doktorBrans: doktorBrans.trim(),
      ilaclar,
      tanilar,
      sertifika,
      ad: ad.trim(),
      soyad: soyad.trim(),
      veriSurumu: RECETE_VERI_SURUMU,
    };

    return recete;
  }

  /**
   * Reçete detay sayfasındaki ICD-10 tanı tablosu (`#f:tableEx1`). Rapor
   * tanılarından (`#form1:tableExRaporTeshisList`) ayrıdır — bunlar reçetenin
   * kendi tanıları. Değerler `<span>` değil `<input value="...">` içinde
   * durduğu için textContent değil inputValue okunur.
   */
  async getReceteTanilariFromDetailPage(): Promise<ReceteTani[]> {
    if (!this.page) {
      throw new Error("Page is not available");
    }

    const rows = await this.page
      .locator("#f\\:tableEx1 tr.rowClass1, #f\\:tableEx1 tr.rowClass2")
      .all();

    const tanilar: ReceteTani[] = [];
    for (let i = 0; i < rows.length; i++) {
      const cells = await rows[i].locator(":scope > td").all();
      const kodInput = cells?.[0]?.locator("input").first();
      const taniInput = cells?.[1]?.locator("input").first();
      // Okuma hatası artık boş string'e düşüp tanıyı yok saymıyor; readInput
      // alanı eksik kaydediyor.
      // Input elemanı olmayan satır (başlık/ayraç) eksik veri değildir; ancak
      // eleman varken okunamazsa readInput bunu eksik olarak kaydeder.
      const icd10Kod =
        kodInput && (await kodInput.count())
          ? await this.readInput(`tanilar[${i}].icd10Kod`, kodInput)
          : "";
      const taniAdi =
        taniInput && (await taniInput.count())
          ? await this.readInput(`tanilar[${i}].tani`, taniInput)
          : "";

      // Medula yeni tanı girişi için boş satırlar da render ediyor; atla.
      if (!icd10Kod.trim() && !taniAdi.trim()) continue;

      tanilar.push({
        icd10Kod: this.normalizeText(icd10Kod),
        tani: this.normalizeText(taniAdi),
      });
    }

    return tanilar;
  }

  /**
   * Bazı reçetelerin detay sayfasında "E-Reçete Görüntüle"
   * (`input#f:buttonEreceteGoruntule`) butonu bulunur; buton ayrı bir sayfaya
   * (EreceteGorme.jsp) götürür. Orada reçetenin "E-Reçete Bilgileri" başlık
   * bloğu, "İlaç Bilgileri" listesi ve "Onay / Açıklama / Tanı Listesi"
   * tabloları durur; hepsi okunduktan sonra sayfanın kendi "Geri Dön"
   * butonuyla detay sayfasına dönülür.
   *
   * `undefined` → buton yok ya da sayfa açılamadı. Listelerin boş dizi olması
   * → sayfa açıldı ama o tabloda satır yok (Onay Listesi çoğunlukla boştur).
   */
  async getEReceteBilgiFromDetailPage(): Promise<EReceteBilgi | undefined> {
    if (!this.page) {
      throw new Error("Page is not available");
    }

    // "Buton yok" sonucuna ancak detay sayfasında olduğumuz kanıtlandıktan
    // sonra varılabilir; yüklenmemiş sayfa aksi halde "bu reçetenin
    // e-Reçetesi yok" gibi görünüyordu.
    if (
      !(await this.ensureAnchor(
        PlaywrightAutomationService.ANCHORS.receteDetay,
        "eRecete.detaySayfasi",
      ))
    ) {
      return undefined;
    }

    const button = this.page.locator("input#f\\:buttonEreceteGoruntule");
    // Buton gerçekten yok: bu reçetenin e-Reçetesi yok — eksik veri değil.
    if ((await button.count()) === 0) return undefined;

    try {
      // Tur yarıda kalırsa detay sayfasına dönülüp bir kez daha denenir.
      return await this.withSubPageRetry("ereceteGoruntule", () =>
        this.readEReceteBilgi(),
      );
    } catch (error) {
      this.captureIssue(error, {
        operation: "ereceteGoruntule",
        outcome: "page-failed",
      });
      this.recordGap({
        alan: "eRecete",
        sebep: this.gapReason(error),
        detay:
          error instanceof Error ? error.message.split("\n")[0] : undefined,
      });
      return undefined;
    }
  }

  /**
   * e-Reçete sayfasını açar, okur ve detay sayfasına döner. Okunamazsa hatayı
   * yukarı verir — sessizce undefined dönmediği için çağıran retry edebiliyor.
   */
  private async readEReceteBilgi(): Promise<EReceteBilgi> {
    if (!this.page) {
      throw new Error("Page is not available");
    }

    const button = this.page.locator("input#f\\:buttonEreceteGoruntule");
    let bilgi: EReceteBilgi | undefined;
    try {
      await button.first().click();
      // e-Reçete sayfası POST sonrası sunucudan geliyor. Detay sayfasındaki
      // buton `f:` , e-Reçete sayfasındakiler `form1:` prefix'li olduğu için
      // `form1:buttonGeriDon` yeni sayfaya geçtiğimizin güvenli işareti.
      await this.page.waitForSelector("input#form1\\:buttonGeriDon", {
        state: "visible",
        timeout: 15000,
      });

      bilgi = await this.page.evaluate(() => {
        const clean = (s: string | null | undefined) =>
          (s ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();

        // Etiketler Türkçe; eşleştirme sadeleştirilmiş hâl üzerinden yapılıyor.
        const fold = (s: string | null | undefined) => {
          const harfler: Record<string, string> = {
            "ç": "c",
            "ğ": "g",
            "ı": "i",
            "î": "i",
            "ö": "o",
            "ş": "s",
            "ü": "u",
            "â": "a",
            "û": "u",
          };
          return clean(s)
            .toLocaleLowerCase("tr")
            .replace(/[çğıîöşüâû]/g, (c) => harfler[c] ?? c);
        };

        /**
         * Hücre metni. İçinde `panelBox` gibi bir iç tablo varsa hücreleri
         * boşlukla ayırır; düz textContent "ASLI GİZEM" ile "DURKAYA"yı
         * bitişik döndürüyor.
         */
        const cellText = (el: Element | null | undefined): string => {
          if (!el) return "";
          const inner = el.querySelector("table");
          if (!inner) return clean(el.textContent);
          return clean(
            Array.from(inner.querySelectorAll("td"))
              .map((td) => clean(td.textContent))
              .filter(Boolean)
              .join(" "),
          );
        };

        /** `headerRow` başlığına göre blok tablosunu bulur. */
        const tableByHeader = (header: string) =>
          Array.from(document.querySelectorAll("table.borderTable")).find(
            (t) =>
              fold(
                t.querySelector(":scope > tbody > tr.headerRow > td")
                  ?.textContent,
              ) === header,
          ) ?? null;

        /**
         * Alt listeler (`table.dataTableEx`) caption metnine göre bulunur:
         * id'ler (form1:tableEx1/2/3) hangi listenin hangisi olduğunu garanti
         * etmiyor.
         */
        const rowsOf = (caption: string): string[][] => {
          const table = Array.from(
            document.querySelectorAll("table.dataTableEx"),
          ).find((t) =>
            fold(t.querySelector("caption")?.textContent).includes(caption),
          );
          if (!table) return [];
          return Array.from(table.querySelectorAll(":scope > tbody > tr"))
            .map((row) =>
              Array.from(row.querySelectorAll(":scope > td")).map((cell) =>
                clean(cell.textContent),
              ),
            )
            .filter((cells) => cells.some((cell) => cell));
        };

        // ---- "E-Reçete Bilgileri" başlık bloğu ----
        // `diger` dışarıda: o alan serbest metin haritası, etiket eşlemesi
        // yalnızca string alanlara yazıyor.
        const BASLIK_ETIKETLERI: Record<
          string,
          Exclude<keyof EReceteBaslik, "diger">
        > = {
          "e-recete no": "eReceteNo",
          "takip no": "takipNo",
          "tesis kodu": "tesisKodu",
          "recete turu": "receteTuru",
          "recete tarihi": "receteTarihi",
          "recete alt turu": "receteAltTuru",
          "provizyon tipi": "provizyonTipi",
          "seri no": "seriNo",
          "protokol no": "protokolNo",
          "doktor brans": "doktorBrans",
          "doktor sertifika": "doktorSertifika",
        };
        /**
         * Kimlik bilgileri toplanmıyor: hasta T.C. kimlik numarası, hekimin
         * diploma tescil numarası ve hekimin adı/soyadı. Bunlar `diger`e de
         * düşmesin diye açıkça eleniyor — analiz için gereken doktor bilgisi
         * branş ve sertifika, kimlik değil.
         */
        const ATLANAN_ETIKETLER = [
          "t.c.kimlik no",
          "doktor dip.tesc.no",
          "doktor adi/soyadi",
        ];
        const baslik: EReceteBaslik = {
          eReceteNo: "",
          takipNo: "",
          tesisKodu: "",
          receteTuru: "",
          receteTarihi: "",
          receteAltTuru: "",
          provizyonTipi: "",
          seriNo: "",
          protokolNo: "",
          doktorBrans: "",
          doktorSertifika: "",
        };
        const diger: Record<string, string> = {};
        const mesajlar: string[] = [];

        const baslikTable = tableByHeader("e-recete bilgileri");
        const baslikRows = baslikTable
          ? Array.from(baslikTable.querySelectorAll(":scope > tbody > tr"))
          : [];
        for (const row of baslikRows) {
          if (row.classList.contains("headerRow")) continue;
          // Onay/Açıklama/Tanı tabloları da bu bloğun satırlarında duruyor;
          // onlar rowsOf() ile ayrıca okunuyor.
          if (row.querySelector("table.dataTableEx")) continue;

          const cells = Array.from(row.querySelectorAll(":scope > td"));
          // Etiket/değer satırları "Etiket | : | Değer" biçiminde; iki nokta
          // hücresi çapa alınıp solundaki etiket sağındaki değerle eşleniyor.
          let ciftBulundu = false;
          for (let i = 0; i < cells.length; i++) {
            if (clean(cells[i].textContent) !== ":") continue;
            const etiket = clean(cells[i - 1]?.textContent);
            if (!etiket) continue;
            ciftBulundu = true;
            const sadeEtiket = fold(etiket);
            // Değeri hiç okumuyoruz — kimlik alanları belleğe de girmesin.
            if (ATLANAN_ETIKETLER.includes(sadeEtiket)) continue;
            const deger = cellText(cells[i + 1]);
            const alan = BASLIK_ETIKETLERI[sadeEtiket];
            if (alan) baslik[alan] = deger;
            else diger[etiket] = deger;
          }
          if (ciftBulundu) continue;

          // Çift içermeyen satırlar serbest metin ("Reçete elektronik olarak
          // imzalanmıştır." ya da kırmızı uyarı satırı).
          const metin = clean(row.textContent);
          if (metin) mesajlar.push(metin);
        }
        if (Object.keys(diger).length) baslik.diger = diger;

        // ---- "İlaç Bilgileri" bloğu ----
        const ILAC_ETIKETLERI: Record<
          string,
          "ad" | "adet" | "kullanim" | "kullanimSekli"
        > = {
          adi: "ad",
          adet: "adet",
          kullanim: "kullanim",
          "kullanim sekli": "kullanimSekli",
        };
        const ilaclar: EReceteIlac[] = [];
        const ilacTable = tableByHeader("ilac bilgileri");
        const ilacRows = ilacTable
          ? Array.from(ilacTable.querySelectorAll(":scope > tbody > tr"))
          : [];
        let aktifIlac: EReceteIlac | null = null;

        for (const row of ilacRows) {
          if (row.classList.contains("headerRow")) continue;
          const cells = Array.from(row.querySelectorAll(":scope > td"));
          if (!cells.length) continue;

          // İlaçları ayıran <hr> satırı.
          if (cells.length === 1 && cells[0].querySelector("hr")) {
            aktifIlac = null;
            continue;
          }

          // İlacın altındaki açıklama tablosu ("Teşhis/Tanı - …").
          const icTablo =
            cells.length === 1 ? cells[0].querySelector("table") : null;
          if (icTablo) {
            if (!aktifIlac) continue;
            for (const td of Array.from(icTablo.querySelectorAll("td"))) {
              const metin = clean(td.textContent);
              if (metin) aktifIlac.aciklamalar.push(metin);
            }
            continue;
          }

          // "Adı : X  Adet : Y  Kullanım : Z  Kullanım Şekli : W" satırı;
          // hücreler etiket/değer ikilileri hâlinde geliyor.
          const alanlar: Record<string, string> = {};
          const ekAlanlar: Record<string, string> = {};
          for (let i = 0; i + 1 < cells.length; i += 2) {
            const etiket = clean(cells[i].textContent).replace(/\s*:\s*$/, "");
            if (!etiket) continue;
            const deger = cellText(cells[i + 1]);
            const alan = ILAC_ETIKETLERI[fold(etiket)];
            if (alan) alanlar[alan] = deger;
            else ekAlanlar[etiket] = deger;
          }
          if (!Object.keys(alanlar).length && !Object.keys(ekAlanlar).length) {
            continue;
          }

          // "TANSIFA 32 MG/10 MG TABLET (28 TABLET) (ARB+KKB) (8699262010258)"
          // → ad + barkod. Açgözlü eşleşme son parantezi yakalar.
          const adHam = alanlar.ad ?? "";
          const eslesme = adHam.match(/^(.*)\((\d{6,})\)\s*$/);
          aktifIlac = {
            ad: clean(eslesme ? eslesme[1] : adHam),
            barkod: eslesme ? eslesme[2] : "",
            adet: alanlar.adet ?? "",
            kullanim: alanlar.kullanim ?? "",
            kullanimSekli: alanlar.kullanimSekli ?? "",
            aciklamalar: [],
          };
          if (Object.keys(ekAlanlar).length) aktifIlac.ekAlanlar = ekAlanlar;
          ilaclar.push(aktifIlac);
        }

        return {
          baslik,
          mesajlar,
          ilaclar,
          onaylar: rowsOf("onay listesi").map(
            ([onayTuru = "", onayYapanDoktor = ""]) => ({
              onayTuru,
              onayYapanDoktor,
            }),
          ),
          aciklamalar: rowsOf("aciklama listesi").map(
            ([aciklamaTuru = "", aciklama = ""]) => ({
              aciklamaTuru,
              aciklama,
            }),
          ),
          tanilar: rowsOf("tani listesi").map(([icd10Kod = "", tani = ""]) => ({
            icd10Kod,
            tani,
          })),
        };
      });
    } finally {
      await this.returnFromERecetePage();
    }

    if (!bilgi) {
      throw new Error("e-Reçete sayfası okunamadı");
    }
    return bilgi;
  }

  /**
   * e-Reçete sayfasındaki "Geri Dön" (`input#form1:buttonGeriDon`) ile reçete
   * detay sayfasına döner. Detay sayfasının açıldığı `#f:t13` (Reçete No) ile
   * doğrulanır — akışın devamı (uyarı kodları vb.) o sayfayı bekliyor.
   */
  private async returnFromERecetePage(): Promise<void> {
    if (!this.page) return;
    try {
      const back = this.page.locator("input#form1\\:buttonGeriDon");
      if ((await back.count()) === 0) return;
      await back.first().click();
      await this.page.waitForSelector("#f\\:t13", {
        state: "attached",
        timeout: 15000,
      });
    } catch (error) {
      this.captureIssue(error, {
        operation: "ereceteGoruntule",
        outcome: "geri-don-failed",
      });
    }
  }

  async searchByDateRange(
    startDate: string,
    endDate: string,
    faturaTuru: FaturaTuru = "1",
  ): Promise<SearchByDateResult> {
    if (!this.page) {
      throw new Error("System is not ready.");
    }
    return this.withOperation(async () => {
      const startDateObj = dayjs(startDate);
      const endDateObj = dayjs(endDate);
      const monthYearArray: string[] = [];

      let current = startDateObj.startOf("month");
      const end = endDateObj.startOf("month");

      while (current.isBefore(end) || current.isSame(end)) {
        monthYearArray.push(current.format("YYYYMM01"));
        current = current.add(1, "month");
      }
      const recipes = [];
      for (const period of monthYearArray) {
        const result = await this.getRecipesByPeriod(period, faturaTuru);
        recipes.push(...result);
      }
      const filteredRecipes = recipes.filter((recete) => {
        const receteDate = dayjs(recete.receteTarihi, "DD/MM/YYYY");
        return (
          receteDate.isSame(startDateObj, 'date') ||
          receteDate.isSame(endDateObj, 'date') ||
          (receteDate.isAfter(startDateObj, 'date') && receteDate.isBefore(endDateObj, 'date'))
        );
      });
      return {
        success: true,
        prescriptions: filteredRecipes,
      };
    });
  }

  async getRecipesByPeriod(period: string, faturaTuru: FaturaTuru = "1", retried = false): Promise<ReceteOzet[]> {
    if (!this.page) {
      throw new Error("System is not ready.");
    }
    try {
      return await this._getRecipesByPeriodInner(period, faturaTuru);
    } catch (err: any) {
      const msg = err?.message || "";
      if (!retried && (msg.includes("Cannot find context") || msg.includes("Target page, context or browser has been closed"))) {
        console.warn("[Playwright] Context/page lost, retrying period query...");
        return await this.getRecipesByPeriod(period, faturaTuru, true);
      }
      this.captureIssue(err, {
        operation: "getRecipesByPeriod",
        detail: `period=${period}, faturaTuru=${faturaTuru}`,
      });
      throw err;
    }
  }

  private async _getRecipesByPeriodInner(period: string, faturaTuru: FaturaTuru = "1"): Promise<ReceteOzet[]> {
    if (!this.page) {
      throw new PlaywrightException(PlaywrightErrorCode.NOT_INITIALIZED);
    }
    await this.navigateToSGKPortal();
    await this.ensurePortalMenu("getRecipesByPeriod");
    const menu = this.page
      .locator(`${ELEMENT_SELECTORS.SOL_MENU_SELECTOR} tr`)
      .nth(3);
    await menu.click();
    await this.page.waitForSelector(
      ELEMENT_SELECTORS.RECETE_LISTESI_FATURA_TIPI_SELECTOR,
    );
    const invoiceSelect = this.page.locator(
      ELEMENT_SELECTORS.RECETE_LISTESI_FATURA_TIPI_SELECTOR,
    );
    const periodSelect = this.page.locator(
      ELEMENT_SELECTORS.RECETE_LISTESI_PERIOD_SELECTOR,
    );
    const sorgulaButton = this.page.locator(
      ELEMENT_SELECTORS.RECETE_LISTESI_SORGULA_BUTTON_SELECTOR,
    );
    await invoiceSelect.selectOption(faturaTuru);
    await periodSelect.selectOption(period);
    await sorgulaButton.click();
    await this.page.waitForLoadState("load");
    const checkListError = async () => {
      const errorSpan = this.page!.locator("td.message > span.outputText");
      const errorText = await errorSpan
        .textContent({
          timeout: 500,
        })
        ?.catch(() => {
          return "";
        });
      return !!(errorText && errorText.trim().length > 0);
    };
    const hasError = await checkListError();
    if (hasError) {
      return [];
    }

    const recipeTable = this.page.locator(
      ELEMENT_SELECTORS.RECETE_LISTESI_TABLE_SELECTOR,
    );
    const pageCountSpan = this.page.locator("#form1\\:text21");
    const pageCountText = await pageCountSpan.textContent();
    const splitParts = (pageCountText?.split("/") || []).map((part) =>
      part.trim(),
    );
    const pageCount = Number(splitParts[1]);

    const receteler: ReceteOzet[] = [];

    for (let p = 1; p <= pageCount; p++) {
      if (p > 1) {
        const pageInput = this.page.locator('input[name="form1:text34"]');
        await pageInput.clear();
        await pageInput.fill(p.toString());
        const goButton = this.page.locator('input[name="form1:buttonSayfayaGit"]');
        await Promise.all([
          goButton.click(),
          this.page.waitForLoadState("load"),
        ]);
      }
      const rows = recipeTable.locator(
        "tbody > tr.rowClass1, tbody > tr.rowClass2",
      );
      const rowCount = await rows.count();

      for (let i = 0; i < rowCount; i++) {
        const row = rows.nth(i);
        const columns = await row.locator("td");
        const receteNo = await columns.nth(1).locator("span").textContent();
        const sonIslemTarihi = await columns
          .nth(2)
          .locator("span")
          .textContent();
        const recepteTarihi = await columns
          .nth(3)
          .locator("span")
          .textContent();
        const ad = await columns.nth(4).locator("span").textContent();
        const soyad = await columns.nth(5).locator("span").textContent();
        const kapsam = await columns.nth(6).locator("span").textContent();

        const recete: ReceteOzet = {
          receteNo: this.normalizeText(receteNo),
          sonIslemTarihi: this.normalizeText(sonIslemTarihi),
          receteTarihi: this.normalizeText(recepteTarihi),
          ad: this.normalizeText(ad),
          soyad: this.normalizeText(soyad),
          kapsam: this.normalizeText(kapsam),
        };
        //await row.click();
        //recete.ilaclar = await this.getIlacOzetFromDetailPage();
        receteler.push(recete);
        // await this.page!.locator(
        //   ELEMENT_SELECTORS.RECETE_DETAY_GERI_DON_BUTTON_SELECTOR,
        // ).click();
      }
    }

    return receteler;
  }

  /**
   * Detay sayfasındaki ilaç tablosunu (`table#f:tbl1`) okur. Tablodaki her
   * satır için bir ilaç dönmek zorunda: eskiden adı boş gelen satır sessizce
   * atlanıyordu ve reçeteden ilaç düşüyordu. Artık okunamayan satır bir kez
   * daha denenir, yine olmazsa eksik olarak kaydedilir.
   */
  async getIlacOzetFromDetailPage(): Promise<IlacOzet[]> {
    const page = this.page!;

    // The Medula JSF table can render multiple <tbody> sections (and sometimes nested tables),
    // so don't assume a single tbody. Instead, select the actual data rows by their rowClass.
    const table = page.locator("table#f\\:tbl1");
    await table.waitFor({ state: "visible" });

    // Data rows are marked with rowClass1/rowClass2.
    const rowsSelector = "tr.rowClass1, tr.rowClass2";
    const rowCount = await table.locator(rowsSelector).count();

    const ilaclar: IlacOzet[] = [];
    let satirHatasi = false;
    let bosSatir = 0;

    for (let r = 0; r < rowCount; r++) {
      let sonuc = await this.parseIlacRow(table.locator(rowsSelector).nth(r));
      if (sonuc === null) {
        // JSF tabloyu POST sonrası yeniden basıyor; satır henüz hazır
        // olmayabilir. Locator'ı tazeleyip bir kez daha dene.
        await page
          .waitForTimeout(PlaywrightAutomationService.FIELD_RETRY_DELAY_MS)
          .catch(() => undefined);
        sonuc = await this.parseIlacRow(table.locator(rowsSelector).nth(r));
      }
      if (sonuc === null) {
        satirHatasi = true;
        this.recordGap({
          alan: `ilaclar[${r}]`,
          sebep: "missing-row",
          detay: `satır ${r + 1}/${rowCount} okunamadı`,
        });
        continue;
      }
      // Medula ilaç eklemek için boş satır da basıyor; o bir ilaç değil.
      if (sonuc === "bos") {
        bosSatir++;
        continue;
      }
      ilaclar.push(sonuc);
    }

    // Boş satırlar dışında tabloda kaç satır varsa o kadar ilaç dönmeli.
    // Satır bazında hata yakalanmadığı halde sayı tutmuyorsa yine de eksik.
    if (!satirHatasi && ilaclar.length !== rowCount - bosSatir) {
      this.recordGap({
        alan: "ilaclar.satirSayisi",
        sebep: "missing-row",
        detay: `${ilaclar.length}/${rowCount - bosSatir}`,
      });
    }

    return ilaclar;
  }

  /**
   * Tek bir ilaç satırını okur. `null` = satır okunamadı (JSF henüz basmamış,
   * barkod/ad alanı gelmemiş) — çağıran tekrar dener ve gerekirse eksik
   * kaydeder. Boş değerler ile okunamayan alanlar burada ayrılıyor: alan
   * elemanı varsa boş değer Medula'nın gerçek verisidir, elemanın hiç
   * olmaması satırın hazır olmadığını gösterir.
   */
  private async parseIlacRow(
    row: Locator,
  ): Promise<IlacOzet | "bos" | null> {
    try {
      // Locate barkod input within the row (ends with :t1)
      const barkodInput = row.locator('input[id$=":t1"]');
      if ((await barkodInput.count()) === 0) return null;

      // Extract the JSF row index from the element id: f:tbl1:<idx>:t1
      const barkodId = (await barkodInput.first().getAttribute("id")) ?? "";
      const m = barkodId.match(/^f:tbl1:(\d+):t1$/);
      if (!m) return null;
      const i = Number(m[1]);

      const valueOf = async (selector: string): Promise<string> => {
        const locator = row.locator(selector);
        return (await locator.count()) ? await locator.inputValue() : "";
      };
      const textOf = async (selector: string): Promise<string> => {
        const locator = row.locator(selector);
        return (await locator.count())
          ? ((await locator.textContent()) ?? "")
          : "";
      };

      const adValue = this.normalizeText(
        await textOf(`span[id="f:tbl1:${i}:t6"]`),
      );
      const barkodValue = this.normalizeText(
        await barkodInput.first().inputValue(),
      );

      // Medula, ilaç eklemek için tabloya boş satır da basıyor: hem barkodu
      // hem adı boş olan satır bir ilaç değildir, sessizce atlanır.
      if (isEmpty(barkodValue) && isEmpty(adValue)) return "bos";

      // Biri dolu diğeri boşsa satır henüz tam basılmamıştır. Eskiden adı boş
      // olan satır sessizce düşürülüyor ve reçeteden ilaç eksiliyordu; artık
      // null dönüp yeniden denenmesini sağlıyoruz.
      if (isEmpty(adValue) || isEmpty(barkodValue)) return null;
      const adetRaw = await valueOf(`input[id="f:tbl1:${i}:t2"]`);
      const adetValue = Number(adetRaw || "0");
      const periyotSayiValue = await valueOf(`input[id="f:tbl1:${i}:t5"]`);
      const periyotTipi = row.locator(`select[id="f:tbl1:${i}:m1"]`);
      // Periyot tipi seçili option'ın METNİ olmalı ("Günde", "Ayda").
      // inputValue() option'ın value'sunu ("3") veriyor ve periyot "1 3" diye
      // kaydedilip doz karşılaştırması çözümlenemez hâle geliyordu.
      const seciliPeriyot = periyotTipi.locator("option:checked").first();
      const periyotValue = (await periyotTipi.count())
        ? (await seciliPeriyot.count())
          ? this.normalizeText(await seciliPeriyot.textContent()) ||
            (await periyotTipi.inputValue())
          : await periyotTipi.inputValue()
        : "";
      const dozValue = await valueOf(`input[id="f:tbl1:${i}:t3"]`);
      const doz2Value = await valueOf(`input[id="f:tbl1:${i}:t4"]`);
      const verilebilecegiText = await textOf(`span[id="f:tbl1:${i}:t10"]`);
      const raporSpan = row.locator(`span[id="f:tbl1:${i}:t9"]`);
      const raportText = (await raporSpan.count())
        ? this.normalizeText(await raporSpan.textContent())
        : undefined;

      return {
        ad: adValue,
        barkod: barkodValue,
        adet: isNaN(adetValue) ? 0 : adetValue,
        periyot:
          periyotSayiValue && periyotValue
            ? `${periyotSayiValue} ${periyotValue}`
            : "",
        doz: dozValue && doz2Value ? `${dozValue} x ${doz2Value}` : "",
        verilebilecegiTarih: this.normalizeText(verilebilecegiText),
        rapor: raportText,
        raporluMu: !isEmpty(raportText?.trim()),
        rowIndex: i,
      };
    } catch {
      // Satır okunurken sayfa değiştiyse/DOM tazelendiyse null dönüp tekrar
      // denenmesini sağla; sessizce eksik ilaç listesi dönme.
      return null;
    }
  }
  async close(): Promise<void> {
    this.stopKeepAlive();
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        this.isInitialized = false;
      }
    } catch (error) {
      console.error("Error closing Playwright:", error);
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.page !== null;
  }

  getCurrentUrl(): string | null {
    return this.page?.url() || null;
  }

  /**
   * getIlacOzetFromDetailPage ile aynı tabloyu okur. Tek bir uygulama
   * kalsın diye ona delege ediyor: iki ayrı kopya varken satır atlama hatası
   * yalnızca birinde düzeltilebiliyordu.
   */
  async scrapeIlacListesi(_page: Page): Promise<IlacOzet[]> {
    return this.getIlacOzetFromDetailPage();
  }

  async addReportsToMedicines(medicines: IlacRow[]) {
    if (!this.page) throw new Error("Playwright not initialized");
    for (const med of medicines) {
      if (med.rapor != "") {
        med.raporlar = await this.getReportForMedicine(med.rowIndex);
      }
    }

    /* const radio = row.locator(`input[id="f:tbl1:${i}:checkbox7"]`);
      if ((await radio.count()) === 0) continue;
      await radio.click();*/

    // Rapor butonu
  }

  async getReportForMedicine(rowIndex: number): Promise<ReceteRapor> {
    const page = this.page;
    const table = page?.locator("table#f\\:tbl1");
    const row = table?.locator(`tr`).filter({
      has: page!.locator(`input[id="f:tbl1:${rowIndex}:t1"]`),
    });
    const checkbox = row?.locator(`input[id="f:tbl1:${rowIndex}:checkbox7"]`);
    await checkbox?.check();
    const raporButton = page?.locator("input#f\\:buttonRaporGoruntule");
    await raporButton?.waitFor({ state: "visible" });
    await raporButton?.click();
    const closeButton = page?.locator(
      'input#f\\:buttonGeriDon, input[type="submit"][value="Geri Dön"]',
    );
    await closeButton?.waitFor({ state: "visible" });
    const data = await this.scrapeRaporPage(page!);
    await closeButton?.click();
    return data;
  }

  async getIlacBilgiForMedicine(rowIndex: number): Promise<IlacBilgi> {
    const page = this.page;
    const table = page?.locator("table#f\\:tbl1");
    const row = table?.locator(`tr`).filter({
      has: page!.locator(`input[id="f:tbl1:${rowIndex}:t1"]`),
    });
    const checkbox = row?.locator(`input[id="f:tbl1:${rowIndex}:checkbox7"]`);
    await checkbox?.check();
    const ilacBilgiButton = page?.locator(
      ELEMENT_SELECTORS.ILAC_BILGI_BUTTON_SELECTOR,
    );
    await ilacBilgiButton?.waitFor({ state: "visible" });
    await ilacBilgiButton?.click();
    const closeButton = page?.locator("input[name='form1:buttonGeriDon']");
    await closeButton?.waitFor({ state: "visible" });
    const bilgi: IlacBilgi = await this.scrapeIlacBilgiPage(page!);
    await closeButton?.click();
    return bilgi;
  }

  async scrapeIlacBilgiPage(page: Page): Promise<IlacBilgi> {
    // İlaç Bilgileri başlığının geldiğinden emin ol. Sayfa açılmadıysa
    // buradan okunacak hiçbir boş değere güvenilemez; hata yukarı verilir ve
    // tur (withSubPageRetry) yeniden denenir.
    await page.waitForSelector(PlaywrightAutomationService.ANCHORS.ilacBilgi, {
      timeout: PlaywrightAutomationService.ANCHOR_TIMEOUT_MS,
    });

    // Helper fonksiyon. Başlık doğrulandığına göre sayfa tam gelmiştir: eleman
    // hiç yoksa Medula o alanı basmamıştır (gerçek yokluk, eksik veri değil).
    // Eleman varken okuma patlarsa (context düştü, DOM tazelendi) readField
    // alanı eksik kaydeder ve tur yeniden denenir.
    const getTextContent = (alan: string, selector: string): Promise<string> =>
      this.readField(
        alan,
        async () => {
          const locator = page.locator(selector).first();
          if ((await locator.count()) === 0) return "";
          return (
            (await locator.textContent({
              timeout: PlaywrightAutomationService.FIELD_READ_TIMEOUT_MS,
            })) || ""
          );
        },
        { fallback: "" },
      );


    // Temel ilaç bilgilerini çıkar
    const ilacAdi = await getTextContent(
      "ilacBilgi.ilacAdi",
      "#form1\\:text13",
    );
    const ambalajMiktari =
      (await getTextContent(
        "ilacBilgi.ambalajMiktari",
        "#form1\\:text14",
      )) +
      " " +
      (await getTextContent(
        "ilacBilgi.ambalajBirimi",
        "#form1\\:text25",
      ));
    const tekDozMiktari =
      (await getTextContent(
        "ilacBilgi.tekDozMiktari",
        "#form1\\:text79",
      )) +
      " " +
      (await getTextContent(
        "ilacBilgi.tekDozBirimi",
        "#form1\\:text80",
      ));
    const cinsiyeti = await getTextContent(
      "ilacBilgi.cinsiyeti",
      "#form1\\:text40",
    );
    const etkinMaddeKod = await getTextContent(
      "ilacBilgi.etkinMaddeKod",
      "#form1\\:text2",
    );
    const etkinMaddeAd = await getTextContent(
      "ilacBilgi.etkinMaddeAd",
      "#form1\\:text35",
    );
    const etkinMadde =
      etkinMaddeKod && etkinMaddeAd ? `${etkinMaddeKod} - ${etkinMaddeAd}` : "";

    // Raporlu maksimum kullanım dozu (form1:box9 text content). Yalnızca
    // raporlu ilaçlarda basıldığı için yokluğu eksik veri sayılmaz.
    const raporluMaksKullanimDoz = await this.readOptionalText(
      page.locator("#form1\\:box9").first(),
    );

    /**
     * Doz kutuları ("1 Günde 1 x 1.0") her parçayı ayrı bir <span>'de tutuyor
     * ve JSF hücreleri arasında boşluk düğümü yok — düz textContent
     * "1Günde1x1.0" veriyor. Bu yüzden span'ler tek tek okunup boşlukla
     * birleştiriliyor.
     */
    const getDozText = (alan: string, selector: string): Promise<string> =>
      this.readField(
        alan,
        async () => {
          // Kutu sayfada hiç yoksa Medula bu ilaç için doz basmamıştır —
          // gerçek yokluk. Kutu varken span'leri okumak patlarsa eksik
          // kaydedilir ve tur yeniden denenir.
          if ((await page.locator(selector).count()) === 0) return "";
          const parts = await page.locator(`${selector} span`).allTextContents();
          return parts
            .map((p) => this.normalizeText(p))
            .filter(Boolean)
            .join(" ");
        },
        { fallback: "" },
      );

    const ayaktanMaksKullanimDoz = await getDozText(
      "ilacBilgi.ayaktanMaksKullanimDoz",
      "#form1\\:box2",
    );
    const yatanMaksKullanimDoz = await getDozText(
      "ilacBilgi.yatanMaksKullanimDoz",
      "#form1\\:box10",
    );

    // SUT bilgilerini çıkar
    // const sutElements = await page
    //   .locator("#form1\\:tableEx1 > tr.rowClass1")
    //   .all();
    const sutBilgileri: any[] = [];

    // Özel durum bilgilerini çıkar
    const ozelDurumElements = await page
      .locator(
        "#form1\\:tableExOzelDurumList tr.rowClass1, #form1\\:tableExOzelDurumList tr.rowClass2",
      )
      .all();
    const ozelDurumlar: OzelDurum[] = [];

    for (const row of ozelDurumElements) {
      const cells = await row.locator("td").all();
      const durumText = await cells?.[0]?.textContent();
      if (durumText && durumText.trim()) {
        const kod = durumText.split("-")[0].trim();
        const aciklama = durumText.split("-").slice(1).join("-").trim();
        ozelDurumlar.push({
          kod,
          mesaj: aciklama,
        });
      }
    }

    // Eşdeğer bilgilerini çıkar
    const esdegerElements = await page
      .locator("#form1\\:tableExIlacEsdeger tr.rowClass1")
      .all();
    const esdegerBilgileri: EsdegerBilgi[] = [];
    for (const element of esdegerElements) {
      const cells = await element.locator("td").all();
      const baslangicTarihi = await cells?.[0]?.textContent();
      const bitisTarihi = await cells?.[1]?.textContent();
      const uyariKodu = await cells?.[2]?.textContent();
      const esdegerKodu = await cells?.[3]?.textContent();
      esdegerBilgileri.push({
        baslangicTarihi: baslangicTarihi?.trim() || "",
        bitisTarihi: bitisTarihi?.trim() || "",
        uyariKodu: uyariKodu?.trim() || "",
        esdegerKodu: esdegerKodu?.trim() || "",
      });
      //form1:tableExIlacMesajListesi
    }
    const mesajlar: IlacMesaj[] = [];
    const mesajTable = page.locator("#form1\\:tableExIlacMesajListesi");
    if ((await mesajTable.count()) > 0) {
      const mesajlarElements = await mesajTable
        .locator("tr.rowClass1, tr.rowClass2")
        .all();
      for (const msgRow of mesajlarElements) {
        const msgCells = await msgRow.locator("td").all();
        if (!msgCells[1]) continue;
        const msgText = await msgCells[1].textContent();
        const mesaj: IlacMesaj = {
          baslik: msgText?.trim() || "",
          mesaj: "",
        };
        try {
          await msgCells[1].click();
          const dialogElement = page.locator("div#form1\\:dialog1");
          await dialogElement.waitFor({ state: "visible", timeout: 5000 });
          const textAreaElement = dialogElement.locator(
            "textarea[name='form1:textarea1']",
          );
          const detayText = await textAreaElement.textContent();
          mesaj.mesaj = detayText?.trim() || "";
          const closeDialogButton = dialogElement.locator(
            "input[name='form1:buttonKapat']",
          );
          await closeDialogButton.click();
          await dialogElement.waitFor({ state: "hidden", timeout: 3000 });
        } catch (e) {
          console.warn("[Playwright] Failed to read message detail:", e);
        }
        mesajlar.push(mesaj);
      }
    }

    return {
      ilacAdi: this.normalizeText(ilacAdi),
      ambalajMiktari: this.normalizeText(ambalajMiktari),
      tekDozMiktari: this.normalizeText(tekDozMiktari),
      cinsiyeti: this.normalizeText(cinsiyeti),
      etkinMadde: this.normalizeText(etkinMadde),
      raporluMaksKullanimDoz: this.normalizeText(raporluMaksKullanimDoz) || undefined,
      ayaktanMaksKullanimDoz: ayaktanMaksKullanimDoz || undefined,
      yatanMaksKullanimDoz: yatanMaksKullanimDoz || undefined,
      sutBilgi: sutBilgileri[0] || undefined,
      ozelDurumlar: ozelDurumlar.length > 0 ? ozelDurumlar : undefined,
      esdegerBilgi: esdegerBilgileri,
      mesajlar: mesajlar,
    };
  }

  async scrapeRaporPage(page: Page): Promise<ReceteRapor> {
    // Page header "Rapor Görme" gelene kadar bekleyelim. Sayfa gelmediyse
    // hata yukarı verilir; buradan okunacak boş değerler rapora güvenilmez
    // veri yazardı.
    await page.waitForSelector(PlaywrightAutomationService.ANCHORS.rapor, {
      timeout: PlaywrightAutomationService.ANCHOR_TIMEOUT_MS,
    });

    // Başlık doğrulandığına göre sayfa tam gelmiştir: eleman hiç yoksa o alan
    // bu raporda basılmamıştır. Eleman varken okuma patlarsa eksik kaydedilir.
    const getTextContent = (alan: string, selector: string): Promise<string> =>
      this.readField(
        alan,
        async () => {
          const locator = page.locator(selector).first();
          if ((await locator.count()) === 0) return "";
          return (
            (await locator.textContent({
              timeout: PlaywrightAutomationService.FIELD_READ_TIMEOUT_MS,
            })) || ""
          );
        },
        { fallback: "" },
      );

    const raporNo = await getTextContent("rapor.raporNo", "#form1\\:text2");
    const raporTarihi = await getTextContent(
      "rapor.raporTarihi",
      "#form1\\:text10",
    );
    const protokolNo = await getTextContent(
      "rapor.protokolNo",
      "#form1\\:text4",
    );
    const duzenlemeTuru = await getTextContent(
      "rapor.duzenlemeTuru",
      "#form1\\:text12",
    );
    const kayitSekli = await getTextContent(
      "rapor.kayitSekli",
      "#form1\\:text15",
    );
    // Açıklama, takip no ve tesis unvanı her raporda basılmıyor (özellikle
    // eski raporlarda); yoklukları eksik veri sayılmaz.
    const aciklama = await this.readOptionalText(
      page.locator("#form1\\:text8").first(),
    );
    const tesisKodu = await getTextContent(
      "rapor.tesisKodu",
      "#form1\\:text9",
    );
    const raporTakipNo = await this.readOptionalText(
      page.locator("#form1\\:text74").first(),
    );
    const tesisUnvan = await this.readOptionalText(
      page.locator("#form1\\:text92").first(),
    );

    // Hak sahibi (hasta) bilgilerini çıkar
    const hastaBilgileri: RaporHasta = {
      cinsiyet: await getTextContent(
        "rapor.hasta.cinsiyet",
        "#form1\\:text3",
      ),
      dogumTarihi: await getTextContent(
        "rapor.hasta.dogumTarihi",
        "#form1\\:text1",
      ),
    };

    // Doktor bilgilerini çıkar
    const doktorRows = await page
      .locator(
        "#form1\\:tableExRaporDoktorList tr.rowClass1, #form1\\:tableExRaporDoktorList tr.rowClass2",
      )
      .all();
    const doktorlar: RaporDoktor[] = [];
    for (const row of doktorRows) {
      const cells = await row.locator("td").all();
      const doktorBrans =
        (await cells?.[2]?.locator("span")?.textContent()) ?? "";
      const doktor = {
        brans: this.normalizeText(doktorBrans),
      };
      doktorlar.push(doktor);
    }

    // Tanı bilgilerini çıkar
    const taniRows = await page
      .locator(
        "#form1\\:tableExRaporTeshisList tr.rowClass1, #form1\\:tableExRaporTeshisList tr.rowClass2",
      )
      .all();
    const tanilar: RaporTani[] = [];

    for (const row of taniRows) {
      const cells = await row.locator(":scope > td").all();
      const taniKodu = await cells?.[0]?.textContent();
      const baslangicTarihi = await cells?.[2]?.textContent();
      const bitisTarihi = await cells?.[3]?.textContent();
      if (taniKodu && taniKodu.trim()) {
        tanilar.push({
          tani: taniKodu.trim(),
          baslangicTarihi: baslangicTarihi?.trim() || "",
          bitisTarihi: bitisTarihi?.trim() || "",
        });
      }
    }

    // Etkin madde bilgilerini çıkar
    const etkenMaddeRows = await page
      .locator("#form1\\:tableEx1 tr.rowClass1, #form1\\:tableEx1 tr.rowClass2")
      .all();
    const etkenMaddeler: RaporEtkenMadde[] = [];

    for (const row of etkenMaddeRows) {
      const cells = await row.locator("td").all();
      const etkenMaddeKodu = await cells?.[0]?.textContent();
      const etkenMaddeAd = await cells?.[1]?.textContent();
      const form = await cells?.[2]?.textContent();
      const tedaviSemasi = await cells?.[3]?.textContent();
      const adetMiktar = await cells?.[4]?.textContent();
      const icerikMiktar = await cells?.[5]?.textContent();
      const eklenmeTarihi = await cells?.[6]?.textContent();

      if (etkenMaddeKodu && etkenMaddeKodu.trim()) {
        etkenMaddeler.push({
          kod: etkenMaddeKodu.trim(),
          ad: etkenMaddeAd?.trim() || "",
          form: form?.trim() || "",
          tedaviSema: tedaviSemasi?.trim() || "",
          adet: Number(adetMiktar?.trim()) || 0,
          icerikMiktari: icerikMiktar?.trim() || "",
          eklenmeZamani: eklenmeTarihi?.trim() || "",
        });
      }
    }

    // Açıklama bilgilerini çıkar
    const aciklamaRows = await page
      .locator("#form1\\:tableEx2 tr.rowClass1, #form1\\:tableEx2 tr.rowClass2")
      .all();
    const aciklamalar: RaporAciklama[] = [];

    for (const row of aciklamaRows) {
      const cells = await row.locator("td").all();
      const aciklama = await cells?.[0]?.textContent();
      const eklenmeZamani = await cells?.[1]?.textContent();
      if (aciklama && aciklama.trim()) {
        aciklamalar.push({
          aciklama: aciklama.trim(),
          eklenmeTarihi: eklenmeZamani?.trim() || "",
        });
      }
    }

    // "Rapor İlave Değer Bilgileri" — Kilo / Boy / Günlük Kalori Miktarı gibi
    // ölçümler. Tablo yalnızca değer girilmiş raporlarda render edilir.
    // Id sabit olsa da, bulunamazsa başlıktan tabloyu yakalayarak devam et.
    let ilaveDegerRows = await page
      .locator("#form1\\:tableEx5 tr.rowClass1, #form1\\:tableEx5 tr.rowClass2")
      .all();
    if (ilaveDegerRows.length === 0) {
      ilaveDegerRows = await page
        .locator('tr.headerRow:has-text("Rapor İlave Değer Bilgileri")')
        .locator("xpath=ancestor::table[1]")
        .locator(
          "table.dataTableEx tr.rowClass1, table.dataTableEx tr.rowClass2",
        )
        .all();
    }
    const ilaveDegerler: RaporIlaveDeger[] = [];

    for (const row of ilaveDegerRows) {
      const cells = await row.locator(":scope > td").all();
      const tur = await cells?.[0]?.textContent();
      const deger = await cells?.[1]?.textContent();
      const aciklama = await cells?.[2]?.textContent();
      const eklenmeZamani = await cells?.[3]?.textContent();

      if (tur && tur.trim()) {
        ilaveDegerler.push({
          tur: this.normalizeText(tur),
          deger: this.normalizeText(deger ?? ""),
          aciklama: this.normalizeText(aciklama ?? ""),
          eklenmeZamani: this.normalizeText(eklenmeZamani ?? ""),
        });
      }
    }

    const rapor: ReceteRapor = {
      raporNo: this.normalizeText(raporNo),
      raporTarihi: this.normalizeText(raporTarihi),
      protokolNo: this.normalizeText(protokolNo),
      duzenlemeTuru: this.normalizeText(duzenlemeTuru),
      kayitSekli: this.normalizeText(kayitSekli),
      aciklama: this.normalizeText(aciklama),
      tesisKodu: this.normalizeText(tesisKodu),
      raporTakipNo: this.normalizeText(raporTakipNo),
      tesisUnvan: this.normalizeText(tesisUnvan),
      tanilar: tanilar,
      doktorlar: doktorlar,
      etkenMaddeler: etkenMaddeler,
      aciklamalar: aciklamalar,
      ilaveDegerler: ilaveDegerler,
      hastaBilgileri,
    };

    return rapor;
  }

  private checkPageError = async (page: Page) => {
    const findErrorType = async (
      message: string,
    ): Promise<Error | undefined> => {
      if (
        message.includes("IP bu eczane için giriş yapmaya yetkili değildir")
      ) {
        const ip = await this.checkIpAddress();
        return new WrongIpException(ip);
      }
      if (message.includes("Geçersiz güvenlik kodu")) {
        return new WrongCaptchaException();
      }
      if (message.includes("Kullanıcı Adı veya Şifre Yanlış")) {
        const context = await page.context();
        await context.clearCookies();
        return new InvalidLoginException();
      }
      // Anything else (e.g. "Yeniden Giriş Yapınız." session-expiry prompt) is
      // NOT a credential error — return undefined so the caller re-logs in.
      return undefined;
    };
    const errorElement = await page.$("table#box1");
    if (errorElement) {
      const errorText = await errorElement.textContent().then((text) => {
        return text?.trim() ?? "";
      });
      if (errorText) {
        throw await findErrorType(errorText);
      }
    }
    return false;
  };

  private async scrabeIlacDetayPage(page: Page): Promise<any> {}

  private readonly checkIpAddress = async (): Promise<string> => {
    const res = await fetch("https://api.ipify.org?format=json");
    const { ip } = await res.json();
    return ip;
  };
}

// Export singleton instance
export const playwrightService = new PlaywrightAutomationService();
