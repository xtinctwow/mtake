-- CreateTable
CREATE TABLE "public"."DiceRound" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "bet" DOUBLE PRECISION NOT NULL,
    "mode" TEXT NOT NULL,
    "chance" DOUBLE PRECISION NOT NULL,
    "clientSeed" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "serverSeed" TEXT NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiceRound_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."DiceRound" ADD CONSTRAINT "DiceRound_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
