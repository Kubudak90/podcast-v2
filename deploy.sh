#!/bin/bash
set -e

# ============================================
# PodChat VPS Deployment Script
# ============================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   PodChat Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please copy .env.production.example to .env and fill in your values"
    exit 1
fi

# Load environment variables
source .env

# Validate required variables
REQUIRED_VARS=(
    "DOMAIN"
    "POSTGRES_PASSWORD"
    "JWT_SECRET"
    "LIVEKIT_API_KEY"
    "LIVEKIT_API_SECRET"
    "S3_ENDPOINT"
    "S3_ACCESS_KEY"
    "S3_SECRET_KEY"
    "S3_BUCKET"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}Error: $var is not set in .env${NC}"
        exit 1
    fi
done

echo -e "${GREEN}Environment variables validated${NC}"

# Function to update domain in nginx config
update_nginx_domain() {
    echo -e "${YELLOW}Updating nginx config with domain: $DOMAIN${NC}"
    sed -i "s/podchat.example.com/$DOMAIN/g" nginx/nginx.conf
    if [ -n "$LIVEKIT_DOMAIN" ]; then
        sed -i "s/livekit.podchat.example.com/$LIVEKIT_DOMAIN/g" nginx/nginx.conf
    fi
}

# Function to get SSL certificate
get_ssl_cert() {
    echo -e "${YELLOW}Getting SSL certificate...${NC}"

    # Use initial nginx config (HTTP only)
    cp nginx/nginx.initial.conf nginx/nginx.conf.bak
    cp nginx/nginx.initial.conf nginx/nginx.conf

    # Start services with HTTP only
    docker compose -f docker-compose.prod.yml up -d nginx

    # Get certificate
    docker compose -f docker-compose.prod.yml run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email admin@$DOMAIN \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN \
        -d $LIVEKIT_DOMAIN

    # Restore HTTPS nginx config
    cp nginx/nginx.conf.bak nginx/nginx.conf
    rm nginx/nginx.conf.bak

    # Update domain in config
    update_nginx_domain

    echo -e "${GREEN}SSL certificate obtained successfully${NC}"
}

# Function to setup database
setup_database() {
    echo -e "${YELLOW}Setting up database...${NC}"

    # Wait for postgres to be ready
    echo "Waiting for PostgreSQL..."
    sleep 10

    # Run prisma migrations
    docker compose -f docker-compose.prod.yml exec backend npx prisma db push

    echo -e "${GREEN}Database setup complete${NC}"
}

# Main deployment
case "${1:-deploy}" in
    deploy)
        echo -e "${YELLOW}Starting full deployment...${NC}"

        # Update nginx domain
        update_nginx_domain

        # Build and start services
        docker compose -f docker-compose.prod.yml build
        docker compose -f docker-compose.prod.yml up -d

        # Setup database
        sleep 15
        setup_database

        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}   Deployment Complete!${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        echo -e "Your app is now running at: ${GREEN}https://$DOMAIN${NC}"
        echo -e "LiveKit server: ${GREEN}wss://$LIVEKIT_DOMAIN${NC}"
        echo ""
        echo "Useful commands:"
        echo "  docker compose -f docker-compose.prod.yml logs -f     # View logs"
        echo "  docker compose -f docker-compose.prod.yml ps          # Check status"
        echo "  docker compose -f docker-compose.prod.yml restart     # Restart services"
        ;;

    ssl)
        echo -e "${YELLOW}Getting SSL certificate only...${NC}"
        get_ssl_cert
        ;;

    update)
        echo -e "${YELLOW}Updating application...${NC}"
        git pull
        docker compose -f docker-compose.prod.yml build backend frontend
        docker compose -f docker-compose.prod.yml up -d backend frontend
        echo -e "${GREEN}Update complete${NC}"
        ;;

    logs)
        docker compose -f docker-compose.prod.yml logs -f ${2:-}
        ;;

    stop)
        echo -e "${YELLOW}Stopping all services...${NC}"
        docker compose -f docker-compose.prod.yml down
        echo -e "${GREEN}All services stopped${NC}"
        ;;

    restart)
        echo -e "${YELLOW}Restarting services...${NC}"
        docker compose -f docker-compose.prod.yml restart ${2:-}
        echo -e "${GREEN}Restart complete${NC}"
        ;;

    db-migrate)
        echo -e "${YELLOW}Running database migrations...${NC}"
        docker compose -f docker-compose.prod.yml exec backend npx prisma db push
        echo -e "${GREEN}Migrations complete${NC}"
        ;;

    backup)
        echo -e "${YELLOW}Creating database backup...${NC}"
        BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
        docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > $BACKUP_FILE
        echo -e "${GREEN}Backup saved to: $BACKUP_FILE${NC}"
        ;;

    *)
        echo "Usage: $0 {deploy|ssl|update|logs|stop|restart|db-migrate|backup}"
        echo ""
        echo "Commands:"
        echo "  deploy      - Full deployment (build & start all services)"
        echo "  ssl         - Get SSL certificate from Let's Encrypt"
        echo "  update      - Pull latest code and rebuild app containers"
        echo "  logs [svc]  - View logs (optionally for specific service)"
        echo "  stop        - Stop all services"
        echo "  restart     - Restart all services"
        echo "  db-migrate  - Run database migrations"
        echo "  backup      - Create database backup"
        exit 1
        ;;
esac
