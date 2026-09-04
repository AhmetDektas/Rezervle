-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "about" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "coverUrl" TEXT,
    "brandHue" INTEGER NOT NULL DEFAULT 214,
    "priceLevel" INTEGER NOT NULL DEFAULT 2,
    "amenities" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "ratingAvg" REAL NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "sectorMeta" TEXT,
    "depositAddon" BOOLEAN NOT NULL DEFAULT false,
    "depositEnabled" BOOLEAN NOT NULL DEFAULT false,
    "depositKind" TEXT NOT NULL DEFAULT 'PERCENT',
    "depositValue" INTEGER NOT NULL DEFAULT 20,
    "depositMinPrice" INTEGER NOT NULL DEFAULT 0,
    "depositRefundHours" INTEGER NOT NULL DEFAULT 24,
    "commissionRate" INTEGER NOT NULL DEFAULT 30,
    "subMerchantKey" TEXT,
    "payoutTitle" TEXT,
    "payoutIban" TEXT,
    "taxNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Business_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BusinessCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Business_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Business" ("about", "amenities", "brandHue", "categoryId", "coverUrl", "createdAt", "depositAddon", "depositEnabled", "depositKind", "depositMinPrice", "depositRefundHours", "depositValue", "email", "featured", "id", "name", "ownerId", "phone", "priceLevel", "ratingAvg", "ratingCount", "rejectionReason", "sectorMeta", "slug", "status", "tagline", "updatedAt", "website") SELECT "about", "amenities", "brandHue", "categoryId", "coverUrl", "createdAt", "depositAddon", "depositEnabled", "depositKind", "depositMinPrice", "depositRefundHours", "depositValue", "email", "featured", "id", "name", "ownerId", "phone", "priceLevel", "ratingAvg", "ratingCount", "rejectionReason", "sectorMeta", "slug", "status", "tagline", "updatedAt", "website" FROM "Business";
DROP TABLE "Business";
ALTER TABLE "new_Business" RENAME TO "Business";
CREATE UNIQUE INDEX "Business_slug_key" ON "Business"("slug");
CREATE INDEX "Business_status_featured_idx" ON "Business"("status", "featured");
CREATE INDEX "Business_categoryId_idx" ON "Business"("categoryId");
CREATE INDEX "Business_ownerId_idx" ON "Business"("ownerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
