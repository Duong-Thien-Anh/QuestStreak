const configuredApiOrigin = import.meta.env.VITE_API_URL?.replace(/\/$/, "");

export const apiOrigin = configuredApiOrigin || "";

export function apiUrl(path: string) {
  return `${apiOrigin}${path}`;
}
