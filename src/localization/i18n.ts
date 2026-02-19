import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        appName: "KolayRapor",
        titleHomePage: "Home Page",
        titleSecondPage: "Second Page",
        documentation: "Documentation",
        version: "Version",
        madeBy: "KolayRapor",
      },
    },
    "pt-BR": {
      translation: {
        appName: "KolayRapor",
        titleHomePage: "Página Inicial",
        titleSecondPage: "Segunda Página",
        documentation: "Documentação",
        version: "Versão",
        madeBy: "KolayRapor",
      },
    },
  },
});
