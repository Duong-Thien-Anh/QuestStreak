import { trpc } from "@/providers/trpc";

export function useCurrentUser() {
  const userQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
  const houseQuery = trpc.house.get.useQuery(undefined, {
    enabled: !!userQuery.data,
    retry: false,
    staleTime: 1000 * 60,
  });
  const currentMember =
    houseQuery.data?.members.find((member) => member.userId === userQuery.data?.id) ??
    null;
  const isDom =
    currentMember?.lifestyleRole === "dominant" ||
    currentMember?.lifestyleRole === "switch";
  const isRootAdmin = userQuery.data?.role === "admin";
  const isSub = currentMember?.lifestyleRole === "submissive";
  const isSwitch = currentMember?.lifestyleRole === "switch";

  return {
    user: userQuery.data ?? null,
    currentMember,
    isDom,
    isSub,
    isSwitch,
    isAdmin: isRootAdmin || isDom,
    isLoading: userQuery.isLoading || houseQuery.isLoading,
  };
}
