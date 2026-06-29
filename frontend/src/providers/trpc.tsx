import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../../backend/api/router";
import type { ReactNode } from "react";
import { apiUrl } from "@/lib/api";
import { getPlatform } from "@/lib/platform";
import { useAppStore } from "@/shared/store/useAppStore";

/* eslint-disable react-refresh/only-export-components */

export const trpc = createTRPCReact<AppRouter>();

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: apiUrl("/api/trpc"),
      transformer: superjson,
      headers() {
        const platform = getPlatform();
        const token = useAppStore.getState().authToken;
        return {
          "X-Platform": platform,
          ...(platform === "telegram" && token
            ? { Authorization: `Bearer ${token}` }
            : {}),
        };
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
