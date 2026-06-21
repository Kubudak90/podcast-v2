ALTER TABLE "recordings" ADD COLUMN "ownerId" TEXT;
UPDATE "recordings" r SET "ownerId" = ro."hostId" FROM "rooms" ro WHERE ro.id = r."roomId" AND r."ownerId" IS NULL;
CREATE INDEX "recordings_ownerId_isPublic_createdAt_idx" ON "recordings"("ownerId", "isPublic", "createdAt");
