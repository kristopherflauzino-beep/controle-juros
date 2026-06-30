export function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const normalized = String(value).replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function pricePayment(principal, periodRatePercent, installments) {
  const pv = toNumber(principal);
  const n = Math.max(1, parseInt(installments || 1, 10));
  const i = toNumber(periodRatePercent) / 100;

  if (pv <= 0) return 0;
  if (i === 0) return roundMoney(pv / n);

  const factor = Math.pow(1 + i, n);
  const payment = pv * ((i * factor) / (factor - 1));
  return roundMoney(payment);
}

export function daysBetween(startDate, endDate = new Date()) {
  if (!startDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diff = end.setHours(0,0,0,0) - start.setHours(0,0,0,0);
  return Math.max(0, Math.floor(diff / 86400000));
}

export function calculateAgreement(agreement, referenceDate = new Date()) {
  const principal = toNumber(agreement.principal);
  const installments = Math.max(1, parseInt(agreement.installments || 1, 10));
  const periodRate = toNumber(agreement.periodRate);
  const dailyRate = toNumber(agreement.dailyRate);

  const payment = pricePayment(principal, periodRate, installments);
  const financedTotal = roundMoney(payment * installments);
  const bankInterest = roundMoney(financedTotal - principal);
  const dailyDays = agreement.startInterestAt ? daysBetween(agreement.startInterestAt, referenceDate) : 0;
  const dailyFactor = dailyDays > 0 ? Math.pow(1 + (dailyRate / 100), dailyDays) : 1;
  const updatedTotal = roundMoney(financedTotal * dailyFactor);
  const dailyInterestValue = roundMoney(updatedTotal - financedTotal);

  return {
    ...agreement,
    principal: roundMoney(principal),
    installments,
    periodRate,
    dailyRate,
    payment,
    financedTotal,
    bankInterest,
    dailyDays,
    dailyInterestValue,
    updatedTotal
  };
}

export function brl(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(toNumber(value));
}

export function dateBR(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}
