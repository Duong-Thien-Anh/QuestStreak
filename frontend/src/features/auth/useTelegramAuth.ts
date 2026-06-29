import { useEffect, useRef } from "react";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/shared/store/useAppStore";

export function useTelegramAuth() {
  const attemptedRef = useRef(false);
  const mutation = trpc.auth.telegramLogin.useMutation({
    onSuccess(data) {
      useAppStore.getState().setAuthToken(data.token);
    },
    onError(error) {
      console.error("Telegram auth failed", error);
    },
  });

  useEffect(() => {
    if (attemptedRef.current || useAppStore.getState().authToken) {
      return;
    }

    const initData = window.Telegram?.WebApp?.initData?.trim() ?? "";
    if (!initData) {
      return;
    }

    attemptedRef.current = true;
    mutation.mutate({ initData });
  }, [mutation]);

  return {
    isLoading: mutation.isPending,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
  };
}
