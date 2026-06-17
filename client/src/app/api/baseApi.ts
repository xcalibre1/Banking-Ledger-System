import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { ApiErrorBody } from "../../shared/types";
import { TAG_TYPES } from "./tags";

const baseQuery = fetchBaseQuery({
  baseUrl: "/api/v1",
  prepareHeaders: (headers) => {
    headers.set("Content-Type", "application/json");
    return headers;
  },
});

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: async (args, api, extraOptions) => {
    const result = await baseQuery(args, api, extraOptions);
    if (result.error && "data" in result.error) {
      const data = result.error.data as ApiErrorBody | undefined;
      if (data?.error?.message) {
        return {
          ...result,
          error: {
            ...result.error,
            message: data.error.message,
          },
        };
      }
    }
    return result;
  },
  tagTypes: [TAG_TYPES.Account, TAG_TYPES.Transaction],
  endpoints: () => ({}),
});
