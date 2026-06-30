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

export function dailyInterest(openAmount: number, rate: number, startedAt?: Date | string | null) {
  if (!startedAt || rate <= 0) return { days: 0, accumulated: 0, updatedAmount: openAmount };
  const start = new Date(startedAt); start.setHours(0, 0, 0, 0);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const days = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000));
  const updatedAmount = openAmount * (1 + rate / 100) ** days;
  return { days, accumulated: round(updatedAmount - openAmount), updatedAmount: round(updatedAmount) };
}
