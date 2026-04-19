# PodChat - Arkadaşlarla Canlı Podcast Uygulaması

## Proje Özeti

Arkadaşlar arasında canlı podcast/sohbet yapılabilen, kayıt edilebilen ve sonradan paylaşılabilen bir web uygulaması. PWA olarak çalışacak (iOS/Android ana ekrana eklenebilir).

## Temel Özellikler

### Kullanıcı Rolleri
- **Host**: Oda oluşturan, yayını başlatan/bitiren kişi
- **Konuşmacı (Speaker)**: Mikrofon açık, konuşabilen (max 10 kişi)
- **Dinleyici (Listener)**: Sadece dinleyebilen, sınırsız sayıda

### Ana Fonksiyonlar
1. **Oda Oluşturma**: Benzersiz link ile paylaşılabilir oda
2. **Canlı Ses**: WebRTC tabanlı gerçek zamanlı ses iletimi
3. **Kayıt**: Server-side otomatik kayıt
4. **Paylaşım**: Kayıtları MP3/podcast formatında indirme/paylaşma
5. **Dinleyici Modu**: Link ile katılıp sadece dinleme

## Tech Stack

### Frontend
```
- React 18+ (Vite ile)
- TypeScript
- TailwindCSS
- PWA (Workbox)
- LiveKit Client SDK (@livekit/components-react)
```

### Backend
```
- Node.js + Express
- Socket.IO (oda yönetimi, state sync, presence)
- LiveKit Server SDK (ses altyapısı)
- PostgreSQL + Prisma (kullanıcı, oda, kayıt metadata)
- Redis (session, cache, Socket.IO adapter)
```

### Ses & Kayıt
```
- LiveKit (WebRTC altyapısı - self-hosted veya cloud)
- Egress API (server-side kayıt)
- FFmpeg (post-processing)
```

### Storage
```
- Cloudflare R2 veya AWS S3 (kayıt dosyaları)
- Presigned URLs (güvenli indirme)
```

## Veritabanı Şeması

### Users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Rooms
```sql
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(20) UNIQUE NOT NULL, -- paylaşım linki için
  title VARCHAR(100) NOT NULL,
  host_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'waiting', -- waiting, live, ended
  max_speakers INT DEFAULT 10,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  ended_at TIMESTAMP
);
```

### Recordings
```sql
CREATE TABLE recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id),
  file_url TEXT NOT NULL,
  duration_seconds INT,
  file_size_bytes BIGINT,
  format VARCHAR(10) DEFAULT 'mp3',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Room Participants
```sql
CREATE TABLE room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(20) NOT NULL, -- host, speaker, listener
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP,
  UNIQUE(room_id, user_id)
);
```

## API Endpoints

### Auth
```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

### Rooms
```
POST   /api/rooms              -- Oda oluştur
GET    /api/rooms/:slug        -- Oda detayı
POST   /api/rooms/:slug/join   -- Odaya katıl
POST   /api/rooms/:slug/leave  -- Odadan ayrıl
POST   /api/rooms/:slug/start  -- Yayını başlat (host only)
POST   /api/rooms/:slug/end    -- Yayını bitir (host only)
PATCH  /api/rooms/:slug/role   -- Rol değiştir (speaker <-> listener)
```

### Recordings
```
GET  /api/rooms/:slug/recordings     -- Oda kayıtları
GET  /api/recordings/:id/download    -- Kayıt indir (presigned URL)
```

### LiveKit Token
```
POST /api/livekit/token   -- LiveKit room token al
```

## Socket.IO Realtime Events

Realtime senkronizasyon `backend/src/lib/socket.ts` üzerinden yürütülür. İstemciler oda slug bazlı namespace'e bağlanır.

```typescript
// Client → Server
socket.emit('room:join',   { slug, token });
socket.emit('room:leave',  { slug });
socket.emit('role:update', { slug, userId, role });
socket.emit('mic:toggle',  { slug, muted });

// Server → Client
socket.on('room:state',         (state: RoomState) => {});
socket.on('participant:joined', (p: Participant) => {});
socket.on('participant:left',   ({ userId }) => {});
socket.on('participant:update', (p: Participant) => {});
socket.on('recording:started',  ({ recordingId }) => {});
socket.on('recording:stopped',  () => {});
socket.on('room:ended',         () => {});

// RoomState shape
interface RoomState {
  roomId: string;
  slug: string;
  title: string;
  status: 'waiting' | 'live' | 'ended';
  hostId: string;
  isRecording: boolean;
  participants: Participant[];
}
```

## Frontend Sayfa Yapısı

```
/                     -- Ana sayfa (oda oluştur veya katıl)
/room/:slug           -- Oda sayfası (canlı yayın)
/room/:slug/ended     -- Yayın bitti sayfası (kayıt indirme)
/profile              -- Profil ve geçmiş kayıtlar
```

## Komponent Yapısı

```
src/
├── components/
│   ├── Room/
│   │   ├── RoomHeader.tsx        -- Başlık, katılımcı sayısı
│   │   ├── ParticipantList.tsx   -- Konuşmacılar listesi
│   │   ├── AudioControls.tsx     -- Mute/unmute, ses seviyesi
│   │   ├── ListenerCount.tsx     -- Dinleyici sayacı
│   │   └── RecordingIndicator.tsx
│   ├── Chat/
│   │   └── LiveChat.tsx          -- Opsiyonel yazılı chat
│   ├── Layout/
│   │   ├── Header.tsx
│   │   └── MobileNav.tsx
│   └── UI/
│       ├── Button.tsx
│       ├── Avatar.tsx
│       └── Modal.tsx
├── pages/
│   ├── Home.tsx
│   ├── Room.tsx
│   └── Profile.tsx
├── hooks/
│   ├── useRoom.ts
│   ├── useLiveKit.ts
│   └── useRecording.ts
├── lib/
│   ├── api.ts
│   ├── socket.ts
│   └── livekit.ts
└── App.tsx
```

## PWA Konfigürasyonu

```json
// manifest.json
{
  "name": "PodChat",
  "short_name": "PodChat",
  "description": "Arkadaşlarla canlı podcast",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#6366f1",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

## Mobil UI Gereksinimleri

- **Touch-friendly**: Minimum 44px buton boyutu
- **Bottom navigation**: Ana kontroller altta
- **Swipe gestures**: Katılımcı listesi için swipe
- **Safe area**: iOS notch ve Android gesture bar desteği
- **Landscape**: Desteklenmeli ama portrait öncelikli

## LiveKit Entegrasyonu

### Token Oluşturma (Backend)
```typescript
import { AccessToken } from 'livekit-server-sdk';

function createToken(roomName: string, participantName: string, isHost: boolean) {
  const token = new AccessToken(API_KEY, API_SECRET, {
    identity: participantName,
  });
  
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true, // speaker için
    canSubscribe: true,
    canPublishData: true,
  });
  
  return token.toJwt();
}
```

### Kayıt Başlatma
```typescript
import { EgressClient, EncodedFileOutput } from 'livekit-server-sdk';

const egressClient = new EgressClient(LIVEKIT_URL, API_KEY, API_SECRET);

// Oda kaydı başlat
const output = new EncodedFileOutput({
  filepath: `recordings/${roomSlug}-${Date.now()}.mp3`,
  fileType: 'MP3',
});

await egressClient.startRoomCompositeEgress(roomName, { file: output });
```

## Geliştirme Öncelikleri

### Faz 1: MVP (İlk versiyon)
1. [ ] Proje setup (Vite + React + TypeScript)
2. [ ] Temel auth (basit username ile giriş)
3. [ ] Oda oluşturma ve katılma
4. [ ] LiveKit entegrasyonu (ses)
5. [ ] Socket.IO realtime sync
6. [ ] Basit UI

### Faz 2: Kayıt & PWA
1. [ ] Server-side kayıt
2. [ ] Kayıt indirme
3. [ ] PWA manifest ve service worker
4. [ ] Offline desteği (ana sayfa)

### Faz 3: Polish
1. [ ] Dinleyici modu
2. [ ] Mobil optimizasyon
3. [ ] Bildirimler
4. [ ] Sosyal paylaşım

## Ortam Değişkenleri

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/podchat

# Redis
REDIS_URL=redis://localhost:6379

# LiveKit
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret

# Storage (R2/S3)
S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com
S3_ACCESS_KEY=xxx
S3_SECRET_KEY=xxx
S3_BUCKET=podchat-recordings

# App
JWT_SECRET=your-jwt-secret
FRONTEND_URL=http://localhost:5173
```

## Notlar

- LiveKit Cloud kullanılabilir (başlangıç için ücretsiz tier var)
- Self-hosted LiveKit için Docker Compose hazırlanabilir
- Kayıtlar için Cloudflare R2 öneriyorum (S3 uyumlu, ucuz)
- Socket.IO sadece oda state sync ve presence için, ses LiveKit'ten geçecek
