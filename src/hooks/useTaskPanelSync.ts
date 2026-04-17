import { useEffect, useRef } from "react";
import { useAppSelector, useAppDispatch } from "@/store";
import { removeGroup, setShowResultReceteNo } from "@/store/slices/taskQueueSlice";

const taskPanelAPI = (window as any).taskPanelAPI;

export function useTaskPanelSync() {
  const dispatch = useAppDispatch();
  const groups = useAppSelector((s) => s.taskQueue.groups);
  const analizSonuclari = useAppSelector((s) => s.recete.analizSonuclari);
  const prevJson = useRef("");

  // Send only deeplink-triggered groups to the separate task panel window.
  // Merge validity from analizSonuclari so the task panel can render per-item
  // Uygun / Uygun Değil badges without needing its own redux access.
  useEffect(() => {
    if (!taskPanelAPI) return;

    const deeplinkGroups = groups
      .filter((g) => g.id.startsWith("deeplink-"))
      .map((g) => {
        const sonuclar = g.receteNo ? analizSonuclari[g.receteNo] : undefined;
        if (!sonuclar) return g;
        return {
          ...g,
          items: g.items.map((item) => {
            const report = sonuclar[item.id];
            if (!report) return item;
            return {
              ...item,
              isValid: item.isValid ?? report.isValid,
              validityScore: item.validityScore ?? report.validityScore,
            };
          }),
        };
      });
    const state = { groups: deeplinkGroups, bulkProgress: null };
    const json = JSON.stringify(state);
    if (json === prevJson.current) return;
    prevJson.current = json;

    console.log("[useTaskPanelSync] Sending deeplink state, groups:", deeplinkGroups.length);
    taskPanelAPI.sendState(state);
  }, [groups, analizSonuclari]);

  // Listen for actions from the task panel window
  useEffect(() => {
    if (!taskPanelAPI) return;

    taskPanelAPI.onAction((action: { type: string; payload?: any }) => {
      switch (action.type) {
        case "removeGroup":
          dispatch(removeGroup(action.payload));
          break;
        case "showResult":
          dispatch(setShowResultReceteNo(action.payload));
          break;
        case "retry":
          dispatch(removeGroup(action.payload.groupId));
          if (action.payload.receteNo) {
            window.dispatchEvent(
              new CustomEvent("kolayrapor:retry-analysis", {
                detail: { receteNo: action.payload.receteNo },
              }),
            );
          }
          break;
        case "bulkCancel":
          window.dispatchEvent(new CustomEvent("kolayrapor:bulk-cancel"));
          break;
        case "bulkForceStop":
          window.dispatchEvent(
            new CustomEvent("kolayrapor:bulk-force-stop"),
          );
          break;
      }
    });
  }, [dispatch]);
}
