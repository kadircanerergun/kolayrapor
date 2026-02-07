// Lazy import of Playwright to avoid Electron startup issues
import type { ChromiumBrowser, Page } from "playwright";
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
import {
  EsdegerBilgi,
  IlacBilgi,
  IlacMesaj,
  IlacOzet,
  OzelDurum,
  RaporAciklama,
  RaporDoktor,
  RaporEtkenMadde,
  RaporHasta,
  RaporTani,
  Recete,
  ReceteIlac,
  ReceteOzet,
  ReceteRapor,
} from "@/types/recete";
import { isEmpty } from "lodash";

let chromium: typeof import("playwright").chromium;

interface NavigationResult {
  success: boolean;
  currentUrl?: string;
  redirectedToLogin?: boolean;
  error?: string;
}

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

  // Check if any chromium directory has the INSTALLATION_COMPLETE marker
  const dirs = fs.readdirSync(browsersPath);
  return dirs.some(dir => {
    if (!dir.startsWith("chromium")) return false;
    const markerFile = path.join(browsersPath, dir, "INSTALLATION_COMPLETE");
    return fs.existsSync(markerFile);
  });
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
    const toInstall: Array<{ name: string; revision: string; downloadPath: string }> = [];

    const chromiumInfo = browsersJson.browsers.find((b: any) => b.name === "chromium");
    if (chromiumInfo) {
      toInstall.push({
        name: "chromium",
        revision: chromiumInfo.revision,
        downloadPath: `builds/chromium/${chromiumInfo.revision}/chromium-win64.zip`,
      });
    }

    // winldd is required on Windows for playwright to work
    if (process.platform === "win32") {
      const winlddInfo = browsersJson.browsers.find((b: any) => b.name === "winldd");
      if (winlddInfo) {
        toInstall.push({
          name: "winldd",
          revision: winlddInfo.revision,
          downloadPath: `builds/winldd/${winlddInfo.revision}/winldd-win64.zip`,
        });
      }
    }

    for (let i = 0; i < toInstall.length; i++) {
      const item = toInstall[i];
      const browserDir = path.join(browsersPath, `${item.name}-${item.revision}`);
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

    return this.performLogin(this.storedCredentials!);
  }

  async initialize(forceRestart: boolean = false, onProgress?: ProgressCallback): Promise<void> {
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

      // If already initialized and not forcing restart, return
      if (this.isInitialized && !forceRestart) {
        console.log("[Playwright] Already initialized, skipping...");
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

    await this.page.goto(url, { waitUntil: "networkidle" });
    const currentUrl = this.page.url();

    // Check if redirected to login page
    const redirectedToLogin =
      currentUrl.includes("/login") && !url.includes("/login");
    // Note: Auto-login will be handled by the caller (renderer) since it has access to credentials
    if (redirectedToLogin) {
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
  }

  async performLogin(credentials: LoginCredentials): Promise<LoginResult> {
    if (!this.page) {
      throw new PlaywrightException(PlaywrightErrorCode.NOT_INITIALIZED);
    }

    // Store credentials for future use
    this.setCredentials(credentials);

    // Wait for SGK login form
    await this.page.waitForSelector('input[name*="text1"]', {
      timeout: 10000,
    });
    await this.page.waitForSelector('input[name*="secret1"]', {
      timeout: 10000,
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
      throw new Error(`Captcha handling failed: ${captchaResult.error}`);
    }

    // Fill captcha solution
    const captchaField = await this.page.$(
      'input[name*="j_id_jsp_2072829783_5"]',
    );
    if (!captchaField) {
      throw new Error("Could not find captcha field");
    }

    await captchaField.fill(captchaResult.solution!);

    // Check KVKK consent checkbox
    const consentCheckbox = await this.page.$('input[name*="kvkkTaahhut"]');
    if (consentCheckbox) {
      await consentCheckbox.check();
    }

    // Click login button
    const loginButton = await this.page.$(
      'input[type="submit"][value="Giriş Yap"]',
    );
    if (!loginButton) {
      throw new Error("Could not find login button");
    }

    await Promise.all([loginButton.click()]);

    try {
      await this.checkPageError(this.page);
    } catch (error) {
      if (error instanceof WrongIpException) {
        throw error;
      }
    }
    await this.page.goto(URLS.MEDULA_HOME);
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
      await this.page.goto(URLS.MEDULA_HOME);
      return await this.performLogin(credentials);
    }
    this.loginCounter = 0;

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

      // Find captcha image
      const captchaImage = await this.page.$(
        'img[src="/eczane/SayiUretenImageYeniServlet"]',
      );
      if (!captchaImage) {
        throw new Error("Could not find captcha image");
      }

      // Get image as base64
      const imageBuffer = await captchaImage.screenshot({
        type: "png",
      });
      const base64Image = imageBuffer.toString("base64");

      // Send captcha to renderer for debugging
      if (this.debugMode) {
        // We'll send this via IPC in the next step
        console.log("Debug mode: Captcha detected");
      }

      // Send to captcha solving API
      const response = await fetch(`https://kolay-rapor-api-8503f0bb8557.herokuapp.com/medula/numbers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          image: base64Image,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = await response.json();
      console.log("Got result: ", result);

      if (!result.code) {
        throw new Error("No captcha solution received from API");
      }

      return {
        success: true,
        solution: result.code,
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
    const sgkUrl = URLS.MEDULA_HOME;
    return this.navigateTo(sgkUrl);
  }

  async searchPrescription(
    prescriptionNumber: string,
  ): Promise<NavigationResult & { prescriptionData?: Recete }> {
    try {
      if (!this.page) {
        throw new Error("System is not ready.");
      }
      await this.navigateToSGKPortal();
      await this.page.waitForSelector(ELEMENT_SELECTORS.SOL_MENU_SELECTOR);
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

      await searchButton.click();
      await this.page.waitForLoadState("load");

      // Parse recete from current page
      const recete = await this.parseReceteFromCurrentPage(prescriptionNumber);
      await this.ilaclaraRaporEkle(recete);
      console.log("Parsed prescription data: ", JSON.stringify(recete));
      return {
        success: true,
        currentUrl: this.page.url(),
        prescriptionData: recete,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Prescription search failed",
      };
    }
  }

  async ilaclaraRaporEkle(recete: Recete): Promise<void> {
    if (!this.page) {
      throw new Error("Page is not available");
    }
    for (let i = 0; i < (recete.ilaclar?.length || 0); i++) {
      const ilac = recete.ilaclar![i];
      if (ilac.raporluMu) {
        ilac.rapor = await this.getReportForMedicine(i);
        ilac.detay = await this.getIlacBilgiForMedicine(i);
      }
    }
  }

  async parseReceteFromCurrentPage(
    prescriptionNumber: string,
  ): Promise<Recete> {
    if (!this.page) {
      throw new Error("Page is not available");
    }

    // Temel reçete bilgilerini çıkar
    const receteNoElement = this.page.locator("#f\\:t13");
    const tesisKoduElement = this.page.locator("#f\\:t33");
    const receteTarihiElement = this.page.locator("#f\\:t29");
    const sonIslemTarihiElement = this.page.locator("#f\\:t31");
    const doktorBransElement = this.page.locator("#f\\:t45");

    const receteNo =
      (await receteNoElement.textContent()) || prescriptionNumber;
    const tesisKodu = (await tesisKoduElement.inputValue()) || "";
    const receteTarihi = (await receteTarihiElement.inputValue()) || "";
    const sonIslemTarihi = (await sonIslemTarihiElement.inputValue()) || "";
    const doktorBrans = (await doktorBransElement.textContent()) || "";

    // İlaç listesini getIlacOzetFromDetailPage kullanarak çıkar
    const ilaclar = (await this.getIlacOzetFromDetailPage()) as ReceteIlac[];

    const recete: Recete = {
      receteNo: receteNo.trim(),
      receteTarihi,
      sonIslemTarihi,
      tesisKodu,
      doktorBrans: doktorBrans.trim(),
      ilaclar,
    };

    return recete;
  }

  async searchByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<SearchByDateResult> {
    if (!this.page) {
      throw new Error("System is not ready.");
    }
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
      const result = await this.getRecipesByPeriod(period);
      recipes.push(...result);
    }
    const filteredRecipes = recipes.filter((recete) => {
      console.log('---', recete.receteTarihi);
      const receteDate = dayjs(recete.receteTarihi, "DD/MM/YYYY");
      console.log(
        receteDate
      );
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
  }

  async getRecipesByPeriod(period: string): Promise<ReceteOzet[]> {
    if (!this.page) {
      throw new Error("System is not ready.");
    }
    await this.navigateToSGKPortal();
    await this.page.waitForSelector(ELEMENT_SELECTORS.SOL_MENU_SELECTOR);
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
    await invoiceSelect.selectOption("1");
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

  async getIlacOzetFromDetailPage(): Promise<IlacOzet[]> {
    const ilaclar: IlacOzet[] = [];
    const page = this.page!;

    // The Medula JSF table can render multiple <tbody> sections (and sometimes nested tables),
    // so don't assume a single tbody. Instead, select the actual data rows by their rowClass.
    const table = page.locator("table#f\\:tbl1");
    await table.waitFor({ state: "visible" });

    // Data rows are marked with rowClass1/rowClass2.
    const dataRows = table.locator("tr.rowClass1, tr.rowClass2");
    const rowCount = await dataRows.count();

    for (let r = 0; r < rowCount; r++) {
      const row = dataRows.nth(r);

      // Locate barkod input within the row (ends with :t1)
      const barkodInput = row.locator('input[id$=":t1"]');
      if ((await barkodInput.count()) === 0) continue;

      // Extract the JSF row index from the element id: f:tbl1:<idx>:t1
      const barkodId = (await barkodInput.first().getAttribute("id")) ?? "";
      const m = barkodId.match(/^f:tbl1:(\d+):t1$/);
      if (!m) continue;
      const i = Number(m[1]);

      const checkbox = row.locator(`input[id="f:tbl1:${i}:checkbox7"]`);

      const adet = row.locator(`input[id="f:tbl1:${i}:t2"]`);
      const periyotSayi = row.locator(`input[id="f:tbl1:${i}:t5"]`);
      const periyotTipi = row.locator(`select[id="f:tbl1:${i}:m1"]`);
      const doz = row.locator(`input[id="f:tbl1:${i}:t3"]`);
      const doz2 = row.locator(`input[id="f:tbl1:${i}:t4"]`);

      const adi = row.locator(`span[id="f:tbl1:${i}:t6"]`);
      const tutar = row.locator(`span[id="f:tbl1:${i}:t7"]`);
      const fark = row.locator(`span[id="f:tbl1:${i}:t8"]`);
      const rapor = row.locator(`span[id="f:tbl1:${i}:t9"]`);
      const verilebilecegi = row.locator(`span[id="f:tbl1:${i}:t10"]`);
      const msj = row.locator(`span[id="f:tbl1:${i}:t11"]`);

      const periyotValue = (await periyotTipi.count())
        ? await periyotTipi.inputValue()
        : "";
      const adValue = await adi.textContent();
      const barkodValue = await barkodInput.first().inputValue();
      const adetValue = Number(
        (await adet.count()) ? await adet.inputValue() : "0",
      );
      const periyotSayiValue = (await periyotSayi.count())
        ? await periyotSayi.inputValue()
        : "";
      const dozValue = (await doz.count()) ? await doz.inputValue() : "";
      const doz2Value = (await doz2.count()) ? await doz2.inputValue() : "";
      const verilebilecegiText = (await verilebilecegi.count())
        ? await verilebilecegi.textContent()
        : "";
      const raportText = (await rapor.count())
        ? this.normalizeText(await rapor.textContent())
        : undefined;
      const ilac: IlacOzet = {
        ad: this.normalizeText(adValue),
        barkod: this.normalizeText(barkodValue),
        adet: isNaN(adetValue) ? 0 : adetValue,
        periyot:
          periyotSayiValue && periyotValue
            ? `${periyotSayiValue} ${periyotValue}`
            : "",
        doz: dozValue && doz2Value ? `${dozValue} x ${doz2Value}` : "",
        verilebilecegiTarih: this.normalizeText(verilebilecegiText),
        rapor: raportText,
        raporluMu: !isEmpty(raportText?.trim()),
      };
      if (!isEmpty(ilac.ad)) {
        ilaclar.push(ilac);
      }
    }
    return ilaclar;
  }
  async close(): Promise<void> {
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

  async scrapeIlacListesi(page: Page): Promise<IlacOzet[]> {
    // The Medula JSF table can render multiple <tbody> sections (and sometimes nested tables),
    // so don't assume a single tbody. Instead, select the actual data rows by their rowClass.
    const table = page.locator("table#f\\:tbl1");
    await table.waitFor({ state: "visible" });

    // Data rows are marked with rowClass1/rowClass2.
    const dataRows = table.locator("tr.rowClass1, tr.rowClass2");
    const rowCount = await dataRows.count();

    const result: IlacOzet[] = [];

    for (let r = 0; r < rowCount; r++) {
      const row = dataRows.nth(r);

      // Locate barkod input within the row (ends with :t1)
      const barkodInput = row.locator('input[id$=":t1"]');
      if ((await barkodInput.count()) === 0) continue;

      // Extract the JSF row index from the element id: f:tbl1:<idx>:t1
      const barkodId = (await barkodInput.first().getAttribute("id")) ?? "";
      const m = barkodId.match(/^f:tbl1:(\d+):t1$/);
      if (!m) continue;
      const i = Number(m[1]);

      const checkbox = row.locator(`input[id="f:tbl1:${i}:checkbox7"]`);

      const adet = row.locator(`input[id="f:tbl1:${i}:t2"]`);
      const periyotSayi = row.locator(`input[id="f:tbl1:${i}:t5"]`);
      const periyotTipi = row.locator(`select[id="f:tbl1:${i}:m1"]`);
      const doz = row.locator(`input[id="f:tbl1:${i}:t3"]`);
      const doz2 = row.locator(`input[id="f:tbl1:${i}:t4"]`);

      const adi = row.locator(`span[id="f:tbl1:${i}:t6"]`);
      const tutar = row.locator(`span[id="f:tbl1:${i}:t7"]`);
      const fark = row.locator(`span[id="f:tbl1:${i}:t8"]`);
      const rapor = row.locator(`span[id="f:tbl1:${i}:t9"]`);
      const verilebilecegi = row.locator(`span[id="f:tbl1:${i}:t10"]`);
      const msj = row.locator(`span[id="f:tbl1:${i}:t11"]`);

      const periyotValue = (await periyotTipi.count())
        ? await periyotTipi.inputValue()
        : "";
      const adValue = await adi.textContent();
      const barkodValue = await barkodInput.first().inputValue();
      const adetValue = Number(
        (await adet.count()) ? await adet.inputValue() : "0",
      );
      const periyotSayiValue = (await periyotSayi.count())
        ? await periyotSayi.inputValue()
        : "";
      const dozValue = (await doz.count()) ? await doz.inputValue() : "";
      const doz2Value = (await doz2.count()) ? await doz2.inputValue() : "";
      const verilebilecegiText = (await verilebilecegi.count())
        ? await verilebilecegi.textContent()
        : "";

      const raportText = (await rapor.count())
        ? this.normalizeText(await rapor.textContent())
        : undefined;
      const ilac: IlacOzet = {
        ad: this.normalizeText(adValue),
        barkod: this.normalizeText(barkodValue),
        adet: isNaN(adetValue) ? 0 : adetValue,
        periyot:
          periyotSayiValue && periyotValue
            ? `${periyotSayiValue} ${periyotValue}`
            : "",
        doz: dozValue && doz2Value ? `${dozValue} x ${doz2Value}` : "",
        verilebilecegiTarih: this.normalizeText(verilebilecegiText),
        rapor: raportText,
        raporluMu: !isEmpty(raportText?.trim()),
      };
      result.push(ilac);
    }
    return result;
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
    closeButton?.click();
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
    closeButton?.click();
    return bilgi;
  }

  async scrapeIlacBilgiPage(page: Page): Promise<IlacBilgi> {
    // İlaç Bilgileri başlığının geldiğinden emin ol
    await page.waitForSelector('td.menuHeader:has-text("İlaç Bilgileri")', {
      timeout: 15000,
    });

    // Helper fonksiyonlar
    const getTextContent = async (selector: string): Promise<string> => {
      try {
        const element = page.locator(selector).first();
        return (await element.textContent()) || "";
      } catch {
        return "";
      }
    };

    // Temel ilaç bilgilerini çıkar
    const ilacAdi = await getTextContent("#form1\\:text13");
    const ambalajMiktari =
      (await getTextContent("#form1\\:text14")) +
      " " +
      (await getTextContent("#form1\\:text25"));
    const tekDozMiktari =
      (await getTextContent("#form1\\:text79")) +
      " " +
      (await getTextContent("#form1\\:text80"));
    const cinsiyeti = await getTextContent("#form1\\:text40");
    const etkinMaddeKod = await getTextContent("#form1\\:text2");
    const etkinMaddeAd = await getTextContent("#form1\\:text35");
    const etkinMadde =
      etkinMaddeKod && etkinMaddeAd ? `${etkinMaddeKod} - ${etkinMaddeAd}` : "";

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
    const mesajlarElements = await page
      .locator(
        "#form1\\:tableExIlacMesajListesi tr.rowClass1, #form1\\:tableExIlacMesajListesi tr.rowClass2",
      )
      .all();
    const mesajlar: IlacMesaj[] = [];
    for (const msgRow of mesajlarElements) {
      const msgCells = await msgRow.locator("td").all();
      const msgText = await msgCells?.[1]?.textContent();
      const mesaj: IlacMesaj = {
        baslik: msgText?.trim() || "",
        mesaj: "",
      };
      await msgCells[1]?.click();
      await page.waitForSelector("div#form1\\:dialog1");
      const dialogElement = page.locator("div#form1\\:dialog1");
      const textAreaElement = dialogElement.locator(
        "textarea[name='form1:textarea1']",
      );
      const detayText = await textAreaElement.textContent();
      mesaj.mesaj = detayText?.trim() || "";
      mesajlar.push(mesaj);
      const closeDialogButton = dialogElement.locator(
        "input[name='form1\\:buttonKapat']",
      );
      await closeDialogButton.click();
    }

    return {
      ilacAdi: this.normalizeText(ilacAdi),
      ambalajMiktari: this.normalizeText(ambalajMiktari),
      tekDozMiktari: this.normalizeText(tekDozMiktari),
      cinsiyeti: this.normalizeText(cinsiyeti),
      etkinMadde: this.normalizeText(etkinMadde),
      sutBilgi: sutBilgileri[0] || undefined,
      ozelDurumlar: ozelDurumlar.length > 0 ? ozelDurumlar : undefined,
      esdegerBilgi: esdegerBilgileri,
      mesajlar: mesajlar,
    };
  }

  async scrapeRaporPage(page: Page): Promise<ReceteRapor> {
    // Page header "Rapor Görme" gelene kadar bekleyelim
    await page.waitForSelector('td.menuHeader:has-text("Rapor Görme")', {
      timeout: 15000,
    });

    const getTextContent = async (selector: string): Promise<string> => {
      try {
        const element = page.locator(selector).first();
        return (await element.textContent()) || "";
      } catch {
        return "";
      }
    };

    const raporNo = await getTextContent("#form1\\:text2");
    const raporTarihi = await getTextContent("#form1\\:text10");
    const protokolNo = await getTextContent("#form1\\:text4");
    const duzenlemeTuru = await getTextContent("#form1\\:text12");
    const kayitSekli = await getTextContent("#form1\\:text15");
    const aciklama = await getTextContent("#form1\\:text8");
    const tesisKodu = await getTextContent("#form1\\:text9");
    const raporTakipNo = await getTextContent("#form1\\:text74");
    const tesisUnvan = await getTextContent("#form1\\:text92");

    // Hak sahibi (hasta) bilgilerini çıkar
    const hastaBilgileri: RaporHasta = {
      cinsiyet: await getTextContent("#form1\\:text3"),
      dogumTarihi: await getTextContent("#form1\\:text1"),
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
      const cells = await row.locator("td").all();
      const taniKodu = await cells?.[0]?.textContent();
      const baslangicTarihi = await cells?.[1]?.textContent();
      const bitisTarihi = await cells?.[2]?.textContent();
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
      if (message.includes("Yeniden giriş")) {
        const context = await page.context();
        await context.clearCookies();
        return new InvalidLoginException();
      }
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
