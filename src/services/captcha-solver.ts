// Local captcha solver service.
//
// Wraps the bundled EasyOCR `captcha-solver` binary (built from
// Documents/captcha/captcha-solve via PyInstaller). The binary is downloaded
// on first launch — exactly like the Playwright browsers — into userData, then
// spawned ONCE as a long-lived child process that talks line-delimited JSON
// over stdin/stdout:
//
//   us  -> stdin :  {"id":"<n>","base64":"<data:image/...;base64,...>"}
//   it  -> stdout:  {"id":"<n>","success":true,"digits":"123456"}
//                   {"id":"<n>","success":false,"error":"..."}
//   on ready, it emits ONE line:  {"ready":true}
//
// The model loads once (~3-6s); after that each solve is ~0.3s. Uzak API
// fallback'i kaldırıldı: captcha çözümünün TEK yolu burası, dolayısıyla
// kurulum/başlatma her çözüm isteğinde gerekirse yeniden deneniyor.

import { app } from "electron";
import path from "path";
import fs from "fs";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { createRequire } from "module";
import {
  CAPTCHA_SOLVER_VERSION,
  CAPTCHA_SOLVER_DOWNLOAD_URL,
  CAPTCHA_SOLVER_EXE_RELPATH,
} from "@/lib/constants";

export interface SolverInstallProgress {
  status: "checking" | "installing" | "done" | "error";
  message: string;
  progress?: number;
}

export type SolverProgressCallback = (progress: SolverInstallProgress) => void;

export interface SolveResult {
  success: boolean;
  digits?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/** Root install dir. Dev uses a folder next to the repo so a locally-built
 *  binary can be dropped in without packaging; prod downloads into userData. */
function getInstallRoot(): string {
  const inDevelopment = process.env.NODE_ENV === "development";
  return inDevelopment
    ? path.join(process.cwd(), "cs-bin")
    : path.join(app.getPath("userData"), "captcha-solver");
}

/** Version-keyed dir — bumping the version forces a clean re-download. */
function getVersionDir(): string {
  return path.join(getInstallRoot(), CAPTCHA_SOLVER_VERSION);
}

function getMarkerFile(): string {
  return path.join(getVersionDir(), "INSTALLATION_COMPLETE");
}

function getExePath(): string {
  return path.join(getVersionDir(), CAPTCHA_SOLVER_EXE_RELPATH);
}

// ---------------------------------------------------------------------------
// Install (download + extract), mirroring the Playwright browser installer
// ---------------------------------------------------------------------------

/** Reuse playwright-core's bundled zip `extract` so we don't add a new dep. */
function getExtractFn(): (zipPath: string, opts: { dir: string }) => Promise<void> {
  const inDevelopment = process.env.NODE_ENV === "development";
  const playwrightPath = inDevelopment
    ? "playwright-core"
    : path.join(process.resourcesPath, "playwright-core");
  const nodeRequire = createRequire(import.meta.url);
  const { extract } = nodeRequire(path.join(playwrightPath, "lib", "zipBundle"));
  return extract;
}

export function isSolverInstalled(): boolean {
  return fs.existsSync(getMarkerFile()) && fs.existsSync(getExePath());
}

async function installSolver(onProgress?: SolverProgressCallback): Promise<void> {
  const versionDir = getVersionDir();
  fs.mkdirSync(versionDir, { recursive: true });

  onProgress?.({
    status: "installing",
    message: "Destek paketleri indiriliyor, lütfen bekleyin...",
    progress: 0,
  });

  const tempDir = path.join(versionDir, `_temp_${process.pid}`);
  fs.mkdirSync(tempDir, { recursive: true });
  const zipPath = path.join(tempDir, "captcha-solver.zip");

  try {
    const response = await fetch(CAPTCHA_SOLVER_DOWNLOAD_URL);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(zipPath, Buffer.from(arrayBuffer));

    onProgress?.({
      status: "installing",
      message: "Destek paketleri çıkartılıyor...",
      progress: 60,
    });

    const extract = getExtractFn();
    await extract(zipPath, { dir: versionDir });

    if (!fs.existsSync(getExePath())) {
      throw new Error(
        `Solver exe not found after extract at ${getExePath()} — check zip layout`,
      );
    }

    fs.writeFileSync(getMarkerFile(), "");
    onProgress?.({ status: "done", message: "Destek paketleri hazır", progress: 100 });
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

export async function ensureSolverInstalled(
  onProgress?: SolverProgressCallback,
): Promise<void> {
  onProgress?.({ status: "checking", message: "Destek paketleri kontrol ediliyor..." });
  if (isSolverInstalled()) {
    onProgress?.({ status: "done", message: "Hazır", progress: 100 });
    return;
  }
  await installSolver(onProgress);
}

// ---------------------------------------------------------------------------
// Long-lived solver process
// ---------------------------------------------------------------------------

interface PendingRequest {
  resolve: (r: SolveResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

class CaptchaSolverService {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private readyPromise: Promise<void> | null = null;
  private stdoutBuffer = "";
  private pending = new Map<string, PendingRequest>();
  private reqCounter = 0;

  // A healthy solve is ~0.3s, so an 8s ceiling bounds the worst case (a wedged
  // but still-alive process) before the caller gives up on this attempt.
  private static readonly SOLVE_TIMEOUT_MS = 8_000;
  private static readonly READY_TIMEOUT_MS = 60_000;

  /** Best-effort liveness check. True only when the process is spawned, hasn't
   *  exited or been killed, still has a writable stdin, and has emitted
   *  {"ready":true}. A wrong `true` is safe — solve() re-checks and reports the
   *  failure back to the caller. */
  isReady(): boolean {
    return (
      this.proc !== null &&
      this.proc.exitCode === null &&
      this.proc.signalCode === null &&
      !this.proc.killed &&
      this.proc.stdin.writable &&
      this.readyResolved
    );
  }
  private readyResolved = false;

  /** Wait up to timeoutMs for the solver to finish warming up. Returns true if
   *  it's ready. Returns false immediately if it isn't even starting, so the
   *  caller can (re)install/spawn it instead of blocking. */
  async waitUntilReady(timeoutMs: number): Promise<boolean> {
    if (this.isReady()) return true;
    if (!this.readyPromise) return false; // not spawned / not starting
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((r) => {
      timer = setTimeout(r, timeoutMs);
    });
    try {
      await Promise.race([this.readyPromise.catch(() => undefined), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    return this.isReady();
  }

  /** Spawn the solver (idempotent). Resolves when the model is loaded. */
  async start(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;

    if (!isSolverInstalled()) {
      throw new Error("Captcha solver is not installed");
    }

    this.readyPromise = new Promise<void>((resolve, reject) => {
      const exePath = getExePath();

      const proc = spawn(exePath, [], {
        cwd: path.dirname(exePath),
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
      this.proc = proc;

      const readyTimer = setTimeout(() => {
        reject(new Error("Captcha solver did not become ready in time"));
        this.stop();
      }, CaptchaSolverService.READY_TIMEOUT_MS);

      proc.stdout.setEncoding("utf8");
      proc.stdout.on("data", (chunk: string) => {
        this.stdoutBuffer += chunk;
        let nl: number;
        while ((nl = this.stdoutBuffer.indexOf("\n")) >= 0) {
          const line = this.stdoutBuffer.slice(0, nl).trim();
          this.stdoutBuffer = this.stdoutBuffer.slice(nl + 1);
          if (!line) continue;
          this.handleLine(line, () => {
            clearTimeout(readyTimer);
            this.readyResolved = true;
            resolve();
          });
        }
      });

      proc.stderr.setEncoding("utf8");
      // Drain the solver's stderr so its pipe buffer can't fill and block it.
      proc.stderr.on("data", () => {});

      proc.on("error", (err) => {
        clearTimeout(readyTimer);
        console.error("[CaptchaSolver] spawn error:", err);
        reject(err);
        this.cleanupAfterExit();
      });

      proc.on("exit", (code, signal) => {
        clearTimeout(readyTimer);
        console.warn(`[CaptchaSolver] exited code=${code} signal=${signal}`);
        this.cleanupAfterExit();
      });
    }).catch((err) => {
      // Allow a future retry by clearing the cached promise.
      this.readyPromise = null;
      throw err;
    });

    return this.readyPromise;
  }

  private handleLine(line: string, onReady: () => void) {
    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch {
      console.warn(`[CaptchaSolver] non-JSON stdout line: ${line}`);
      return;
    }

    if (obj.ready === true) {
      onReady();
      return;
    }

    const id = obj.id != null ? String(obj.id) : null;
    if (id && this.pending.has(id)) {
      const { resolve, timer } = this.pending.get(id)!;
      clearTimeout(timer);
      this.pending.delete(id);
      resolve({
        success: !!obj.success,
        digits: obj.digits,
        error: obj.error,
      });
    }
  }

  private cleanupAfterExit() {
    this.readyResolved = false;
    this.proc = null;
    this.readyPromise = null;
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.resolve({ success: false, error: "Captcha solver process exited" });
    }
    this.pending.clear();
  }

  /** Solve one captcha. Rejects-as-result (never throws) so callers can fall back. */
  async solve(base64Image: string): Promise<SolveResult> {
    if (!this.isReady() || !this.proc) {
      return { success: false, error: "Captcha solver not ready" };
    }

    const id = String(++this.reqCounter);
    return new Promise<SolveResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ success: false, error: "Captcha solve timed out" });
      }, CaptchaSolverService.SOLVE_TIMEOUT_MS);

      this.pending.set(id, { resolve, timer });

      try {
        this.proc!.stdin.write(JSON.stringify({ id, base64: base64Image }) + "\n");
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        resolve({
          success: false,
          error: err instanceof Error ? err.message : "stdin write failed",
        });
      }
    });
  }

  stop() {
    if (this.proc && this.proc.exitCode === null) {
      try {
        this.proc.stdin.end();
        this.proc.kill();
      } catch {
        // ignore
      }
    }
    this.cleanupAfterExit();
  }
}

export const captchaSolverService = new CaptchaSolverService();

export interface CaptchaSolveOutcome {
  success: boolean;
  code: string | null;
  /** Which path produced the result. Uzak API kaldırıldı; "none" = çözücü
   *  hazır değildi, yani hiç denenemedi. */
  via: "local" | "none";
  error?: string;
}

/** Model ısınırken (tipik 3-6 sn) beklenecek üst sınır. */
const WARMUP_WAIT_MS = 30_000;

/** Aynı anda gelen çözüm isteklerinin kurulumu/başlatmayı çoğaltmasını önler. */
let bootstrapPromise: Promise<void> | null = null;

function bootstrapSolver(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      if (!isSolverInstalled()) {
        await ensureSolverInstalled();
      }
      await captchaSolverService.start();
    })().finally(() => {
      bootstrapPromise = null;
    });
  }
  return bootstrapPromise;
}

/**
 * Çözücünün ayakta olduğundan emin olur.
 *
 * Uzak API fallback'i kaldırıldığı için bu tek yol: açılıştaki kurulum ya da
 * spawn patladıysa captcha çözümü kalıcı olarak ölmesin diye burada bir kez
 * daha deneniyor.
 */
async function ensureSolverRunning(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (captchaSolverService.isReady()) return { ok: true };

  // Zaten ısınıyorsa bekle; başlamamışsa anında false döner.
  if (await captchaSolverService.waitUntilReady(WARMUP_WAIT_MS)) {
    return { ok: true };
  }

  try {
    await bootstrapSolver();
  } catch (err) {
    return {
      ok: false,
      error: `Güvenlik kodu çözücü başlatılamadı: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  return captchaSolverService.isReady()
    ? { ok: true }
    : { ok: false, error: "Güvenlik kodu çözücü hazır değil" };
}

/**
 * Captcha'yı yalnızca yerel (bundled EasyOCR) çözücüyle çözer.
 * `base64Image` ham base64 ya da `data:image/...` URL'i olabilir. Hem webview'ın
 * `captcha:solve` IPC handler'ı hem de Playwright login akışı buradan geçiyor,
 * böylece ikisi de aynı davranıyor.
 */
export async function solveCaptcha(base64Image: string): Promise<CaptchaSolveOutcome> {
  const running = await ensureSolverRunning();
  if (!running.ok) {
    return { success: false, code: null, via: "none", error: running.error };
  }

  try {
    const local = await captchaSolverService.solve(base64Image);
    if (local.success && local.digits) {
      return { success: true, code: local.digits, via: "local" };
    }
    return {
      success: false,
      code: null,
      via: "local",
      error: local.error || "Güvenlik kodu okunamadı",
    };
  } catch (err) {
    return {
      success: false,
      code: null,
      via: "local",
      error: err instanceof Error ? err.message : "Güvenlik kodu çözülemedi",
    };
  }
}
