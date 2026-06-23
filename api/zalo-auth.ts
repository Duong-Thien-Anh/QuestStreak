import { env } from "./lib/env";

type ZaloGraphPicture = {
  data?: {
    url?: string;
  };
};

type ZaloGraphProfile = {
  id?: string;
  name?: string;
  picture?: ZaloGraphPicture;
  error?: unknown;
};

export type VerifiedZaloProfile = {
  id: string;
  name: string | null;
  avatar: string | null;
};

export async function verifyZaloAccessToken(
  accessToken: string
): Promise<VerifiedZaloProfile> {
  const url = new URL(env.zaloOpenApiUrl);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("fields", "id,name,picture");

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Không thể xác thực Zalo access token");
  }

  const profile = (await response.json()) as ZaloGraphProfile;
  if (profile.error || !profile.id) {
    throw new Error("Zalo access token không hợp lệ");
  }

  return {
    id: profile.id,
    name: profile.name ?? null,
    avatar: profile.picture?.data?.url ?? null,
  };
}
