-- CreateTable
CREATE TABLE "public"."PlinkoRound" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "bet" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "clientSeed" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "serverSeed" TEXT NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "params" JSONB,
    "state" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlinkoRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlinkoRound_userId_clientSeed_createdAt_idx" ON "public"."PlinkoRound"("userId", "clientSeed", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlinkoRound_userId_clientSeed_nonce_key" ON "public"."PlinkoRound"("userId", "clientSeed", "nonce");

-- AddForeignKey
ALTER TABLE "public"."PlinkoRound" ADD CONSTRAINT "PlinkoRound_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
