-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "jazzcashEnabled" BOOLEAN NOT NULL DEFAULT true,
    "jazzcashLabel" TEXT NOT NULL DEFAULT 'JazzCash',
    "easypaisaEnabled" BOOLEAN NOT NULL DEFAULT true,
    "easypaisaLabel" TEXT NOT NULL DEFAULT 'EasyPaisa',
    "cardEnabled" BOOLEAN NOT NULL DEFAULT true,
    "cardLabel" TEXT NOT NULL DEFAULT 'Card',
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappNumber" TEXT NOT NULL DEFAULT '923001234567',
    "brandStripEnabled" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Settings" ("cardEnabled", "cardLabel", "easypaisaEnabled", "easypaisaLabel", "id", "jazzcashEnabled", "jazzcashLabel", "whatsappEnabled", "whatsappNumber") SELECT "cardEnabled", "cardLabel", "easypaisaEnabled", "easypaisaLabel", "id", "jazzcashEnabled", "jazzcashLabel", "whatsappEnabled", "whatsappNumber" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
