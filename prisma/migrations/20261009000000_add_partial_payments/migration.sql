-- Adição compatível: contratos e parcelas existentes mantêm seus valores.
ALTER TABLE "Agreement" ADD COLUMN "receivedAmount" DECIMAL(14,2);
ALTER TABLE "Installment" ADD COLUMN "remainingAmount" DECIMAL(14,2);

CREATE TABLE "PartialPayment" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartialPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartialPayment_operationId_installmentId_key" ON "PartialPayment"("operationId", "installmentId");
CREATE INDEX "PartialPayment_agreementId_createdAt_idx" ON "PartialPayment"("agreementId", "createdAt");
ALTER TABLE "PartialPayment" ADD CONSTRAINT "PartialPayment_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartialPayment" ADD CONSTRAINT "PartialPayment_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
