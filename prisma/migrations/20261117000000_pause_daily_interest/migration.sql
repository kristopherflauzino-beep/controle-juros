-- Estado de pausa; os saldos e registros existentes não são alterados.
ALTER TABLE "Installment"
  ADD COLUMN "dailyInterestPaused" BOOLEAN NOT NULL DEFAULT false;
