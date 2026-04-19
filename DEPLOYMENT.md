# PodChat VPS Deployment Guide

Bu rehber, PodChat uygulamasını kendi VPS'inize deploy etmenizi anlatır.

## Gereksinimler

### VPS Gereksinimleri
- **OS**: Ubuntu 22.04 LTS veya Debian 12 (önerilen)
- **RAM**: Minimum 2GB (4GB önerilen)
- **CPU**: 2 vCPU
- **Disk**: 20GB SSD
- **Network**: Açık portlar: 80, 443, 7881/tcp, 50000-50100/udp

### Domain Gereksinimleri
- Bir domain (örn: `podchat.example.com`)
- DNS A kaydı VPS IP'sine yönlendirilmiş
- LiveKit için subdomain (örn: `livekit.podchat.example.com`)

### Harici Servisler
- **Cloudflare R2** veya **AWS S3** hesabı (kayıt dosyaları için)

## Hızlı Kurulum

### 1. VPS'i Hazırla

SSH ile VPS'e bağlan ve setup scriptini çalıştır:

```bash
# Root olarak çalıştır
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/podchat/main/setup-vps.sh)"
```

Veya manuel:

```bash
# Sistem güncelle
sudo apt update && sudo apt upgrade -y

# Docker kur
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Çıkış yap ve tekrar gir
exit
```

### 2. Projeyi Clone'la

```bash
cd /opt/podchat
git clone https://github.com/YOUR_USERNAME/podchat.git .
```

### 3. Environment Dosyasını Oluştur

```bash
cp .env.production.example .env
nano .env
```

Aşağıdaki değerleri doldur:

```env
# Domain'ini yaz
DOMAIN=podchat.example.com
LIVEKIT_DOMAIN=livekit.podchat.example.com

# Güçlü şifreler oluştur
POSTGRES_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 64)

# LiveKit API anahtarlarını oluştur
# docker run --rm livekit/livekit-server generate-keys
LIVEKIT_API_KEY=APIxxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxx

# Cloudflare R2 bilgileri
S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET=podchat-recordings

# Frontend URL'leri
VITE_API_URL=https://podchat.example.com
VITE_LIVEKIT_URL=wss://livekit.podchat.example.com
FRONTEND_URL=https://podchat.example.com
```

### 4. LiveKit API Anahtarları Oluştur

```bash
docker run --rm livekit/livekit-server generate-keys
```

Çıktıyı `.env` dosyasına kopyala.

### 5. Deploy Et

```bash
chmod +x deploy.sh
./deploy.sh deploy
```

## SSL Sertifikası

İlk deployment'ta SSL otomatik alınmaz. Manuel almak için:

```bash
# Önce HTTP ile başlat
./deploy.sh ssl

# Sonra full deploy
./deploy.sh deploy
```

## Cloudflare R2 Kurulumu

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) > R2
2. "Create bucket" > Bucket adı: `podchat-recordings`
3. "Manage R2 API Tokens" > "Create API Token"
4. Permissions: Object Read & Write
5. Access Key ID ve Secret'ı `.env`'e kopyala

## Yönetim Komutları

```bash
# Logları izle
./deploy.sh logs

# Belirli servisin logları
./deploy.sh logs backend

# Servisleri yeniden başlat
./deploy.sh restart

# Güncelleme (git pull + rebuild)
./deploy.sh update

# Veritabanı yedeği al
./deploy.sh backup

# Durdur
./deploy.sh stop
```

## Port Gereksinimleri

| Port | Protokol | Açıklama |
|------|----------|----------|
| 80 | TCP | HTTP (SSL redirect) |
| 443 | TCP | HTTPS |
| 7881 | TCP | LiveKit RTC TCP |
| 50000-50100 | UDP | LiveKit RTC UDP (WebRTC) |

## Firewall Ayarları

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 7881/tcp
sudo ufw allow 50000:50100/udp
sudo ufw enable
```

## Sorun Giderme

### Container'lar başlamıyor
```bash
docker compose -f docker-compose.prod.yml logs
```

### Database bağlantı hatası
```bash
# Postgres durumunu kontrol et
docker compose -f docker-compose.prod.yml exec postgres pg_isready

# Migrations tekrar çalıştır
./deploy.sh db-migrate
```

### LiveKit bağlantı sorunu
1. UDP portlarının açık olduğundan emin ol
2. `livekit.yaml` içindeki `use_external_ip: true` olmalı
3. Domain'in doğru IP'ye yönlendirildiğini kontrol et

### SSL sertifikası alınamıyor
1. Domain'in VPS IP'sine yönlendirildiğinden emin ol
2. 80 portunun açık olduğunu kontrol et
3. nginx loglarına bak: `./deploy.sh logs nginx`

## Güncelleme

```bash
cd /opt/podchat
git pull
./deploy.sh update
```

## Yedekleme

### Manuel yedek
```bash
./deploy.sh backup
```

### Otomatik yedekleme (cron)
```bash
# Her gün gece 3'te yedek al
crontab -e
0 3 * * * /opt/podchat/deploy.sh backup >> /var/log/podchat-backup.log 2>&1
```

## Monitoring

Basit health check:
```bash
curl https://podchat.example.com/health
curl https://podchat.example.com/api/health
```

Docker container durumu:
```bash
docker compose -f docker-compose.prod.yml ps
```

## Kaynak Kullanımı

```bash
# Container kaynak kullanımı
docker stats

# Sistem kaynakları
htop
```

## Destek

Sorun yaşarsan GitHub Issues kullan:
https://github.com/YOUR_USERNAME/podchat/issues
