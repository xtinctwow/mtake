-- CreateTable
CREATE TABLE "public"."BaccaratRound" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "currency" TEXT NOT NULL,
    "clientSeed" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "serverSeed" TEXT NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "totalBet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "betPlayer" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "betBanker" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "betTie" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "betPlayerPair" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "betBankerPair" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BaccaratRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BaccaratRound_userId_clientSeed_createdAt_idx" ON "public"."BaccaratRound"("userId", "clientSeed", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BaccaratRound_userId_clientSeed_nonce_key" ON "public"."BaccaratRound"("userId", "clientSeed", "nonce");

-- AddForeignKey
ALTER TABLE "public"."BaccaratRound" ADD CONSTRAINT "BaccaratRound_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
