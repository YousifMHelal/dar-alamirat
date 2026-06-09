-- CreateEnum
CREATE TYPE "ReviewSentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "sentiment" "ReviewSentiment",
ADD COLUMN     "themes" TEXT[] DEFAULT ARRAY[]::TEXT[];
