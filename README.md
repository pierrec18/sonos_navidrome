# Sonos Navidrome SMAPI Bridge

🎵 **Service de musique compatible Sonos SMAPI permettant d'accéder à votre instance Navidrome auto-hébergée directement depuis l'application Sonos.**

## ✨ Fonctionnalités

### 🔐 Authentification sécurisée
- **Account Linking OAuth** : Liaison sécurisée de votre instance Navidrome
- **Token/Salt auth** : Authentification Subsonic sécurisée (plus de mots de passe en clair)
- **Multi-utilisateurs** : Chaque utilisateur lie sa propre instance

### 🎶 Navigation complète
- **5 modes de navigation** :
  - Artists → Albums → Tracks
  - Albums (A–Z) → Tracks  
  - Albums (par date de sortie) → Tracks
  - Albums (récents) → Tracks
  - Playlists → Tracks

### 🔍 Recherche avancée
- Recherche simultanée dans artistes, albums et pistes
- Pagination conforme SMAPI
- Tri français intelligent (insensible casse/accents)

### 🎵 Streaming optimisé
- Support des **Range requests** (seek/pause/resume)
- URLs de streaming propres sans `f=json`
- Compatible HTTP 206 Partial Content

## 🚀 Installation

### Prérequis
- Node.js 18+
- Instance Navidrome fonctionnelle
- Domaine avec HTTPS (Let's Encrypt recommandé)

### 1. Clone et setup
```bash
git clone https://github.com/pierrec18/sonos_navidrome.git
cd sonos_navidrome
npm install
```

### 2. Configuration
Créez un fichier `.env` :
```env
# Port du service (défaut: 4000)
PORT=4000

# Répertoire des données (liens utilisateurs)
DATA_DIR=./data

# Clé de chiffrement pour les credentials stockés (32 chars)
ENCRYPTION_KEY=your-32-character-encryption-key-here

# TTL des tokens OAuth en secondes (défaut: 1 an)
TOKEN_TTL_SECONDS=31536000

# URLs de redirection autorisées (optionnel)
ALLOWED_REDIRECT_PREFIXES=https://your-domain.com

# Credentials OAuth pour validation client (optionnel)
OAUTH_CLIENT_ID=sonos-navidrome
OAUTH_CLIENT_SECRET=your-secret-key
```

### 3. Build et démarrage
```bash
# Build
npm run build

# Démarrage
npm start

# Ou en développement
npm run dev
```

### 4. Configuration reverse proxy

#### NGINX Proxy Manager
Dans l'onglet **Advanced** du Proxy Host :
```nginx
# Support Range requests pour streaming
proxy_set_header Range $http_range;
proxy_set_header If-Range $http_if_range;
proxy_force_ranges on;

# Streaming optimisé
proxy_request_buffering off;
proxy_buffering off;
proxy_http_version 1.1;

# Headers streaming
add_header Accept-Ranges bytes always;
proxy_set_header Connection "";
```

#### NGINX classique
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    # SSL config...
    
    location / {
        proxy_pass http://localhost:4000;
        
        # Headers de base
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Support Range requests
        proxy_set_header Range $http_range;
        proxy_set_header If-Range $http_if_range;
        proxy_force_ranges on;
        
        # Streaming optimisé
        proxy_request_buffering off;
        proxy_buffering off;
        proxy_http_version 1.1;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
```

### 5. Docker (optionnel)
```bash
# Build l'image
docker build -t sonos-navidrome .

# Lancement
docker run -d \
  --name sonos-navidrome \
  -p 4000:4000 \
  -v $(pwd)/data:/app/data \
  -e ENCRYPTION_KEY=your-key \
  sonos-navidrome
```

### 6. Configuration Sonos

1. **Ajout dans Sonos Developer** :
   - Créez un compte sur [Sonos Developer](https://developer.sonos.com)
   - Ajoutez votre service dans le Partner Dashboard
   - Configurez l'endpoint : `https://your-domain.com/smapi`

2. **Test local** :
   ```bash
   # Testez l'OAuth
   curl "https://your-domain.com/oauth/authorize?client_id=test&redirect_uri=https://your-domain.com/callback"
   
   # Testez SMAPI
   export TOKEN=your-oauth-token
   ./test.sh
   ```

## 🔧 Développement

### Structure du projet
```
src/
├── server.ts          # Serveur Express + SOAP
├── auth/              # Authentification OAuth
│   ├── oauth.ts       # Routes OAuth
│   ├── store.ts       # Stockage sécurisé
│   └── context.ts     # Résolution tokens
├── smapi/             # Handlers SMAPI
│   └── service.ts     # Logic browse/search/stream
├── vendor/            # Client Navidrome
│   └── navidrome.ts   # API Subsonic/OpenSubsonic
└── wsdl/              # WSDL SMAPI 1.1
    └── musicService.wsdl
```

### Scripts disponibles
```bash
npm run dev      # Développement avec ts-node
npm run build    # Compilation TypeScript
npm start        # Production
npm test         # Tests (via test.sh)
```

### Tests d'intégration
```bash
# Avec token OAuth
export TOKEN=your-oauth-token
./test.sh

# Avec terme de recherche personnalisé
./test.sh "beatles"
```

## 📋 API Endpoints

### OAuth
- `GET /oauth/authorize` - Page d'autorisation utilisateur
- `POST /oauth/authorize` - Validation credentials + redirect
- `POST /oauth/token` - Échange code → token
- `POST /unlink` - Révocation token

### SMAPI SOAP
- `POST /smapi` - Endpoint principal SMAPI
- `GET /wsdl` - WSDL de service

### Utilitaires
- `GET /` - Redirection vers authorization
- Toutes les routes avec HTTPS obligatoire en production

## 🔍 Troubleshooting

### Logs utiles
```bash
# Logs du service
tail -f logs/app.log

# Debugging SMAPI
DEBUG=1 ./test.sh
```

### Erreurs communes

**"Missing loginToken"**
- Vérifiez que l'OAuth fonctionne
- Testez `/oauth/authorize` manuellement

**"Invalid or expired loginToken"**
- Token expiré ou révoqué
- Relancez la liaison dans Sonos

**"Failed to verify credentials"**
- URL/credentials Navidrome incorrects
- Vérifiez la connectivité vers Navidrome

**Streaming ne fonctionne pas**
- Vérifiez la config NGINX Range requests
- Testez avec `curl -H "Range: bytes=0-1000"`

## 📚 Documentation

- [SMAPI Documentation](https://developer.sonos.com/build/content-service-add-on/)
- [Subsonic API](http://www.subsonic.org/pages/api.jsp)
- [Navidrome](https://www.navidrome.org/)

## 🤝 Contributing

Les contributions sont bienvenues ! Merci de :

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📝 License

Ce projet est sous licence MIT. Voir `LICENSE` pour plus de détails.

## 🎵 Crédits

Développé avec ❤️ pour la communauté Sonos + Navidrome.

- [Sonos](https://www.sonos.com/) pour l'API SMAPI
- [Navidrome](https://www.navidrome.org/) pour le serveur de musique
- Communauté open-source pour les outils et libs
