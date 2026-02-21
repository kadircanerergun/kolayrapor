import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/electron/renderer";
import { init as sentryReactInit, ErrorBoundary as SentryErrorBoundary } from "@sentry/react";
import { syncWithLocalTheme } from "./actions/theme";
import { useTranslation } from "react-i18next";
import { updateAppLanguage } from "./actions/language";
import { RouterProvider } from "@tanstack/react-router";
import { Provider } from "react-redux";
import { store } from "./store";
import { router } from "./utils/routes";
import { DeeplinkKontrol } from "./components/deeplink-kontrol";
import "./localization/i18n";
import { API_BASE_URL } from "./lib/constants";

Sentry.init(
  {
    integrations: [Sentry.browserTracingIntegration()],
    tracePropagationTargets: ["localhost", API_BASE_URL],
    tracesSampleRate: 1.0,
  },
  sentryReactInit,
);

export default function App() {
  const { i18n } = useTranslation();
  const isDeeplink = (window as any).deeplinkAPI?.isDeeplink;

  useEffect(() => {
    syncWithLocalTheme();
    updateAppLanguage(i18n);
  }, [i18n]);

  if (isDeeplink) {
    return (
      <Provider store={store}>
        <DeeplinkKontrol />
      </Provider>
    );
  }

  return (
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  );
}

const root = createRoot(document.getElementById("app")!);
root.render(
  <React.StrictMode>
    <SentryErrorBoundary fallback={<p>Bir hata oluştu.</p>}>
      <App />
    </SentryErrorBoundary>
  </React.StrictMode>,
);
