/*
  Warnings:

  - You are about to drop the column `betBankerPair` on the `BaccaratRound` table. All the data in the column will be lost.
  - You are about to drop the column `betPlayerPair` on the `BaccaratRound` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."BaccaratRound" DROP COLUMN "betBankerPair",
DROP COLUMN "betPlayerPair";
