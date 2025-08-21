# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet respecte le [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-08-21

### 🎉 Version initiale stable

### Ajouté
- **Service SMAPI complet** compatible Sonos SMAPI 1.1
- **Authentification OAuth sécurisée** avec account linking
- **5 modes de navigation** :
  - Artists → Albums → Tracks
  - Albums (A–Z) 
  - Albums (par date de sortie)
  - Albums (par date d'ajout)  
  - Playlists
- **Recherche avancée** (artistes, albums, pistes)
- **Streaming optimisé** avec support Range requests
- **Multi-utilisateurs** - chaque utilisateur lie sa propre instance Navidrome
- **Authentification Subsonic sécurisée** (token/salt vs password)
- **Tri français intelligent** avec Intl.Collator
- **Pagination SMAPI conforme** pour toutes les opérations
- **Docker support** avec Dockerfile optimisé
- **Configuration NGINX** pour reverse proxy
- **Tests d'intégration** automatisés (test.sh)
- **Documentation complète** d'installation et usage

### Sécurité
- Chiffrement AES-256-GCM des credentials stockés
- Authentification OAuth avec tokens expirables
- Validation des URLs de redirection
- Support token/salt Subsonic (plus de mots de passe en clair)

### Performance
- URLs de streaming sans `f=json` pour flux binaires
- Support HTTP 206 Partial Content pour seek/resume
- Pagination efficace via API Subsonic
- Cache-friendly avec headers appropriés

### Technique
- **Node.js 18+** avec TypeScript
- **Express.js** pour le serveur HTTP
- **node-soap** pour le service SOAP SMAPI
- **Axios** pour les appels API Navidrome/Subsonic
- **Architecture modulaire** (auth, smapi, vendor)
- **WSDL SMAPI 1.1** complet et valide
- **Client Subsonic/OpenSubsonic** robuste

### Documentation
- README complet avec guide d'installation
- Configuration NGINX pour Range requests
- Exemples Docker et docker-compose
- Guide de troubleshooting
- Tests d'intégration documentés

## [Unreleased]

### Prévu
- Support des favoris/ratings
- Cache intelligent pour gros catalogues
- Métriques et monitoring
- Support multi-instances Navidrome par utilisateur
