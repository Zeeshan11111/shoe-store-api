-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "codEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Settings" ADD COLUMN "codLabel" TEXT NOT NULL DEFAULT 'Cash on Delivery';
