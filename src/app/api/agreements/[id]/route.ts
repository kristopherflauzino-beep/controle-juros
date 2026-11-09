import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { asNumber, fail, requireSession } from "@/lib/api";
import { capitalizedInstallmentCents, flatProgressiveTable, monthlyDueDate } from "@/lib/finance";
import { Prisma } from "@prisma/client";

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
    return fail("Ative os juros no mês desejado pelo Relatório mensal.");
  }
  if (d.action === "mark-paid") {
    if (old.status === "PAID") return fail("Este acordo ja esta pago");
    if (old.status === "CANCELED") return fail("Um acordo cancelado nao pode ser recebido");
    try {
      const paid = await prisma.$transaction(async tx => {
        const current = await tx.agreement.findUniqueOrThrow({ where: { id }, include: { installments: true } });
        if (current.status === "PAID" || current.status === "CANCELED") throw new Error("Este acordo já foi pago ou cancelado. Atualize o relatório.");
        const balances = capitalizedInstallmentCents(current, new Date());
        const paidAmount = [...balances.values()].reduce((sum, cents) => sum + cents, 0) / 100;
        if (paidAmount <= 0) throw new Error("Não há saldo pendente para quitar neste acordo.");
        if (current.installments.some(item => item.dailyInterestActive)) {
          for (const item of current.installments.filter(item => !item.paid && !item.rescheduledIntoId)) {
            await tx.installment.update({ where: { id: item.id }, data: { paid: true, remainingAmount: (balances.get(item.id) || 0) / 100, dailyInterestActive: false, dailyInterestStartedAt: null, dailyInterestBaseAmount: null } });
          }
          const previouslyReceived = current.receivedAmount == null ? current.installments.filter(item => item.paid).reduce((sum, item) => sum + Number(item.remainingAmount ?? item.amount), 0) : Number(current.receivedAmount);
          return tx.agreement.update({ where: { id }, data: { status: "PAID", openAmount: 0, receivedAmount: previouslyReceived + paidAmount, dailyInterestActive: false } });
        }
        await tx.installment.updateMany({ where: { agreementId: id, paid: false, rescheduledIntoId: null }, data: current.receivedAmount == null ? { paid: true } : { paid: true, remainingAmount: 0 } });
        return tx.agreement.update({ where: { id }, data: current.receivedAmount == null
          ? { status: "PAID", openAmount: paidAmount, dailyInterestActive: false, ...(current.dailyInterestActive ? { dailyInterestStartedAt: null } : {}) }
          : { status: "PAID", openAmount: 0, receivedAmount: Number(current.receivedAmount) + paidAmount, dailyInterestActive: false, ...(current.dailyInterestActive ? { dailyInterestBaseAmount: null, dailyInterestStartedAt: null } : {}) } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return NextResponse.json(paid);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return fail("O relatório mudou durante o pagamento. Atualize e tente novamente.", 409);
      return fail(error instanceof Error ? error.message : "Não foi possível registrar o pagamento.", 409);
    }
  }
  if (await prisma.installment.count({ where: { agreementId: id, rescheduledIntoId: { not: null } } })) return fail("Este acordo tem parcelas reparceladas. Seus valores originais foram preservados como histórico.", 409);
  const count = asNumber(d.installmentCount), rate = asNumber(d.interestRate);
  // O valor digitado no editor é a base antes dos juros, como na criação.
  // totalAmount continua aceito como nome legado do campo no frontend anterior.
  const amount = asNumber(d.originalAmount ?? d.totalAmount);
  if (!(amount > 0) || !Number.isInteger(count) || !(count >= 1) || !Number.isFinite(rate) || rate < 0 || !d.dueDate) return fail("Dados financeiros inválidos");
  if (d.status && !allowedStatuses.includes(d.status)) return fail("Status inválido");
  const activeMonthlyInterest = await prisma.installment.count({ where: { agreementId: id, dailyInterestActive: true, paid: false } });
  if (activeMonthlyInterest && (d.status === "PAID" || d.status === "CANCELED")) return fail("Juros diário ativo: para encerrar a cobrança, use o botão Pago.", 409);
  let calc: ReturnType<typeof flatProgressiveTable>;
  try { calc = flatProgressiveTable(amount, rate, count); }
  catch { return fail("Informe um valor válido para as parcelas"); }
  const due = new Date(`${d.dueDate}T12:00:00.000Z`);
  if (isNaN(due.getTime())) return fail("Vencimento inválido");
  const dailyRateInput = d.dailyInterestRate === "" || d.dailyInterestRate == null ? null : asNumber(d.dailyInterestRate);
  if (dailyRateInput !== null && (!Number.isFinite(dailyRateInput) || dailyRateInput < 0)) return fail("Informe uma taxa de juros diário válida");
  const structureChanged = amount !== Number(old.originalAmount) || count !== old.installmentCount || rate !== Number(old.interestRate) || due.toISOString().slice(0, 10) !== old.dueDate.toISOString().slice(0, 10);
  const agreementTotal = structureChanged ? calc.total : Number(old.totalAmount);
  const openAmount = structureChanged ? calc.total : d.openAmount === "" || d.openAmount == null ? Number(old.openAmount) : asNumber(d.openAmount);
  if (!Number.isFinite(openAmount) || openAmount < 0 || (openAmount > agreementTotal && openAmount !== Number(old.openAmount))) return fail("Informe um valor em aberto válido");
  const financialChanged = structureChanged || openAmount !== Number(old.openAmount);
  if (activeMonthlyInterest && financialChanged) return fail("Este acordo possui juros diário ativo. Quite as parcelas antes de alterar os valores.", 409);
  if (old.receivedAmount != null && financialChanged) return fail("Não é possível recalcular um acordo com pagamento parcial. Os valores recebidos foram preservados.", 409);
  if (structureChanged && await prisma.installment.count({ where: { agreementId: id, paid: true } })) return fail("Não é possível recalcular um acordo com parcelas pagas. Os pagamentos existentes foram preservados.", 409);
  try {
    const result = await prisma.$transaction(async tx => {
      if (structureChanged) await tx.installment.deleteMany({ where: { agreementId: id } });
      return tx.agreement.update({ where: { id }, data: { originalAmount: amount, openAmount, installmentCount: count, interestRate: rate, installmentAmount: structureChanged ? calc.payment : old.installmentAmount, totalAmount: agreementTotal, dueDate: structureChanged ? due : old.dueDate, notes: agreementNote(old.notes, d.notes), status: d.status || old.status, dailyInterestRate: activeMonthlyInterest ? old.dailyInterestRate : dailyRateInput, ...(structureChanged ? { installments: { create: calc.rows.map((row, i) => ({ ...row, dueDate: monthlyDueDate(due, i) })) } } : {}) }, include: { installments: { orderBy: { number: "asc" } } } });
    });
    return NextResponse.json(result);
  } catch { return fail("Não foi possível salvar o acordo.", 500); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req, "ADMIN"); if (auth.error) return auth.error;
  const { id } = await params;
  const agreement = await prisma.agreement.findUnique({ where: { id }, select: { id: true, rescheduleOperationId: true, _count: { select: { rescheduledInstallments: true, installments: { where: { rescheduledIntoId: { not: null } } } } } } });
  if (!agreement) return fail("Registro não encontrado", 404);
  if (agreement.rescheduleOperationId || agreement._count.rescheduledInstallments || agreement._count.installments) return fail("Este registro faz parte de um reparcelamento e deve ser preservado como histórico.", 409);
  try {
    await prisma.$transaction(async tx => {
      await tx.dailyInterestLog.deleteMany({ where: { agreementId: id } });
      await tx.installment.deleteMany({ where: { agreementId: id } });
      await tx.agreement.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true });
  } catch { return fail("Não foi possível excluir o registro.", 500); }
}
