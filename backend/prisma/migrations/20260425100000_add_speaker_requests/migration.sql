CREATE TABLE "speaker_requests" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "speaker_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "speaker_requests_roomId_userId_key" ON "speaker_requests"("roomId", "userId");
CREATE INDEX "speaker_requests_roomId_status_requestedAt_idx" ON "speaker_requests"("roomId", "status", "requestedAt");
CREATE INDEX "speaker_requests_userId_status_idx" ON "speaker_requests"("userId", "status");

ALTER TABLE "speaker_requests"
    ADD CONSTRAINT "speaker_requests_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "speaker_requests"
    ADD CONSTRAINT "speaker_requests_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
