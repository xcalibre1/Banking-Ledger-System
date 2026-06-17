import { baseApi } from "@/app/api/baseApi";
import { TAG_TYPES } from "@/app/api/tags";
import type {
  ReverseResult,
  TransactionListResponse,
} from "@/shared/types";

interface ReverseTransactionRequest {
  transactionId: string;
  idempotencyKey: string;
}

export const transactionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTransactions: builder.query<TransactionListResponse, void>({
      query: () => "/transactions",
      providesTags: (result) =>
        result
          ? [
              ...result.transactions.map(({ id }) => ({
                type: TAG_TYPES.Transaction,
                id,
              })),
              { type: TAG_TYPES.Transaction, id: "LIST" },
            ]
          : [{ type: TAG_TYPES.Transaction, id: "LIST" }],
    }),
    reverseTransaction: builder.mutation<
      ReverseResult,
      ReverseTransactionRequest
    >({
      query: ({ transactionId, idempotencyKey }) => ({
        url: `/transactions/${transactionId}/reverse`,
        method: "POST",
        body: {},
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

export const {
  useGetTransactionsQuery,
  useReverseTransactionMutation,
} = transactionsApi;
