-- O juros diário passa a pertencer à parcela e, portanto, ao mês de vencimento.
-- As colunas financeiras já existentes não são reescritas.
ALTER TABLE "Installment" ADD COLUMN "dailyInterestActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Installment" ADD COLUMN "dailyInterestRate" DECIMAL(8,4);
ALTER TABLE "Installment" ADD COLUMN "dailyInterestStartedAt" TIMESTAMP(3);
ALTER TABLE "Installment" ADD COLUMN "dailyInterestBaseAmount" DECIMAL(14,2);

-- Correção solicitada em 09/11/2026: somente parcelas pendentes de novembro
-- conservam a ativação e a data/taxa originais. Os demais meses não acumulam juros.
UPDATE "Installment" AS installment
SET "dailyInterestActive" = true,
    "dailyInterestRate" = COALESCE(agreement."dailyInterestRate", 0),
    "dailyInterestStartedAt" = agreement."dailyInterestStartedAt",
    "dailyInterestBaseAmount" = COALESCE(installment."remainingAmount", installment."amount")
FROM "Agreement" AS agreement
WHERE installment."agreementId" = agreement."id"
  AND agreement."dailyInterestActive" = true
  AND agreement."dailyInterestStartedAt" IS NOT NULL
  AND agreement."status" IN ('OPEN', 'LATE')
  AND installment."paid" = false
  AND installment."rescheduledIntoId" IS NULL
  AND COALESCE(installment."remainingAmount", installment."amount") > 0
  AND installment."dueDate" >= TIMESTAMP '2026-11-01 00:00:00'
  AND installment."dueDate" < TIMESTAMP '2026-12-01 00:00:00';

-- Mantém os campos legados como histórico; apenas desliga sua cobrança global.
UPDATE "Agreement" SET "dailyInterestActive" = false
WHERE "dailyInterestActive" = true;
