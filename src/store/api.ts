import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL } from "@/lib/constants";

export interface ModelInfo {
  model: string;
  label: string;
  provider: "openai" | "gemini";
  pricing: { input: number; cachedInput: number; output: number };
}

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: API_BASE_URL }),
  endpoints: (builder) => ({
    getModels: builder.query<ModelInfo[], void>({
      query: () => "/report/models",
    }),
  }),
});

export const { useGetModelsQuery } = apiSlice;
