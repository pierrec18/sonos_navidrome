import { navidromeForToken, extractLoginToken } from "../auth/context.js";
function nowVersion() {
    return Math.floor(Date.now() / 1000);
}
function container(id, title) {
    return { id, itemType: "container", title, canEnumerate: true };
}
export function makeSmapiService() {
    return {
        MusicService: {
            MusicServiceSOAPPort: {
                async getLastUpdate(_, cb) {
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
                        const loginToken = extractLoginToken(headers, req);
                        const nd = navidromeForToken(loginToken);
                        const { id = "A:root", index = 0, count = 50 } = args || {};
                        let items = [];
                        if (id === "A:root") {
                            items = [
                                container("A:artists", "Artists"),
                            ];
                        }
                        else if (id === "A:artists") {
                            const artists = await nd.listArtists();
                            items = artists.map((a) => ({
                                id: `A:albums:${a.id}`,
                                itemType: "container",
                                title: a.name,
                                canEnumerate: true
                            }));
                        }
                        else if (id.startsWith("A:albums:")) {
                            const artistId = id.split(":").pop();
                            const albums = await nd.listAlbums(artistId);
                            items = albums.map((alb) => ({
                                id: `A:tracks:${alb.id}`,
                                itemType: "container",
                                title: alb.name,
                                canEnumerate: true
                            }));
                        }
                        else if (id.startsWith("A:tracks:")) {
                            const albumId = id.split(":").pop();
                            const tracks = await nd.listTracks(albumId);
                            items = tracks.map((t) => ({
                                id: `track:${t.id}`,
                                itemType: "track",
                                title: t.title,
                                artist: t.artist,
                                album: t.album,
                                albumArtURI: t.coverArt,
                                canPlay: true,
                                duration: Math.floor((t.duration || 0) / 1000)
                            }));
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
                        cb({ Fault: { faultcode: "Server", faultstring: e.message || "getMetadata failed" } });
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
                        cb({ Fault: { faultcode: "Server", faultstring: e.message || "getMediaMetadata failed" } });
                    }
                },
                async getMediaURI(args, cb, headers, req) {
                    try {
                        const loginToken = extractLoginToken(headers, req);
                        const nd = navidromeForToken(loginToken);
                        const { id } = args;
                        if (!id || !id.startsWith("track:")) {
                            return cb({ Fault: { faultcode: "Client", faultstring: "Invalid track id" } });
                        }
                        const trackId = id.split(":").pop();
                        const mediaUrl = await nd.streamUrl(trackId);
                        cb(null, { mediaUrl, httpHeaders: { "Content-Type": "audio/mpeg" } });
                    }
                    catch (e) {
                        cb({ Fault: { faultcode: "Server", faultstring: e.message || "getMediaURI failed" } });
                    }
                },
                async search(args, cb, headers, req) {
                    try {
                        const loginToken = extractLoginToken(headers, req);
                        const nd = navidromeForToken(loginToken);
                        const { term = "", index = 0, count = 50 } = args || {};
                        const results = await nd.search(term);
                        const items = [
                            ...results.tracks.map((t) => ({
                                id: `track:${t.id}`,
                                itemType: "track",
                                title: t.title,
                                artist: t.artist,
                                album: t.album,
                                albumArtURI: t.coverArt,
                                canPlay: true,
                                duration: Math.floor((t.duration || 0) / 1000)
                            }))
                        ];
                        const i = Number(index) || 0;
                        const c = Number(count) || 50;
                        const windowed = items.slice(i, i + c);
                        cb(null, { index: i, count: windowed.length, total: items.length, items: windowed });
                    }
                    catch (e) {
                        cb({ Fault: { faultcode: "Server", faultstring: e.message || "search failed" } });
                    }
                },
            }
        }
    };
}
