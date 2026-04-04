/**
 * Converts internal/technical error messages into user-friendly Turkish messages.
 * Playwright and browser automation errors should never be shown to users directly.
 */

const PLAYWRIGHT_PATTERNS: [RegExp, string][] = [
  [/Target page, context or browser has been closed/i, "Sistem bağlantısı kesildi. Lütfen tekrar deneyin."],
  [/Cannot find context/i, "Sistem bağlantısı kesildi. Lütfen tekrar deneyin."],
  [/page has been closed/i, "Sistem bağlantısı kesildi. Lütfen tekrar deneyin."],
  [/browser has been closed/i, "Sistem bağlantısı kesildi. Lütfen tekrar deneyin."],
  [/context has been closed/i, "Sistem bağlantısı kesildi. Lütfen tekrar deneyin."],
  [/frame was detached/i, "Bağlantı yenilendi. Lütfen tekrar deneyin."],
  [/frame got detached/i, "Bağlantı yenilendi. Lütfen tekrar deneyin."],
  [/Navigation failed/i, "Sisteme erişilemedi. Lütfen tekrar deneyin."],
  [/Timeout.*exceeded/i, "İşlem zaman aşımına uğradı. Lütfen tekrar deneyin."],
  [/waiting for selector/i, "Sistem yanıt vermedi. Lütfen tekrar deneyin."],
  [/waiting for locator/i, "Sistem yanıt vermedi. Lütfen tekrar deneyin."],
  [/net::ERR_/i, "Bağlantı hatası. İnternet bağlantınızı kontrol edin."],
  [/Page is not available/i, "Sistem hazır değil. Lütfen tekrar deneyin."],
  [/Initialization failed/i, "Sistem başlatılamadı. Lütfen tekrar deneyin."],
  [/Prescription search failed/i, "Reçete sorgulanamadı. Lütfen tekrar deneyin."],
  [/page\.goto/i, "Sisteme erişilemedi. Lütfen tekrar deneyin."],
];

export function toUserFriendlyError(error: unknown, fallback?: string): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  for (const [pattern, friendly] of PLAYWRIGHT_PATTERNS) {
    if (pattern.test(message)) {
      return friendly;
    }
  }

  // If the message looks technical (contains stack-like patterns), use fallback
  if (/at\s+\w|\.ts:|\.js:|page\.|frame\.|browser\.|context\./i.test(message)) {
    return fallback || "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.";
  }

  return message || fallback || "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.";
}
