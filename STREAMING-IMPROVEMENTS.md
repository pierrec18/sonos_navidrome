# Améliorations du Streaming Audio - Sonos SMAPI

## 🎯 Objectifs accomplis

### 1. **Authentification Subsonic sécurisée (token/salt)**
- ✅ Fonction `subsonicAuth()` : génère token MD5 + salt aléatoire
- ✅ Préfère `t=&s=` au lieu de `p=` (mot de passe en clair)
- ✅ Compatible Subsonic 1.13+ et Navidrome 1.16.1

### 2. **URLs de streaming optimisées**
- ✅ Endpoint `/rest/stream.view` au lieu de `/rest/stream`
- ✅ Suppression de `&f=json` (inutile pour flux binaire)
- ✅ URLs propres pour le player Sonos

### 3. **Support des Range requests**
- ✅ Configuration NGINX pour les requêtes de plage
- ✅ Support du seek/resume dans les pistes
- ✅ Réponses HTTP 206 (Partial Content)

## 🔧 Modifications techniques

### `src/vendor/navidrome.ts`
```typescript
// Nouvelle fonction d'auth sécurisée
export function subsonicAuth(user: string, plainPassword: string) {
  const s = crypto.randomBytes(6).toString("hex");
  const t = crypto.createHash("md5").update(plainPassword + s).digest("hex");
  return { user, t, s };
}

// URLs de streaming optimisées
export function streamUrl(baseURL: string, auth: Auth, songId: string) {
  // Utilise /rest/stream.view sans f=json
  // Préfère token/salt à password en clair
}
```

### Configuration NGINX (NPM)
```nginx
# À ajouter dans Proxy Host musique.crvsk.me - onglet Advanced
proxy_set_header Range $http_range;
proxy_set_header If-Range $http_if_range;
proxy_force_ranges on;
proxy_request_buffering off;
proxy_buffering off;
add_header Accept-Ranges bytes always;
```

## 🎵 Bénéfices utilisateur

1. **Sécurité renforcée** : Plus de mots de passe en clair dans les URLs
2. **Streaming fluide** : Support natif du seek/pause/resume
3. **Performance** : Requêtes de plage pour économiser la bande passante
4. **Compatibilité** : Conforme aux standards Subsonic modernes

## 📋 Prochaines étapes

1. **Déployer** le code sur le serveur distant
2. **Configurer NGINX** selon nginx-streaming.conf
3. **Tester** le streaming dans l'app Sonos
4. **Vérifier** les Range requests dans les logs
Mets ceci dans ton handler getMetadata (dans src/smapi/service.ts, là où tu traites déjà A:root, A:artists, etc.).
Les helpers supposent que tu as déjà une couche navidrome.* (OpenSubsonic).