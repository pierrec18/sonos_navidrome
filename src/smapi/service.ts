import { navidromeForToken, extractLoginToken } from "../auth/context.js";
import * as nd from "../vendor/navidrome.js";
import { store } from "../auth/store.js";

type LastUpdateResponse = {
  favorites?: number;
  catalog?: number;
  credentials?: number;
  policies?: number;
};

type Item = {
  id: string;
  itemType: string;
  title: string;
  artist?: string;
  album?: string;
  albumArtURI?: string;
  canPlay?: boolean;
  canEnumerate?: boolean;
  mimeType?: string;
  duration?: number;
};

function nowVersion(): number {
  return Math.floor(Date.now() / 1000);
}

function container(id: string, title: string): Item {
  return { id, itemType: "container", title, canEnumerate: true };
}

async function resolveLinkFromHeaders(headers: any, req?: any) {
  const loginToken = extractLoginToken(headers, req);
  if (!loginToken) throw new Error("Missing loginToken");
  
  const tokenRec = store.findToken(loginToken);
  if (!tokenRec) throw new Error("Invalid or expired loginToken");
  
  const link = store.findLink(tokenRec.linkId);
  if (!link) throw new Error("Linked account not found");
  
  const auth = link.auth.kind === "password" 
    ? { user: link.user, password: link.auth.password }
    : { user: link.user, token: link.auth.token, salt: link.auth.salt };
    
  return { baseURL: link.baseURL, auth };
}

function createFault(code: string, message: string) {
  return { Fault: { faultcode: code, faultstring: message }};
}

export function makeSmapiService() {
  return {
    MusicService: {
      MusicServiceSOAPPort: {
        async getLastUpdate(_: any, cb: Function, headers: any, req: any) {
          // Debug log to verify SOAP server wiring and inbound headers
          try {
            const h = (headers || {}) as any;
            const agent = req?.headers?.['user-agent'];
            console.log('[SMAPI] getLastUpdate called', {
              ua: agent,
              hasHeaders: !!headers,
              keys: h && typeof h === 'object' ? Object.keys(h) : []
            });
          } catch {}
          const resp: LastUpdateResponse = {
            favorites: nowVersion(),
            catalog: nowVersion(),
            credentials: nowVersion(),
            policies: nowVersion(),
          };
          cb(null, resp);
        },

        async getMetadata(args: any, cb: Function, headers: any, req: any) {
          try {
            console.log("[SMAPI] getMetadata id=", args?.id);
            const { baseURL, auth } = await resolveLinkFromHeaders(headers, req);
            const { id = "A:root", index = 0, count = 50 } = args || {};
            let items: Item[] = [];

            if (id === "A:root") {
              items = [
                container("A:artists", "Artists"),
              ];
            } else if (id === "A:artists") {
              const artistsData = await nd.getArtists(baseURL, auth);
              const artists = (artistsData?.index || []).flatMap((idx: any) => idx.artist || []);
              items = artists.map((a: any) => ({
                id: `A:albums:${a.id}`,
                itemType: "container",
                title: a.name,
                albumArtURI: nd.coverUrl(baseURL, a.coverArt),
                canEnumerate: true
              }));
            } else if (id.startsWith("A:albums:")) {
              const loginToken = extractLoginToken(headers, req);
              const ndClient = navidromeForToken(loginToken);
              const artistId = id.split(":").pop()!;
              const albums = await ndClient.listAlbums(artistId);
              items = albums.map((alb: any) => ({
                id: `A:tracks:${alb.id}`,
                itemType: "container",
                title: alb.name,
                albumArtURI: nd.coverUrl(baseURL, alb.coverArt),
                canEnumerate: true
              }));
            } else if (id.startsWith("A:tracks:")) {
              // A:tracks:<albumId> -> lister les pistes jouables de l'album
              const albumId = String(id).slice("A:tracks:".length);
              const index = Number(args?.index ?? 0);
              const count = Math.min(200, Math.max(1, Number(args?.count ?? 50)));

              const album = await nd.getAlbum(baseURL, auth, albumId);
              const songs = Array.isArray(album?.song) ? album.song : [];

              const slice = songs.slice(index, index + count);
              const items = slice.map((t: any) => ({
                id: `track:${t.id}`,
                itemType: "track",
                title: t.title,
                artist: t.artist,
                album: t.album,
                albumArtURI: nd.coverUrl(baseURL, t.coverArt),
                canPlay: true,
                mimeType: t.contentType || "audio/mpeg",
                duration: t.duration ? Math.round(t.duration) : undefined,
              }));

              return cb(null, { index, count: items.length, total: songs.length, items });
            } else {
              items = [];
            }

            const i = Number(index) || 0;
            const c = Number(count) || 50;
            const windowed = items.slice(i, i + c);
            cb(null, { index: i, count: windowed.length, total: items.length, items: windowed });
          } catch (e:any) {
            console.error("[SMAPI] getMetadata error", e);
            cb(createFault("Server", e.message || "getMetadata failed"));
          }
        },

        async getMediaMetadata(args: any, cb: Function, headers: any, req: any) {
          try {
            const loginToken = extractLoginToken(headers, req);
            const nd = navidromeForToken(loginToken);
            const { id } = args;
            if (!id || !id.startsWith("track:")) {
              return cb(null, { itemType: "unknown", id, title: "Unknown" });
            }
            const trackId = id.split(":").pop()!;
            const t = await nd.getTrack(trackId);
            cb(null, {
              id,
              itemType: "track",
              title: t.title,
              artist: t.artist,
              album: t.album,
              albumArtURI: t.coverArt,
              canPlay: true,
              duration: Math.floor((t.duration || 0) / 1000)
            });
          } catch (e:any) {
            console.error("[SMAPI] getMediaMetadata error", e);
            cb(createFault("Server", e.message || "getMediaMetadata failed"));
          }
        },

        async getMediaURI(args: any, cb: Function, headers: any, req: any) {
          try {
            const id = String(args?.id || "");
            if (!id.startsWith("track:")) {
              return cb(createFault("ItemNotFound", "invalid id"));
            }
            const songId = id.slice("track:".length);
            const { baseURL, auth } = await resolveLinkFromHeaders(headers, req);
            const mediaUrl = nd.streamUrl(baseURL, auth, songId);
            cb(null, { mediaUrl });
          } catch (e: any) {
            console.error("[SMAPI] getMediaURI error", e);
            cb(createFault("InternalServerError", String(e?.message || e)));
          }
        },

        async search(args: any, cb: Function, headers: any, req: any) {
          try {
            const term = (args?.term || "").trim();
            const index = Number(args?.index ?? 0);
            const count = Math.min(50, Math.max(1, Number(args?.count ?? 25)));

            if (!term) {
              return cb(null, { index: 0, count: 0, total: 0, items: [] });
            }

            const { baseURL, auth } = await resolveLinkFromHeaders(headers, req);
            const results = await nd.searchAll(baseURL, auth, term, index + count);

            const items: any[] = [];

            // Artistes -> conteneurs d'albums
            for (const a of results.artist || []) {
              items.push({
                id: `A:albums:${a.id}`,
                itemType: "container",
                title: a.name,
                albumArtURI: nd.coverUrl(baseURL, a.coverArt),
                canEnumerate: true,
              });
            }

            // Albums -> conteneurs de pistes
            for (const alb of results.album || []) {
              items.push({
                id: `A:tracks:${alb.id}`,
                itemType: "container",
                title: alb.title,
                artist: alb.artist,
                albumArtURI: nd.coverUrl(baseURL, alb.coverArt),
                canEnumerate: true,
              });
            }

            // Pistes -> items jouables
            for (const t of results.song || []) {
              items.push({
                id: `track:${t.id}`,
                itemType: "track",
                title: t.title,
                artist: t.artist,
                album: t.album,
                albumArtURI: nd.coverUrl(baseURL, t.coverArt),
                canPlay: true,
                mimeType: t.contentType || "audio/mpeg",
                duration: t.duration ? Math.round(t.duration) : undefined,
              });
            }

            const windowed = items.slice(index, index + count);
            cb(null, { index, count: windowed.length, total: items.length, items: windowed });
          } catch (e: any) {
            console.error("[SMAPI] search error", e);
            cb(createFault("InternalServerError", String(e?.message || e)));
          }
        },
      }
    }
  };
}
