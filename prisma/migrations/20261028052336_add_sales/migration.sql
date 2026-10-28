-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "percentage" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "originalPrice" REAL,
    "rating" REAL NOT NULL,
    "reviews" INTEGER NOT NULL,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "stock" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "colorwaySole" TEXT NOT NULL,
    "colorwayUpper" TEXT NOT NULL,
    "colorwayAccent" TEXT NOT NULL,
    "colors" TEXT NOT NULL,
    "sizes" TEXT NOT NULL,
    "saleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("brand", "category", "colors", "colorwayAccent", "colorwaySole", "colorwayUpper", "createdAt", "description", "gender", "id", "isNew", "name", "originalPrice", "price", "rating", "reviews", "sizes", "stock", "updatedAt") SELECT "brand", "category", "colors", "colorwayAccent", "colorwaySole", "colorwayUpper", "createdAt", "description", "gender", "id", "isNew", "name", "originalPrice", "price", "rating", "reviews", "sizes", "stock", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
