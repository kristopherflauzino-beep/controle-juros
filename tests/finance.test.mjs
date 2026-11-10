import assert from "node:assert/strict";
import test from "node:test";
import { agreementTableFromTotal, allocatePartialPaymentCents, capitalizedInstallmentCents, clientOutstandingCents, dailyInterest, dailyInterestBalanceAfterPartialPayment, flatProgressiveTable, monthlyDailyInterestSummary, monthlyDueDate, monthlyInstallmentTotal, reportAgreementInstallmentValue, reportInstallmentValue, rescheduleTable } from "../src/lib/finance.ts";

const closeTo = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} deveria ser ${expected}`);

test("juros diário é composto, preciso e determinístico", () => {
  const start = "2026-09-22T12:00:00.000Z";
  [10, 10.2, 10.404, 10.61208].forEach((expected, days) => {
    const reference = new Date(new Date(start).getTime() + days * 86_400_000);
    closeTo(dailyInterest(10, 2, start, reference).updatedAmount, expected);
    closeTo(dailyInterest(10, 2, start, reference).updatedAmount, expected);
  });
});

test("juros diário continua após muitos dias sem prazo máximo", () => {
  const start = "2026-01-01T12:00:00Z";
  const afterOneYear = new Date(Date.parse(start) + 365 * 86_400_000);
  const result = dailyInterest(100, 0.5, start, afterOneYear);
  assert.equal(result.days, 365);
  closeTo(result.updatedAmount, 100 * 1.005 ** 365);
});

test("taxas 0%, 0,5%, 1%, 2% e 5% usam exponenciação", () => {
  for (const rate of [0, 0.5, 1, 2, 5]) closeTo(dailyInterest(10, rate, "2026-09-22T12:00:00Z", "2026-09-25T12:00:00Z").updatedAmount, 10 * (1 + rate / 100) ** 3);
});

test("registro antigo sem ativação permanece inalterado", () => {
  assert.deepEqual(dailyInterest(1000, 5, null, "2036-09-22T12:00:00Z"), { days: 0, accumulated: 0, updatedAmount: 1000 });
});

test("juros diário de novembro não altera parcelas de outubro ou dezembro", () => {
  const reference = "2026-11-11T12:00:00Z";
  const agreement = { clientId: "cliente-1", status: "OPEN", openAmount: "300", dailyInterestActive: false,
    dailyInterestRate: "2", dailyInterestStartedAt: "2026-10-01T12:00:00Z", installments: [
      { id: "outubro", amount: "50", dueDate: "2026-10-08T12:00:00Z", paid: false, dailyInterestActive: false },
      { id: "novembro", amount: "200", dueDate: "2026-11-08T12:00:00Z", paid: false, dailyInterestActive: true, dailyInterestRate: "2", dailyInterestBaseAmount: "200", dailyInterestStartedAt: "2026-11-09T12:00:00Z", amortization: "200" },
      { id: "dezembro", amount: "50", dueDate: "2026-12-08T12:00:00Z", paid: false, dailyInterestActive: false },
    ] };
  assert.equal(clientOutstandingCents([agreement], "cliente-1", "2026-10", reference), 5000);
  assert.equal(clientOutstandingCents([agreement], "cliente-1", "2026-12", reference), 5000);
  assert.equal(clientOutstandingCents([agreement], "cliente-1", "2026-11", reference), 20808);
  assert.equal(clientOutstandingCents([agreement], "cliente-1", "2026-11", reference), 20808);
  assert.equal(clientOutstandingCents([agreement], "cliente-1", null, reference), 30808);
  assert.equal(monthlyDailyInterestSummary([{ agreement, installment: agreement.installments[0] }], reference), null);
  const summary = monthlyDailyInterestSummary([{ agreement, installment: agreement.installments[1] }], reference);
  closeTo(summary.currentTotal, 208.08);
  closeTo(summary.accruedInterest, 8.08);
});

test("mês selecionado soma o valor integral pendente de vários acordos", () => {
  const reference = "2026-11-11T12:00:00Z";
  const agreements = [100, 200].map((amount, index) => ({ clientId: "cliente-1", status: "OPEN", openAmount: String(amount), dailyInterestActive: false,
    installments: [{ id: `parcela-${index}`, amount: String(amount), dueDate: "2026-11-20T12:00:00Z", paid: false, dailyInterestActive: true, dailyInterestRate: "2", dailyInterestBaseAmount: String(amount), dailyInterestStartedAt: "2026-11-09T12:00:00Z", amortization: String(amount) }] }));
  assert.equal(clientOutstandingCents(agreements, "cliente-1", "2026-11", reference), 31212);
  const summary = monthlyDailyInterestSummary(agreements.map(agreement => ({ agreement, installment: agreement.installments[0] })), reference);
  closeTo(summary.currentTotal, 300 * 1.02 ** 2);
});

test("reparcelamento soma apenas saldos ativos e preserva pagamentos anteriores", () => {
  const reference = "2026-10-03T12:00:00Z";
  const first = { clientId: "cliente-1", status: "OPEN", openAmount: "80", receivedAmount: "20", dailyInterestBaseAmount: "80", dailyInterestRate: "2", dailyInterestStartedAt: "2026-10-01T12:00:00Z", installments: [
    { id: "paga", amount: "20", remainingAmount: "0", dueDate: reference, paid: true },
    { id: "aberta", amount: "100", remainingAmount: "80", dueDate: reference, paid: false, dailyInterestActive: true, dailyInterestBaseAmount: "80", dailyInterestRate: "2", dailyInterestStartedAt: "2026-10-01T12:00:00Z" },
  ] };
  const second = { clientId: "cliente-1", status: "LATE", openAmount: "50", installments: [{ id: "outra", amount: "50", dueDate: reference, paid: false }] };
  const consolidated = { ...second, installments: [{ id: "historica", amount: "900", remainingAmount: "0", rescheduledIntoId: "novo-acordo", dueDate: reference, paid: false }] };
  assert.equal(clientOutstandingCents([first, second, consolidated], "cliente-1", null, reference), 8323 + 5000);
  assert.equal(clientOutstandingCents([first, second, consolidated], "outro-cliente", null, reference), 0);
  assert.equal(clientOutstandingCents([first, second], "cliente-1", "2026-11", reference), 0);
  assert.equal(monthlyInstallmentTotal([consolidated], "cliente-1", "2026-10", reference), 0);
});

test("mês específico usa só parcelas escolhidas, mesmo dentro de um acordo maior", () => {
  const agreement = { clientId: "cliente-1", status: "OPEN", openAmount: "200", installments: [
    { id: "outubro", amount: "100", dueDate: "2026-10-08T12:00:00Z", paid: false },
    { id: "novembro", amount: "100", dueDate: "2026-11-08T12:00:00Z", paid: false },
  ] };
  assert.equal(clientOutstandingCents([agreement], "cliente-1", "2026-10"), 10000);
  assert.equal(clientOutstandingCents([agreement], "cliente-1"), 20000);
  agreement.installments[0].rescheduledIntoId = "novo-acordo";
  agreement.installments[0].remainingAmount = "0";
  assert.equal(clientOutstandingCents([agreement], "cliente-1"), 10000);
  assert.equal(monthlyInstallmentTotal([agreement], "cliente-1", "2026-10"), 0);
  assert.equal(monthlyInstallmentTotal([agreement], "cliente-1", "2026-11"), 100);
});

test("novo juros de 40% sobre R$ 100 em duas parcelas gera 2x R$ 70", () => {
  const schedule = rescheduleTable(100, 40, 2);
  assert.equal(schedule.total, 140);
  assert.deepEqual(schedule.rows.map(row => row.amount), [70, 70]);
  assert.equal(schedule.rows.reduce((sum, row) => sum + row.amortization, 0), 100);
  const uneven = rescheduleTable(100, 0, 3);
  assert.equal(uneven.rows.reduce((sum, row) => sum + Math.round(row.amount * 100), 0), 10000);
});

test("reparcelar um mês congela sua parte do juros diário e mantém o outro mês ativo", () => {
  const agreement = { clientId: "cliente-1", status: "OPEN", openAmount: "200", dailyInterestBaseAmount: "200", dailyInterestRate: "2", dailyInterestStartedAt: "2026-10-01T12:00:00Z", installments: [
    { id: "outubro", amount: "100", dueDate: "2026-10-08T12:00:00Z", paid: false, dailyInterestActive: true, dailyInterestBaseAmount: "100", dailyInterestRate: "2", dailyInterestStartedAt: "2026-10-01T12:00:00Z" },
    { id: "novembro", amount: "100", dueDate: "2026-11-08T12:00:00Z", paid: false, dailyInterestActive: true, dailyInterestBaseAmount: "100", dailyInterestRate: "2", dailyInterestStartedAt: "2026-10-01T12:00:00Z" },
  ] };
  const transferAt = "2026-10-03T12:00:00Z";
  assert.equal(clientOutstandingCents([agreement], "cliente-1", "2026-10", transferAt), 10404);
  agreement.installments[0].rescheduledIntoId = "novo-acordo";
  agreement.installments[0].remainingAmount = "0";
  agreement.installments[0].dailyInterestActive = false;
  agreement.openAmount = "100";
  assert.equal(clientOutstandingCents([agreement], "cliente-1", "2026-10", "2026-10-04T12:00:00Z"), 0);
  assert.equal(clientOutstandingCents([agreement], "cliente-1", "2026-11", "2026-10-04T12:00:00Z"), 10612);
});

test("quadro mensal consolida juros de vários acordos em um único total", () => {
  const first = { clientId: "cliente-1", openAmount: "53.60", status: "OPEN", installments: [{ amount: "53.60", amortization: "40", dueDate: "2026-10-08T12:00:00Z", paid: false, dailyInterestActive: true, dailyInterestBaseAmount: "53.60", dailyInterestRate: "2", dailyInterestStartedAt: "2026-10-01T12:00:00Z" }] };
  const second = { clientId: "cliente-1", openAmount: "460", status: "OPEN", installments: [{ amount: "460", amortization: "400", dueDate: "2026-10-08T12:00:00Z", paid: false, dailyInterestActive: true, dailyInterestBaseAmount: "460", dailyInterestRate: "2", dailyInterestStartedAt: "2026-10-01T12:00:00Z" }] };
  const items = [{ agreement: first, installment: first.installments[0] }, { agreement: second, installment: second.installments[0] }];
  const summary = monthlyDailyInterestSummary(items, "2026-10-03T12:00:00Z");
  closeTo(summary.originalWithoutInterest, 440);
  closeTo(summary.originalTotal, 513.6);
  closeTo(summary.baseTotal, 513.6);
  closeTo(summary.currentTotal, 513.6 * 1.02 ** 2);
  closeTo(summary.accruedInterest, summary.currentTotal - summary.baseTotal);
  assert.deepEqual(summary.rates, [2]);
  assert.deepEqual(summary.days, [2]);
});

test("quadro mensal mantém abatimento parcial e identifica taxas diferentes", () => {
  const partial = { clientId: "cliente-1", openAmount: "40", receivedAmount: "30", status: "OPEN", installments: [{ amount: "70", amortization: "50", remainingAmount: "40", dueDate: "2026-10-08T12:00:00Z", paid: false, dailyInterestActive: true, dailyInterestBaseAmount: "40", dailyInterestRate: "2", dailyInterestStartedAt: "2026-10-01T12:00:00Z" }] };
  const other = { clientId: "cliente-1", openAmount: "30", status: "OPEN", installments: [{ amount: "30", amortization: "30", dueDate: "2026-10-08T12:00:00Z", paid: false, dailyInterestActive: true, dailyInterestBaseAmount: "30", dailyInterestRate: "1", dailyInterestStartedAt: "2026-10-02T12:00:00Z" }] };
  const items = [{ agreement: partial, installment: partial.installments[0] }, { agreement: other, installment: other.installments[0] }];
  const summary = monthlyDailyInterestSummary(items, "2026-10-03T12:00:00Z");
  closeTo(summary.originalWithoutInterest, 80);
  closeTo(summary.originalTotal, 100);
  closeTo(summary.baseTotal, 70);
  closeTo(summary.currentTotal, 40 * 1.02 ** 2 + 30 * 1.01);
  assert.deepEqual(summary.rates, [1, 2]);
  assert.deepEqual(summary.days, [1, 2]);
  assert.equal(monthlyDailyInterestSummary([{ agreement: other, installment: { ...other.installments[0], dailyInterestActive: false } }], "2026-10-03T12:00:00Z"), null);
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
      { amount: "70", dueDate: "2026-10-08T12:00:00Z", paid: false, dailyInterestActive: true, dailyInterestBaseAmount: "70", dailyInterestRate: "2", dailyInterestStartedAt: "2026-09-22T12:00:00Z" },
      { amount: "70", dueDate: "2026-11-08T12:00:00Z", paid: false, dailyInterestActive: false },
    ] },
    { clientId: "cliente-1", openAmount: "30", installments: [{ amount: "30", dueDate: "2026-10-20T12:00:00Z", paid: true }] },
    { clientId: "cliente-2", openAmount: "900", installments: [{ amount: "900", dueDate: "2026-10-08T12:00:00Z", paid: false }] },
  ];
  const referenceDate = "2026-09-24T12:00:00Z";
  closeTo(monthlyInstallmentTotal(agreements, "cliente-1", "2026-10", referenceDate), 70 * 1.02 ** 2 + 30);
  closeTo(monthlyInstallmentTotal(agreements, "cliente-1", "2026-11", referenceDate), 70);
  assert.equal(monthlyInstallmentTotal(agreements, "cliente-1", "2026-12", referenceDate), 0);
  assert.equal(monthlyInstallmentTotal(agreements, "cliente-2", "2026-10", referenceDate), 900);
});

test("pagamento parcial do mês abate parcelas antigas e juros usa somente o saldo novo", () => {
  const agreement = { clientId: "cliente-1", openAmount: "140", receivedAmount: null, installments: [
    { id: "outubro", number: 1, amount: "70", dueDate: "2026-10-08T12:00:00Z", paid: false },
    { id: "novembro", number: 2, amount: "70", dueDate: "2026-11-08T12:00:00Z", paid: false },
  ] };
  const before = capitalizedInstallmentCents(agreement, "2026-10-09T12:00:00Z");
  assert.deepEqual([...before.values()], [7000, 7000]);
  const allocations = allocatePartialPaymentCents([{ id: "outubro", balanceCents: before.get("outubro") }], 3000);
  assert.equal(allocations.get("outubro"), 3000);
  agreement.installments[0].remainingAmount = "40";
  agreement.openAmount = "110";
  agreement.receivedAmount = "30";
  assert.equal(monthlyInstallmentTotal([agreement], "cliente-1", "2026-10"), 40);
  assert.equal(monthlyInstallmentTotal([agreement], "cliente-1", "2026-11"), 70);
  agreement.dailyInterestBaseAmount = "110";
  agreement.dailyInterestRate = "2";
  agreement.dailyInterestStartedAt = "2026-10-09T12:00:00Z";
  agreement.installments[0].dailyInterestActive = true;
  agreement.installments[0].dailyInterestBaseAmount = "40";
  agreement.installments[0].dailyInterestRate = "2";
  agreement.installments[0].dailyInterestStartedAt = "2026-10-09T12:00:00Z";
  const reference = "2026-10-11T12:00:00Z";
  closeTo(reportAgreementInstallmentValue(agreement, agreement.installments[0], reference), 40 * 1.02 ** 2);
  closeTo(reportAgreementInstallmentValue(agreement, agreement.installments[1], reference), 70);
  closeTo([...capitalizedInstallmentCents(agreement, reference).values()].reduce((sum, value) => sum + value, 0) / 100, 111.62, 0.01);
  assert.throws(() => allocatePartialPaymentCents([{ id: "outubro", balanceCents: 4000 }], 4000));
});

test("pagamento parcial de mês com vários acordos segue a ordem de vencimento", () => {
  const allocations = allocatePartialPaymentCents([
    { id: "primeira", balanceCents: 5000 },
    { id: "segunda", balanceCents: 7000 },
    { id: "terceira", balanceCents: 4000 },
  ], 8000);
  assert.deepEqual([...allocations], [["primeira", 5000], ["segunda", 3000]]);
  const centsAllocation = allocatePartialPaymentCents([
    { id: "primeira", balanceCents: 7000 },
    { id: "segunda", balanceCents: 7000 },
  ], 7001);
  assert.deepEqual([...centsAllocation], [["primeira", 7000], ["segunda", 1]]);
});

test("juros avança na virada do dia em São Paulo, mesmo antes de completar 24 horas", () => {
  const start = "2026-11-09T01:30:00Z"; // 08/11 às 22h30 em São Paulo
  const onEighth = dailyInterest(10, 2, start, "2026-11-09T02:59:59Z");
  const onNinth = dailyInterest(10, 2, start, "2026-11-09T03:00:00Z");
  const onTenth = dailyInterest(10, 2, start, "2026-11-10T03:00:00Z");
  assert.equal(onEighth.days, 0);
  assert.equal(onNinth.days, 1);
  assert.equal(onTenth.days, 2);
  closeTo(onNinth.updatedAmount, 10.2);
  closeTo(onTenth.updatedAmount, 10.404);
  closeTo(dailyInterest(10, 2, start, "2026-11-10T03:00:00Z").updatedAmount, 10.404);
  assert.equal(dailyInterest(10, 2, start, "2026-11-08T12:00:00Z").days, 0);
});

test("parcela de novembro vencida no dia 08 acumula juros nos dias 09 e 10 sem afetar outros meses", () => {
  const agreement = { clientId: "cliente-1", status: "OPEN", openAmount: "150", installments: [
    { id: "outubro", amount: "20", dueDate: "2026-10-08T12:00:00Z", paid: false, dailyInterestActive: false },
    { id: "novembro", amount: "100", dueDate: "2026-11-08T12:00:00Z", paid: false, dailyInterestActive: true, dailyInterestRate: "2", dailyInterestBaseAmount: "100", dailyInterestStartedAt: "2026-11-09T01:30:00Z" },
    { id: "dezembro", amount: "30", dueDate: "2026-12-08T12:00:00Z", paid: false, dailyInterestActive: false },
  ] };
  const reference = "2026-11-10T03:00:00Z";
  assert.equal(clientOutstandingCents([agreement], "cliente-1", "2026-11", reference), 10404);
  assert.equal(clientOutstandingCents([agreement], "cliente-1", "2026-10", reference), 2000);
  assert.equal(clientOutstandingCents([agreement], "cliente-1", "2026-12", reference), 3000);
});

test("pagamento parcial em 10/11 preserva o juros de 09/11 sobre o valor integral", () => {
  const start = "2026-11-08T12:00:00Z";
  const paidAt = "2026-11-10T15:00:00Z";
  const updated = dailyInterestBalanceAfterPartialPayment(100, 2, start, 3000, paidAt);
  assert.equal(updated.availableCents, 10200);
  assert.equal(updated.baseCents, 7200);
  assert.equal(updated.balanceCents, 7344);
  closeTo(dailyInterest(updated.baseCents / 100, 2, updated.anchor, "2026-11-11T15:00:00Z").updatedAmount, 74.9088);
  const sameDay = dailyInterestBalanceAfterPartialPayment(100, 2, paidAt, 3000, paidAt);
  assert.equal(sameDay.balanceCents, 7000);
  assert.throws(() => dailyInterestBalanceAfterPartialPayment(100, 2, start, 10201, paidAt));
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
