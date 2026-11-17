import assert from "node:assert/strict";
import test from "node:test";
import { agreementTableFromTotal, allocatePartialPaymentCents, capitalizedInstallmentCents, clientOutstandingCents, dailyInterest, dailyInterestBalanceAfterPartialPayment, flatProgressiveTable, monthlyDailyInterestSummary, monthlyDueDate, monthlyInstallmentTotal, overdueDailyInterest, reportAgreementInstallmentValue, reportInstallmentValue, rescheduleTable } from "../src/lib/finance.ts";

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
  closeTo(updated.baseAfterPayment, 72);
  assert.equal(updated.balanceCents, 7344);
  closeTo(dailyInterest(updated.baseAfterPayment, 2, updated.anchor, "2026-11-11T15:00:00Z").updatedAmount, 74.9088);
  const sameDay = dailyInterestBalanceAfterPartialPayment(100, 2, paidAt, 3000, paidAt);
  assert.equal(sameDay.balanceCents, 7000);
  assert.throws(() => dailyInterestBalanceAfterPartialPayment(100, 2, start, 10201, paidAt));
});

test("R$ 500 pagos em 10/11 preservam juros compostos sobre R$ 1.268,10 antes da baixa", () => {
  const result = dailyInterestBalanceAfterPartialPayment(1268.1, 2, "2026-11-08T12:00:00Z", 50000, "2026-11-10T12:00:00Z");
  closeTo(result.accruedBeforePayment, 25.362);
  closeTo(result.baseAfterPayment, 793.462);
  assert.equal(result.balanceCents, 80933);
  closeTo(dailyInterest(result.baseAfterPayment, 2, result.anchor, "2026-11-11T12:00:00Z").updatedAmount, 825.5178648);
});

test("resumo de novembro preserva juros anteriores à baixa e arredonda o total uma vez", () => {
  const balances = [515, 100, 140], amounts = [515, 140, 140], amortizations = [515, 100, 100];
  const bases = [541.2356688742, 105.0943046358, 147.13202649];
  const carried = [17.2999072848, 3.359205298, 4.7028874172];
  const agreement = { clientId: "luis", status: "OPEN", openAmount: "755", installments: balances.map((balance, index) => ({
    amount: amounts[index], remainingAmount: balance, amortization: amortizations[index], dueDate: "2026-11-08T12:00:00Z",
    paid: false, dailyInterestActive: true, dailyInterestRate: 2, dailyInterestStartedAt: "2026-11-09T12:00:00Z",
    dailyInterestBaseAmount: bases[index], dailyInterestCarried: carried[index],
  })) };
  const items = agreement.installments.map(installment => ({ agreement, installment }));
  const today = monthlyDailyInterestSummary(items, "2026-11-10T12:00:00Z");
  closeTo(today.baseTotal, 768.1);
  closeTo(today.carriedInterest, 25.362);
  closeTo(today.accruedInterest, 41.23124);
  assert.equal(Math.round(today.currentTotal * 100), 80933);
  const tomorrow = monthlyDailyInterestSummary(items, "2026-11-11T12:00:00Z");
  closeTo(tomorrow.baseTotal, 768.1);
  assert.equal(Math.round(tomorrow.currentTotal * 100), 82552);
});

test("ativação começa no dia zero e o total mensal arredonda só na apresentação", () => {
  const activatedAt = "2026-11-10T14:00:00Z";
  assert.equal(dailyInterest(10, 2, activatedAt, "2026-11-11T02:59:59Z").days, 0);
  assert.equal(dailyInterest(10, 2, activatedAt, "2026-11-11T03:00:00Z").days, 1);
  const bases = [541.2356688742, 105.0943046358, 147.13202649];
  for (const [reference, expected] of [
    ["2026-11-10T12:00:00Z", 80933],
    ["2026-11-11T12:00:00Z", 82552],
  ]) {
    const total = bases.reduce((sum, base) => sum + dailyInterest(base, 2, "2026-11-09T12:00:00Z", reference).updatedAmount, 0);
    assert.equal(Math.round(total * 100), expected);
  }
});

test("saldo existente em 17/11 permanece igual e parcelas futuras esperam o vencimento", () => {
  const base = 100, rate = 2, activated = "2026-11-10T12:00:00Z", due = "2026-11-20T12:00:00Z";
  const onCutoff = dailyInterest(base, rate, activated, "2026-11-17T12:00:00Z").updatedAmount;
  closeTo(overdueDailyInterest(base, rate, activated, due, "2026-11-17T12:00:00Z").updatedAmount, onCutoff);
  for (const day of [18, 19, 20]) closeTo(overdueDailyInterest(base, rate, activated, due, `2026-11-${day}T12:00:00Z`).updatedAmount, onCutoff);
  closeTo(overdueDailyInterest(base, rate, activated, due, "2026-11-21T02:59:59Z").updatedAmount, onCutoff);
  closeTo(overdueDailyInterest(base, rate, activated, due, "2026-11-21T03:00:00Z").updatedAmount, onCutoff * 1.02);
});

test("parcela vencida cresce na primeira virada após 17/11; pausa e retomada conservam o saldo", () => {
  const due = "2026-11-08T12:00:00Z", activated = "2026-11-10T12:00:00Z";
  const onCutoff = overdueDailyInterest(100, 2, activated, due, "2026-11-17T12:00:00Z").updatedAmount;
  closeTo(overdueDailyInterest(100, 2, activated, due, "2026-11-18T03:00:00Z").updatedAmount, onCutoff * 1.02);
  const pausedAt = "2026-11-18T12:00:00Z", frozen = onCutoff * 1.02;
  closeTo(overdueDailyInterest(frozen, 2, pausedAt, due, "2026-12-01T12:00:00Z", true).updatedAmount, frozen);
  closeTo(overdueDailyInterest(frozen, 2, "2026-11-25T12:00:00Z", due, "2026-11-26T12:00:00Z").updatedAmount, frozen * 1.02);
});

test("pagamento parcial após corte não acrescenta juros a parcela ainda não vencida", () => {
  const result = dailyInterestBalanceAfterPartialPayment(100, 2, "2026-11-17T12:00:00Z", 3000, "2026-11-18T12:00:00Z", "2026-11-20T12:00:00Z");
  assert.equal(result.balanceCents, 7000);
  closeTo(overdueDailyInterest(result.baseAfterPayment, 2, result.anchor, "2026-11-20T12:00:00Z", "2026-11-20T12:00:00Z").updatedAmount, 70);
  closeTo(overdueDailyInterest(result.baseAfterPayment, 2, result.anchor, "2026-11-20T12:00:00Z", "2026-11-21T12:00:00Z").updatedAmount, 71.4);
});

test("relatório mensal soma apenas juros novos das parcelas vencidas e conserva pausa", () => {
  const agreement = { clientId: "cliente", status: "OPEN", openAmount: 200, installments: [
    { id: "vencida", amount: 100, amortization: 100, dueDate: "2026-11-08T12:00:00Z", paid: false, dailyInterestActive: true, dailyInterestRate: 2, dailyInterestStartedAt: "2026-11-17T12:00:00Z", dailyInterestBaseAmount: 100 },
    { id: "futura", amount: 100, amortization: 100, dueDate: "2026-11-20T12:00:00Z", paid: false, dailyInterestActive: true, dailyInterestRate: 2, dailyInterestStartedAt: "2026-11-17T12:00:00Z", dailyInterestBaseAmount: 100 },
  ] };
  assert.equal(Math.round(monthlyInstallmentTotal([agreement], "cliente", "2026-11", "2026-11-18T12:00:00Z") * 100), 20200);
  agreement.installments[0].dailyInterestPaused = true;
  agreement.installments[0].dailyInterestCarried = 0;
  assert.equal(Math.round(monthlyInstallmentTotal([agreement], "cliente", "2026-11", "2026-11-25T12:00:00Z") * 100), 21041);
  agreement.installments[1].dailyInterestPaused = true;
  agreement.installments[1].dailyInterestBaseAmount = 110.40808;
  agreement.installments[1].dailyInterestStartedAt = "2026-11-25T12:00:00Z";
  const summary = monthlyDailyInterestSummary(agreement.installments.map(installment => ({ agreement, installment })), "2026-12-01T12:00:00Z");
  assert.equal(summary.paused, true);
  assert.equal(Math.round(summary.currentTotal * 100), 21041);
});

test("ajuste pontual de novembro exibe R$ 750 sem alterar a parcela já paga", () => {
  const amounts = [344.7813809171, 172.3886190829, 0, 70, 39.7, 123.13];
  const paid = [false, false, true, false, false, true];
  const agreement = { clientId: "luis", status: "OPEN", openAmount: 626.87, installments: amounts.map((amount, index) => ({
    id: `novembro-${index}`, amount, remainingAmount: amount, dueDate: "2026-11-08T12:00:00Z", paid: paid[index],
    dailyInterestActive: index < 2, dailyInterestPaused: index < 2, dailyInterestBaseAmount: amount, dailyInterestRate: 2,
    dailyInterestStartedAt: index < 2 ? "2026-11-17T12:00:00Z" : null,
  })) };
  assert.equal(Math.round(monthlyInstallmentTotal([agreement], "luis", "2026-11", "2026-11-17T16:00:00Z") * 100), 75000);
  assert.equal(Math.round(monthlyInstallmentTotal([agreement], "luis", "2026-11", "2026-11-25T16:00:00Z") * 100), 75000);
  assert.equal(agreement.installments[5].remainingAmount, 123.13);
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
