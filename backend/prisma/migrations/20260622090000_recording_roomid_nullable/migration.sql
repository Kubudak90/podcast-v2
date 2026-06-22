-- Make recordings.roomId nullable and switch its FK to ON DELETE SET NULL
-- so uploaded podcasts (no room) are representable and room deletion no longer
-- cascade-deletes recordings.
ALTER TABLE "recordings" ALTER COLUMN "roomId" DROP NOT NULL;
ALTER TABLE "recordings" DROP CONSTRAINT "recordings_roomId_fkey";
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
