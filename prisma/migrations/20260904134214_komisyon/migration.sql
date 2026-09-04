-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reservationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "method" TEXT NOT NULL DEFAULT 'AT_VENUE',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "providerRef" TEXT,
    "failureReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    "refundedAt" DATETIME,
    "commissionRate" INTEGER NOT NULL DEFAULT 0,
    "commissionAmount" INTEGER NOT NULL DEFAULT 0,
    "netAmount" INTEGER NOT NULL DEFAULT 0,
    "settlementStatus" TEXT NOT NULL DEFAULT 'NONE',
    "releasedAt" DATETIME,
    "settlementNote" TEXT,
    CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "createdAt", "currency", "failureReason", "id", "method", "paidAt", "provider", "providerRef", "refundedAt", "reservationId", "status") SELECT "amount", "createdAt", "currency", "failureReason", "id", "method", "paidAt", "provider", "providerRef", "refundedAt", "reservationId", "status" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE UNIQUE INDEX "Payment_reservationId_key" ON "Payment"("reservationId");
CREATE INDEX "Payment_settlementStatus_idx" ON "Payment"("settlementStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
