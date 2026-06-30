export type PriceRow = {
  number: number;
  paymentValue: number;
  interestValue: number;
  amortization: number;
  remainingValue: number;
};

export type PriceResult = {
  originalValue: number;
  interestRate: number;
  installmentsCount: number;
  installmentValue: number;
  totalFinal: number;
  totalInterest: number;
  rows: PriceRow[];
};

export type DailyInterestResult = {
  baseOpenAmount: number;
  dailyRate: number;
  startedAt: string | null;
  daysCount: number;
  accumulatedInterest: number;
  updatedAmount: number;
};

export function roundMoney(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.replace(",", "."));
  if (value && typeof value === "object" && "toString" in value) return Number(String(value));
  return 0;
}

export function addMonths(date: Date, months: number): Date {
  const copy = new Date(date.getTime());
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

export function calculatePriceSchedule(
  originalValue: number,
  interestRatePercent: number,
  installmentsCount: number
): PriceResult {
  const pv = toNumber(originalValue);
  const rate = toNumber(interestRatePercent);
  const n = Math.trunc(toNumber(installmentsCount));

  if (!Number.isFinite(pv) || pv <= 0) throw new Error("Valor financiado inválido.");
  if (!Number.isFinite(rate) || rate < 0) throw new Error("Taxa de juros inválida.");
  if (!Number.isInteger(n) || n < 1) throw new Error("Quantidade de parcelas inválida.");

  const i = rate / 100;
  let installmentValue: number;

  if (i === 0) {
    installmentValue = pv / n;
  } else {
    installmentValue = pv * ((i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1));
  }

  installmentValue = roundMoney(installmentValue);
  const rows: PriceRow[] = [];
  let balance = pv;

  for (let number = 1; number <= n; number++) {
    const interestValue = roundMoney(balance * i);
    let amortization = roundMoney(installmentValue - interestValue);
    if (number === n) {
      amortization = roundMoney(balance);
    }
    const paymentValue = number === n ? roundMoney(interestValue + amortization) : installmentValue;
    balance = roundMoney(balance - amortization);

    rows.push({
      number,
      paymentValue,
      interestValue,
      amortization,
      remainingValue: Math.max(0, balance)
    });
  }

  const totalFinal = roundMoney(rows.reduce((sum, row) => sum + row.paymentValue, 0));
  const totalInterest = roundMoney(totalFinal - pv);

  return {
    originalValue: roundMoney(pv),
    interestRate: rate,
    installmentsCount: n,
    installmentValue,
    totalFinal,
    totalInterest,
    rows
  };
}

export function daysBetween(startDate: Date, endDate = new Date()): number {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
  return Math.max(0, Math.floor((end - start) / 86400000));
}

export function calculateDailyInterest(
  openAmount: number,
  dailyInterestRatePercent?: number | null,
  startedAt?: Date | string | null,
  endDate = new Date()
): DailyInterestResult {
  const baseOpenAmount = roundMoney(toNumber(openAmount));
  const dailyRate = toNumber(dailyInterestRatePercent ?? 0);

  if (!startedAt || dailyRate <= 0) {
    return {
      baseOpenAmount,
      dailyRate,
      startedAt: startedAt ? new Date(startedAt).toISOString() : null,
      daysCount: 0,
      accumulatedInterest: 0,
      updatedAmount: baseOpenAmount
    };
  }

  const start = new Date(startedAt);
  const daysCount = daysBetween(start, endDate);
  const updatedAmount = roundMoney(baseOpenAmount * Math.pow(1 + dailyRate / 100, daysCount));
  const accumulatedInterest = roundMoney(updatedAmount - baseOpenAmount);

  return {
    baseOpenAmount,
    dailyRate,
    startedAt: start.toISOString(),
    daysCount,
    accumulatedInterest,
    updatedAmount
  };
}

export function brl(value: unknown): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(toNumber(value));
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}
