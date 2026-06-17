import { baseApi } from "@/app/api/baseApi";
import { TAG_TYPES } from "@/app/api/tags";
import type {
  Account,
  AccountsListResponse,
  CreateAccountRequest,
} from "@/shared/types";

export const accountsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAccounts: builder.query<AccountsListResponse, void>({
      query: () => "/accounts",
      providesTags: (result) =>
        result
          ? [
              ...result.accounts.map(({ id }) => ({
                type: TAG_TYPES.Account,
                id,
              })),
              { type: TAG_TYPES.Account, id: "LIST" },
            ]
          : [{ type: TAG_TYPES.Account, id: "LIST" }],
    }),
    createAccount: builder.mutation<Account, CreateAccountRequest>({
      query: (body) => ({
        url: "/accounts",
        method: "POST",
        body,
      }),
      invalidatesTags: [
        { type: TAG_TYPES.Account, id: "LIST" },
        { type: TAG_TYPES.Transaction, id: "LIST" },
      ],
    }),
  }),
});

export const { useGetAccountsQuery, useCreateAccountMutation } = accountsApi;
