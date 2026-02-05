import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ReceteOzet } from "@/types/recete";

interface SearchParams {
  startDate: string;
  endDate: string;
}

interface SearchState {
  receteler: ReceteOzet[];
  loading: boolean;
  error: string | null;
  currentPage: number;
  selectedRecetes: string[];
  lastSearchParams: SearchParams | null;
  loadingRecete: string | null;
}

const initialState: SearchState = {
  receteler: [],
  loading: false,
  error: null,
  currentPage: 1,
  selectedRecetes: [],
  lastSearchParams: null,
  loadingRecete: null,
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
  resetSearch,
} = receteSlice.actions;

export default receteSlice.reducer;
