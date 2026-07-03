CREATE TYPE "LimitRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
CREATE TABLE "LimitChangeRequest" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "currentLimit" DECIMAL(14,2) NOT NULL,
  "requestedLimit" DECIMAL(14,2) NOT NULL,
  "status" "LimitRequestStatus" NOT NULL DEFAULT 'PENDING',
  "adminMessage" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LimitChangeRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LimitChangeRequest_clientId_createdAt_idx" ON "LimitChangeRequest"("clientId", "createdAt");
ALTER TABLE "LimitChangeRequest" ADD CONSTRAINT "LimitChangeRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;