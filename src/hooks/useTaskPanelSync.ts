import { useEffect, useRef } from "react";
import { useAppSelector, useAppDispatch } from "@/store";
import { removeGroup, setShowResultReceteNo } from "@/store/slices/taskQueueSlice";

const taskPanelAPI = (window as any).taskPanelAPI;

export function useTaskPanelSync() {
  const dispatch = useAppDispatch();
  const groups = useAppSelector((s) => s.taskQueue.groups);
  const bulkProgress = useAppSelector((s) => s.recete.bulkProgress);
  const prevJson = useRef("");

  // Send state updates to task panel window
  useEffect(() => {
    if (!taskPanelAPI) return;

    const state = { groups, bulkProgress };
    const json = JSON.stringify(state);
    if (json === prevJson.current) return;
    prevJson.current = json;

    console.log("[useTaskPanelSync] Sending state, groups:", groups.length, "bulk:", !!bulkProgress);
    taskPanelAPI.sendState(state);
  }, [groups, bulkProgress]);

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
