import axios from "axios";
import crypto from "crypto";

export type AuthType = 
  | { kind: "password"; password: string }
  | { kind: "token"; token: string; salt: string };

export type NavidromeCreds = {
  baseURL: string;
  user: string;
  auth: AuthType;
};

export function subsonicAuth(user: string, plainPassword: string) {
  const s = crypto.randomBytes(6).toString("hex");       // salt >= 6 chars
  const t = crypto.createHash("md5").update(plainPassword + s).digest("hex"); // t = md5(p+s)
  return { user, t, s };
}

function commonParams(user: string, auth: AuthType) {
  const base: any = { u: user, v: "1.16.1", c: "sonos-smapi", f: "json" };
  if (auth.kind === "password") return { ...base, p: auth.password };
  return { ...base, t: auth.token, s: auth.salt };
}

function artUrl(baseURL: string, user: string, auth: AuthType, coverId?: string) {
  if (!coverId) return undefined;
  const params = new URLSearchParams({ ...commonParams(user, auth) as any, id: coverId });
  return `${baseURL}/rest/getCoverArt?${params.toString()}`;
}

// --- Navidrome client helpers ---

type Auth = { user?: string; password?: string; token?: string; salt?: string };

function applyAuth(u: URL, auth: Auth) {
  u.searchParams.set("v", "1.16.1");
  u.searchParams.set("c", "sonos-smapi");
  u.searchParams.set("f", "json");
  if (auth.token && auth.salt) {
    if (auth.user) u.searchParams.set("u", auth.user);
    u.searchParams.set("t", auth.token);
    u.searchParams.set("s", auth.salt);
  } else {
    if (auth.user) u.searchParams.set("u", auth.user);
    if (auth.password) u.searchParams.set("p", auth.password);
  }
}

export function coverUrl(baseURL: string, coverId?: string) {
  if (!coverId) return undefined;
  const u = new URL("/rest/getCoverArt", baseURL);
  u.searchParams.set("id", coverId);
  u.searchParams.set("v", "1.16.1");
  u.searchParams.set("c", "sonos-smapi");
  u.searchParams.set("format", "jpg");
  return u.toString();
}

export async function searchAll(baseURL: string, auth: Auth, term: string, count = 25) {
  const per = Math.max(1, Math.floor(count / 3)); // artistes/albums/songs
  const url = new URL("/rest/search2", baseURL);
  url.searchParams.set("query", term);
  url.searchParams.set("artistCount", String(per));
  url.searchParams.set("albumCount", String(per));
  url.searchParams.set("songCount", String(per));
  applyAuth(url, auth);

  const { data } = await axios.get(url.toString(), { timeout: 10000 });
  return data?.["subsonic-response"]?.searchResult2 || {};
}

export async function getArtists(baseURL: string, auth: Auth) {
  const url = new URL("/rest/getArtists", baseURL);
  applyAuth(url, auth);
  const { data } = await axios.get(url.toString(), { timeout: 10000 });
  return data?.["subsonic-response"]?.artists ?? {};
}

export async function getArtist(baseURL: string, auth: Auth, artistId: string) {
  const url = new URL("/rest/getArtist", baseURL);
  url.searchParams.set("id", artistId);
  applyAuth(url, auth);
  const { data } = await axios.get(url.toString(), { timeout: 10000 });
  return data?.["subsonic-response"]?.artist ?? {};
}

export async function getAlbum(baseURL: string, auth: Auth, albumId: string) {
  const url = new URL("/rest/getAlbum", baseURL);
  url.searchParams.set("id", albumId);
  applyAuth(url, auth);
  const { data } = await axios.get(url.toString(), { timeout: 10000 });
  return data?.["subsonic-response"]?.album ?? {};
}

export function streamUrl(baseURL: string, auth: Auth, songId: string) {
  const u = new URL("/rest/stream.view", baseURL);
  u.searchParams.set("id", songId);
  u.searchParams.set("v", "1.16.1");
  u.searchParams.set("c", "sonos-smapi");
  
  // Utilise l'authentification token/salt si disponible, sinon password
  if (auth.token && auth.salt) {
    if (auth.user) u.searchParams.set("u", auth.user);
    u.searchParams.set("t", auth.token);
    u.searchParams.set("s", auth.salt);
  } else if (auth.user && auth.password) {
    // Génère token/salt pour une auth plus sécurisée
    const { t, s } = subsonicAuth(auth.user, auth.password);
    u.searchParams.set("u", auth.user);
    u.searchParams.set("t", t);
    u.searchParams.set("s", s);
  }
  
  return u.toString();
}

export function createNavidromeClient(creds: NavidromeCreds) {
  const { baseURL, user, auth } = creds;

  return {
    async listArtists() {
      const params = new URLSearchParams(commonParams(user, auth) as any);
      const url = `${baseURL}/rest/getArtists?${params.toString()}`;
      const { data } = await axios.get(url);
      const artists = (data?.subsonic_response?.artists?.index || [])
        .flatMap((idx:any) => idx.artist || []);
      return artists.map((a:any) => ({ id: String(a.id), name: a.name }));
    },

    async listAlbums(artistId: string) {
      const params = new URLSearchParams({ ...(commonParams(user, auth) as any), id: artistId });
      const url = `${baseURL}/rest/getArtist?${params.toString()}`;
      const { data } = await axios.get(url);
      const albums = data?.subsonic_response?.artist?.album || [];
      return albums.map((alb:any) => ({ id: String(alb.id), name: alb.name }));
    },

    async listTracks(albumId: string) {
      const params = new URLSearchParams({ ...(commonParams(user, auth) as any), id: albumId });
      const url = `${baseURL}/rest/getAlbum?${params.toString()}`;
      const { data } = await axios.get(url);
      const songs = data?.subsonic_response?.album?.song || [];
      return songs.map((s:any) => ({
        id: String(s.id),
        title: s.title,
        artist: s.artist,
        album: s.album,
        duration: s.duration ? Number(s.duration) * 1000 : undefined,
        coverArt: artUrl(baseURL, user, auth, s.coverArt)
      }));
    },

    async getTrack(trackId: string) {
      const params = new URLSearchParams({ ...(commonParams(user, auth) as any), id: trackId });
      const url = `${baseURL}/rest/getSong?${params.toString()}`;
      const { data } = await axios.get(url);
      const s = data?.subsonic_response?.song;
      return {
        id: String(s.id),
        title: s.title,
        artist: s.artist,
        album: s.album,
        duration: s.duration ? Number(s.duration) * 1000 : undefined,
        coverArt: artUrl(baseURL, user, auth, s.coverArt)
      };
    },

    async streamUrl(trackId: string) {
      const params = new URLSearchParams({ ...(commonParams(user, auth) as any), id: trackId, format: "mp3" });
      return `${baseURL}/rest/stream?${params.toString()}`;
    },

    async search(term: string) {
      const params = new URLSearchParams({ ...(commonParams(user, auth) as any), query: term, songCount: "50" });
      const url = `${baseURL}/rest/search2?${params.toString()}`;
      const { data } = await axios.get(url);
      const res = data?.subsonic_response?.searchResult2 || {};
      const tracks = (res.song || []).map((s:any) => ({
        id: String(s.id),
        title: s.title,
        artist: s.artist,
        album: s.album,
        duration: s.duration ? Number(s.duration) * 1000 : undefined,
        coverArt: artUrl(baseURL, user, auth, s.coverArt)
      }));
      return { tracks };
    }
  };
}
