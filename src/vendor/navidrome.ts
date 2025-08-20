import axios from "axios";

export type AuthType = 
  | { kind: "password"; password: string }
  | { kind: "token"; token: string; salt: string };

export type NavidromeCreds = {
  baseURL: string;
  user: string;
  auth: AuthType;
};

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
