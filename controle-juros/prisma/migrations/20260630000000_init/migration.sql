CREATE TYPE "Role" AS ENUM ('ADMIN', 'CLIENT');
CREATE TYPE "RequestStatus" AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO');
CREATE TYPE "AgreementStatus" AS ENUM ('ABERTO', 'PAGO', 'ATRASADO', 'CANCELADO');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Client" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "document" TEXT,
  "phone" TEXT,
  "email" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Request" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "observation" TEXT,
  "status" "RequestStatus" NOT NULL DEFAULT 'PENDENTE',
  "approvedAt" TIMESTAMP(3),
  "refusedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Agreement" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "requestId" TEXT,
  "originalValue" DECIMAL(14,2) NOT NULL,
  "openAmount" DECIMAL(14,2) NOT NULL,
  "installmentsCount" INTEGER NOT NULL,
  "interestRate" DECIMAL(10,4) NOT NULL,
  "installmentValue" DECIMAL(14,2) NOT NULL,
  "totalFinal" DECIMAL(14,2) NOT NULL,
  "agreementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" "AgreementStatus" NOT NULL DEFAULT 'ABERTO',
  "observations" TEXT,
  "dailyInterestRate" DECIMAL(10,4),
  "dailyInterestStartedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Installment" (
  "id" TEXT NOT NULL,
  "agreementId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "paymentValue" DECIMAL(14,2) NOT NULL,
  "interestValue" DECIMAL(14,2) NOT NULL,
  "amortization" DECIMAL(14,2) NOT NULL,
  "remainingValue" DECIMAL(14,2) NOT NULL,
  "paid" BOOLEAN NOT NULL DEFAULT false,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyInterestLog" (
  "id" TEXT NOT NULL,
  "agreementId" TEXT NOT NULL,
  "baseOpenAmount" DECIMAL(14,2) NOT NULL,
  "dailyRate" DECIMAL(10,4) NOT NULL,
  "daysCount" INTEGER NOT NULL,
  "updatedAmount" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyInterestLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Client_email_key" ON "Client"("email");
CREATE UNIQUE INDEX "Client_userId_key" ON "Client"("userId");
CREATE UNIQUE INDEX "Agreement_requestId_key" ON "Agreement"("requestId");
CREATE UNIQUE INDEX "Installment_agreementId_number_key" ON "Installment"("agreementId", "number");

ALTER TABLE "Client" ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Request" ADD CONSTRAINT "Request_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyInterestLog" ADD CONSTRAINT "DailyInterestLog_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
