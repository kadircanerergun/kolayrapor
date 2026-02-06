import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Recete, ReceteOzet } from "@/types/recete";
import type { ReceteReportResponse } from "@/services/report-api";

interface SearchParams {
  startDate: string;
  endDate: string;
}

// receteNo → barkod → analysis result
type AnalizSonuclari = Record<string, Record<string, ReceteReportResponse>>;

interface BulkProgress {
  type: "verileriAl" | "analizEt";
  current: number;
  total: number;
  currentReceteNo: string;
}

interface SearchState {
  receteler: ReceteOzet[];
  loading: boolean;
  error: string | null;
  currentPage: number;
  selectedRecetes: string[];
  lastSearchParams: SearchParams | null;
  loadingRecete: string | null;
  detaylar: Record<string, Recete>;
  analizSonuclari: AnalizSonuclari;
  analyzingRecete: string | null;
  bulkProgress: BulkProgress | null;
}

const initialState: SearchState = {
  receteler: [],
  loading: false,
  error: null,
  currentPage: 1,
  selectedRecetes: [],
  lastSearchParams: null,
  loadingRecete: null,
  detaylar: {},
  analizSonuclari: {},
  analyzingRecete: null,
  bulkProgress: null,
};

const receteSlice = createSlice({
  name: "recete",
  initialState,
  reducers: {
    searchStarted(state, action: PayloadAction<SearchParams>) {
      state.loading = true;
      state.error = null;
      state.receteler = [];
      state.selectedRecetes = [];
      state.currentPage = 1;
      state.lastSearchParams = action.payload;
    },
    searchCompleted(state, action: PayloadAction<ReceteOzet[]>) {
      state.loading = false;
      state.receteler = action.payload;
      state.currentPage = 1;
    },
    searchFailed(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    setCurrentPage(state, action: PayloadAction<number>) {
      state.currentPage = action.payload;
    },
    toggleReceteSelection(state, action: PayloadAction<string>) {
      const receteNo = action.payload;
      const index = state.selectedRecetes.indexOf(receteNo);
      if (index === -1) {
        state.selectedRecetes.push(receteNo);
      } else {
        state.selectedRecetes.splice(index, 1);
      }
    },
    selectAllRecetes(state) {
      state.selectedRecetes = state.receteler.map((r) => r.receteNo);
    },
    clearReceteSelection(state) {
      state.selectedRecetes = [];
    },
    setLoadingRecete(state, action: PayloadAction<string | null>) {
      state.loadingRecete = action.payload;
    },
    detaylarLoaded(state, action: PayloadAction<Record<string, Recete>>) {
      state.detaylar = { ...state.detaylar, ...action.payload };
    },
    detayFetched(state, action: PayloadAction<Recete>) {
      state.detaylar[action.payload.receteNo] = action.payload;
    },
    setAnalyzingRecete(state, action: PayloadAction<string | null>) {
      state.analyzingRecete = action.payload;
    },
    analizCompleted(
      state,
      action: PayloadAction<{
        receteNo: string;
        sonuclar: Record<string, ReceteReportResponse>;
      }>,
    ) {
      state.analizSonuclari[action.payload.receteNo] = action.payload.sonuclar;
    },
    analizSonuclariLoaded(
      state,
      action: PayloadAction<Record<string, Record<string, ReceteReportResponse>>>,
    ) {
      for (const [receteNo, sonuclar] of Object.entries(action.payload)) {
        state.analizSonuclari[receteNo] = {
          ...state.analizSonuclari[receteNo],
          ...sonuclar,
        };
      }
    },
    setBulkProgress(state, action: PayloadAction<BulkProgress | null>) {
      state.bulkProgress = action.payload;
    },
    resetSearch() {
      return initialState;
    },
  },
});

export const {
  searchStarted,
  searchCompleted,
  searchFailed,
  setCurrentPage,
  toggleReceteSelection,
  selectAllRecetes,
  clearReceteSelection,
  setLoadingRecete,
  detaylarLoaded,
  detayFetched,
  setAnalyzingRecete,
  analizCompleted,
  analizSonuclariLoaded,
  setBulkProgress,
  resetSearch,
} = receteSlice.actions;

export default receteSlice.reducer;
