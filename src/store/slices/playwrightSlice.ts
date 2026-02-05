import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getPlaywrightAPI } from "@/utils/playwright-api-loader";
import {
  searchStarted,
  searchCompleted,
  searchFailed,
  setLoadingRecete,
} from "./receteSlice";
import type { RootState } from "../index";
import type { Recete } from "@/types/recete";

interface PlaywrightState {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: PlaywrightState = {
  isReady: false,
  isLoading: false,
  error: null,
};

export const initializePlaywright = createAsyncThunk(
  "playwright/initialize",
  async (_, { getState }) => {
    const state = getState() as RootState;
    if (state.playwright.isReady) return;

    const api = getPlaywrightAPI();
    const result = await api.initialize();
    if (!result.success) {
      throw new Error(result.error || "Initialization failed");
    }
  },
);

export const searchByDateRange = createAsyncThunk(
  "playwright/searchByDateRange",
  async (
    { startDate, endDate }: { startDate: string; endDate: string },
    { dispatch, getState },
  ) => {
    dispatch(searchStarted({ startDate, endDate }));

    const state = getState() as RootState;
    if (!state.playwright.isReady) {
      const api = getPlaywrightAPI();
      const initResult = await api.initialize();
      if (!initResult.success) {
        dispatch(searchFailed(initResult.error || "Initialization failed"));
        throw new Error(initResult.error || "Initialization failed");
      }
    }

    const api = getPlaywrightAPI();
    const result = await api.searchByDateRange(startDate, endDate);

    if (result.error) {
      dispatch(searchFailed(result.error));
      throw new Error(result.error);
    }

    if (result.success) {
      dispatch(searchCompleted(result.prescriptions || []));
    }

    return result;
  },
);

export const searchPrescriptionDetail = createAsyncThunk(
  "playwright/searchPrescriptionDetail",
  async (receteNo: string, { dispatch }) => {
    dispatch(setLoadingRecete(receteNo));
    try {
      const api = getPlaywrightAPI();
      const result = await api.searchPrescription(receteNo);

      if (!result.success) {
        throw new Error(result.error || "Prescription search failed");
      }

      return result.prescriptionData as Recete;
    } finally {
      dispatch(setLoadingRecete(null));
    }
  },
);

const playwrightSlice = createSlice({
  name: "playwright",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(initializePlaywright.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(initializePlaywright.fulfilled, (state) => {
      state.isLoading = false;
      state.isReady = true;
    });
    builder.addCase(initializePlaywright.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.error.message || "Initialization failed";
    });

    builder.addCase(searchByDateRange.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(searchByDateRange.fulfilled, (state) => {
      state.isLoading = false;
      state.isReady = true;
    });
    builder.addCase(searchByDateRange.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.error.message || "Search failed";
    });
  },
});

export default playwrightSlice.reducer;
