import { os } from "@orpc/server";
import { app, autoUpdater } from "electron";

export const currentPlatfom = os.handler(() => {
  return process.platform;
});

export const appVersion = os.handler(() => {
  return app.getVersion();
});

export const checkForUpdates = os.handler(async () => {
  const currentVersion = app.getVersion();
  const inDevelopment = process.env.NODE_ENV === "development";

  if (inDevelopment) {
    return { status: "dev" as const, currentVersion };
  }

  return new Promise<{
    status: "up-to-date" | "update-available" | "error" | "dev";
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

    autoUpdater.checkForUpdates();
  });
});
