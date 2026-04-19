#!/bin/bash
set -e

# ============================================
# VPS Initial Setup Script
# Run this ONCE on a fresh Ubuntu/Debian VPS
# ============================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   VPS Initial Setup for PodChat${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (sudo)${NC}"
    exit 1
fi

# Update system
echo -e "${YELLOW}Updating system packages...${NC}"
apt update && apt upgrade -y

# Install required packages
echo -e "${YELLOW}Installing required packages...${NC}"
apt install -y \
    curl \
    wget \
    git \
    ufw \
    fail2ban \
    htop \
    nano

# Install Docker
echo -e "${YELLOW}Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh

    # Add current user to docker group
    if [ -n "$SUDO_USER" ]; then
        usermod -aG docker $SUDO_USER
    fi
else
    echo "Docker already installed"
fi

# Install Docker Compose
echo -e "${YELLOW}Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    apt install -y docker-compose-plugin
else
    echo "Docker Compose already installed"
fi

# Configure firewall
echo -e "${YELLOW}Configuring firewall...${NC}"
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS
ufw allow 7881/tcp    # LiveKit RTC TCP
ufw allow 50000:50100/udp  # LiveKit RTC UDP

# Enable firewall
echo "y" | ufw enable

# Configure fail2ban
echo -e "${YELLOW}Configuring fail2ban...${NC}"
systemctl enable fail2ban
systemctl start fail2ban

# Create app directory
APP_DIR="/opt/podchat"
echo -e "${YELLOW}Creating application directory: $APP_DIR${NC}"
mkdir -p $APP_DIR
if [ -n "$SUDO_USER" ]; then
    chown -R $SUDO_USER:$SUDO_USER $APP_DIR
fi

# Setup swap (for small VPS instances)
echo -e "${YELLOW}Setting up swap space...${NC}"
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
    echo "Swap enabled (2GB)"
else
    echo "Swap already configured"
fi

# Optimize system for containers
echo -e "${YELLOW}Optimizing system settings...${NC}"
cat >> /etc/sysctl.conf << EOF

# Docker/Container optimizations
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
vm.overcommit_memory = 1
vm.swappiness = 10
EOF
sysctl -p

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   VPS Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Clone your repository to $APP_DIR:"
echo "   cd $APP_DIR && git clone https://github.com/YOUR_USERNAME/podchat.git ."
echo ""
echo "2. Copy and edit environment file:"
echo "   cp .env.production.example .env"
echo "   nano .env"
echo ""
echo "3. Run deployment:"
echo "   ./deploy.sh deploy"
echo ""
echo -e "${YELLOW}Important: Log out and back in for docker group changes to take effect${NC}"
