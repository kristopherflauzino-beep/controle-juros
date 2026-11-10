-- Aumenta apenas a precisão da base de juros das parcelas.
-- Os valores existentes são preservados, com zeros nas casas decimais novas.
BEGIN;

ALTER TABLE "Installment"
  ALTER COLUMN "dailyInterestBaseAmount" TYPE DECIMAL(24,10);
ALTER TABLE "Installment"
  ADD COLUMN "dailyInterestCarried" DECIMAL(24,10) NOT NULL DEFAULT 0;

-- Correção pontual de novembro de Luis Miguel. A atualização só ocorre se
-- os quatro lançamentos, o pagamento de R$ 500 em 10/11 e o total de R$ 768,10
-- ainda corresponderem exatamente ao estado confirmado pelo administrador.
-- R$ 1.268,10 × 1,02 = R$ 1.293,462; após a baixa: R$ 793,462.
-- Em 10/11: R$ 793,462 × 1,02 = R$ 809,33124.
WITH target_client AS (
  SELECT MIN(client."id") AS "clientId"
  FROM "Client" AS client
  JOIN "User" AS account ON account."id" = client."userId"
  WHERE account."name" = 'Luis Miguel' AND account."role" = 'CLIENT'
  HAVING COUNT(*) = 1
), month_rows AS (
  SELECT installment.*, agreement."clientId", agreement."status" AS "agreementStatus"
  FROM "Installment" AS installment
  JOIN "Agreement" AS agreement ON agreement."id" = installment."agreementId"
  JOIN target_client ON target_client."clientId" = agreement."clientId"
  WHERE installment."dueDate" >= TIMESTAMP '2026-11-01 00:00:00'
    AND installment."dueDate" < TIMESTAMP '2026-12-01 00:00:00'
    AND installment."rescheduledIntoId" IS NULL
), matching_month AS (
  SELECT "clientId"
  FROM month_rows
  GROUP BY "clientId"
  HAVING COUNT(*) = 4
    AND COUNT(*) FILTER (WHERE NOT "paid") = 3
    AND COUNT(*) FILTER (WHERE NOT "paid" AND "amount" = 515.00 AND "dueDate"::date = DATE '2026-11-08') = 1
    AND COUNT(*) FILTER (WHERE NOT "paid" AND "amount" = 140.00 AND COALESCE("remainingAmount", "amount") = 100.00 AND "dueDate"::date = DATE '2026-11-08') = 1
    AND COUNT(*) FILTER (WHERE NOT "paid" AND "amount" = 140.00 AND COALESCE("remainingAmount", "amount") = 140.00 AND "dueDate"::date = DATE '2026-11-20') = 1
    AND COUNT(*) FILTER (WHERE "paid" AND "amount" = 900.00 AND COALESCE("remainingAmount", 0) = 0) = 1
    AND COUNT(*) FILTER (WHERE NOT "paid" AND ("agreementStatus" NOT IN ('OPEN', 'LATE') OR NOT "dailyInterestActive" OR "dailyInterestStartedAt" IS NULL OR "dailyInterestRate" IS DISTINCT FROM 2.0000)) = 0
    AND SUM("amount") = 1695.00
    AND SUM("amortization") = 1615.00
    AND SUM(CASE WHEN NOT "paid" THEN COALESCE("remainingAmount", "amount") ELSE 0 END) = 755.00
    AND ROUND(SUM(CASE
      WHEN "paid" THEN COALESCE("remainingAmount", "amount")
      WHEN "dailyInterestActive" THEN
        COALESCE("dailyInterestBaseAmount", "remainingAmount", "amount")
        * POWER(1 + COALESCE("dailyInterestRate", 0) / 100,
          GREATEST(0, DATE '2026-11-10' - (("dailyInterestStartedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date))
      ELSE COALESCE("remainingAmount", "amount")
    END), 2) = 768.10
), matching_payment AS (
  SELECT month_rows."clientId"
  FROM "PartialPayment" AS payment
  JOIN month_rows ON month_rows."id" = payment."installmentId"
  JOIN matching_month ON matching_month."clientId" = month_rows."clientId"
  GROUP BY month_rows."clientId", payment."operationId"
  HAVING SUM(payment."amount") = 500.00
    AND MIN(((payment."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date) = DATE '2026-11-10'
    AND MAX(((payment."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date) = DATE '2026-11-10'
), weighted AS (
  SELECT month_rows."id",
    ROW_NUMBER() OVER (ORDER BY month_rows."id") AS row_number,
    COUNT(*) OVER () AS row_count,
    ROUND(COALESCE(month_rows."remainingAmount", month_rows."amount") * 793.4620000000 / 755.00, 10) AS share,
    ROUND(COALESCE(month_rows."remainingAmount", month_rows."amount") * 25.3620000000 / 755.00, 10) AS carry_share
  FROM month_rows
  WHERE NOT month_rows."paid"
    AND EXISTS (SELECT 1 FROM matching_payment WHERE matching_payment."clientId" = month_rows."clientId")
), allocation AS (
  SELECT "id",
    CASE WHEN row_number = row_count THEN 793.4620000000 - (SUM(share) OVER () - share) ELSE share END AS new_base,
    CASE WHEN row_number = row_count THEN 25.3620000000 - (SUM(carry_share) OVER () - carry_share) ELSE carry_share END AS carried
  FROM weighted
)
UPDATE "Installment" AS installment
SET "dailyInterestBaseAmount" = allocation.new_base,
    "dailyInterestCarried" = allocation.carried,
    "dailyInterestStartedAt" = TIMESTAMP '2026-11-09 12:00:00',
    "dailyInterestRate" = 2.0000,
    "dailyInterestActive" = true
FROM allocation
WHERE installment."id" = allocation."id";

COMMIT;
