import express from "express";
import crypto from "crypto";
import { store } from "./store.js";
import { createNavidromeClient } from "../vendor/navidrome.js";
const router = express.Router();
const TOKEN_TTL_SECONDS = parseInt(process.env.TOKEN_TTL_SECONDS || "31536000", 10);
function randId(len = 32) {
    return crypto.randomBytes(len).toString("hex");
}
function allowedRedirect(uri) {
    if (!uri)
        return false;
    const allowed = (process.env.ALLOWED_REDIRECT_PREFIXES || "").split(",").map(s => s.trim()).filter(Boolean);
    if (allowed.length === 0)
        return true;
    return allowed.some(pref => uri.startsWith(pref));
}
router.get("/oauth/authorize", (req, res) => {
    const { client_id, redirect_uri, state } = req.query;
    if (!client_id || !redirect_uri) {
        return res.status(400).send("Missing client_id or redirect_uri");
    }
    if (!allowedRedirect(redirect_uri)) {
        return res.status(400).send("redirect_uri not allowed");
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><html><body>
  <h1>Lier votre instance Navidrome</h1>
  <form method="POST" action="/oauth/authorize">
    <input type="hidden" name="client_id" value="${String(client_id)}"/>
    <input type="hidden" name="redirect_uri" value="${String(redirect_uri)}"/>
    <input type="hidden" name="state" value="${String(state || "")}"/>
    <label>URL Navidrome: <input name="baseURL" type="url" required /></label>
    <label>User: <input name="user" required /></label>
    <label>Password: <input name="password" type="password" /></label>
    <div>ou Token+Salt:</div>
    <label>Token: <input name="token" /></label>
    <label>Salt: <input name="salt" /></label>
    <button>Autoriser Sonos</button>
  </form>
  </body></html>`);
});
router.post("/oauth/authorize", express.urlencoded({ extended: true }), async (req, res) => {
    const { client_id, redirect_uri, state, baseURL, user, password, token, salt } = req.body;
    if (!client_id || !redirect_uri)
        return res.status(400).send("Missing client_id or redirect_uri");
    if (!allowedRedirect(redirect_uri))
        return res.status(400).send("redirect_uri not allowed");
    if (!baseURL || !user)
        return res.status(400).send("Missing baseURL or user");
    let auth;
    if (password)
        auth = { kind: "password", password };
    else if (token && salt)
        auth = { kind: "token", token, salt };
    else
        return res.status(400).send("Provide password OR token+salt");
    try {
        const nd = createNavidromeClient({ baseURL, user, auth });
        await nd.listArtists();
    }
    catch (e) {
        return res.status(400).send("Failed to verify credentials with your Navidrome: " + (e.message || e));
    }
    const link = {
        id: randId(12),
        createdAt: Date.now(),
        baseURL,
        user,
        auth
    };
    store.saveLink(link);
    const code = randId(16) + "." + link.id;
    const url = new URL(redirect_uri);
    url.searchParams.set("code", code);
    if (state)
        url.searchParams.set("state", state);
    return res.redirect(url.toString());
});
router.post("/oauth/token", express.urlencoded({ extended: true }), (req, res) => {
    const { grant_type, code, client_id, client_secret } = req.body;
    if (grant_type !== "authorization_code")
        return res.status(400).json({ error: "unsupported_grant_type" });
    if (!code || typeof code !== "string" || !code.includes("."))
        return res.status(400).json({ error: "invalid_request" });
    if (process.env.OAUTH_CLIENT_ID && client_id && process.env.OAUTH_CLIENT_ID !== client_id)
        return res.status(400).json({ error: "invalid_client" });
    if (process.env.OAUTH_CLIENT_SECRET && client_secret && process.env.OAUTH_CLIENT_SECRET !== client_secret)
        return res.status(400).json({ error: "invalid_client" });
    const linkId = code.split(".").pop();
    const token = randId(24);
    const expiresAt = Date.now() + (TOKEN_TTL_SECONDS * 1000);
    store.saveToken({ token, linkId, expiresAt });
    return res.json({ token_type: "Bearer", access_token: token, expires_in: TOKEN_TTL_SECONDS });
});
router.post("/unlink", express.json(), (req, res) => {
    const { access_token } = req.body;
    if (!access_token)
        return res.status(400).json({ ok: false, error: "missing token" });
    store.revokeToken(access_token);
    res.json({ ok: true });
});
export default router;
