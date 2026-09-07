-- 既存データを保持し、不明な発行経路のセッションをverifiedへ昇格させない。
ALTER TABLE "User" ADD COLUMN "digestEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Session" ADD COLUMN "authMethod" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "Circle" ADD COLUMN "invitesEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Membership" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Post" ADD COLUMN "afterword" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Post" ADD COLUMN "clientRequestId" TEXT;
ALTER TABLE "Post" ADD COLUMN "requestHash" TEXT;
CREATE UNIQUE INDEX "Post_authorId_clientRequestId_key" ON "Post"("authorId", "clientRequestId");

CREATE TABLE "CircleBan" (
    "circleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CircleBan_pkey" PRIMARY KEY ("circleId", "userId"),
    CONSTRAINT "CircleBan_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CircleBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
