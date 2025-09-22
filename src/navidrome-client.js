const axios = require('axios');
const crypto = require('crypto-js');
const https = require('https');

class NavidromeClient {
  constructor(config) {
    this.url = config.url;
    this.username = config.username;
    this.password = config.password;
    // Générer un salt fixe pour toute la session
    this.salt = this.generateSalt();
    this.token = crypto.MD5(this.password + this.salt).toString();
    
    console.log(`🔑 Navidrome credentials générées: salt=${this.salt}, token=${this.token.substring(0, 8)}...`);
    
    // Créer un agent HTTPS qui ignore les erreurs de certificat SSL
    const httpsAgent = new https.Agent({
      rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0', // Peut être désactivé via env
      secureProtocol: 'TLSv1_2_method' // Force TLS 1.2
    });
    
    this.client = axios.create({
      baseURL: `${this.url}/rest`,
      timeout: 10000,
      httpsAgent: httpsAgent,
      params: {
        u: this.username,
        t: this.token,
        s: this.salt,
        v: '1.16.1',
        c: 'SonosNavidromeBridge',
        f: 'json'
      }
    });
  }

  generateSalt() {
    return Math.random().toString(36).substring(2, 15);
  }

  async ping() {
    try {
      const response = await this.client.get('/ping');
      return response.data;
    } catch (error) {
      throw new Error(`Erreur ping Navidrome: ${error.message}`);
    }
  }

  async authenticate() {
    try {
      const response = await this.ping();
      if (response['subsonic-response'].status !== 'ok') {
        throw new Error('Authentification échouée');
      }
      return true;
    } catch (error) {
      throw new Error(`Authentification Navidrome échouée: ${error.message}`);
    }
  }

  async getArtists() {
    try {
      const response = await this.client.get('/getArtists');
      return response.data['subsonic-response'].artists;
    } catch (error) {
      throw new Error(`Erreur récupération artistes: ${error.message}`);
    }
  }

  async getArtist(id) {
    try {
      const response = await this.client.get('/getArtist', {
        params: { id }
      });
      return response.data['subsonic-response'].artist;
    } catch (error) {
      throw new Error(`Erreur récupération artiste ${id}: ${error.message}`);
    }
  }

  async getAlbum(id) {
    try {
      const response = await this.client.get('/getAlbum', {
        params: { id }
      });
      return response.data['subsonic-response'].album;
    } catch (error) {
      throw new Error(`Erreur récupération album ${id}: ${error.message}`);
    }
  }

  async getSong(id) {
    try {
      const response = await this.client.get('/getSong', {
        params: { id }
      });
      return response.data['subsonic-response'].song;
    } catch (error) {
      throw new Error(`Erreur récupération chanson ${id}: ${error.message}`);
    }
  }

  async getAlbumList(type = 'newest', size = 50, offset = 0) {
    try {
      const response = await this.client.get('/getAlbumList2', {
        params: { type, size, offset }
      });
      return response.data['subsonic-response'].albumList2;
    } catch (error) {
      throw new Error(`Erreur récupération liste albums: ${error.message}`);
    }
  }

  async search(query, artistCount = 20, albumCount = 20, songCount = 20) {
    try {
      const response = await this.client.get('/search3', {
        params: {
          query,
          artistCount,
          albumCount,
          songCount
        }
      });
      return response.data['subsonic-response'].searchResult3;
    } catch (error) {
      throw new Error(`Erreur recherche: ${error.message}`);
    }
  }

  async searchArtists(query, offset = 0, limit = 20) {
    try {
      const searchResult = await this.search(query, limit, 0, 0);
      return searchResult.artist || [];
    } catch (error) {
      throw new Error(`Erreur recherche artistes: ${error.message}`);
    }
  }

  async searchAlbums(query, offset = 0, limit = 20) {
    try {
      const searchResult = await this.search(query, 0, limit, 0);
      return searchResult.album || [];
    } catch (error) {
      throw new Error(`Erreur recherche albums: ${error.message}`);
    }
  }

  getStreamUrl(id) {
    return `${this.url}/rest/stream?u=${this.username}&t=${this.token}&s=${this.salt}&v=1.16.1&c=SonosNavidromeBridge&id=${id}`;
  }

  getCoverArtUrl(id, size = 300) {
    if (!id) return null;
    return `${this.url}/rest/getCoverArt?u=${this.username}&t=${this.token}&s=${this.salt}&v=1.16.1&c=SonosNavidromeBridge&id=${id}&size=${size}`;
  }
}

module.exports = NavidromeClient;
