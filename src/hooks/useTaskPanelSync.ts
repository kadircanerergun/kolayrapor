import { useEffect, useRef } from "react";
import { useAppSelector, useAppDispatch } from "@/store";
import { removeGroup, setShowResultReceteNo } from "@/store/slices/taskQueueSlice";

const taskPanelAPI = (window as any).taskPanelAPI;

export function useTaskPanelSync() {
  const dispatch = useAppDispatch();
  const notification = useAppSelector((s) => s.taskQueue.notification);
  const prevJson = useRef("");

  // The separate top-right panel window is used only for the automated
  // (KA / deeplink) flow: push a single one-shot notification to it. The window
  // shows it for 3s and closes itself — no per-medicine progress is streamed.
  useEffect(() => {
    if (!taskPanelAPI) return;

    const state = { notification };
    const json = JSON.stringify(state);
    if (json === prevJson.current) return;
    prevJson.current = json;

    taskPanelAPI.sendState(state);
  }, [notification]);

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
