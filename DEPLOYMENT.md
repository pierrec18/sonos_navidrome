# 🚀 Déploiement Sonos-Navidrome avec Portainer

## Option 1 : Via Docker Compose dans Portainer (Recommandée)

### 1. Créer une Stack dans Portainer

1. Connectez-vous à votre interface Portainer
2. Allez dans **Stacks** > **Add stack**
3. Nommez votre stack : `sonos-navidrome`
4. Copiez le contenu du `docker-compose.yml` ci-dessous :

```yaml
version: '3.8'

services:
  sonos-navidrome:
    image: pierrec18/sonos-navidrome:latest
    container_name: sonos-navidrome
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - NAVIDROME_URL=https://your-navidrome.example.com
      - NAVIDROME_USERNAME=votre_username
      - NAVIDROME_PASSWORD=votre_password
      - SERVICE_URL=https://your-sonos-service.example.com
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  default:
    name: sonos-navidrome-network
```

### 2. Variables d'environnement à modifier

Modifiez ces variables dans le docker-compose.yml :
- `NAVIDROME_URL` : URL de votre instance Navidrome
- `NAVIDROME_USERNAME` : Nom d'utilisateur Navidrome
- `NAVIDROME_PASSWORD` : Mot de passe Navidrome
- `SERVICE_URL` : URL publique de votre service Sonos

### 3. Déployer la stack

1. Cliquez sur **Deploy the stack**
2. Portainer va télécharger l'image et créer le conteneur
3. Vérifiez les logs pour vous assurer que tout fonctionne

## Option 2 : Build local et déploiement

Si vous préférez builder l'image directement sur votre serveur :

### 1. Cloner le repository sur votre serveur

```bash
git clone https://github.com/pierrec18/sonos_navidrome.git
cd sonos_navidrome
```

### 2. Créer le fichier .env

```bash
cp .env.example .env
# Éditez le fichier .env avec vos valeurs
```

### 3. Dans Portainer

1. Allez dans **Stacks** > **Add stack**
2. Choisissez **Upload** et uploadez votre `docker-compose.yml`
3. Ou utilisez **Repository** et pointez vers votre repo GitHub

## Option 3 : Container individuel dans Portainer

### 1. Via l'interface Portainer

1. Allez dans **Containers** > **Add container**
2. Nom : `sonos-navidrome`
3. Image : `pierrec18/sonos-navidrome:latest`
4. **Port mapping** : `3000:3000`
5. **Environment variables** :
   ```
   NODE_ENV=production
   PORT=3000
   NAVIDROME_URL=https://your-navidrome.example.com
   NAVIDROME_USERNAME=votre_username
   NAVIDROME_PASSWORD=votre_password
   SERVICE_URL=https://your-sonos-service.example.com
   ```
6. **Restart policy** : `Unless stopped`
7. Cliquez sur **Deploy the container**

## Vérification du déploiement

Une fois déployé, vérifiez que le service fonctionne :

### 1. Logs du conteneur
Vérifiez les logs dans Portainer pour vous assurer que :
- La connexion à Navidrome réussit
- Le serveur SOAP démarre correctement

### 2. Test des endpoints
```bash
# Test de santé
curl http://votre-serveur:3000/health

# Test du manifest Sonos
curl http://votre-serveur:3000/manifest
```

### 3. Test avec le script de validation
Modifiez l'URL dans votre script de test et exécutez-le :
```bash
node testsonos.js
```

## Configuration reverse proxy (si nécessaire)

Si vous utilisez un reverse proxy (Nginx, Traefik, etc.), voici un exemple de configuration Nginx :

```nginx
server {
    listen 443 ssl;
    server_name your-sonos-service.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Mise à jour

Pour mettre à jour le service :

1. **Via Portainer** : 
   - Allez dans votre stack
   - Cliquez sur **Pull and redeploy**

2. **Manuellement** :
   ```bash
   docker pull pierrec18/sonos-navidrome:latest
   docker stop sonos-navidrome
   docker rm sonos-navidrome
   # Redéployez via Portainer
   ```

## Troubleshooting

### Logs utiles
```bash
# Via Docker CLI
docker logs sonos-navidrome -f

# Via Portainer
Containers > sonos-navidrome > Logs
```

### Erreurs courantes
- **Connexion Navidrome échoue** : Vérifiez les variables d'environnement
- **Port déjà utilisé** : Changez le port externe dans le docker-compose
- **SSL/TLS** : Assurez-vous que SERVICE_URL utilise HTTPS en production