-- AlterTable
ALTER TABLE "Admin" ADD COLUMN "resetToken" TEXT;
ALTER TABLE "Admin" ADD COLUMN "resetTokenExpiry" DATETIME;

-- CreateIndex
CREATE UNIQUE INDEX "Admin_resetToken_key" ON "Admin"("resetToken");
