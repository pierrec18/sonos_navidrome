import axios from "axios";
function commonParams(user, auth) {
    const base = { u: user, v: "1.16.1", c: "sonos-smapi", f: "json" };
    if (auth.kind === "password")
        return { ...base, p: auth.password };
    return { ...base, t: auth.token, s: auth.salt };
}
function artUrl(baseURL, user, auth, coverId) {
    if (!coverId)
        return undefined;
    const params = new URLSearchParams({ ...commonParams(user, auth), id: coverId });
    return `${baseURL}/rest/getCoverArt?${params.toString()}`;
}
export function createNavidromeClient(creds) {
    const { baseURL, user, auth } = creds;
    return {
        async listArtists() {
            const params = new URLSearchParams(commonParams(user, auth));
            const url = `${baseURL}/rest/getArtists?${params.toString()}`;
            const { data } = await axios.get(url);
            const artists = (data?.subsonic_response?.artists?.index || [])
                .flatMap((idx) => idx.artist || []);
            return artists.map((a) => ({ id: String(a.id), name: a.name }));
        },
        async listAlbums(artistId) {
            const params = new URLSearchParams({ ...commonParams(user, auth), id: artistId });
            const url = `${baseURL}/rest/getArtist?${params.toString()}`;
            const { data } = await axios.get(url);
            const albums = data?.subsonic_response?.artist?.album || [];
            return albums.map((alb) => ({ id: String(alb.id), name: alb.name }));
        },
        async listTracks(albumId) {
            const params = new URLSearchParams({ ...commonParams(user, auth), id: albumId });
            const url = `${baseURL}/rest/getAlbum?${params.toString()}`;
            const { data } = await axios.get(url);
            const songs = data?.subsonic_response?.album?.song || [];
            return songs.map((s) => ({
                id: String(s.id),
                title: s.title,
                artist: s.artist,
                album: s.album,
                duration: s.duration ? Number(s.duration) * 1000 : undefined,
                coverArt: artUrl(baseURL, user, auth, s.coverArt)
            }));
        },
        async getTrack(trackId) {
            const params = new URLSearchParams({ ...commonParams(user, auth), id: trackId });
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
        async streamUrl(trackId) {
            const params = new URLSearchParams({ ...commonParams(user, auth), id: trackId, format: "mp3" });
            return `${baseURL}/rest/stream?${params.toString()}`;
        },
        async search(term) {
            const params = new URLSearchParams({ ...commonParams(user, auth), query: term, songCount: "50" });
            const url = `${baseURL}/rest/search2?${params.toString()}`;
            const { data } = await axios.get(url);
            const res = data?.subsonic_response?.searchResult2 || {};
            const tracks = (res.song || []).map((s) => ({
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
