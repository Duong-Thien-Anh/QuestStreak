type TelegramWebApp = {
  initData?: string;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export type Platform = "web" | "telegram";

export const isTelegram = () => !!window.Telegram?.WebApp?.initData;

export const getPlatform = (): Platform => (isTelegram() ? "telegram" : "web");

export const getTelegramInitData = () =>
  window.Telegram?.WebApp?.initData ?? "";

