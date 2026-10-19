-- Campos opcionais: nenhum acordo, parcela ou valor existente é alterado.
ALTER TABLE "Agreement" ADD COLUMN "rescheduleOperationId" TEXT;
ALTER TABLE "Agreement" ADD COLUMN "rescheduleScopeMonth" TEXT;
ALTER TABLE "Installment" ADD COLUMN "rescheduledIntoId" TEXT;
ALTER TABLE "Installment" ADD COLUMN "rescheduledAt" TIMESTAMP(3);
ALTER TABLE "Installment" ADD COLUMN "rescheduledAmount" DECIMAL(14,2);

CREATE UNIQUE INDEX "Agreement_rescheduleOperationId_key" ON "Agreement"("rescheduleOperationId");
CREATE INDEX "Installment_rescheduledIntoId_idx" ON "Installment"("rescheduledIntoId");
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_rescheduledIntoId_fkey"
  FOREIGN KEY ("rescheduledIntoId") REFERENCES "Agreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
