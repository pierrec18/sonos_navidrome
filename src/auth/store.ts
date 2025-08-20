import fs from "fs";
import path from "path";
import crypto from "crypto";

export type AuthType = 
  | { kind: "password"; password: string }
  | { kind: "token"; token: string; salt: string };

export type LinkRecord = {
  id: string;
  createdAt: number;
  baseURL: string;
  user: string;
  auth: AuthType;
};

export type TokenRecord = {
  token: string;
  linkId: string;
  expiresAt: number;
};

const DATA_DIR = process.env.DATA_DIR || "./data";
const LINKS_FILE = path.join(DATA_DIR, "links.json");
const TOKENS_FILE = path.join(DATA_DIR, "tokens.json");

const ENC_KEY = (process.env.ENCRYPTION_KEY || "").padEnd(32, "0").slice(0,32);
const IV_LEN = 12;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(LINKS_FILE)) fs.writeFileSync(LINKS_FILE, "[]", "utf-8");
  if (!fs.existsSync(TOKENS_FILE)) fs.writeFileSync(TOKENS_FILE, "[]", "utf-8");
}

function enc(data: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(ENC_KEY), iv);
  const enc = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}
function dec(b64: string): string {
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN+16);
  const enc = buf.subarray(IV_LEN+16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(ENC_KEY), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

function readJson<T>(file: string): T {
  ensureDir();
  return JSON.parse(fs.readFileSync(file, "utf-8") || "[]");
}
function writeJson(file: string, data: any) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export const store = {
  saveLink(link: LinkRecord): void {
    const links: any[] = readJson<any[]>(LINKS_FILE);
    const toSave = {
      ...link,
      auth: link.auth.kind === "password"
        ? { kind: "password", password: enc(link.auth.password) }
        : { kind: "token", token: enc(link.auth.token), salt: enc(link.auth.salt) }
    };
    links.push(toSave);
    writeJson(LINKS_FILE, links);
  },

  findLink(id: string): LinkRecord | undefined {
    const links: any[] = readJson<any[]>(LINKS_FILE);
    const raw = links.find(l => l.id === id);
    if (!raw) return undefined;
    if (raw.auth.kind === "password") {
      raw.auth.password = dec(raw.auth.password);
    } else {
      raw.auth.token = dec(raw.auth.token);
      raw.auth.salt = dec(raw.auth.salt);
    }
    return raw as LinkRecord;
  },

  saveToken(tokenRec: TokenRecord): void {
    const tokens: TokenRecord[] = readJson<TokenRecord[]>(TOKENS_FILE);
    tokens.push(tokenRec);
    writeJson(TOKENS_FILE, tokens);
  },

  findToken(token: string): TokenRecord | undefined {
    const tokens: TokenRecord[] = readJson<TokenRecord[]>(TOKENS_FILE);
    return tokens.find(t => t.token === token && t.expiresAt > Date.now());
  },

  revokeToken(token: string): void {
    const tokens: TokenRecord[] = readJson<TokenRecord[]>(TOKENS_FILE);
    const next = tokens.filter(t => t.token !== token);
    writeJson(TOKENS_FILE, next);
  }
};
