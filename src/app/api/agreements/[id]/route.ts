import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { asNumber, fail, requireSession } from "@/lib/api";
import { agreementTableFromTotal, dailyInterest, flatProgressiveTable, monthlyDueDate } from "@/lib/finance";

const allowedStatuses = ["OPEN", "PAID", "LATE", "CANCELED"];
const agreementNote = (previous: unknown, submitted: unknown) => {
  const current = String(previous || "").trim();
  const next = String(submitted || "").trim();
  const preserved = !current ? next : next.includes(current) ? next : next ? `${current}\n${next}` : current;
  const stamp = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return preserved ? `${preserved}\n${stamp} - Acordo atualizado.` : `${stamp} - Acordo atualizado.`;
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req, "ADMIN"); if (auth.error) return auth.error;
  const { id } = await params; const old = await prisma.agreement.findUnique({ where: { id } }); if (!old) return fail("Relatório não encontrado", 404);
  const d = await req.json();
  if (d.action === "start-interest") {
    const rate = d.dailyInterestRate === "" || d.dailyInterestRate == null ? Number(old.dailyInterestRate ?? 0) : asNumber(d.dailyInterestRate);
    if (!Number.isFinite(rate) || rate < 0) return fail("Informe uma taxa de juros diário válida");
    if (old.dailyInterestActive || old.dailyInterestStartedAt) return fail("O juros diário já foi iniciado");
    if (old.status === "PAID" || old.status === "CANCELED") return fail("Não é possível iniciar juros em um acordo pago ou cancelado");
    const activated = await prisma.agreement.updateMany({ where: { id, dailyInterestActive: false, dailyInterestStartedAt: null, openAmount: old.openAmount }, data: { dailyInterestActive: true, dailyInterestRate: rate, dailyInterestStartedAt: new Date(), dailyInterestBaseAmount: old.openAmount } });
    if (activated.count !== 1) return fail("O juros diário já foi iniciado", 409);
    return NextResponse.json(await prisma.agreement.findUnique({ where: { id } }));
  }
  if (d.action === "mark-paid") {
    if (old.status === "PAID") return fail("Este acordo ja esta pago");
    if (old.status === "CANCELED") return fail("Um acordo cancelado nao pode ser recebido");
    const paidAmount = dailyInterest(Number(old.dailyInterestBaseAmount ?? old.openAmount), Number(old.dailyInterestRate ?? 0), old.dailyInterestStartedAt).updatedAmount;
    const paid = await prisma.$transaction(async tx => {
      await tx.installment.updateMany({ where: { agreementId: id }, data: { paid: true } });
      return tx.agreement.update({ where: { id }, data: { status: "PAID", openAmount: paidAmount, dailyInterestActive: false, dailyInterestStartedAt: null } });
    });
    return NextResponse.json(paid);
  }
  const count = asNumber(d.installmentCount), rate = asNumber(d.interestRate);
  const totalInput = d.totalAmount === "" || d.totalAmount == null ? null : asNumber(d.totalAmount);
  const amount = totalInput === null ? asNumber(d.originalAmount) : totalInput;
  if (!(amount > 0) || !Number.isInteger(count) || !(count >= 1) || !Number.isFinite(rate) || rate < 0 || !d.dueDate) return fail("Dados financeiros inválidos");
  if (d.status && !allowedStatuses.includes(d.status)) return fail("Status inválido");
  let calc: ReturnType<typeof flatProgressiveTable> | ReturnType<typeof agreementTableFromTotal>;
  try { calc = totalInput === null ? flatProgressiveTable(amount, rate, count) : agreementTableFromTotal(totalInput, rate, count); }
  catch { return fail("Informe um valor válido para as parcelas"); }
  const unchangedTotal = totalInput !== null && calc.total === Number(old.totalAmount) && count === old.installmentCount && rate === Number(old.interestRate);
  const principal = totalInput === null ? amount : unchangedTotal ? Number(old.originalAmount) : "principal" in calc ? calc.principal : amount;
  const due = new Date(`${d.dueDate}T12:00:00.000Z`);
  if (isNaN(due.getTime())) return fail("Vencimento inválido");
  const dailyRateInput = d.dailyInterestRate === "" || d.dailyInterestRate == null ? null : asNumber(d.dailyInterestRate);
  if (dailyRateInput !== null && (!Number.isFinite(dailyRateInput) || dailyRateInput < 0)) return fail("Informe uma taxa de juros diário válida");
  const structureChanged = principal !== Number(old.originalAmount) || calc.total !== Number(old.totalAmount) || count !== old.installmentCount || rate !== Number(old.interestRate) || due.toISOString().slice(0, 10) !== old.dueDate.toISOString().slice(0, 10);
  const openAmount = structureChanged ? calc.total : d.openAmount === "" || d.openAmount == null ? Number(old.openAmount) : asNumber(d.openAmount);
  if (!Number.isFinite(openAmount) || openAmount < 0 || (openAmount > calc.total && openAmount !== Number(old.openAmount))) return fail("Informe um valor em aberto válido");
  const financialChanged = structureChanged || openAmount !== Number(old.openAmount);
  if (structureChanged && await prisma.installment.count({ where: { agreementId: id, paid: true } })) return fail("Não é possível recalcular um acordo com parcelas pagas. Os pagamentos existentes foram preservados.", 409);
  try {
    const result = await prisma.$transaction(async tx => {
      if (structureChanged) await tx.installment.deleteMany({ where: { agreementId: id } });
      return tx.agreement.update({ where: { id }, data: { originalAmount: principal, openAmount, installmentCount: count, interestRate: rate, installmentAmount: calc.payment, totalAmount: calc.total, dueDate: structureChanged ? due : old.dueDate, notes: agreementNote(old.notes, d.notes), status: d.status || old.status, dailyInterestRate: old.dailyInterestStartedAt ? old.dailyInterestRate : dailyRateInput, ...(financialChanged && old.dailyInterestStartedAt ? { dailyInterestBaseAmount: openAmount, dailyInterestStartedAt: new Date() } : {}), ...(structureChanged ? { installments: { create: calc.rows.map((row, i) => ({ ...row, dueDate: monthlyDueDate(due, i) })) } } : {}) }, include: { installments: { orderBy: { number: "asc" } } } });
    });
    return NextResponse.json(result);
  } catch { return fail("Não foi possível salvar o acordo.", 500); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req, "ADMIN"); if (auth.error) return auth.error;
  const { id } = await params;
  if (!await prisma.agreement.findUnique({ where: { id }, select: { id: true } })) return fail("Registro não encontrado", 404);
  try {
    await prisma.$transaction(async tx => {
      await tx.dailyInterestLog.deleteMany({ where: { agreementId: id } });
      await tx.installment.deleteMany({ where: { agreementId: id } });
      await tx.agreement.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true });
  } catch { return fail("Não foi possível excluir o registro.", 500); }
}
