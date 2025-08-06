-- CreateTable
CREATE TABLE "public"."Price" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "usdPrice" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Price_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Price_symbol_key" ON "public"."Price"("symbol");
