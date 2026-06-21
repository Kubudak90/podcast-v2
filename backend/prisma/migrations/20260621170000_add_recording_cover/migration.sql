-- Add nullable cover image key to recordings (additive, backward-compatible)
ALTER TABLE "recordings" ADD COLUMN "coverImageKey" TEXT;
