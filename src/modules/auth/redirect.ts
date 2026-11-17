// Where to go after logging in. The `next` value comes from the URL, so it is
// untrusted: only paths inside the app are accepted (no open redirect).

export const LOGIN_PATH = "/login";

export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) return "/";
  // "//host" and "/\host" are read by browsers as another site.
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value === LOGIN_PATH || value.startsWith(`${LOGIN_PATH}?`)) return "/";
  return value;
}
