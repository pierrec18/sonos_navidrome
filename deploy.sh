#!/bin/bash

# 🚀 Script de déploiement Sonos-Navidrome pour serveur avec Portainer
# Usage: ./deploy.sh [serveur] [utilisateur]

set -e

SERVER=${1:-"votre-serveur.com"}
USER=${2:-"root"}
PROJECT_NAME="sonos_navidrome"

echo "🚀 Déploiement Sonos-Navidrome sur $SERVER"

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher les étapes
step() {
    echo -e "${GREEN}✓ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

error() {
    echo -e "${RED}✗ $1${NC}"
    exit 1
}

# Vérifier que les fichiers nécessaires existent
if [ ! -f "Dockerfile" ]; then
    error "Dockerfile non trouvé dans le répertoire courant"
fi

if [ ! -f "docker-compose.yml" ]; then
    error "docker-compose.yml non trouvé dans le répertoire courant"
fi

# Créer l'archive du projet
step "Création de l'archive du projet..."
tar -czf ${PROJECT_NAME}.tar.gz \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=*.log \
    --exclude=.env \
    .

# Transférer l'archive sur le serveur
step "Transfert des fichiers vers $SERVER..."
scp ${PROJECT_NAME}.tar.gz $USER@$SERVER:/tmp/

# Se connecter au serveur et déployer
step "Déploiement sur le serveur..."
ssh $USER@$SERVER << EOF
    set -e
    
    # Nettoyer l'ancien déploiement
    if [ -d "/opt/${PROJECT_NAME}" ]; then
        cd /opt/${PROJECT_NAME}
        docker-compose down 2>/dev/null || true
        cd /
        rm -rf /opt/${PROJECT_NAME}
    fi
    
    # Créer le répertoire de déploiement
    mkdir -p /opt/${PROJECT_NAME}
    cd /opt/${PROJECT_NAME}
    
    # Extraire l'archive
    tar -xzf /tmp/${PROJECT_NAME}.tar.gz
    rm /tmp/${PROJECT_NAME}.tar.gz
    
    # Créer le fichier .env s'il n'existe pas
    if [ ! -f ".env" ]; then
        echo "# Variables d'environnement pour Sonos-Navidrome" > .env
        echo "NAVIDROME_URL=https://your-navidrome.example.com" >> .env
        echo "NAVIDROME_USERNAME=admin" >> .env
        echo "NAVIDROME_PASSWORD=changeme" >> .env
        echo "SERVICE_URL=https://your-sonos-service.example.com" >> .env
        echo "PORT=3000" >> .env
        echo "NODE_ENV=production" >> .env
        echo ""
        echo "⚠ Fichier .env créé avec des valeurs par défaut."
        echo "⚠ Modifiez /opt/${PROJECT_NAME}/.env avec vos vraies valeurs !"
    fi
    
    # Construire et démarrer
    docker-compose up -d --build
    
    # Vérifier que le conteneur fonctionne
    sleep 5
    if docker-compose ps | grep -q "Up"; then
        echo "✅ Déploiement réussi !"
        echo "📋 Logs du conteneur :"
        docker-compose logs --tail=20
    else
        echo "❌ Erreur lors du déploiement"
        docker-compose logs
        exit 1
    fi
EOF

# Nettoyer
rm ${PROJECT_NAME}.tar.gz

step "Déploiement terminé !"
echo ""
echo "📝 Prochaines étapes :"
echo "1. Connectez-vous à votre serveur : ssh $USER@$SERVER"
echo "2. Éditez le fichier .env : nano /opt/${PROJECT_NAME}/.env"
echo "3. Redémarrez le service : cd /opt/${PROJECT_NAME} && docker-compose restart"
echo "4. Vérifiez les logs : docker-compose logs -f"
echo ""
echo "🌐 URL du service : http://$SERVER:3000"
echo "📊 Health check : http://$SERVER:3000/health"
echo "📋 Manifest Sonos : http://$SERVER:3000/manifest"