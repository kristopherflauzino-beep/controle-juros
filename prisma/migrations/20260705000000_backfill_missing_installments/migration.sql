INSERT INTO "Installment" (
  "id",
  "agreementId",
  "number",
  "amount",
  "interest",
  "amortization",
  "balance",
  "dueDate",
  "paid"
)
SELECT
  'cmig_' || substr(md5(a."id" || '-' || gs."number"::text), 1, 20),
  a."id",
  gs."number",
  a."installmentAmount",
  GREATEST(a."installmentAmount" - (a."originalAmount" / a."installmentCount"), 0),
  a."originalAmount" / a."installmentCount",
  GREATEST(a."totalAmount" - (a."installmentAmount" * gs."number"), 0),
  a."dueDate" + ((gs."number" - 1) * INTERVAL '1 month'),
  false
FROM "Agreement" a
CROSS JOIN LATERAL generate_series(1, a."installmentCount") AS gs("number")
WHERE a."installmentCount" > 1
  AND NOT EXISTS (
    SELECT 1
    FROM "Installment" i
    WHERE i."agreementId" = a."id"
      AND i."number" = gs."number"
  );
