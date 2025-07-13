/*
  Warnings:

  - A unique constraint covering the columns `[shop]` on the table `Merchant` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Merchant_shop_key" ON "Merchant"("shop");
