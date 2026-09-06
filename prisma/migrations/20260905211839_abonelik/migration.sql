-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "planKey" TEXT NOT NULL DEFAULT 'baslangic',
ADD COLUMN     "planPrice" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "planStatus" TEXT NOT NULL DEFAULT 'TRIAL',
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);
