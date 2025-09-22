class SmapiService {
  constructor(navidromeClient) {
    this.navidrome = navidromeClient;
  }

  async _getMetadata(args) {
    try {
      const { id, index = 0, count = 100 } = args;
      console.log(`📋 _getMetadata avec id: ${id}, index: ${index}, count: ${count}`);

      if (id === 'root') {
        return this.getRootMetadata();
      } else if (id === 'artists') {
        return await this.getArtistsMetadata(index, count);
      } else if (id === 'albums') {
        return await this.getAlbumsMetadata(index, count);
      } else if (id && id.startsWith('artist:')) {
        const artistId = id.replace('artist:', '');
        return await this.getArtistMetadata(artistId, index, count);
      } else if (id && id.startsWith('album:')) {
        const albumId = id.replace('album:', '');
        return await this.getAlbumMetadata(albumId, index, count);
      } else {
        throw new Error(`ID non reconnu: ${id}`);
      }
    } catch (error) {
      console.error('❌ Erreur _getMetadata:', error.message);
      return this.createErrorResponse(error.message);
    }
  }

  async _getExtendedMetadata(args) {
    try {
      const { id } = args;
      console.log(`📄 _getExtendedMetadata avec id: ${id}`);

      if (id && id.startsWith('track:')) {
        const trackId = id.replace('track:', '');
        const song = await this.navidrome.getSong(trackId);
        if (!song) {
          throw new Error(`Chanson non trouvée pour getExtendedMetadata: ${trackId}`);
        }
        return this.createTrackExtendedMetadata(song);
      } else if (id && id.startsWith('album:')) {
        const albumId = id.replace('album:', '');
        const album = await this.navidrome.getAlbum(albumId);
        if (!album) {
          throw new Error(`Album non trouvé pour getExtendedMetadata: ${albumId}`);
        }
        return this.createAlbumExtendedMetadata(album);
      } else if (id && id.startsWith('artist:')) {
        const artistId = id.replace('artist:', '');
        const artist = await this.navidrome.getArtist(artistId);
        if (!artist) {
          throw new Error(`Artiste non trouvé pour getExtendedMetadata: ${artistId}`);
        }
        return this.createArtistExtendedMetadata(artist);
      } else if (id === 'albums' || id === 'artists') {
        // Conteneurs racine - ne pas supporter getExtendedMetadata
        throw new Error(`getExtendedMetadata non supporté pour les conteneurs racine: ${id}`);
      } else {
        throw new Error(`ID non supporté pour getExtendedMetadata: ${id}`);
      }
    } catch (error) {
      console.error('❌ Erreur _getExtendedMetadata:', error.message);
      return this.createErrorResponse(error.message);
    }
  }

  async _getMediaURI(args) {
    try {
      const { id } = args;
      console.log(`🎵 _getMediaURI appelé avec id: ${id}`);
      
      if (!id || !id.startsWith('track:')) {
        throw new Error(`ID invalide pour getMediaURI: ${id}`);
      }

      const trackId = id.replace('track:', '');
      console.log(`🔍 Track ID extrait: ${trackId}`);

      // Vérifier que la chanson existe
      const song = await this.navidrome.getSong(trackId);
      if (!song) {
        console.error(`❌ Chanson non trouvée: ${trackId}`);
        throw new Error(`Chanson non trouvée: ${trackId}`);
      }

      console.log(`📀 Chanson trouvée: ${song.title} - ${song.artist}`);

      const streamUrl = this.navidrome.getStreamUrl(trackId);
      console.log(`🔗 URL de streaming générée: ${streamUrl}`);

      // Test d'accessibilité de l'URL en mode HEAD
      console.log(`🧪 Test d'accessibilité de l'URL de streaming...`);
      try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(streamUrl, { 
          method: 'HEAD',
          timeout: 5000,
          headers: {
            'User-Agent': 'SonosNavidromeBridge/1.0'
          }
        });
        
        console.log(`📊 Test URL - Status: ${response.status}`);
        console.log(`📊 Test URL - Content-Type: ${response.headers.get('content-type')}`);
        console.log(`📊 Test URL - Content-Length: ${response.headers.get('content-length')}`);
        
        if (!response.ok) {
          console.error(`❌ URL non accessible - Status: ${response.status}`);
          throw new Error(`URL de streaming non accessible - Status: ${response.status}`);
        }
        
        console.log(`✅ URL accessible !`);
      } catch (urlError) {
        console.error(`❌ Erreur test URL: ${urlError.message}`);
        // Ne pas faire échouer complètement, juste log l'erreur
      }

      console.log(`✅ Retour URL pour Sonos: ${streamUrl}`);

      const result = {
        getMediaURIResult: streamUrl
      };
      
      return result;
    } catch (error) {
      console.error('❌ Erreur _getMediaURI:', error.message);
      return this.createErrorResponse(error.message);
    }
  }

  async _getMediaMetadata(args) {
    try {
      const { id } = args;
      console.log(`🎼 _getMediaMetadata avec id: ${id}`);

      if (id && id.startsWith('track:')) {
        const trackId = id.replace('track:', '');
        const song = await this.navidrome.getSong(trackId);
        if (!song) {
          throw new Error(`Chanson non trouvée pour getMediaMetadata: ${trackId}`);
        }
        return this.createTrackMediaMetadata(song);
      } else {
        throw new Error(`ID non supporté pour getMediaMetadata: ${id}`);
      }
    } catch (error) {
      console.error('❌ Erreur _getMediaMetadata:', error.message);
      return this.createErrorResponse(error.message);
    }
  }

  // Métadonnées racine
  getRootMetadata() {
    return {
      getMetadataResult: {
        index: 0,
        count: 2,
        total: 2,
        mediaCollection: [
          {
            id: 'artists',
            itemType: 'container',
            title: 'Artistes',
            summary: 'Parcourir par artistes',
            albumArtURI: ''
          },
          {
            id: 'albums',
            itemType: 'albumList',
            title: 'Albums',
            summary: 'Parcourir par albums',
            albumArtURI: ''
          }
        ]
      }
    };
  }

  // Liste des artistes
  async getArtistsMetadata(index, count) {
    const artists = await this.navidrome.getArtists();
    const artistArray = artists.index || [];
    const flatArtists = artistArray.flatMap(idx => idx.artist || []);
    
    const slice = flatArtists.slice(index, index + count);
    
    return {
      getMetadataResult: {
        index,
        count: slice.length,
        total: flatArtists.length,
        mediaCollection: slice.map(artist => ({
          id: `artist:${artist.id}`,
          itemType: 'container',
          title: artist.name,
          summary: `${artist.albumCount || 0} albums`,
          albumArtURI: this.navidrome.getCoverArtUrl(artist.id) || ''
        }))
      }
    };
  }

  // Liste des albums
  async getAlbumsMetadata(index, count) {
    const albumList = await this.navidrome.getAlbumList('newest', count, index);
    const albums = albumList.album || [];
    
    return {
      getMetadataResult: {
        index,
        count: albums.length,
        total: albums.length + index, // Approximation
        mediaCollection: albums.map(album => ({
          id: `album:${album.id}`,
          itemType: 'album',
          title: album.name,
          artist: album.artist,
          summary: `${album.songCount || 0} pistes`,
          albumArtURI: this.navidrome.getCoverArtUrl(album.id) || '',
          canPlay: true,
          canAddToFavorites: true
        }))
      }
    };
  }

  // Albums d'un artiste
  async getArtistMetadata(artistId, index, count) {
    const artist = await this.navidrome.getArtist(artistId);
    const albums = artist.album || [];
    const slice = albums.slice(index, index + count);
    
    return {
      getMetadataResult: {
        index,
        count: slice.length,
        total: albums.length,
        mediaCollection: slice.map(album => ({
          id: `album:${album.id}`,
          itemType: 'album',
          title: album.name,
          artist: album.artist,
          summary: `${album.songCount || 0} pistes`,
          albumArtURI: this.navidrome.getCoverArtUrl(album.id) || '',
          canPlay: true,
          canAddToFavorites: true
        }))
      }
    };
  }

  // ⚠️ CORRECTION PRINCIPALE : Pistes d'un album
  async getAlbumMetadata(albumId, index, count) {
    const album = await this.navidrome.getAlbum(albumId);
    const songs = album.song || [];
    const slice = songs.slice(index, index + count);
    
    return {
      getMetadataResult: {
        index,
        count: slice.length,
        total: songs.length,
        // ⚠️ IMPORTANT : Pour les tracks, Sonos attend des objets directement dans mediaMetadata
        // avec les bonnes propriétés pour déclencher getMediaURI
        mediaMetadata: slice.map(song => ({
          id: `track:${song.id}`,
          title: song.title,
          mimeType: this.getMimeType(song.contentType || song.suffix),
          itemType: 'track',
          // ⚠️ trackMetadata doit contenir toutes les infos nécessaires
          trackMetadata: {
            albumId: `album:${album.id}`,
            duration: song.duration || 0,
            artistId: song.artistId ? `artist:${song.artistId}` : `artist:${album.artistId}`,
            artist: song.artist || album.artist,
            album: album.name,
            albumArtURI: this.navidrome.getCoverArtUrl(album.id) || '',
            // ⚠️ Ces flags sont CRITIQUES pour que Sonos déclenche getMediaURI
            canPlay: true,
            canSeek: true,
            canSkip: true,
            canAddToFavorites: true
          }
        }))
      }
    };
  }

  // Métadonnées média d'une piste
  createTrackMediaMetadata(song) {
    return {
      getMediaMetadataResult: {
        id: `track:${song.id}`,
        title: song.title,
        mimeType: this.getMimeType(song.contentType || song.suffix),
        itemType: 'track',
        trackMetadata: {
          albumId: song.albumId ? `album:${song.albumId}` : undefined,
          duration: song.duration || 0,
          artistId: song.artistId ? `artist:${song.artistId}` : undefined,
          artist: song.artist,
          album: song.album,
          albumArtURI: song.albumId ? this.navidrome.getCoverArtUrl(song.albumId) : '',
          // ⚠️ Flags critiques
          canPlay: true,
          canSeek: true,
          canSkip: true,
          canAddToFavorites: true
        }
      }
    };
  }

  // Métadonnées étendues d'une piste
  createTrackExtendedMetadata(song) {
    return {
      getExtendedMetadataResult: {
        mediaMetadata: {
          id: `track:${song.id}`,
          title: song.title,
          mimeType: this.getMimeType(song.contentType || song.suffix),
          itemType: 'track',
          trackMetadata: {
            albumId: song.albumId ? `album:${song.albumId}` : undefined,
            duration: song.duration || 0,
            artistId: song.artistId ? `artist:${song.artistId}` : undefined,
            artist: song.artist,
            album: song.album,
            albumArtURI: song.albumId ? this.navidrome.getCoverArtUrl(song.albumId) : '',
            // ⚠️ Flags critiques
            canPlay: true,
            canSeek: true,
            canSkip: true,
            canAddToFavorites: true
          }
        }
      }
    };
  }

  // Métadonnées étendues d'un artiste
  createArtistExtendedMetadata(artist) {
    return {
      getExtendedMetadataResult: {
        mediaCollection: {
          id: `artist:${artist.id}`,
          itemType: 'artist',
          title: artist.name,
          summary: `${artist.albumCount || 0} albums`,
          albumArtURI: this.navidrome.getCoverArtUrl(artist.id) || '',
          canPlay: false,
          canEnumerate: true,
          canAddToFavorites: true
        }
      }
    };
  }

  // Métadonnées étendues d'un album
  createAlbumExtendedMetadata(album) {
    return {
      getExtendedMetadataResult: {
        mediaCollection: {
          id: `album:${album.id}`,
          itemType: 'album',
          title: album.name,
          artist: album.artist,
          summary: `${album.songCount || 0} pistes`,
          albumArtURI: this.navidrome.getCoverArtUrl(album.id) || '',
          canPlay: true,
          canEnumerate: true,
          canAddToFavorites: true
        }
      }
    };
  }

  // Méthode de normalisation des types MIME améliorée
  getMimeType(contentTypeOrSuffix) {
    if (!contentTypeOrSuffix) {
      console.log(`🔧 Type MIME manquant → défaut: audio/mpeg`);
      return 'audio/mpeg';
    }

    // Si c'est une extension de fichier
    if (contentTypeOrSuffix.length <= 5 && !contentTypeOrSuffix.includes('/')) {
      const ext = contentTypeOrSuffix.toLowerCase().replace('.', '');
      switch (ext) {
        case 'mp3':
          return 'audio/mpeg';
        case 'flac':
          return 'audio/flac';
        case 'm4a':
        case 'mp4':
          return 'audio/mp4';
        case 'ogg':
          return 'audio/ogg';
        case 'wav':
          return 'audio/wav';
        default:
          console.log(`🔧 Extension non reconnue: ${ext} → défaut: audio/mpeg`);
          return 'audio/mpeg';
      }
    }

    // Normaliser les types MIME pour la compatibilité Sonos
    const normalizedType = contentTypeOrSuffix.toLowerCase();
    
    switch (normalizedType) {
      case 'audio/mp4':
      case 'audio/x-m4a':
      case 'audio/m4a':
        console.log(`🔧 Type MIME: ${contentTypeOrSuffix} → audio/mp4`);
        return 'audio/mp4';
      
      case 'audio/flac':
      case 'audio/x-flac':
        console.log(`🔧 Type MIME: ${contentTypeOrSuffix} → audio/flac`);
        return 'audio/flac';
      
      case 'audio/mpeg':
      case 'audio/mp3':
      case 'audio/x-mp3':
        console.log(`🔧 Type MIME: ${contentTypeOrSuffix} → audio/mpeg`);
        return 'audio/mpeg';
      
      case 'audio/ogg':
      case 'audio/x-ogg':
      case 'audio/vorbis':
        console.log(`🔧 Type MIME: ${contentTypeOrSuffix} → audio/ogg`);
        return 'audio/ogg';
      
      case 'audio/wav':
      case 'audio/x-wav':
      case 'audio/wave':
        console.log(`🔧 Type MIME: ${contentTypeOrSuffix} → audio/wav`);
        return 'audio/wav';
      
      default:
        console.log(`🔧 Type MIME non reconnu: ${contentTypeOrSuffix} → conservé tel quel`);
        return contentTypeOrSuffix;
    }
  }

  // Réponse d'erreur
  createErrorResponse(message) {
    return {
      fault: {
        faultcode: 'Server',
        faultstring: message
      }
    };
  }
}

module.exports = SmapiService;
