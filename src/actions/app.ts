import { ipc } from "@/ipc/manager";

export function getPlatform() {
  return ipc.client.app.currentPlatfom();
}

export function getAppVersion() {
  return ipc.client.app.appVersion();
}

export function relaunchApp() {
  return ipc.client.app.relaunchApp();
}
