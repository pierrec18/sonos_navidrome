# Utilisation de l'image Node.js Alpine pour une taille réduite
FROM node:18-alpine

# Métadonnées
LABEL description="Service SMAPI Sonos pour Navidrome"
LABEL version="1.0"

# Définir le répertoire de travail
WORKDIR /app

# Installer les dépendances système nécessaires
RUN apk add --no-cache \
    curl \
    && rm -rf /var/cache/apk/*

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances Node.js
RUN npm ci --only=production && \
    npm cache clean --force

# Copier le code source
COPY src/ ./src/
COPY config/ ./config/

# Créer un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs && \
    adduser -S sonos -u 1001 -G nodejs

# Changer vers l'utilisateur non-root
USER sonos

# Exposer le port
EXPOSE 3000

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=3000

# Ajouter un healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Commande de démarrage
CMD ["node", "src/index.js"]