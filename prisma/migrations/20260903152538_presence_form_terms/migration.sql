-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "form" TEXT NOT NULL DEFAULT 'text',
ADD COLUMN     "terms" TEXT[] DEFAULT ARRAY[]::TEXT[];
