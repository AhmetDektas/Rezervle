-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "paymentDeadline" TIMESTAMP(3),
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ProcessedEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reference" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessedEvent_processedAt_idx" ON "ProcessedEvent"("processedAt");

-- CreateIndex
CREATE INDEX "Reservation_paymentDeadline_idx" ON "Reservation"("paymentDeadline");

-- CreateIndex
CREATE INDEX "Reservation_startsAt_reminderSentAt_idx" ON "Reservation"("startsAt", "reminderSentAt");
