import { os } from "@orpc/server";
import { app, autoUpdater } from "electron";
import { captchaSolverService } from "../../services/captcha-solver";

export const currentPlatfom = os.handler(() => {
  return process.platform;
});

export const appVersion = os.handler(() => {
  return app.getVersion();
});

/** Fully quit and restart the app (not just a renderer reload). */
export const relaunchApp = os.handler(() => {
  (app as any).isQuitting = true;
  // app.exit() skips the before-quit hook, so tear the captcha solver child
  // down here to avoid leaving an orphaned process behind on every relaunch.
  captchaSolverService.stop();
  app.relaunch();
  app.exit(0);
});

export const checkForUpdates = os.handler(async () => {
  const currentVersion = app.getVersion();
  const inDevelopment = process.env.NODE_ENV === "development";

  if (inDevelopment) {
    return { status: "dev" as const, currentVersion };
  }

  return new Promise<{
    status: "up-to-date" | "update-available" | "downloading" | "error" | "dev";
    currentVersion: string;
    message?: string;
  }>((resolve) => {
    const cleanup = () => {
      autoUpdater.removeListener("update-available", onAvailable);
      autoUpdater.removeListener("update-not-available", onNotAvailable);
      autoUpdater.removeListener("error", onError);
    };

    const onAvailable = () => {
      cleanup();
      resolve({ status: "update-available", currentVersion });
    };

    const onNotAvailable = () => {
      cleanup();
      resolve({ status: "up-to-date", currentVersion });
    };

    const onError = (err: Error) => {
      cleanup();
      resolve({ status: "error", currentVersion, message: err.message });
    };

    autoUpdater.on("update-available", onAvailable);
    autoUpdater.on("update-not-available", onNotAvailable);
    autoUpdater.on("error", onError);

    setTimeout(() => {
      cleanup();
      resolve({ status: "error", currentVersion, message: "Zaman aşımı" });
    }, 15000);

    try {
      autoUpdater.checkForUpdates();
    } catch (err: any) {
      cleanup();
      if (err?.message?.includes('already running')) {
        resolve({ status: "downloading", currentVersion, message: "Güncelleme zaten indiriliyor." });
      } else {
        resolve({ status: "error", currentVersion, message: err?.message });
      }
    }
  });
});
