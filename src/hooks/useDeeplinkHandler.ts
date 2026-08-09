import { useEffect, useCallback } from "react";
import { useAppDispatch } from "@/store";
import {
  setDeeplinkNotification,
  type DeeplinkNotificationResult,
} from "@/store/slices/taskQueueSlice";
import { searchPrescriptionDetail } from "@/store/slices/playwrightSlice";
import { analizCompleted, setAnalyzingRecete } from "@/store/slices/receteSlice";
import { reportApiService } from "@/services/report-api";
import { cacheAnalysis, getCachedAnalysis } from "@/lib/db";

const deeplinkAPI = (window as any).deeplinkAPI;

export function useDeeplinkHandler() {
  const dispatch = useAppDispatch();

  const handleDeeplink = useCallback(
    async (params: { receteNo: string; barkodlar: string[]; kontrol: boolean }) => {
      const { receteNo, barkodlar } = params;

      // Unique per trigger so the panel window re-shows for the same reçete.
      const notificationId = `${receteNo}-${Date.now()}`;
      let patientName = "";

      dispatch(setAnalyzingRecete(receteNo));

      try {
        const recete = await dispatch(
          searchPrescriptionDetail({ receteNo }),
        ).unwrap();

        // Fire the "otomatik kontrol başladı" notification now that we know
        // the patient. The top-right panel window shows it while the
        // per-medicine work below runs, then swaps to the results.
        patientName = `${recete?.ad ?? ""} ${recete?.soyad ?? ""}`.trim();
        dispatch(
          setDeeplinkNotification({
            id: notificationId,
            receteNo,
            patientName,
            status: "running",
          }),
        );

        let raporluIlaclar = (recete?.ilaclar ?? []).filter(
          (m: any) => m.raporluMu,
        );

        // If specific barkodlar were requested, filter to those
        if (barkodlar.length > 0) {
          raporluIlaclar = raporluIlaclar.filter((m: any) =>
            barkodlar.includes(m.barkod),
          );
        }

        if (raporluIlaclar.length === 0) {
          dispatch(
            setDeeplinkNotification({
              id: notificationId,
              receteNo,
              patientName,
              status: "done",
              message: "Bu reçetede raporlu ilaç bulunamadı.",
              results: [],
            }),
          );
          return;
        }

        // Reuse cached analyses; only call the API for uncached medicines.
        const cached = await getCachedAnalysis([receteNo]);
        const cachedForRecete = cached[receteNo] ?? {};

        const results: DeeplinkNotificationResult[] = [];

        for (const ilac of raporluIlaclar) {
          const label = ilac.ad || ilac.barkod;
          const cachedReport = cachedForRecete[ilac.barkod];
          if (cachedReport) {
            dispatch(
              analizCompleted({
                receteNo,
                sonuclar: { [ilac.barkod]: cachedReport },
              }),
            );
            results.push({
              barkod: ilac.barkod,
              label,
              validityScore: cachedReport.validityScore,
            });
            continue;
          }
          try {
            const result = await reportApiService.generateReport(
              ilac.barkod,
              recete,
            );
            if (result.success && result.data) {
              await cacheAnalysis(receteNo, ilac.barkod, result.data);
              dispatch(
                analizCompleted({
                  receteNo,
                  sonuclar: { [ilac.barkod]: result.data },
                }),
              );
              results.push({
                barkod: ilac.barkod,
                label,
                validityScore: result.data.validityScore,
              });
            } else {
              results.push({ barkod: ilac.barkod, label, failed: true });
            }
          } catch {
            // Individual failures are reported as such; the rest still show.
            results.push({ barkod: ilac.barkod, label, failed: true });
          }
        }

        // Surface the results in the always-on-top panel window — the main
        // window may be hidden in the tray, so this is the only thing the
        // user sees. Clicking "Detayları Gör" there opens the in-app sheet.
        dispatch(
          setDeeplinkNotification({
            id: notificationId,
            receteNo,
            patientName,
            status: "done",
            results,
          }),
        );
      } catch {
        // Prescription fetch failed — tell the user instead of going silent.
        dispatch(
          setDeeplinkNotification({
            id: notificationId,
            receteNo,
            patientName,
            status: "done",
            message: "Reçete bilgileri alınamadı. Lütfen tekrar deneyin.",
            results: [],
          }),
        );
      } finally {
        dispatch(setAnalyzingRecete(null));
      }
    },
    [dispatch],
  );

  useEffect(() => {
    if (!deeplinkAPI) return;

    deeplinkAPI.onParams(
      (params: { receteNo: string; barkodlar: string[]; kontrol: boolean }) => {
        handleDeeplink(params);
      },
    );
  }, [handleDeeplink]);
}
