const express = require('express');
const soap = require('soap');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const NavidromeClient = require('./navidrome-client');
const SmapiService = require('./smapi-service');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour logger les requêtes SOAP
app.use('/smapi', (req, res, next) => {
  console.log('📦 Requête SOAP reçue:', {
    method: req.method,
    soapAction: req.headers.soapaction,
    userAgent: req.headers['user-agent']
  });
  next();
});

// Initialize clients
const navidromeClient = new NavidromeClient({
  url: process.env.NAVIDROME_URL,
  username: process.env.NAVIDROME_USERNAME,
  password: process.env.NAVIDROME_PASSWORD
});

const smapiService = new SmapiService(navidromeClient);

// En-têtes de sécurité requis par Sonos
app.use((req, res, next) => {
  res.set('X-Frame-Options', 'DENY');
  res.set('X-XSS-Protection', '1; mode=block');
  next();
});

// Routes essentielles
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString()
  });
});

// Endpoint manifest obligatoire pour tests Sonos
app.get('/manifest', (req, res) => {
  console.log('📋 Endpoint /manifest appelé');
  res.json({
    schemaVersion: '1.0',
    id: 'navidrome',
    displayName: 'Navidrome',
    capabilities: ['browse', 'search']
    // authentication: { type: 'oauth2' } // pour plus tard si nécessaire
  });
});

// Route WSDL dynamique
app.get('/wsdl', (req, res) => {
  try {
    const templatePath = path.join(__dirname, '../config/smapi.wsdl.template');
    let wsdlContent = fs.readFileSync(templatePath, 'utf8');
    
    // Remplacer le placeholder par l'URL du service
    const serviceUrl = process.env.SERVICE_URL || `http://localhost:${PORT}`;
    wsdlContent = wsdlContent.replace(/{{SERVICE_URL}}/g, serviceUrl);
    
    res.type('application/xml');
    res.send(wsdlContent);
  } catch (error) {
    console.error('❌ Erreur génération WSDL:', error.message);
    res.status(500).send('Erreur génération WSDL');
  }
});

// Middleware pour parser JSON dans les endpoints API
app.use(express.json());

// Endpoints API minimaux pour tests Sonos
app.post('/browse', (req, res) => {
  console.log('🔍 Endpoint /browse appelé avec:', req.body);
  const { id, index = 0, count = 50 } = req.body || {};
  if (!id) {
    return res.status(400).json({ error: "missing 'id'" });
  }
  res.json({ 
    items: [], 
    index: parseInt(index), 
    count: parseInt(count), 
    total: 0 
  });
});

app.post('/search', (req, res) => {
  console.log('🔎 Endpoint /search appelé avec:', req.body);
  const { term, index = 0, count = 50 } = req.body || {};
  if (!term) {
    return res.status(400).json({ error: "missing 'term'" });
  }
  res.json({ 
    items: [], 
    index: parseInt(index), 
    count: parseInt(count), 
    total: 0 
  });
});

app.post('/info', (req, res) => {
  console.log('ℹ️ Endpoint /info appelé avec:', req.body);
  const { id } = req.body || {};
  if (!id) {
    return res.status(400).json({ error: "missing 'id'" });
  }
  res.json({ 
    id, 
    type: 'track', 
    metadata: {} 
  });
});

app.post('/metadata', (req, res) => {
  console.log('📊 Endpoint /metadata appelé avec:', req.body);
  const { ids } = req.body || {};
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: "missing 'ids[]'" });
  }
  res.json({ 
    items: ids.map(id => ({ id, metadata: {} })) 
  });
});

// Endpoints optionnels pour éviter les 404
app.get('/presentationmap', (req, res) => {
  console.log('🗺️ Endpoint /presentationmap appelé');
  res.json({ 
    version: '1.0', 
    presentationMap: {} 
  });
});

app.get('/strings', (req, res) => {
  console.log('🔤 Endpoint /strings appelé');
  res.json({ 
    en: { play: 'Play', search: 'Search', browse: 'Browse' }, 
    fr: { play: 'Lire', search: 'Chercher', browse: 'Parcourir' } 
  });
});

// Route de test pour getMediaURI
app.get('/test-media-uri/:trackId', async (req, res) => {
  try {
    const { trackId } = req.params;
    console.log(`🧪 Test manuel getMediaURI pour track: ${trackId}`);
    const result = await smapiService._getMediaURI({ id: `track:${trackId}` });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Démarrer le serveur
app.listen(PORT, async () => {
  console.log(`🎵 Serveur SMAPI Sonos-Navidrome démarré sur le port ${PORT}`);
  console.log(`📁 Interface de test: http://localhost:${PORT}`);
  console.log(`🔗 Navidrome: ${process.env.NAVIDROME_URL}`);
  
  try {
    // Test de connexion à Navidrome
    await navidromeClient.authenticate();
    console.log('✅ Connexion à Navidrome réussie');
    
    // Service SOAP simplifié selon la documentation Sonos
    const soapService = {
      SonosAPI: {
        SonosAPIPort: {
          getLastUpdate: async (args) => {
            console.log('📅 getLastUpdate appelé', args);
            return {
              getLastUpdateResult: {
                catalog: Math.floor(Date.now() / 1000),
                favorites: Math.floor(Date.now() / 1000),
                pollInterval: 60
              }
            };
          },

          getMetadata: async (args) => {
            console.log('📋 getMetadata appelé avec:', JSON.stringify(args, null, 2));
            const result = await smapiService._getMetadata(args);
            console.log('📋 getMetadata retourne:', JSON.stringify(result, null, 2));
            return result;
          },

          getExtendedMetadata: async (args) => {
            console.log('📄 *** getExtendedMetadata APPELÉ *** avec:', JSON.stringify(args, null, 2));
            const result = await smapiService._getExtendedMetadata(args);
            console.log('📄 *** getExtendedMetadata RETOURNE *** :', JSON.stringify(result, null, 2));
            return result;
          },

          getMediaURI: async (args) => {
            console.log('🎵 *** getMediaURI APPELÉ *** avec:', JSON.stringify(args, null, 2));
            const result = await smapiService._getMediaURI(args);
            console.log('🎵 *** getMediaURI RETOURNE *** :', JSON.stringify(result, null, 2));
            return result;
          },

          getMediaMetadata: async (args) => {
            console.log('🎼 getMediaMetadata appelé avec:', JSON.stringify(args, null, 2));
            const result = await smapiService._getMediaMetadata(args);
            console.log('🎼 getMediaMetadata retourne:', JSON.stringify(result, null, 2));
            return result;
          }
        }
      }
    };
    
    // Démarrer le serveur SOAP
    // Générer le WSDL dynamiquement
    const templatePath = path.join(__dirname, '../config/smapi.wsdl.template');
    let xml = fs.readFileSync(templatePath, 'utf8');
    const serviceUrl = process.env.SERVICE_URL || `http://localhost:${PORT}`;
    xml = xml.replace(/{{SERVICE_URL}}/g, serviceUrl);
    soap.listen(app, '/smapi', soapService, xml);
    console.log('🧼 Serveur SOAP SMAPI démarré sur /smapi');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error.message);
  }
});

module.exports = app;