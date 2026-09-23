import assert from "node:assert/strict";
import test from "node:test";
import { agreementTableFromTotal, dailyInterest, flatProgressiveTable, monthlyDueDate } from "../src/lib/finance.ts";

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

test("total editado é distribuído sem perder centavos e preserva a fórmula atual", () => {
  const result = agreementTableFromTotal(2700.01, 2, 4);
  assert.equal(result.total, 2700.01);
  assert.equal(Math.round(result.rows.reduce((sum, row) => sum + row.amount, 0) * 100), 270001);
  assert.equal(Math.round(result.rows.reduce((sum, row) => sum + row.interest + row.amortization, 0) * 100), 270001);
  assert.equal(result.rows[3].balance, 0);
  closeTo(flatProgressiveTable(result.principal, 2, 4).total, 2700.01, 0.05);
});
