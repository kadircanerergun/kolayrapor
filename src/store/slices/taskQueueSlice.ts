import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface TaskItem {
  id: string;
  label: string;
  /**
   * `medicine` = tek bir ilacın kontrolü (id barkoddur), `step` = hazırlık
   * adımı ("Reçete verileri toplanıyor"). Panelde ilerleme ilaç sayısı
   * üzerinden gösterildiği için adımlar sayıma girmiyor; işaretlenmemiş
   * item'lar adım sayılır.
   */
  kind?: "step" | "medicine";
  status: "pending" | "running" | "done" | "error";
  errorMessage?: string;
  isValid?: boolean;
  validityScore?: number;
}

export interface TaskGroup {
  id: string;
  title: string;
  receteNo?: string;
  items: TaskItem[];
  createdAt: number;
}

/** Per-medicine outcome shown in the finished notification. */
export interface DeeplinkNotificationResult {
  barkod: string;
  label: string;
  /** Undefined when the medicine could not be analyzed. */
  validityScore?: number;
  failed?: boolean;
}

/** Notification for the top-right panel window driving an automated
 *  (KA / deeplink) check. `id` is unique per trigger so the panel re-shows
 *  even for the same prescription. It goes through two phases: `running`
 *  while the check runs, then `done` with the results — the `done` phase is
 *  the only thing the user sees when the main window is hidden in the tray. */
export interface DeeplinkNotification {
  id: string;
  receteNo: string;
  patientName: string;
  status: "running" | "done";
  /** Set when there is nothing to report (no raporlu medicine, fetch failed). */
  message?: string;
  results?: DeeplinkNotificationResult[];
}

interface TaskQueueState {
  groups: TaskGroup[];
  showResultReceteNo: string | null;
  notification: DeeplinkNotification | null;
}

const initialState: TaskQueueState = {
  groups: [],
  showResultReceteNo: null,
  notification: null,
};

const taskQueueSlice = createSlice({
  name: "taskQueue",
  initialState,
  reducers: {
    addGroup(state, action: PayloadAction<{ id: string; title: string; receteNo?: string; items: TaskItem[] }>) {
      // Remove existing group with same id to avoid duplicates
      state.groups = state.groups.filter((g) => g.id !== action.payload.id);
      state.groups.push({
        ...action.payload,
        createdAt: Date.now(),
      });
    },
    updateTask(
      state,
      action: PayloadAction<{
        groupId: string;
        taskId: string;
        status: TaskItem["status"];
        errorMessage?: string;
        isValid?: boolean;
        validityScore?: number;
      }>,
    ) {
      const group = state.groups.find((g) => g.id === action.payload.groupId);
      if (!group) return;
      const task = group.items.find((t) => t.id === action.payload.taskId);
      if (!task) return;
      task.status = action.payload.status;
      if (action.payload.errorMessage) {
        task.errorMessage = action.payload.errorMessage;
      }
      if (action.payload.isValid !== undefined) {
        task.isValid = action.payload.isValid;
      }
      if (action.payload.validityScore !== undefined) {
        task.validityScore = action.payload.validityScore;
      }
    },
    clearDeeplinkGroupsExcept(state, action: PayloadAction<string>) {
      state.groups = state.groups.filter(
        (g) => !g.id.startsWith("deeplink-") || g.receteNo === action.payload,
      );
    },
    removeGroup(state, action: PayloadAction<string>) {
      state.groups = state.groups.filter((g) => g.id !== action.payload);
    },
    clearCompleted(state) {
      state.groups = state.groups.filter((g) =>
        g.items.some((i) => i.status === "running" || i.status === "pending"),
      );
    },
    setShowResultReceteNo(state, action: PayloadAction<string | null>) {
      state.showResultReceteNo = action.payload;
    },
    setDeeplinkNotification(
      state,
      action: PayloadAction<DeeplinkNotification | null>,
    ) {
      state.notification = action.payload;
    },
  },
});

export const {
  addGroup,
  updateTask,
  removeGroup,
  clearCompleted,
  setShowResultReceteNo,
  clearDeeplinkGroupsExcept,
  setDeeplinkNotification,
} = taskQueueSlice.actions;
export default taskQueueSlice.reducer;
