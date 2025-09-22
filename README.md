# 🎵 Sonos-Navidrome Bridge

Un serveur SMAPI (Sonos Music API) qui permet d'intégrer votre serveur Navidrome avec vos appareils Sonos.

## 📋 Description

Ce projet crée un pont entre votre serveur musical Navidrome et l'écosystème Sonos, permettant de naviguer et de lire votre bibliothèque musicale directement depuis l'application Sonos.

### ✨ Fonctionnalités

- ✅ **Navigation par artistes et albums** - Parcourez votre collection musicale
- ✅ **Lecture de musique** - Streaming direct depuis Navidrome vers Sonos
- ✅ **Interface de test** - Interface web pour tester les fonctionnalités
- ✅ **Compatibilité SMAPI** - Implémentation complète de l'API Sonos
- ✅ **Mode bac à sable** - Configuration pour tests locaux

## 🚀 Installation

### Prérequis

- Node.js 16+ 
- Un serveur Navidrome accessible
- Accès réseau entre le serveur et vos appareils Sonos

### 1. Installation des dépendances

```bash
npm install
```

### 2. Configuration

Éditez le fichier `.env` avec vos paramètres Navidrome :

```env
```env
# Configuration Navidrome
NAVIDROME_URL=https://votre-instance-navidrome.com
NAVIDROME_USERNAME=votre_username
NAVIDROME_PASSWORD=votre_password

# Configuration du serveur SMAPI
PORT=3000
SERVICE_NAME=Navidrome Bridge
SERVICE_VERSION=1.0.0

# URL publique du service SMAPI (utilisée dans le WSDL)
# Cette URL doit être accessible par Sonos
SERVICE_URL=https://votre-domaine.com
```

# Mode de développement
NODE_ENV=development
DEBUG=true
```

### 3. Démarrage du serveur

```bash
# Mode développement (avec redémarrage automatique)
npm run dev

# Mode production
npm start
```

Le serveur sera accessible sur : `http://localhost:3000`

## 🧪 Tests

### Interface Web de Test

Ouvrez votre navigateur sur `http://localhost:3000` pour accéder à l'interface de test qui vous permet de :

- Vérifier l'état du service
- Tester la connexion à Navidrome
- Tester les endpoints SMAPI
- Visualiser les logs en temps réel

### Tests en ligne de commande

```bash
# Lancer la suite de tests
npm test
```

### Tests manuels avec cURL

```bash
# Test de santé
curl http://localhost:3000/health

# Test getMetadata root
curl -X POST http://localhost:3000/smapi \
  -H "Content-Type: text/xml" \
  -H 'SOAPAction: "http://www.sonos.com/Services/1.1#getMetadata"' \
  -d '<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <getMetadata xmlns="http://www.sonos.com/Services/1.1">
      <id>root</id>
      <index>0</index>
      <count>100</count>
    </getMetadata>
  </soap:Body>
</soap:Envelope>'
```

## 📡 Endpoints SMAPI

Le serveur implémente les endpoints SMAPI requis :

- **`getMetadata`** - Navigation dans le catalogue (artistes, albums, pistes)
- **`getExtendedMetadata`** - Métadonnées détaillées pour la vue Info
- **`getMediaURI`** - URL de streaming pour la lecture
- **`getMediaMetadata`** - Métadonnées pour la lecture
- **`getLastUpdate`** - Synchronisation avec Sonos

## 🏗️ Architecture

```
src/
├── index.js           # Serveur principal Express + SOAP
├── navidrome-client.js # Client pour l'API Subsonic/Navidrome
└── smapi-service.js   # Service SMAPI pour Sonos

config/
└── smapi.wsdl         # Définition WSDL du service SOAP

public/
└── index.html         # Interface web de test

test/
└── test-endpoints.js  # Scripts de test automatisés
```

## 🔧 Configuration pour Sonos

### Mode Bac à Sable (Développement)

1. **Serveur local** : Le serveur fonctionne sur `http://localhost:3000/smapi`
2. **Tests internes** : Utilisez l'interface web pour valider le fonctionnement
3. **Simulation Sonos** : Testez les requêtes SOAP manuellement

### Configuration Nginx Proxy Manager (Production)

Pour déployer en production avec un reverse proxy :

```nginx
# Configuration pour Nginx Proxy Manager
location /smapi {
    proxy_pass http://localhost:3000/smapi;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 📊 Monitoring

### Logs

Les logs du serveur incluent :
- Connexions Navidrome
- Requêtes SMAPI reçues
- Erreurs et performances
- État des endpoints

### Métriques

L'interface web affiche :
- État de santé du service
- Statut de connexion Navidrome
- Résultats des tests en temps réel
- Logs d'activité

## 🛠️ Développement

### Structure des IDs

Le système utilise des IDs préfixés pour organiser le contenu :

- `root` - Racine du service
- `artists` - Liste des artistes
- `albums` - Liste des albums
- `artist:123` - Artiste spécifique
- `album:456` - Album spécifique
- `track:789` - Piste spécifique

### Mapping Navidrome → SMAPI

| Navidrome (Subsonic) | SMAPI Sonos | Description |
|---------------------|-------------|-------------|
| `getArtists` | `getMetadata(artists)` | Liste des artistes |
| `getAlbumList2` | `getMetadata(albums)` | Liste des albums |
| `getArtist` | `getMetadata(artist:id)` | Albums d'un artiste |
| `getAlbum` | `getMetadata(album:id)` | Pistes d'un album |
| `stream` | `getMediaURI` | URL de streaming |

## 🚨 Dépannage

### Erreurs courantes

1. **Connexion Navidrome échouée**
   - Vérifiez l'URL, nom d'utilisateur et mot de passe
   - Testez l'accès direct à votre Navidrome

2. **Serveur SOAP inaccessible**
   - Vérifiez que le port 3000 est libre
   - Contrôlez les logs pour les erreurs de démarrage

3. **Données vides dans Sonos**
   - Vérifiez que votre Navidrome contient des médias
   - Consultez les logs pour les erreurs de mapping

### Debug

Activez le mode debug dans `.env` :
```env
NODE_ENV=development
DEBUG=true
```

## 📝 TODO

- [ ] Authentification Sonos (OAuth)
- [ ] Support des playlists
- [ ] Fonction de recherche
- [ ] Mise en cache intelligente
- [ ] Support multi-utilisateurs
- [ ] Métriques avancées

## 📄 Licence

MIT License - Voir le fichier LICENSE pour plus de détails.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir des issues ou des pull requests.
