-- CreateTable
CREATE TABLE "public"."BlackjackRound" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "bet" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "clientSeed" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "serverSeed" TEXT NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlackjackRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlackjackRound_userId_clientSeed_createdAt_idx" ON "public"."BlackjackRound"("userId", "clientSeed", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BlackjackRound_userId_clientSeed_nonce_key" ON "public"."BlackjackRound"("userId", "clientSeed", "nonce");

-- AddForeignKey
ALTER TABLE "public"."BlackjackRound" ADD CONSTRAINT "BlackjackRound_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
