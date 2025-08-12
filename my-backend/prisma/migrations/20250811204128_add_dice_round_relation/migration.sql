/*
  Warnings:

  - A unique constraint covering the columns `[userId,clientSeed,nonce]` on the table `DiceRound` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "DiceRound_userId_clientSeed_createdAt_idx" ON "public"."DiceRound"("userId", "clientSeed", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DiceRound_userId_clientSeed_nonce_key" ON "public"."DiceRound"("userId", "clientSeed", "nonce");
