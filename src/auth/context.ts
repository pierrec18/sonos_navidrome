import { store } from "./store.js";
import { createNavidromeClient } from "../vendor/navidrome.js";

export function extractLoginToken(headers?: any, req?: any): string | undefined {
  if (!headers) headers = {};
  const h = headers || {};
  if (h.loginToken) return h.loginToken;
  if (h.token) return h.token;
  if (h.credentials && (h.credentials.loginToken || h.credentials.token)) {
    return h.credentials.loginToken || h.credentials.token;
  }
  const keys = Object.keys(h);
  for (const k of keys) {
    const v = (h as any)[k];
    if (v && typeof v === "object" && (v.loginToken || v.token)) {
      return v.loginToken || v.token;
    }
  }
  const auth = req?.headers?.authorization;
  if (auth && /^Bearer\s+/.test(auth)) return auth.replace(/^Bearer\s+/i, "");
  const xt = req?.headers?.["x-sonos-login-token"];
  if (xt && typeof xt === "string") return xt;
  return undefined;
}

export function navidromeForToken(loginToken?: string) {
  if (!loginToken) throw new Error("Missing loginToken");
  const tokenRec = store.findToken(loginToken);
  if (!tokenRec) throw new Error("Invalid or expired loginToken");
  const link = store.findLink(tokenRec.linkId);
  if (!link) throw new Error("Linked account not found");
  return createNavidromeClient({
    baseURL: link.baseURL,
    user: link.user,
    auth: link.auth
  });
}
