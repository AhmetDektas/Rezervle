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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Business_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BusinessCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Business_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Business" ("about", "amenities", "brandHue", "categoryId", "coverUrl", "createdAt", "email", "featured", "id", "name", "ownerId", "phone", "priceLevel", "ratingAvg", "ratingCount", "rejectionReason", "sectorMeta", "slug", "status", "tagline", "updatedAt", "website") SELECT "about", "amenities", "brandHue", "categoryId", "coverUrl", "createdAt", "email", "featured", "id", "name", "ownerId", "phone", "priceLevel", "ratingAvg", "ratingCount", "rejectionReason", "sectorMeta", "slug", "status", "tagline", "updatedAt", "website" FROM "Business";
DROP TABLE "Business";
ALTER TABLE "new_Business" RENAME TO "Business";
CREATE UNIQUE INDEX "Business_slug_key" ON "Business"("slug");
CREATE INDEX "Business_status_featured_idx" ON "Business"("status", "featured");
CREATE INDEX "Business_categoryId_idx" ON "Business"("categoryId");
CREATE INDEX "Business_ownerId_idx" ON "Business"("ownerId");
CREATE TABLE "new_Reservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdById" TEXT,
    "date" TEXT NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "blockEnd" INTEGER NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "channel" TEXT NOT NULL DEFAULT 'ONLINE',
    "price" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "finalPrice" INTEGER NOT NULL,
    "note" TEXT,
    "internalNote" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" DATETIME,
    "promotionId" TEXT,
    "extra" TEXT,
    "depositAmount" INTEGER NOT NULL DEFAULT 0,
    "depositStatus" TEXT NOT NULL DEFAULT 'NONE',
    "slotKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reservation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reservation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Reservation_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Reservation_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Reservation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Reservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Reservation_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Reservation" ("blockEnd", "branchId", "businessId", "cancelReason", "cancelledAt", "channel", "code", "createdAt", "createdById", "customerId", "date", "discount", "endMin", "endsAt", "extra", "finalPrice", "id", "internalNote", "note", "price", "promotionId", "serviceId", "slotKey", "staffId", "startMin", "startsAt", "status", "updatedAt") SELECT "blockEnd", "branchId", "businessId", "cancelReason", "cancelledAt", "channel", "code", "createdAt", "createdById", "customerId", "date", "discount", "endMin", "endsAt", "extra", "finalPrice", "id", "internalNote", "note", "price", "promotionId", "serviceId", "slotKey", "staffId", "startMin", "startsAt", "status", "updatedAt" FROM "Reservation";
DROP TABLE "Reservation";
ALTER TABLE "new_Reservation" RENAME TO "Reservation";
CREATE UNIQUE INDEX "Reservation_code_key" ON "Reservation"("code");
CREATE UNIQUE INDEX "Reservation_slotKey_key" ON "Reservation"("slotKey");
CREATE INDEX "Reservation_businessId_date_idx" ON "Reservation"("businessId", "date");
CREATE INDEX "Reservation_staffId_date_idx" ON "Reservation"("staffId", "date");
CREATE INDEX "Reservation_branchId_date_idx" ON "Reservation"("branchId", "date");
CREATE INDEX "Reservation_customerId_startsAt_idx" ON "Reservation"("customerId", "startsAt");
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
