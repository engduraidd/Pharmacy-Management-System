-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'EMPLOYEE');

-- CreateTable
CREATE TABLE "app_user" (
    "userId" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "session" (
    "sessionId" SERIAL NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "medicine" (
    "medicineId" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "description" TEXT,
    "barcode" TEXT,
    "currentSellingPrice" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "medicine_pkey" PRIMARY KEY ("medicineId")
);

-- CreateTable
CREATE TABLE "stock_batch" (
    "batchId" SERIAL NOT NULL,
    "medicineId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expiryDate" DATE NOT NULL,
    "supplierPurchasePrice" DECIMAL(18,4),

    CONSTRAINT "stock_batch_pkey" PRIMARY KEY ("batchId")
);

-- CreateTable
CREATE TABLE "sale" (
    "saleId" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "dateTime" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmount" DECIMAL(18,4) NOT NULL,
    "requestKey" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,

    CONSTRAINT "sale_pkey" PRIMARY KEY ("saleId")
);

-- CreateTable
CREATE TABLE "sale_item" (
    "saleItemId" SERIAL NOT NULL,
    "saleId" INTEGER NOT NULL,
    "batchId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitSellingPrice" DECIMAL(18,4) NOT NULL,
    "subtotal" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "sale_item_pkey" PRIMARY KEY ("saleItemId")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_username_key" ON "app_user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "session_tokenHash_key" ON "session"("tokenHash");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "session_expiresAt_idx" ON "session"("expiresAt");

-- CreateIndex
CREATE INDEX "stock_batch_medicineId_expiryDate_batchId_idx" ON "stock_batch"("medicineId", "expiryDate", "batchId");

-- CreateIndex
CREATE INDEX "stock_batch_expiryDate_idx" ON "stock_batch"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "sale_requestKey_key" ON "sale"("requestKey");

-- CreateIndex
CREATE INDEX "sale_userId_dateTime_idx" ON "sale"("userId", "dateTime");

-- CreateIndex
CREATE INDEX "sale_item_saleId_idx" ON "sale_item"("saleId");

-- CreateIndex
CREATE INDEX "sale_item_batchId_idx" ON "sale_item"("batchId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_user"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batch" ADD CONSTRAINT "stock_batch_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicine"("medicineId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale" ADD CONSTRAINT "sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_user"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sale"("saleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "stock_batch"("batchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain safeguards not represented by Prisma's schema DSL.
ALTER TABLE "stock_batch" ADD CONSTRAINT "stock_batch_nonnegative_quantity" CHECK ("quantity" >= 0);
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_positive_quantity" CHECK ("quantity" > 0);
ALTER TABLE "medicine" ADD CONSTRAINT "medicine_valid_price" CHECK ("currentSellingPrice" >= 0 AND "currentSellingPrice" != 'NaN'::numeric);
ALTER TABLE "stock_batch" ADD CONSTRAINT "stock_batch_valid_cost" CHECK ("supplierPurchasePrice" IS NULL OR ("supplierPurchasePrice" >= 0 AND "supplierPurchasePrice" != 'NaN'::numeric));
ALTER TABLE "sale" ADD CONSTRAINT "sale_valid_total" CHECK ("totalAmount" >= 0 AND "totalAmount" != 'NaN'::numeric);
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_valid_amounts" CHECK ("unitSellingPrice" >= 0 AND "unitSellingPrice" != 'NaN'::numeric AND "subtotal" >= 0 AND "subtotal" != 'NaN'::numeric);

