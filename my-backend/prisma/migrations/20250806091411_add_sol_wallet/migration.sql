-- CreateTable
CREATE TABLE "public"."SolWallet" (
    "userId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "SolWallet_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "public"."SolWallet" ADD CONSTRAINT "SolWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
