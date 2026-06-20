ALTER TABLE "room_participants" ADD COLUMN "mutedByHost" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "room_participants" ADD COLUMN "kickedAt" TIMESTAMP(3);
