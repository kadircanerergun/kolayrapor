import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector, TypedUseSelectorHook } from "react-redux";
import receteReducer from "./slices/receteSlice";
import playwrightReducer from "./slices/playwrightSlice";
import taskQueueReducer from "./slices/taskQueueSlice";
import { apiSlice } from "./api";

export const store = configureStore({
  reducer: {
    recete: receteReducer,
    playwright: playwrightReducer,
    taskQueue: taskQueueReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
