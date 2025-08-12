/*
  Warnings:

  - Added the required column `currency` to the `DiceRound` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."DiceRound" ADD COLUMN     "currency" TEXT NOT NULL;
