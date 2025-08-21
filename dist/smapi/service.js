import { navidromeForToken, extractLoginToken } from "../auth/context.js";
import * as nd from "../vendor/navidrome.js";
import { store } from "../auth/store.js";
function nowVersion() {
    return Math.floor(Date.now() / 1000);
}
function container(id, title) {
    return { id, itemType: "container", title, canEnumerate: true };
}
async function resolveLinkFromHeaders(headers, req) {
    const loginToken = extractLoginToken(headers, req);
    if (!loginToken)
        throw new Error("Missing loginToken");
    const tokenRec = store.findToken(loginToken);
    if (!tokenRec)
        throw new Error("Invalid or expired loginToken");
    const link = store.findLink(tokenRec.linkId);
    if (!link)
        throw new Error("Linked account not found");
    const auth = link.auth.kind === "password"
        ? { user: link.user, password: link.auth.password }
        : { user: link.user, token: link.auth.token, salt: link.auth.salt };
    return { baseURL: link.baseURL, auth };
}
function createFault(code, message) {
    return { Fault: { faultcode: code, faultstring: message } };
}
// Utils: URL cover & collator FR sensible aux accents mais tri basique
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
function coverArtUrl(baseURL, id, size = 300) {
    if (!id)
        return undefined;
    return `${baseURL}/rest/getCoverArt?id=${encodeURIComponent(id)}&v=1.16.1&c=sonos-smapi&format=jpg&size=${size}`;
}
function mapAlbumToContainer(a) {
    return {
        id: `A:tracks:${a.id}`,
        itemType: "container",
        title: a.name || a.title,
        artist: a.displayArtist || a.artist,
        albumArtURI: a.coverArt,
        canEnumerate: true,
    };
}
function computeReleaseSortKey(a) {
    // priorité à la vraie date, sinon l'année
    const d = (a.releaseDate?.iso && Date.parse(a.releaseDate.iso)) ||
        (a.originalReleaseDate?.iso && Date.parse(a.originalReleaseDate.iso)) ||
        (a.year ? Date.UTC(a.year, 0, 1) : 0);
    return Number.isFinite(d) ? d : 0;
}
export function makeSmapiService() {
    return {
        MusicService: {
            MusicServiceSOAPPort: {
                async getLastUpdate(_, cb, headers, req) {
                    // Debug log to verify SOAP server wiring and inbound headers
                    try {
                        const h = (headers || {});
                        const agent = req?.headers?.['user-agent'];
                        console.log('[SMAPI] getLastUpdate called', {
                            ua: agent,
                            hasHeaders: !!headers,
                            keys: h && typeof h === 'object' ? Object.keys(h) : []
                        });
                    }
                    catch { }
                    const resp = {
                        favorites: nowVersion(),
                        catalog: nowVersion(),
                        credentials: nowVersion(),
                        policies: nowVersion(),
                    };
                    cb(null, resp);
                },
                async getMetadata(args, cb, headers, req) {
                    try {
                        console.log("[SMAPI] getMetadata id=", args?.id);
                        const { baseURL, auth } = await resolveLinkFromHeaders(headers, req);
                        const { id = "A:root", index = 0, count = 50 } = args || {};
                        let items = [];
                        if (id === "A:root") {
                            items = [
                                { id: "A:artists", itemType: "container", title: "Artists", canEnumerate: true },
                                { id: "A:albums", itemType: "container", title: "Albums (A–Z)", canEnumerate: true },
                                { id: "A:albums:byRelease", itemType: "container", title: "Albums (par date de sortie)", canEnumerate: true },
                                { id: "A:albums:byAdded", itemType: "container", title: "Albums (par date d'ajout)", canEnumerate: true },
                                { id: "A:playlists", itemType: "container", title: "Playlists", canEnumerate: true },
                            ];
                        }
                        else if (id === "A:artists") {
                            const artistsData = await nd.getArtists(baseURL, auth);
                            const artists = (artistsData?.index || []).flatMap((idx) => idx.artist || []);
                            items = artists.map((a) => ({
                                id: `A:albums:${a.id}`,
                                itemType: "container",
                                title: a.name,
                                albumArtURI: nd.coverUrl(baseURL, a.coverArt),
                                canEnumerate: true
                            }));
                        }
                        else if (id === "A:albums") {
                            // Albums (A–Z) — pagination native via albumList2
                            const reqIndex = Number(args?.index ?? 0);
                            const reqCount = Math.min(200, Math.max(1, Number(args?.count ?? 50)));
                            const page = await nd.getAlbumList2(baseURL, auth, {
                                type: "alphabeticalByName",
                                size: reqCount,
                                offset: reqIndex,
                            });
                            const albums = (page?.albumList2?.album ?? []).map((a) => ({
                                ...mapAlbumToContainer(a),
                                albumArtURI: coverArtUrl(baseURL, a.coverArt),
                            }));
                            // Déjà A→Z via le backend; on peut re-trier localement par sûreté
                            albums.sort((a, b) => collator.compare(a.title || "", b.title || ""));
                            return cb(null, {
                                index: reqIndex,
                                count: albums.length,
                                total: page?.albumList2?.total ?? reqIndex + albums.length,
                                items: albums
                            });
                        }
                        else if (id === "A:albums:byAdded") {
                            // Albums (par date d'ajout) — backend "newest"
                            const reqIndex = Number(args?.index ?? 0);
                            const reqCount = Math.min(200, Math.max(1, Number(args?.count ?? 50)));
                            const page = await nd.getAlbumList2(baseURL, auth, {
                                type: "newest",
                                size: reqCount,
                                offset: reqIndex,
                            });
                            const albums = (page?.albumList2?.album ?? []).map((a) => ({
                                ...mapAlbumToContainer(a),
                                albumArtURI: coverArtUrl(baseURL, a.coverArt),
                            }));
                            return cb(null, {
                                index: reqIndex,
                                count: albums.length,
                                total: page?.albumList2?.total ?? reqIndex + albums.length,
                                items: albums
                            });
                        }
                        else if (id === "A:albums:byRelease") {
                            // Albums (par date de sortie) — tri local par releaseDate
                            const reqIndex = Number(args?.index ?? 0);
                            const reqCount = Math.min(200, Math.max(1, Number(args?.count ?? 50)));
                            // Récupère un gros lot puis trie localement (pour bibliothèques massives, considérer cache)
                            const SIZE = 5000;
                            const page = await nd.getAlbumList2(baseURL, auth, {
                                type: "alphabeticalByName",
                                size: SIZE,
                                offset: 0
                            });
                            const all = (page?.albumList2?.album ?? []);
                            const sorted = all
                                .map((a) => ({ _k: computeReleaseSortKey(a), a }))
                                .sort((x, y) => (y._k - x._k)) // récent → ancien
                                .map((x) => ({
                                ...mapAlbumToContainer(x.a),
                                albumArtURI: coverArtUrl(baseURL, x.a.coverArt),
                            }));
                            const slice = sorted.slice(reqIndex, reqIndex + reqCount);
                            return cb(null, {
                                index: reqIndex,
                                count: slice.length,
                                total: sorted.length,
                                items: slice
                            });
                        }
                        else if (id === "A:playlists") {
                            // Playlists (liste)
                            const reqIndex = Number(args?.index ?? 0);
                            const reqCount = Math.min(200, Math.max(1, Number(args?.count ?? 50)));
                            const resp = await nd.getPlaylists(baseURL, auth);
                            const pls = (resp?.playlists?.playlist ?? []).map((p) => ({
                                id: `PL:${p.id}`,
                                itemType: "container",
                                title: p.name,
                                albumArtURI: p.coverArt ? coverArtUrl(baseURL, p.coverArt) : undefined,
                                canEnumerate: true,
                            }));
                            // Tri A→Z par nom
                            pls.sort((a, b) => collator.compare(a.title || "", b.title || ""));
                            const slice = pls.slice(reqIndex, reqIndex + reqCount);
                            return cb(null, {
                                index: reqIndex,
                                count: slice.length,
                                total: pls.length,
                                items: slice
                            });
                        }
                        else if (id.startsWith("PL:")) {
                            // Détail d'une playlist → pistes
                            const plId = id.slice(3);
                            const reqIndex = Number(args?.index ?? 0);
                            const reqCount = Math.min(200, Math.max(1, Number(args?.count ?? 50)));
                            const resp = await nd.getPlaylist(baseURL, auth, plId);
                            const tracks = (resp?.playlist?.entry ?? []).map((t) => ({
                                id: `track:${t.id}`,
                                itemType: "track",
                                title: t.title,
                                artist: t.artist,
                                album: t.album,
                                albumArtURI: t.coverArt ? coverArtUrl(baseURL, t.coverArt) : undefined,
                                canPlay: true,
                                mimeType: t.contentType || "audio/mpeg",
                                duration: t.duration ? Math.round(t.duration) : undefined,
                            }));
                            const slice = tracks.slice(reqIndex, reqIndex + reqCount);
                            return cb(null, {
                                index: reqIndex,
                                count: slice.length,
                                total: tracks.length,
                                items: slice
                            });
                        }
                        else if (id.startsWith("A:albums:") && !id.includes(":by")) {
                            // Albums d'un artiste (anti-chrono) — amélioration avec computeReleaseSortKey
                            const artistId = String(id).slice("A:albums:".length);
                            const reqIndex = Number(args?.index ?? 0);
                            const reqCount = Math.min(200, Math.max(1, Number(args?.count ?? 50)));
                            const artist = await nd.getArtist(baseURL, auth, artistId);
                            // album peut être [], un seul objet, ou un tableau
                            let albumsRaw = artist?.album ?? [];
                            if (!Array.isArray(albumsRaw))
                                albumsRaw = albumsRaw ? [albumsRaw] : [];
                            const albums = albumsRaw
                                .map((a) => ({ _k: computeReleaseSortKey(a), a }))
                                .sort((x, y) => y._k - x._k) // récent → ancien
                                .map((x) => ({
                                ...mapAlbumToContainer(x.a),
                                albumArtURI: coverArtUrl(baseURL, x.a.coverArt),
                            }));
                            const slice = albums.slice(reqIndex, reqIndex + reqCount);
                            return cb(null, {
                                index: reqIndex,
                                count: slice.length,
                                total: albums.length,
                                items: slice
                            });
                        }
                        else if (id.startsWith("A:tracks:")) {
                            // A:tracks:<albumId> -> lister les pistes jouables de l'album
                            const albumId = String(id).slice("A:tracks:".length);
                            const index = Number(args?.index ?? 0);
                            const count = Math.min(200, Math.max(1, Number(args?.count ?? 50)));
                            const album = await nd.getAlbum(baseURL, auth, albumId);
                            const songs = Array.isArray(album?.song) ? album.song : [];
                            const slice = songs.slice(index, index + count);
                            const items = slice.map((t) => ({
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
                        }
                        else {
                            items = [];
                        }
                        const i = Number(index) || 0;
                        const c = Number(count) || 50;
                        const windowed = items.slice(i, i + c);
                        cb(null, { index: i, count: windowed.length, total: items.length, items: windowed });
                    }
                    catch (e) {
                        console.error("[SMAPI] getMetadata error", e);
                        cb(createFault("Server", e.message || "getMetadata failed"));
                    }
                },
                async getMediaMetadata(args, cb, headers, req) {
                    try {
                        const loginToken = extractLoginToken(headers, req);
                        const nd = navidromeForToken(loginToken);
                        const { id } = args;
                        if (!id || !id.startsWith("track:")) {
                            return cb(null, { itemType: "unknown", id, title: "Unknown" });
                        }
                        const trackId = id.split(":").pop();
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
                    }
                    catch (e) {
                        console.error("[SMAPI] getMediaMetadata error", e);
                        cb(createFault("Server", e.message || "getMediaMetadata failed"));
                    }
                },
                async getMediaURI(args, cb, headers, req) {
                    try {
                        const id = String(args?.id || "");
                        if (!id.startsWith("track:")) {
                            return cb(createFault("ItemNotFound", "invalid id"));
                        }
                        const songId = id.slice("track:".length);
                        const { baseURL, auth } = await resolveLinkFromHeaders(headers, req);
                        const mediaUrl = nd.streamUrl(baseURL, auth, songId);
                        cb(null, { mediaUrl });
                    }
                    catch (e) {
                        console.error("[SMAPI] getMediaURI error", e);
                        cb(createFault("InternalServerError", String(e?.message || e)));
                    }
                },
                async search(args, cb, headers, req) {
                    try {
                        const term = (args?.term || "").trim();
                        const reqIndex = Number(args?.index ?? 0);
                        const reqCount = Math.min(50, Math.max(1, Number(args?.count ?? 25)));
                        if (!term) {
                            return cb(null, { index: 0, count: 0, total: 0, items: [] });
                        }
                        const { baseURL, auth } = await resolveLinkFromHeaders(headers, req);
                        const results = await nd.searchAll(baseURL, auth, term, reqIndex + reqCount);
                        const items = [];
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
                        // Pagination conforme aux attentes Sonos
                        const total = items.length;
                        const windowed = items.slice(reqIndex, reqIndex + reqCount);
                        cb(null, {
                            index: reqIndex,
                            count: windowed.length,
                            total: total,
                            items: windowed
                        });
                    }
                    catch (e) {
                        console.error("[SMAPI] search error", e);
                        cb(createFault("InternalServerError", String(e?.message || e)));
                    }
                },
            }
        }
    };
}
