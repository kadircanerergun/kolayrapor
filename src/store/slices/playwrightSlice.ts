import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getPlaywrightAPI } from "@/utils/playwright-api-loader";
import {
  searchStarted,
  searchCompleted,
  searchFailed,
  setLoadingRecete,
  detaylarLoaded,
  detayFetched,
  setAnalyzingRecete,
  analizCompleted,
  analizSonuclariLoaded,
} from "./receteSlice";
import type { RootState } from "../index";
import type { Recete } from "@/types/recete";
import {
  getCachedDetails,
  cacheDetail,
  getCachedAnalysis,
  cacheAnalysisBatch,
} from "@/lib/db";
import {
  reportApiService,
  type ReceteReportResponse,
} from "@/services/report-api";

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
      const prescriptions = result.prescriptions || [];
      dispatch(searchCompleted(prescriptions));

      const receteNos = prescriptions.map((p: { receteNo: string }) => p.receteNo);
      const cached = await getCachedDetails(receteNos);
      if (Object.keys(cached).length > 0) {
        dispatch(detaylarLoaded(cached));
      }
      const cachedAnaliz = await getCachedAnalysis(receteNos);
      if (Object.keys(cachedAnaliz).length > 0) {
        dispatch(analizSonuclariLoaded(cachedAnaliz));
      }
    }

    return result;
  },
);

export const searchPrescriptionDetail = createAsyncThunk(
  "playwright/searchPrescriptionDetail",
  async (
    { receteNo, force = false }: { receteNo: string; force?: boolean },
    { dispatch },
  ) => {
    dispatch(setLoadingRecete(receteNo));
    try {
      if (!force) {
        const cached = await getCachedDetails([receteNo]);
        if (cached[receteNo]) {
          dispatch(detayFetched(cached[receteNo]));
          return cached[receteNo];
        }
      }

      const api = getPlaywrightAPI();
      const result = await api.searchPrescription(receteNo);

      if (!result.success) {
        throw new Error(result.error || "Prescription search failed");
      }

      const recete = result.prescriptionData as Recete;
      await cacheDetail(recete);
      dispatch(detayFetched(recete));
      return recete;
    } finally {
      dispatch(setLoadingRecete(null));
    }
  },
);

export const analyzePrescription = createAsyncThunk(
  "playwright/analyzePrescription",
  async (
    { receteNo, force = false }: { receteNo: string; force?: boolean },
    { dispatch, getState },
  ) => {
    dispatch(setAnalyzingRecete(receteNo));
    try {
      // 1. Check Dexie for cached analysis results (unless force)
      if (!force) {
        const cachedAnaliz = await getCachedAnalysis([receteNo]);
        if (cachedAnaliz[receteNo] && Object.keys(cachedAnaliz[receteNo]).length > 0) {
          dispatch(analizCompleted({ receteNo, sonuclar: cachedAnaliz[receteNo] }));
          return cachedAnaliz[receteNo];
        }
      }

      // 2. Get the prescription detail — from Redux state, Dexie cache, or Playwright
      let recete: Recete | undefined;
      const state = getState() as RootState;
      recete = state.recete.detaylar[receteNo];

      if (!recete) {
        const cached = await getCachedDetails([receteNo]);
        if (cached[receteNo]) {
          recete = cached[receteNo];
          dispatch(detayFetched(recete));
        }
      }

      if (!recete) {
        const api = getPlaywrightAPI();
        const result = await api.searchPrescription(receteNo);
        if (!result.success) {
          throw new Error(result.error || "Prescription search failed");
        }
        recete = result.prescriptionData as Recete;
        await cacheDetail(recete);
        dispatch(detayFetched(recete));
      }

      // 3. Run report analysis for each raporlu medicine
      const raporluIlaclar = (recete.ilaclar ?? []).filter((m) => m.raporluMu);
      const sonuclar: Record<string, ReceteReportResponse> = {};

      for (const ilac of raporluIlaclar) {
        const result = await reportApiService.generateReport(
          ilac.barkod,
          recete,
        );
        if (result.success && result.data) {
          sonuclar[ilac.barkod] = result.data;
        }
      }

      // 4. Save to Dexie and dispatch
      await cacheAnalysisBatch(receteNo, sonuclar);
      dispatch(analizCompleted({ receteNo, sonuclar }));
      return sonuclar;
    } finally {
      dispatch(setAnalyzingRecete(null));
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
