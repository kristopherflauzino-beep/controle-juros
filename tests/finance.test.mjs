import assert from "node:assert/strict";
import test from "node:test";
import { agreementTableFromTotal, dailyInterest, flatProgressiveTable, monthlyDueDate, monthlyInstallmentTotal, reportInstallmentValue } from "../src/lib/finance.ts";

const closeTo = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} deveria ser ${expected}`);

test("juros diário é composto, preciso e determinístico", () => {
  const start = "2026-09-22T12:00:00.000Z";
  [10, 10.2, 10.404, 10.61208].forEach((expected, days) => {
    const reference = new Date(new Date(start).getTime() + days * 86_400_000);
    closeTo(dailyInterest(10, 2, start, reference).updatedAmount, expected);
    closeTo(dailyInterest(10, 2, start, reference).updatedAmount, expected);
  });
});

test("taxas 0%, 0,5%, 1%, 2% e 5% usam exponenciação", () => {
  for (const rate of [0, 0.5, 1, 2, 5]) closeTo(dailyInterest(10, rate, "2026-09-22T12:00:00Z", "2026-09-25T12:00:00Z").updatedAmount, 10 * (1 + rate / 100) ** 3);
});

test("registro antigo sem ativação permanece inalterado", () => {
  assert.deepEqual(dailyInterest(1000, 5, null, "2036-09-22T12:00:00Z"), { days: 0, accumulated: 0, updatedAmount: 1000 });
});

test("relatório distribui juros entre meses sem duplicar o valor do acordo", () => {
  const startedAt = "2026-09-22T12:00:00Z";
  const referenceDate = "2026-09-24T12:00:00Z";
  const october = reportInstallmentValue(70, 140, 140, 2, startedAt, referenceDate);
  const november = reportInstallmentValue(70, 140, 140, 2, startedAt, referenceDate);
  closeTo(october + november, dailyInterest(140, 2, startedAt, referenceDate).updatedAmount);
  closeTo(reportInstallmentValue(70, 140, 140, 2, null, referenceDate), 70);
});

test("utilizado por mês soma parcelas do cliente e acompanha o relatório", () => {
  const agreements = [
    { clientId: "cliente-1", openAmount: "140", dailyInterestBaseAmount: "140", dailyInterestRate: "2", dailyInterestStartedAt: "2026-09-22T12:00:00Z", installments: [
      { amount: "70", dueDate: "2026-10-08T12:00:00Z", paid: false },
      { amount: "70", dueDate: "2026-11-08T12:00:00Z", paid: false },
    ] },
    { clientId: "cliente-1", openAmount: "30", installments: [{ amount: "30", dueDate: "2026-10-20T12:00:00Z", paid: true }] },
    { clientId: "cliente-2", openAmount: "900", installments: [{ amount: "900", dueDate: "2026-10-08T12:00:00Z", paid: false }] },
  ];
  const referenceDate = "2026-09-24T12:00:00Z";
  closeTo(monthlyInstallmentTotal(agreements, "cliente-1", "2026-10", referenceDate), 70 * 1.02 ** 2 + 30);
  closeTo(monthlyInstallmentTotal(agreements, "cliente-1", "2026-11", referenceDate), 70 * 1.02 ** 2);
  assert.equal(monthlyInstallmentTotal(agreements, "cliente-1", "2026-12", referenceDate), 0);
  assert.equal(monthlyInstallmentTotal(agreements, "cliente-2", "2026-10", referenceDate), 900);
});

test("somente dias completos são contabilizados", () => {
  assert.equal(dailyInterest(10, 2, "2026-09-22T12:00:00Z", "2026-09-23T11:59:59.999Z").days, 0);
  assert.equal(dailyInterest(10, 2, "2026-09-22T12:00:00Z", "2026-09-23T12:00:00Z").days, 1);
});

test("regra mensal existente preserva o dia e limita o fim do mês", () => {
  assert.equal(monthlyDueDate("2026-01-31T12:00:00Z", 1).toISOString(), "2026-02-28T12:00:00.000Z");
});

test("acordo de 2.400 em quatro parcelas gera quatro registros sincronizados", () => {
  const result = agreementTableFromTotal(2400, 0, 4);
  assert.equal(result.total, 2400);
  assert.equal(result.payment, 600);
  assert.equal(result.rows.length, 4);
  assert.equal(result.rows.reduce((sum, row) => sum + row.amount, 0), 2400);
});

test("valor base de R$ 100 com 40% em duas parcelas gera 2 × R$ 70", () => {
  const result = flatProgressiveTable(100, 40, 2);
  assert.equal(result.total, 140);
  assert.deepEqual(result.rows.map((row) => row.amount), [70, 70]);
});

test("total editado é distribuído sem perder centavos e preserva a fórmula atual", () => {
  const result = agreementTableFromTotal(2700.01, 2, 4);
  assert.equal(result.total, 2700.01);
  assert.equal(Math.round(result.rows.reduce((sum, row) => sum + row.amount, 0) * 100), 270001);
  assert.equal(Math.round(result.rows.reduce((sum, row) => sum + row.interest + row.amortization, 0) * 100), 270001);
  assert.equal(result.rows[3].balance, 0);
  closeTo(flatProgressiveTable(result.principal, 2, 4).total, 2700.01, 0.05);
});
