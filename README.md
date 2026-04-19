# PodChat

Arkadaşlarla canlı podcast / sohbet uygulaması. Web (PWA) + iOS native client + Node.js backend. Ses LiveKit üzerinden, presence ve oda state'i Socket.IO ile yürütülür.

> Mimari ve veritabanı şemasının ayrıntıları için `CLAUDE.md` dosyasına bakın.

## Repo yapısı

```
.
├── backend/              Node 20 + TypeScript + Prisma + Socket.IO + LiveKit
├── frontend/             React 19 + Vite + Tailwind + LiveKit components (PWA)
├── nginx/                Edge reverse-proxy konfigürasyonu (prod)
├── livekit.yaml          Self-hosted LiveKit (dev)
├── livekit.prod.yaml     Self-hosted LiveKit (prod)
├── egress.yaml           Egress recorder (dev)
├── egress.prod.yaml      Egress recorder (prod)
├── docker-compose.yml    Lokal dev stack
├── docker-compose.prod.yml
├── deploy.sh             VPS deploy scripti (DEPLOYMENT.md'ye bak)
└── ../PodChat/           iOS SwiftUI uygulaması (ayrı Xcode projesi)
```

## Hızlı başlangıç (lokal)

Gerekli: Docker + Docker Compose, Node 20, npm 10. iOS için Xcode 16.

```bash
# 1) Tüm bağımlı servisleri ayağa kaldır (Postgres, Redis, LiveKit, Egress)
docker compose up -d

# 2) Backend
cd backend
cp .env.example .env       # değerleri doldur (özellikle LIVEKIT_API_KEY/SECRET)
npm install
npx prisma migrate dev
npm run dev                # http://localhost:3001

# 3) Frontend (yeni terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev                # http://localhost:5173

# 4) iOS (yeni terminal)
cd ../PodChat
open PodChat.xcodeproj     # Debug scheme localhost:3001 backend'e bağlanır
```

## Ortak komutlar

| Yer | Komut | Açıklama |
| --- | --- | --- |
| backend | `npm run dev` | Hot-reload server |
| backend | `npm run lint` / `lint:fix` | ESLint |
| backend | `npm run format` / `format:check` | Prettier |
| backend | `npm run typecheck` | `tsc --noEmit` |
| backend | `npm test` | Vitest |
| backend | `npm run db:migrate` | Prisma migrate dev |
| backend | `npm run db:studio` | Prisma Studio |
| frontend | `npm run dev` | Vite dev server |
| frontend | `npm run lint` | ESLint |
| frontend | `npm run test:run` | Vitest (CI) |
| frontend | `npm run build` | Üretim bundle'ı |
| iOS | `xcodebuild -scheme PodChat test` | Unit testler |

## Ortam değişkenleri

- Backend: `backend/.env.example` — Postgres, JWT, LiveKit, S3/R2, VAPID, FRONTEND_URL.
- Frontend: `frontend/.env.example` — `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_LIVEKIT_URL`, `VITE_VAPID_PUBLIC_KEY`.
- iOS: `Configuration.swift` derleme zamanında `#if DEBUG` ile `localhost`, aksi halde `livepodchat.com` kullanır. Info.plist üzerinden `API_BASE_URL` / `LIVEKIT_URL` override edilebilir.

> Hiçbir `.env` dosyasını commit etmeyin. Üretim secret'ları VPS üzerinde saklanır (`DEPLOYMENT.md`).

## API dökümantasyonu

REST endpoint'leri makine-okunur olarak `backend/openapi.yaml` dosyasındadır. Swagger UI ile görüntülemek için:

```bash
npx @redocly/cli preview-docs backend/openapi.yaml
```

## Test ve CI

GitHub Actions `.github/workflows/ci.yml` her PR'da:

- Backend: lint + typecheck + Vitest (Postgres servisli)
- Frontend: lint + typecheck + Vitest + production build
- iOS: `xcodebuild test` (iPhone 16 simulator)

## Deploy

Üretim deploy adımları `DEPLOYMENT.md` dosyasında. Özetle:

1. VPS hazırla: `setup-vps.sh`
2. Secret'ları yerleştir: `backend/.env` + `livekit.prod.yaml` + `egress.prod.yaml`
3. `docker compose -f docker-compose.prod.yml up -d`
4. Nginx + SSL: `nginx/` altındaki şablon

## Lisans

Özel proje — ilgili lisans bilgisi belirtilene kadar redistribution kısıtlıdır.
