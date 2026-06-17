import { baseApi } from "@/app/api/baseApi";
import { TAG_TYPES } from "@/app/api/tags";
import type { TransferRequest, TransferResult } from "@/shared/types";

export const transfersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createTransfer: builder.mutation<TransferResult, TransferRequest>({
      query: ({ idempotencyKey, ...body }) => ({
        url: "/transfers",
        method: "POST",
        body,
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
      }),
      invalidatesTags: [
        { type: TAG_TYPES.Account, id: "LIST" },
        { type: TAG_TYPES.Transaction, id: "LIST" },
      ],
    }),
  }),
});

export const { useCreateTransferMutation } = transfersApi;
