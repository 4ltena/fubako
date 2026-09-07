-- 既存の投稿は従来どおり箱への公開として保持する。
CREATE TYPE "PostVisibility" AS ENUM ('circle', 'private');
ALTER TABLE "Post" ADD COLUMN "visibility" "PostVisibility" NOT NULL DEFAULT 'circle';
ALTER TABLE "Circle" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
CREATE TABLE "TopicMute" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "circleId" TEXT NOT NULL,
  "word" TEXT NOT NULL,
  "normalizedWord" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TopicMute_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TopicMute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TopicMute_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TopicMute_userId_circleId_normalizedWord_key" ON "TopicMute"("userId", "circleId", "normalizedWord");
