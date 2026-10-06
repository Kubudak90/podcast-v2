ALTER TABLE "rooms" ADD COLUMN "topic" TEXT;
ALTER TABLE "rooms" ADD COLUMN "description" TEXT;

CREATE INDEX "rooms_isPublic_status_topic_idx" ON "rooms"("isPublic", "status", "topic");
