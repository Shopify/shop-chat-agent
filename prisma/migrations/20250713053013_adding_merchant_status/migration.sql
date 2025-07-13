-- CreateEnum
CREATE TYPE "MerchantStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "status" "MerchantStatus" NOT NULL DEFAULT 'ACTIVE';
