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
const brazilianCalendarDay = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
});

function calendarDayIndex(date: Date) {
  const parts = brazilianCalendarDay.formatToParts(date);
  const year = Number(parts.find(part => part.type === "year")?.value);
  const month = Number(parts.find(part => part.type === "month")?.value);
  const day = Number(parts.find(part => part.type === "day")?.value);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function dailyInterestBalanceAfterPartialPayment(baseAmount: number, rate: number, startedAt: Date | string, paymentCents: number, paidAt: Date | string) {
  const start = new Date(startedAt), payment = new Date(paidAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(payment.getTime())) throw new Error("Data de juros inválida");
  if (!Number.isSafeInteger(paymentCents) || paymentCents < 0) throw new Error("Pagamento parcial inválido");
  const paymentDay = calendarDayIndex(payment);
  const anchor = calendarDayIndex(start) < paymentDay
    ? new Date((paymentDay - 1) * 86_400_000 + 43_200_000)
    : payment;
  const availableCents = Math.round(dailyInterest(baseAmount, rate, start, anchor).updatedAmount * 100);
  if (paymentCents > availableCents) throw new Error("Pagamento excede o saldo anterior aos juros de hoje");
  const baseCents = availableCents - paymentCents;
  const balanceCents = Math.round(dailyInterest(baseCents / 100, rate, anchor, payment).updatedAmount * 100);
  return { availableCents, baseCents, balanceCents, anchor };
}

export function dailyInterest(baseAmount: number, rate: number, startedAt?: Date | string | null, referenceDate: Date | string = new Date()) {
  if (!Number.isFinite(baseAmount) || baseAmount < 0) throw new Error("Valor base inválido");
  if (!Number.isFinite(rate) || rate < 0) throw new Error("Taxa diária inválida");
  if (!startedAt) return { days: 0, accumulated: 0, updatedAmount: baseAmount };
  const start = new Date(startedAt), reference = new Date(referenceDate);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(reference.getTime())) throw new Error("Data de juros inválida");
  const days = Math.max(0, calendarDayIndex(reference) - calendarDayIndex(start));
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
  status?: string;
  dailyInterestActive?: boolean;
  dailyInterestBaseAmount?: MoneyValue | null;
  dailyInterestRate?: MoneyValue | null;
  dailyInterestStartedAt?: Date | string | null;
  installments: { amount: MoneyValue; remainingAmount?: MoneyValue | null; rescheduledIntoId?: string | null; dueDate: Date | string; paid: boolean; dailyInterestActive?: boolean; dailyInterestRate?: MoneyValue | null; dailyInterestStartedAt?: Date | string | null; dailyInterestBaseAmount?: MoneyValue | null }[];
};

export function installmentBalance(installment: MonthlyAgreement["installments"][number]) {
  return Number(installment.remainingAmount ?? installment.amount);
}

export function reportAgreementInstallmentValue(agreement: MonthlyAgreement, installment: MonthlyAgreement["installments"][number], referenceDate: Date | string = new Date()) {
  const amount = installmentBalance(installment);
  if (installment.paid) return amount;
  if (installment.dailyInterestActive && installment.dailyInterestStartedAt) {
    return dailyInterest(Number(installment.dailyInterestBaseAmount ?? amount), Number(installment.dailyInterestRate ?? 0), installment.dailyInterestStartedAt, referenceDate).updatedAmount;
  }
  return amount;
}

export function monthlyDailyInterestSummary(items: { agreement: MonthlyAgreement; installment: MonthlyAgreement["installments"][number] & { amortization: MoneyValue } }[], referenceDate: Date | string = new Date()) {
  const active = items.filter(({ agreement, installment }) => !installment.paid && agreement.status !== "PAID" && installment.dailyInterestActive && installment.dailyInterestStartedAt);
  if (!active.length) return null;
  const currentTotal = items.reduce((sum, { agreement, installment }) => sum + reportAgreementInstallmentValue(agreement, installment, referenceDate), 0);
  const originalWithoutInterest = items.reduce((sum, { installment }) => sum + Number(installment.amortization), 0);
  const originalTotal = items.reduce((sum, { installment }) => sum + Number(installment.amount), 0);
  let accruedInterest = 0;
  const rates = new Set<number>(), days = new Set<number>();
  for (const { installment } of active) {
    const rate = Number(installment.dailyInterestRate ?? 0);
    const result = dailyInterest(Number(installment.dailyInterestBaseAmount ?? installmentBalance(installment)), rate, installment.dailyInterestStartedAt, referenceDate);
    accruedInterest += result.accumulated;
    rates.add(rate);
    days.add(result.days);
  }
  return { originalWithoutInterest, originalTotal, baseTotal: currentTotal - accruedInterest, currentTotal, accruedInterest, rates: [...rates].sort((a, b) => a - b), days: [...days].sort((a, b) => a - b) };
}

export function capitalizedInstallmentCents(agreement: Omit<MonthlyAgreement, "installments"> & { installments: (MonthlyAgreement["installments"][number] & { id: string; number?: number })[] }, referenceDate: Date | string = new Date()) {
  const unpaid = agreement.installments.filter(item => !item.paid && !item.rescheduledIntoId).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime() || (a.number ?? 0) - (b.number ?? 0));
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

export function clientOutstandingCents(agreements: (Omit<MonthlyAgreement, "installments"> & { installments: (MonthlyAgreement["installments"][number] & { id: string; number?: number })[] })[], clientId: string, month: string | null = null, referenceDate: Date | string = new Date()) {
  return agreements.filter(agreement => agreement.clientId === clientId && (agreement.status === "OPEN" || agreement.status === "LATE"))
    .reduce((total, agreement) => {
      const balances = capitalizedInstallmentCents(agreement, referenceDate);
      return total + agreement.installments.filter(item => !item.paid && !item.rescheduledIntoId && (!month || new Date(item.dueDate).toISOString().slice(0, 7) === month))
        .reduce((sum, item) => sum + (balances.get(item.id) || 0), 0);
    }, 0);
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
      if (installment.rescheduledIntoId) return sum;
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

export function rescheduleTable(baseAmount: number, interestRate: number, count: number) {
  const calculated = flatProgressiveTable(baseAmount, interestRate, count);
  const totalCents = Math.round(calculated.total * 100), principalCents = Math.round(baseAmount * 100);
  if (!Number.isSafeInteger(totalCents) || !Number.isSafeInteger(principalCents) || count > principalCents) throw new Error("Saldo insuficiente para o número de parcelas");
  const amountPerRow = Math.floor(totalCents / count), principalPerRow = Math.floor(principalCents / count);
  let paidCents = 0;
  const rows = Array.from({ length: count }, (_, index) => {
    const amountCents = amountPerRow + (index < totalCents % count ? 1 : 0);
    const principalForRow = principalPerRow + (index < principalCents % count ? 1 : 0);
    paidCents += amountCents;
    return { number: index + 1, amount: amountCents / 100, interest: (amountCents - principalForRow) / 100,
      amortization: principalForRow / 100, balance: (totalCents - paidCents) / 100 };
  });
  return { total: totalCents / 100, payment: rows[0].amount, rows };
}
