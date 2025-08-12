-- CreateTable
CREATE TABLE "public"."MinesRound" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "bet" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "mines" INTEGER NOT NULL,
    "clientSeed" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "serverSeed" TEXT NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'live',
    "safeRevealed" INTEGER NOT NULL DEFAULT 0,
    "revealed" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MinesRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MinesRound_userId_clientSeed_createdAt_idx" ON "public"."MinesRound"("userId", "clientSeed", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MinesRound_userId_clientSeed_nonce_key" ON "public"."MinesRound"("userId", "clientSeed", "nonce");

-- AddForeignKey
ALTER TABLE "public"."MinesRound" ADD CONSTRAINT "MinesRound_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
