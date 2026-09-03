-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "reactionNotifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PostVeil" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostVeil_pkey" PRIMARY KEY ("userId","postId")
);

-- AddForeignKey
ALTER TABLE "PostVeil" ADD CONSTRAINT "PostVeil_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostVeil" ADD CONSTRAINT "PostVeil_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
