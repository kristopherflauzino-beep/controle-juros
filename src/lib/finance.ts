export type Row = { number: number; amount: number; interest: number; amortization: number; balance: number };
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function priceTable(principal: number, monthlyRate: number, count: number): { payment: number; total: number; interest: number; rows: Row[] } {
  if (!(principal > 0) || !(count >= 1) || monthlyRate < 0) throw new Error("Parâmetros financeiros inválidos");
  const i = monthlyRate / 100;
  const payment = i === 0 ? principal / count : principal * (i * (1 + i) ** count) / ((1 + i) ** count - 1);
  let balance = principal;
  const rows = Array.from({ length: count }, (_, index) => {
    const interest = balance * i;
    const amortization = payment - interest;
    balance = Math.max(0, balance - amortization);
    return { number: index + 1, amount: round(payment), interest: round(interest), amortization: round(amortization), balance: round(balance) };
  });
  const total = payment * count;
  return { payment: round(payment), total: round(total), interest: round(total - principal), rows };
}

export function flatProgressiveTable(principal: number, baseRate: number, count: number): { payment: number; total: number; interest: number; rows: Row[]; effectiveRate: number } {
  if (!(principal > 0) || !(count >= 1) || baseRate < 0) throw new Error("Parâmetros financeiros inválidos");
  const total = round(principal * (1 + baseRate / 100) ** Math.max(1, count - 1));
  const effectiveRate = round((total / principal - 1) * 100);
  const payment = round(total / count);
  const rows = Array.from({ length: count }, (_, index) => {
    const paid = round(payment * (index + 1));
    return {
      number: index + 1,
      amount: payment,
      interest: round(payment - principal / count),
      amortization: round(principal / count),
      balance: round(Math.max(0, total - paid))
    };
  });
  return { payment, total, interest: round(total - principal), rows, effectiveRate: round(effectiveRate) };
}


export function monthlyDueDate(firstDueDate: Date | string, monthOffset: number) {
  const first = new Date(firstDueDate);
  const year = first.getUTCFullYear(), month = first.getUTCMonth() + monthOffset, day = first.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay), 12));
}
export function dailyInterest(baseAmount: number, rate: number, startedAt?: Date | string | null, referenceDate: Date | string = new Date()) {
  if (!Number.isFinite(baseAmount) || baseAmount < 0) throw new Error("Valor base inválido");
  if (!Number.isFinite(rate) || rate < 0) throw new Error("Taxa diária inválida");
  if (!startedAt) return { days: 0, accumulated: 0, updatedAmount: baseAmount };
  const startTime = new Date(startedAt).getTime(), referenceTime = new Date(referenceDate).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(referenceTime)) throw new Error("Data de juros inválida");
  const days = Math.max(0, Math.floor((referenceTime - startTime) / 86_400_000));
  const updatedAmount = baseAmount * (1 + rate / 100) ** days;
  return { days, accumulated: updatedAmount - baseAmount, updatedAmount };
}

export function reportInstallmentValue(amount: number, unpaidTotal: number, baseAmount: number, rate: number, startedAt?: Date | string | null, referenceDate: Date | string = new Date()) {
  if (!startedAt || unpaidTotal <= 0) return amount;
  const accrued = dailyInterest(baseAmount, rate, startedAt, referenceDate).accumulated;
  return amount + accrued * amount / unpaidTotal;
}

type MoneyValue = number | string | { toString(): string };
type MonthlyAgreement = {
  clientId: string;
  openAmount: MoneyValue;
  receivedAmount?: MoneyValue | null;
  dailyInterestBaseAmount?: MoneyValue | null;
  dailyInterestRate?: MoneyValue | null;
  dailyInterestStartedAt?: Date | string | null;
  installments: { amount: MoneyValue; remainingAmount?: MoneyValue | null; dueDate: Date | string; paid: boolean }[];
};

export function installmentBalance(installment: MonthlyAgreement["installments"][number]) {
  return Number(installment.remainingAmount ?? installment.amount);
}

export function reportAgreementInstallmentValue(agreement: MonthlyAgreement, installment: MonthlyAgreement["installments"][number], referenceDate: Date | string = new Date()) {
  const amount = installmentBalance(installment);
  if (installment.paid) return amount;
  const unpaidTotal = agreement.installments.filter(item => !item.paid).reduce((sum, item) => sum + installmentBalance(item), 0);
  if (unpaidTotal <= 0) return 0;
  if (agreement.receivedAmount != null) {
    const updated = dailyInterest(Number(agreement.dailyInterestBaseAmount ?? agreement.openAmount), Number(agreement.dailyInterestRate ?? 0), agreement.dailyInterestStartedAt, referenceDate).updatedAmount;
    return updated * amount / unpaidTotal;
  }
  return reportInstallmentValue(amount, unpaidTotal, Number(agreement.dailyInterestBaseAmount ?? agreement.openAmount), Number(agreement.dailyInterestRate ?? 0), agreement.dailyInterestStartedAt, referenceDate);
}

export function capitalizedInstallmentCents(agreement: Omit<MonthlyAgreement, "installments"> & { installments: (MonthlyAgreement["installments"][number] & { id: string; number?: number })[] }, referenceDate: Date | string = new Date()) {
  const unpaid = agreement.installments.filter(item => !item.paid).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime() || (a.number ?? 0) - (b.number ?? 0));
  const values = unpaid.map(item => reportAgreementInstallmentValue(agreement, item, referenceDate));
  let centsLeft = Math.round(values.reduce((sum, value) => sum + value, 0) * 100);
  if (!Number.isSafeInteger(centsLeft) || centsLeft < 0) throw new Error("Saldo financeiro inválido");
  const balances = new Map<string, number>();
  unpaid.forEach((item, index) => {
    const value = index === unpaid.length - 1 ? centsLeft : Math.min(centsLeft, Math.round(values[index] * 100));
    balances.set(item.id, value);
    centsLeft -= value;
  });
  return balances;
}

export function allocatePartialPaymentCents(items: { id: string; balanceCents: number }[], paymentCents: number) {
  const total = items.reduce((sum, item) => sum + item.balanceCents, 0);
  if (!Number.isSafeInteger(paymentCents) || paymentCents <= 0 || paymentCents >= total) throw new Error("Pagamento parcial inválido");
  let left = paymentCents;
  const allocations = new Map<string, number>();
  for (const item of items) {
    const amount = Math.min(left, item.balanceCents);
    if (amount > 0) allocations.set(item.id, amount);
    left -= amount;
  }
  return allocations;
}

export function monthlyInstallmentTotal(agreements: MonthlyAgreement[], clientId: string, month: string, referenceDate: Date | string = new Date()) {
  return agreements.filter(agreement => agreement.clientId === clientId).reduce((total, agreement) => {
    return total + agreement.installments.reduce((sum, installment) => {
      if (new Date(installment.dueDate).toISOString().slice(0, 7) !== month) return sum;
      return sum + reportAgreementInstallmentValue(agreement, installment, referenceDate);
    }, 0);
  }, 0);
}

export function agreementTableFromTotal(total: number, baseRate: number, count: number) {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(baseRate) || baseRate < 0 || !Number.isInteger(count) || count < 1) {
    throw new Error("Parâmetros financeiros inválidos");
  }
  // Inverte a mesma fórmula usada em flatProgressiveTable para que o total
  // informado pelo administrador seja exatamente o total salvo no acordo.
  const factor = (1 + baseRate / 100) ** Math.max(1, count - 1);
  const principal = round(total / factor);
  if (!Number.isFinite(principal) || principal <= 0) throw new Error("Principal inválido para a taxa e o número de parcelas");
  const cents = Math.round(total * 100);
  if (cents < count) throw new Error("O total deve permitir parcelas de pelo menos R$ 0,01");
  const principalCents = Math.round(principal * 100);
  const baseCents = Math.floor(cents / count);
  const basePrincipalCents = Math.floor(principalCents / count);
  let paidCents = 0;
  const rows = Array.from({ length: count }, (_, index) => {
    const amountCents = baseCents + (index < cents % count ? 1 : 0);
    paidCents += amountCents;
    const amount = amountCents / 100;
    const amortizationCents = basePrincipalCents + (index < principalCents % count ? 1 : 0);
    const amortization = amortizationCents / 100;
    return {
      number: index + 1,
      amount,
      interest: (amountCents - amortizationCents) / 100,
      amortization,
      balance: round((cents - paidCents) / 100),
    };
  });
  return { principal, payment: rows[0].amount, total: cents / 100, rows };
}
