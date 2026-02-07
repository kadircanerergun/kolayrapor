import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { syncWithLocalTheme } from "./actions/theme";
import { useTranslation } from "react-i18next";
import { updateAppLanguage } from "./actions/language";
import { RouterProvider } from "@tanstack/react-router";
import { Provider } from "react-redux";
import { store } from "./store";
import { router } from "./utils/routes";
import { DeeplinkKontrol } from "./components/deeplink-kontrol";
import "./localization/i18n";

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
    <App />
  </React.StrictMode>,
);
