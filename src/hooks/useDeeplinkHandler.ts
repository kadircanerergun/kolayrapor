import { useEffect, useCallback } from "react";
import { useAppDispatch } from "@/store";
import { addGroup, updateTask, setShowResultReceteNo } from "@/store/slices/taskQueueSlice";
import { searchPrescriptionDetail } from "@/store/slices/playwrightSlice";
import { analizCompleted, setAnalyzingRecete } from "@/store/slices/receteSlice";
import { reportApiService } from "@/services/report-api";
import { cacheAnalysis } from "@/lib/db";

const deeplinkAPI = (window as any).deeplinkAPI;

export function useDeeplinkHandler() {
  const dispatch = useAppDispatch();

  const handleDeeplink = useCallback(
    async (params: { receteNo: string; barkodlar: string[] }) => {
      const { receteNo, barkodlar } = params;
      const groupId = `deeplink-${receteNo}-${Date.now()}`;

      dispatch(setAnalyzingRecete(receteNo));
      dispatch(
        addGroup({
          id: groupId,
          title: `Reçete ${receteNo}`,
          receteNo,
          items: [
            {
              id: "fetch",
              label: "Reçete verileri toplanıyor",
              status: "running",
            },
          ],
        }),
      );

      try {
        const recete = await dispatch(
          searchPrescriptionDetail({ receteNo }),
        ).unwrap();
        dispatch(updateTask({ groupId, taskId: "fetch", status: "done" }));

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
            updateTask({
              groupId,
              taskId: "fetch",
              status: "error",
              errorMessage: "Raporlu ilaç bulunamadı",
            }),
          );
          return;
        }

        // Add per-medicine tasks
        dispatch(
          addGroup({
            id: groupId,
            title: `Reçete ${receteNo}`,
            receteNo,
            items: [
              {
                id: "fetch",
                label: "Reçete verileri toplanıyor",
                status: "done",
              },
              ...raporluIlaclar.map((m: any, idx: number) => ({
                id: m.barkod,
                label: m.ad || m.barkod,
                status: (idx === 0 ? "running" : "pending") as
                  | "running"
                  | "pending",
              })),
            ],
          }),
        );

        // Analyze one by one
        for (let i = 0; i < raporluIlaclar.length; i++) {
          const ilac = raporluIlaclar[i];
          dispatch(
            updateTask({ groupId, taskId: ilac.barkod, status: "running" }),
          );
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
            }
            dispatch(
              updateTask({ groupId, taskId: ilac.barkod, status: "done" }),
            );
          } catch {
            dispatch(
              updateTask({
                groupId,
                taskId: ilac.barkod,
                status: "error",
                errorMessage: "Analiz başarısız",
              }),
            );
          }
        }

        // Show results when done
        dispatch(setShowResultReceteNo(receteNo));
      } catch {
        dispatch(
          updateTask({
            groupId,
            taskId: "fetch",
            status: "error",
            errorMessage: "Reçete verileri alınamadı",
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
      (params: { receteNo: string; barkodlar: string[] }) => {
        handleDeeplink(params);
      },
    );
  }, [handleDeeplink]);
}
