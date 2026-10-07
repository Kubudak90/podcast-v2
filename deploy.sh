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

# sed replacement delimiter is "|". Escape "\" and "&" so a domain is literal.
escape_sed_repl() {
    printf '%s' "$1" | sed -e 's/[\\&]/\\&/g'
}

# Longer host first. "livekit.podchat.example.com" contains "podchat.example.com";
# replacing the short name first turns the LiveKit vhost into "livekit.$DOMAIN".
apply_nginx_domains() {
    local file="$1"

    if [ -z "${DOMAIN:-}" ]; then
        echo "DOMAIN is not set" >&2
        return 1
    fi

    if [ -n "${LIVEKIT_DOMAIN:-}" ]; then
        sed -i "s|livekit.podchat.example.com|$(escape_sed_repl "$LIVEKIT_DOMAIN")|g" "$file"
    fi
    sed -i "s|podchat.example.com|$(escape_sed_repl "$DOMAIN")|g" "$file"
}

# Function to update domain in nginx config
update_nginx_domain() {
    local file="${1:-nginx/nginx.conf}"
    echo -e "${YELLOW}Updating nginx config with domain: $DOMAIN${NC}"
    apply_nginx_domains "$file"
}

# Set while the HTTPS config is swapped out for the HTTP-only certbot config.
NGINX_CONF_BACKUP=""

restore_nginx_conf() {
    if [ -n "${NGINX_CONF_BACKUP}" ] && [ -f "${NGINX_CONF_BACKUP}" ]; then
        cp "${NGINX_CONF_BACKUP}" nginx/nginx.conf
        rm -f "${NGINX_CONF_BACKUP}"
        NGINX_CONF_BACKUP=""
    fi
}

# Function to get SSL certificate
get_ssl_cert() {
    echo -e "${YELLOW}Getting SSL certificate...${NC}"

    # Keep the real HTTPS config. A previous version copied the HTTP-only file
    # onto the backup, then "restored" that and deleted the TLS server blocks.
    NGINX_CONF_BACKUP=$(mktemp)
    cp nginx/nginx.conf "${NGINX_CONF_BACKUP}"
    trap restore_nginx_conf EXIT

    cp nginx/nginx.initial.conf nginx/nginx.conf

    # Start services with HTTP only
    if ! docker compose -f docker-compose.prod.yml up -d nginx; then
        restore_nginx_conf
        trap - EXIT
        return 1
    fi

    local -a cert_args
    cert_args=(-d "${DOMAIN}")
    if [ -n "${LIVEKIT_DOMAIN:-}" ]; then
        cert_args+=(-d "${LIVEKIT_DOMAIN}")
    fi

    # Get certificate
    if ! docker compose -f docker-compose.prod.yml run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "admin@${DOMAIN}" \
        --agree-tos \
        --no-eff-email \
        "${cert_args[@]}"; then
        restore_nginx_conf
        trap - EXIT
        echo -e "${RED}SSL certificate request failed. HTTPS nginx config restored.${NC}" >&2
        return 1
    fi

    restore_nginx_conf
    trap - EXIT

    # Update domain in the restored HTTPS config
    update_nginx_domain

    if ! docker compose -f docker-compose.prod.yml exec nginx nginx -s reload; then
        docker compose -f docker-compose.prod.yml restart nginx
    fi

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

load_env() {
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
    # shellcheck disable=SC1091
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
}

main() {
    load_env

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
            # pull restores the placeholder config; write the real domains back
            update_nginx_domain
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
            docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$BACKUP_FILE"
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
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main "$@"
fi
