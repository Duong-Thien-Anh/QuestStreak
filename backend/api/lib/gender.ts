export const supportedGenders = ["male", "female"] as const;

export type SupportedGender = (typeof supportedGenders)[number];

export function avatarForGender(gender: SupportedGender) {
  return gender === "male" ? "/avatars/admin.jpg" : "/avatars/sub.jpg";
}
