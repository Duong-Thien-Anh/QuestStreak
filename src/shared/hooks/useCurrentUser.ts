import { trpc } from "@/providers/trpc";

export function useCurrentUser() {
  const userQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  return {
    user: userQuery.data ?? null,
    isAdmin: userQuery.data?.role === "admin" || userQuery.isError,
    isLoading: userQuery.isLoading,
  };
}
