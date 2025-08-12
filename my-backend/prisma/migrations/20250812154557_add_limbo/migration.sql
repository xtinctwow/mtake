-- CreateTable
CREATE TABLE "public"."LimboRound" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "bet" DOUBLE PRECISION NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "resultMult" DOUBLE PRECISION,
    "clientSeed" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "serverSeed" TEXT NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LimboRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LimboRound_userId_clientSeed_createdAt_idx" ON "public"."LimboRound"("userId", "clientSeed", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LimboRound_userId_clientSeed_nonce_key" ON "public"."LimboRound"("userId", "clientSeed", "nonce");

-- AddForeignKey
ALTER TABLE "public"."LimboRound" ADD CONSTRAINT "LimboRound_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
