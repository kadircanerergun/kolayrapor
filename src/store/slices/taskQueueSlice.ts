import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface TaskItem {
  id: string;
  label: string;
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

interface TaskQueueState {
  groups: TaskGroup[];
  showResultReceteNo: string | null;
}

const initialState: TaskQueueState = {
  groups: [],
  showResultReceteNo: null,
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
  },
});

export const {
  addGroup,
  updateTask,
  removeGroup,
  clearCompleted,
  setShowResultReceteNo,
  clearDeeplinkGroupsExcept,
} = taskQueueSlice.actions;
export default taskQueueSlice.reducer;
