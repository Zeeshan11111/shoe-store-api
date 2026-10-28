-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Banner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eyebrow" TEXT NOT NULL,
    "headingLine1" TEXT NOT NULL,
    "headingLine2" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sole" TEXT NOT NULL,
    "upper" TEXT NOT NULL,
    "accent" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "saleId" TEXT,
    CONSTRAINT "Banner_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Banner" ("accent", "description", "eyebrow", "headingLine1", "headingLine2", "id", "sole", "sortOrder", "upper") SELECT "accent", "description", "eyebrow", "headingLine1", "headingLine2", "id", "sole", "sortOrder", "upper" FROM "Banner";
DROP TABLE "Banner";
ALTER TABLE "new_Banner" RENAME TO "Banner";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
