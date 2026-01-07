// Lazy import of Playwright to avoid Electron startup issues
import type { ChromiumBrowser, Page } from "playwright";
import { ELEMENT_SELECTORS } from "@/constants";
import dayjs from "dayjs";
import { WrongIpException } from "@/exceptions/wrong-ip.exception";
import { WrongCaptchaException } from "@/exceptions/wrong-captcha.exception";
import { InvalidLoginException } from "@/exceptions/invalid-login.exception";
import {
  PlaywrightErrorCode,
  PlaywrightException,
} from "@/exceptions/playwright.exception";
import { URLS } from "@/constants/urls";
import { UnsuccessfulLoginException } from "@/exceptions/unsuccessful-login.exception";
import { IlacOzet, ReceteOzet } from "@/types/recete";
import { Locator } from "@playwright/test";

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
  prescriptions?: string[];
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

async function loadPlaywright() {
  if (!chromium) {
    try {
      const pw = await import("playwright");
      chromium = pw.chromium;
    } catch (error) {
      throw new Error(
        `Failed to load Playwright: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
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

  async initialize(forceRestart: boolean = false): Promise<void> {
    try {
      // Load Playwright dynamically
      await loadPlaywright();

      // If already initialized and not forcing restart, return
      if (this.isInitialized && !forceRestart) return;

      // Close existing browser if restarting
      if (forceRestart && this.browser) {
        await this.close();
      }

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

      const context = await this.browser.newContext();
      this.page = await context.newPage();
      this.isInitialized = true;

      console.log("Playwright automation service initialized");
    } catch (error) {
      console.error("Failed to initialize Playwright:", error);
      throw error;
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
      const response = await fetch("http://localhost:3000/medula/numbers", {
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
  ): Promise<NavigationResult & { prescriptionData?: unknown }> {
    return new Promise(async (resolve, reject) => {
      resolve({ success: false, error: "Not implemented yet"});
    });
    // try {
    //   if (!this.page) {
    //     throw new PlaywrightException(PlaywrightErrorCode.NOT_INITIALIZED);
    //   }
    //   // First navigate to main portal URL
    //   await this.navigateToSGKPortal();
    //   await this.page.waitForSelector(ELEMENT_SELECTORS.SOL_MENU_SELECTOR);
    //   const menu = this.page
    //     .locator(`${ELEMENT_SELECTORS.SOL_MENU_SELECTOR} tr`)
    //     .nth(5);
    //   await menu.click();
    //   // Wait for the prescription number form
    //   await this.page.waitForSelector('input[name="form1:text2"]', {
    //     timeout: 10000,
    //   });
    //
    //   // Fill the prescription number
    //   const prescriptionField = await this.page.$('input[name="form1:text2"]');
    //   if (!prescriptionField) {
    //     throw new Error("Could not find prescription number field");
    //   }
    //   await prescriptionField.fill(prescriptionNumber);
    //
    //   // Click the search button
    //   const searchButton = await this.page.$(
    //     'input[type="submit"][value="Sorgula"]#form1\\:buttonReceteNoSorgula',
    //   );
    //   if (!searchButton) {
    //     throw new Error("Could not find search button");
    //   }
    //
    //   // Submit the form and wait for results
    //   await Promise.all([
    //     this.page.waitForNavigation({ timeout: 15000 }).catch(() => {
    //       // Sometimes the page doesn't navigate, just updates content
    //       console.log(
    //         "No navigation occurred, content might be updated in place",
    //       );
    //     }),
    //     searchButton.click(),
    //   ]);
    //   await this.page.waitForLoadState("load");
    //
    //   const prescriptionMedicines = await this.scrapeIlacListesi(this.page);
    //   await this.addReportsToMedicines(prescriptionMedicines);
    //   console.log("Extracted prescription data:", prescriptionMedicines);
    //
    //   return {
    //     success: true,
    //     currentUrl: this.page.url(),
    //     prescriptionData: {
    //       number: prescriptionNumber,
    //       searchResults: prescriptionMedicines,
    //       timestamp: new Date().toISOString(),
    //     },
    //   };
    // } catch (error) {
    //   return {
    //     success: false,
    //     error:
    //       error instanceof Error ? error.message : "Prescription search failed",
    //   };
    // }
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
    console.log("Recipes by date range:", recipes);
    return {
      success: true,
    }
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
      const errorText = await errorSpan.textContent({
        timeout: 500
      })?.catch(() => {
        return ''
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
    console.log('pageCount', pageCount);

    for (let p = 1; p <= pageCount; p++) {
      const rows = recipeTable.locator(
        "tbody > tr.rowClass1, tbody > tr.rowClass2",
      );
      const rowCount = await rows.count();
      console.log('rowCount', rowCount);

      for (let i = 0; i < rowCount; i++) {
        const row = rows.nth(i);
        const columns = await row.locator('td');
        const receteNo = await columns.nth(1).locator('span').textContent();
        const sonIslemTarihi = await columns.nth(2).locator('span').textContent();
        const recepteTarihi = await columns.nth(3).locator('span').textContent();
        const ad = await columns.nth(4).locator('span').textContent();
        const soyad = await columns.nth(5).locator('span').textContent();
        const kapsam = await columns.nth(6).locator('span').textContent();

        const recete: ReceteOzet = {
          receteNo: this.normalizeText(receteNo),
          sonIslemTarihi: this.normalizeText(sonIslemTarihi),
          receteTarihi: this.normalizeText(recepteTarihi),
          ad: this.normalizeText(ad),
          soyad: this.normalizeText(soyad),
          kapsam: this.normalizeText(kapsam),
        };
        recete.ilaclar = await this.getMedicinesForRow(row);
        receteler.push(recete);
      }
    }

    return receteler;
  }

  async getMedicinesForRow(row: Locator): Promise<IlacOzet[]> {
    const ilaclar: IlacOzet[] = [];
    await row.click();
    const page = this.page!;

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
      const adetValue = Number((await adet.count() ? await adet.inputValue() : "0"));
      const periyotSayiValue = (await periyotSayi.count()) ? await periyotSayi.inputValue() : "";
      const dozValue = (await doz.count()) ? await doz.inputValue() : "";
      const doz2Value = (await doz2.count()) ? await doz2.inputValue() : "";
      const verilebilecegiText = (await verilebilecegi.count()) ? await verilebilecegi.textContent() : "";

      const ilac: IlacOzet = {
        ad: this.normalizeText(adValue),
        barkod: this.normalizeText(barkodValue),
        adet: isNaN(adetValue) ? 0 : adetValue,
        periyot: periyotSayiValue && periyotValue ? `${periyotSayiValue} ${periyotValue}` : "",
        doz: dozValue && doz2Value ? `${dozValue} x ${doz2Value}` : "",
        verilebilecegiTarih: this.normalizeText(verilebilecegiText),
        rapor: (await rapor.count()) ? this.normalizeText(await rapor.textContent()) : undefined
      }
      ilaclar.push(ilac);
    }
    // return back
    await this.page!.locator(ELEMENT_SELECTORS.RECETE_DETAY_GERI_DON_BUTTON_SELECTOR).click()
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
      const adetValue = Number((await adet.count() ? await adet.inputValue() : "0"));
      const periyotSayiValue = (await periyotSayi.count()) ? await periyotSayi.inputValue() : "";
      const dozValue = (await doz.count()) ? await doz.inputValue() : "";
      const doz2Value = (await doz2.count()) ? await doz2.inputValue() : "";
      const verilebilecegiText = (await verilebilecegi.count()) ? await verilebilecegi.textContent() : "";

      const ilac: IlacOzet = {
        ad: this.normalizeText(adValue),
        barkod: this.normalizeText(barkodValue),
        adet: isNaN(adetValue) ? 0 : adetValue,
        periyot: periyotSayiValue && periyotValue ? `${periyotSayiValue} ${periyotValue}` : "",
        doz: dozValue && doz2Value ? `${dozValue} x ${doz2Value}` : "",
        verilebilecegiTarih: this.normalizeText(verilebilecegiText),
        rapor: (await rapor.count()) ? this.normalizeText(await rapor.textContent()) : undefined
      }
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

  async getReportForMedicine(rowIndex: number): Promise<Record<string, any>> {
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

  async scrapeRaporPage(page: Page): Promise<RaporData> {
    // Page header "Rapor Görme" gelene kadar bekleyelim
    await page.waitForSelector('td.menuHeader:has-text("Rapor Görme")', {
      timeout: 15000,
    });

    // Helpers
    const textById = async (id: string) =>
      this.normalizeText(
        await page.locator(`#${id.replace(/:/g, "\\:")}`).textContent(),
      );

    // --- Hak Sahibi (PII hariç) ---
    // PII: form1:text5 (tc), form1:text7 + form1:text58 (ad/soyad) => özellikle çekmiyoruz.
    const cinsiyet = await textById("form1:text3");
    const dogumTarihi = await textById("form1:text1");

    // --- Rapor Bilgileri ---
    const raporNumarasi = await textById("form1:text2");
    const raporTarihi = await textById("form1:text10");
    const protokolNo = await textById("form1:text4");
    const duzenlemeTuru = await textById("form1:text12");
    const aciklama = await textById("form1:text8");
    const kayitSekli = await textById("form1:text15");
    const tesisKodu = await textById("form1:text9");
    const raporTakipNo = await textById("form1:text74");
    const tesisUnvani = await textById("form1:text92");
    const kullaniciAdi = await textById("form1:text436");

    // Açıklamalar tablosu: form1:tableEx2
    const aciklamaRows = page.locator(
      "table#form1\\:tableEx2 tr.rowClass1, table#form1\\:tableEx2 tr.rowClass2",
    );
    const aciklamaCount = await aciklamaRows.count();
    const aciklamalar: Array<{ aciklama: string; eklenmeZamani: string }> = [];

    for (let i = 0; i < aciklamaCount; i++) {
      const row = aciklamaRows.nth(i);
      const aciklamaTxt = this.normalizeText(
        await row.locator('span[id$=":text43"]').textContent(),
      );
      const zamanTxt = this.normalizeText(
        await row.locator('span[id$=":text891"]').textContent(),
      );
      if (aciklamaTxt || zamanTxt)
        aciklamalar.push({ aciklama: aciklamaTxt, eklenmeZamani: zamanTxt });
    }

    // --- Tanı Bilgileri ---
    const taniRows = page.locator(
      "table#form1\\:tableExRaporTeshisList > tbody tr.rowClass1, table#form1\\:tableExRaporTeshisList > tbody tr.rowClass2",
    );
    const taniCount = await taniRows.count();
    const taniBilgileri: RaporData["taniBilgileri"] = [];

    for (let r = 0; r < taniCount; r++) {
      const row = taniRows.nth(r);

      const grupBasligi = this.normalizeText(
        await row.locator('span[id$=":text77"]').first().textContent(),
      );
      const baslangic = this.normalizeText(
        await row.locator("td").nth(2).textContent(),
      ); // 3. kolon
      const bitis = this.normalizeText(
        await row.locator("td").nth(3).textContent(),
      ); // 4. kolon

      // nested ICD rows: ...:tableEx4 içinde text78 (icd), text82 (tanim)
      const icdRows = row.locator('table[id$=":tableEx4"] > tbody > tr');
      const icdCount = await icdRows.count();
      const kodlar: Array<{ icd10: string; tanim: string }> = [];

      for (let j = 0; j < icdCount; j++) {
        const icdRow = icdRows.nth(j);
        const icd10 = this.normalizeText(
          await icdRow.locator('span[id$=":text78"]').textContent(),
        );
        const tanim = this.normalizeText(
          await icdRow.locator('span[id$=":text82"]').textContent(),
        );
        if (icd10 || tanim) kodlar.push({ icd10, tanim });
      }

      if (grupBasligi || kodlar.length || baslangic || bitis) {
        taniBilgileri.push({ grupBasligi, kodlar, baslangic, bitis });
      }
    }

    // --- Doktor Bilgileri ---
    const doktorRows = page.locator(
      "table#form1\\:tableExRaporDoktorList tr.rowClass1, table#form1\\:tableExRaporDoktorList tr.rowClass2",
    );
    const doktorCount = await doktorRows.count();
    const doktorBilgileri: RaporData["doktorBilgileri"] = [];

    for (let i = 0; i < doktorCount; i++) {
      const row = doktorRows.nth(i);
      doktorBilgileri.push({
        diplomaNo: this.normalizeText(
          await row.locator('span[id$=":text26"]').textContent(),
        ),
        diplomaTescilNo: this.normalizeText(
          await row.locator('span[id$=":text97"]').textContent(),
        ),
        brans: this.normalizeText(
          await row.locator('span[id$=":text96"]').textContent(),
        ),
        adi: this.normalizeText(
          await row.locator('span[id$=":text95"]').textContent(),
        ),
        soyadi: this.normalizeText(
          await row.locator('span[id$=":text94"]').textContent(),
        ),
      });
    }

    // --- Etkin Madde Bilgileri ---
    const emRows = page.locator(
      "table#form1\\:tableEx1 tr.rowClass1, table#form1\\:tableEx1 tr.rowClass2",
    );
    const emCount = await emRows.count();
    const etkinMaddeBilgileri: RaporData["etkinMaddeBilgileri"] = [];

    for (let i = 0; i < emCount; i++) {
      const row = emRows.nth(i);
      etkinMaddeBilgileri.push({
        kodu: this.normalizeText(
          await row.locator('span[id$=":text62"]').textContent(),
        ),
        adi: this.normalizeText(
          await row.locator('span[id$=":text63"]').textContent(),
        ),
        form: this.normalizeText(
          await row.locator('span[id$=":text65"]').textContent(),
        ),
        tedaviSema: this.normalizeText(
          await row.locator('span[id$=":text76"]').textContent(),
        ),
        adetMiktar: this.normalizeText(
          await row.locator('span[id$=":text66"]').textContent(),
        ),
        icerikMiktari: this.normalizeText(
          await row.locator('span[id$=":text64"]').textContent(),
        ),
        eklenmeZamani: this.normalizeText(
          await row.locator('span[id$=":text24"]').textContent(),
        ),
      });
    }

    return {
      hakSahibi: { cinsiyet, dogumTarihi },
      raporBilgileri: {
        raporNumarasi,
        raporTarihi,
        protokolNo,
        duzenlemeTuru,
        aciklama,
        kayitSekli,
        tesisKodu,
        raporTakipNo,
        tesisUnvani,
        kullaniciAdi,
        aciklamalar,
      },
      taniBilgileri,
      doktorBilgileri,
      etkinMaddeBilgileri,
    };
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
