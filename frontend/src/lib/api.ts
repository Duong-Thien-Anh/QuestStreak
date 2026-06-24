const DEFAULT_PRODUCTION_API_ORIGIN = "https://lunis-house-backend.onrender.com";

const configuredApiOrigin = import.meta.env.VITE_API_URL?.replace(/\/$/, "");

export const apiOrigin =
  configuredApiOrigin || (import.meta.env.PROD ? DEFAULT_PRODUCTION_API_ORIGIN : "");

export function apiUrl(path: string) {
  return `${apiOrigin}${path}`;
}
