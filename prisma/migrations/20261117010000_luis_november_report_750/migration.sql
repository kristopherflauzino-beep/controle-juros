-- Ajuste solicitado para o total de novembro de Luis Miguel no Relatório.
-- Preserva as parcelas pagas, os pagamentos parciais e os demais meses/clientes.
-- Só atualiza a parcela pendente identificada se o estado financeiro conferido
-- antes da publicação ainda corresponder exatamente ao banco.
BEGIN;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

WITH month_rows AS (
  SELECT installment.*, agreement."clientId"
  FROM "Installment" AS installment
  JOIN "Agreement" AS agreement ON agreement."id" = installment."agreementId"
  JOIN "Client" AS client ON client."id" = agreement."clientId"
  JOIN "User" AS account ON account."id" = client."userId"
  WHERE account."name" = 'Luis Miguel'
    AND account."role" = 'CLIENT'
    AND installment."dueDate" >= TIMESTAMP '2026-11-01 00:00:00'
    AND installment."dueDate" < TIMESTAMP '2026-12-01 00:00:00'
    AND installment."rescheduledIntoId" IS NULL
), matching_month AS (
  SELECT "clientId"
  FROM month_rows
  GROUP BY "clientId"
  HAVING COUNT(*) = 6
    AND COUNT(*) FILTER (WHERE "paid") = 2
    AND COUNT(*) FILTER (WHERE NOT "paid" AND "dailyInterestActive" AND "dailyInterestPaused") = 2
    AND COUNT(*) FILTER (WHERE NOT "paid" AND "dailyInterestActive" AND NOT "dailyInterestPaused") = 0
    AND SUM(CASE
      WHEN "paid" THEN COALESCE("remainingAmount", "amount")
      WHEN "dailyInterestActive" AND "dailyInterestPaused" THEN COALESCE("dailyInterestBaseAmount", "remainingAmount", "amount")
      ELSE COALESCE("remainingAmount", "amount")
    END) = 1000.9324678524
), target AS (
  SELECT installment."id", installment."agreementId"
  FROM "Installment" AS installment
  JOIN "Agreement" AS agreement ON agreement."id" = installment."agreementId"
  JOIN matching_month ON matching_month."clientId" = agreement."clientId"
  WHERE installment."id" = 'cmvs38b1j0000l806xkryr0ry'
    AND installment."agreementId" = 'cmvs37qw40001i806csoc9ieh'
    AND installment."paid" = false
    AND installment."dailyInterestActive" = true
    AND installment."dailyInterestPaused" = true
    AND installment."dailyInterestRate" = 2.0000
    AND installment."dueDate" = TIMESTAMP '2026-11-08 12:00:00'
    AND installment."amount" = 515.00
    AND installment."remainingAmount" = 595.71
    AND installment."dailyInterestBaseAmount" = 595.7138487695
    AND agreement."status" = 'OPEN'
    AND agreement."openAmount" = 595.71
    AND agreement."receivedAmount" = 38.43
), updated_installment AS (
  UPDATE "Installment" AS installment
  SET "remainingAmount" = 344.78,
      "dailyInterestBaseAmount" = 344.7813809171
  FROM target
  WHERE installment."id" = target."id"
  RETURNING installment."agreementId"
)
UPDATE "Agreement" AS agreement
SET "openAmount" = 344.78,
    "updatedAt" = NOW()
WHERE agreement."id" IN (SELECT "agreementId" FROM updated_installment);

COMMIT;
