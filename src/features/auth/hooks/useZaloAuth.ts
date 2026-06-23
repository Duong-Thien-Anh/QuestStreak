import { useCallback, useMemo } from "react";
import { getAccessToken, getUserInfo } from "zmp-sdk/apis";
import { trpc } from "@/providers/trpc";

function isZaloMiniAppRuntime() {
  if (typeof window === "undefined") return false;
  const maybeZaloWindow = window as typeof window & {
    APP_ID?: unknown;
    zAppID?: unknown;
    ZaloJavaScriptInterface?: unknown;
  };
  return Boolean(
    maybeZaloWindow.APP_ID ||
      maybeZaloWindow.zAppID ||
      maybeZaloWindow.ZaloJavaScriptInterface
  );
}

export function useZaloAuth() {
  const utils = trpc.useUtils();
  const zaloLoginMutation = trpc.auth.zaloLogin.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      await utils.house.get.invalidate();
    },
  });

  const loginWithZalo = useCallback(async () => {
    const accessToken = await getAccessToken();
    await getUserInfo();
    await zaloLoginMutation.mutateAsync({ accessToken });
  }, [zaloLoginMutation]);

  return useMemo(
    () => ({
      isZaloMiniApp: isZaloMiniAppRuntime(),
      loginWithZalo,
      isLoading: zaloLoginMutation.isPending,
      error: zaloLoginMutation.error,
    }),
    [loginWithZalo, zaloLoginMutation.error, zaloLoginMutation.isPending]
  );
}
