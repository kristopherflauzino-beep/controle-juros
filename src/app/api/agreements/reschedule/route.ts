import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, requireSession } from "@/lib/api";
import { capitalizedInstallmentCents, clientOutstandingCents, monthlyDueDate, rescheduleTable } from "@/lib/finance";

class RescheduleConflict extends Error {}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "ADMIN"); if (auth.error) return auth.error;
  const body = await req.json();
  const clientId = body.clientId, count = Number(body.installmentCount), rate = Number(body.interestRate);
  const month: string | null = body.month || null;
  const expectedTotalCents = Number(body.expectedTotalCents), operationId = body.operationId;
  if (typeof clientId !== "string" || !clientId || !Number.isInteger(count) || count < 1 || count > 120) return fail("Informe cliente e número de parcelas válidos (1 a 120).");
  if (!Number.isFinite(rate) || rate < 0 || rate > 9999.9999 || Math.abs(Math.round(rate * 10000) - rate * 10000) > 0.000001) return fail("Informe uma taxa de juros válida com até quatro casas decimais.");
  if (month !== null && (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))) return fail("Selecione um mês válido.");
  if (!Number.isSafeInteger(expectedTotalCents) || expectedTotalCents <= 0) return fail("Atualize o saldo do cliente e tente novamente.");
  if (typeof operationId !== "string" || !/^[0-9a-f-]{36}$/i.test(operationId)) return fail("Identificador do parcelamento inválido.");
  if (typeof body.dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) return fail("Informe uma data de vencimento válida.");
  const due = new Date(`${body.dueDate}T12:00:00.000Z`);
  if (Number.isNaN(due.getTime()) || due.toISOString().slice(0, 10) !== body.dueDate) return fail("Informe uma data de vencimento válida.");

  try {
    const agreement = await prisma.$transaction(async tx => {
      const previous = await tx.agreement.findUnique({ where: { rescheduleOperationId: operationId } });
      if (previous) {
        if (previous.clientId !== clientId || previous.rescheduleScopeMonth !== month || previous.installmentCount !== count || Number(previous.interestRate) !== rate || previous.dueDate.getTime() !== due.getTime() || Math.round(Number(previous.originalAmount) * 100) !== expectedTotalCents) throw new RescheduleConflict("Esta operação já foi concluída com outros dados. Reabra o formulário para fazer um novo acordo.");
        return previous;
      }
      if (!await tx.client.findUnique({ where: { id: clientId }, select: { id: true } })) throw new RescheduleConflict("Cliente não encontrado.");
      const sources = await tx.agreement.findMany({ where: { clientId, status: { in: ["OPEN", "LATE"] } }, include: { installments: true } });
      const now = new Date();
      const totalCents = clientOutstandingCents(sources, clientId, month, now);
      if (!Number.isSafeInteger(totalCents) || totalCents <= 0) throw new RescheduleConflict("Não há saldo em aberto no escopo escolhido.");
      if (totalCents !== expectedTotalCents) throw new RescheduleConflict("O saldo mudou. Atualize o menu Acordo e confira o novo valor antes de confirmar.");
      if (count > totalCents) throw new RescheduleConflict("O saldo deve permitir parcelas de pelo menos R$ 0,01.");
      let schedule: ReturnType<typeof rescheduleTable>;
      try { schedule = rescheduleTable(totalCents / 100, rate, count); }
      catch { throw new RescheduleConflict("A taxa ou o número de parcelas gerou um valor inválido."); }
      if (schedule.total >= 1_000_000_000_000) throw new RescheduleConflict("O valor total ultrapassa o limite financeiro do sistema.");
      const created = await tx.agreement.create({ data: {
        clientId, rescheduleOperationId: operationId, rescheduleScopeMonth: month, originalAmount: totalCents / 100, openAmount: schedule.total,
        installmentCount: count, interestRate: rate, installmentAmount: schedule.payment, totalAmount: schedule.total,
        agreementDate: now, dueDate: due, status: "OPEN",
        notes: `Acordo: saldo ${month ? `de ${month}` : "total"} reparcelado em ${count} parcela(s), com juros base de ${rate}%.`,
        dailyInterestActive: false, dailyInterestRate: null, dailyInterestStartedAt: null, dailyInterestBaseAmount: null,
        installments: { create: schedule.rows.map((row, index) => ({ ...row, dueDate: monthlyDueDate(due, index) })) },
      } });
      const stamp = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      for (const source of sources) {
        const balances = capitalizedInstallmentCents(source, now);
        const selected = source.installments.filter(item => !item.paid && !item.rescheduledIntoId && (!month || item.dueDate.toISOString().slice(0, 7) === month));
        if (!selected.length) continue;
        const selectedIds = new Set(selected.map(item => item.id));
        const remaining = source.installments.filter(item => !item.paid && !item.rescheduledIntoId && !selectedIds.has(item.id));
        const remainingCents = remaining.reduce((sum, item) => sum + (balances.get(item.id) || 0), 0);
        for (const item of selected) {
          const updated = await tx.installment.updateMany({ where: { id: item.id, paid: false, rescheduledIntoId: null }, data: { remainingAmount: 0, rescheduledIntoId: created.id, rescheduledAt: now, rescheduledAmount: (balances.get(item.id) || 0) / 100 } });
          if (updated.count !== 1) throw new RescheduleConflict("Uma parcela mudou durante o reparcelamento. Atualize a tela e tente novamente.");
        }
        for (const item of remaining) await tx.installment.update({ where: { id: item.id }, data: { remainingAmount: (balances.get(item.id) || 0) / 100 } });
        const oldInterest = source.dailyInterestStartedAt ? ` Juros diário de ${Number(source.dailyInterestRate ?? 0)}% iniciado em ${source.dailyInterestStartedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} congelado para as parcelas transferidas.` : "";
        const note = `${stamp} - Acordo: ${month ? `parcelas de ${month}` : "saldo total"} transferidas para o registro ${created.id}.${oldInterest}`;
        const updated = await tx.agreement.updateMany({ where: { id: source.id, updatedAt: source.updatedAt, status: { in: ["OPEN", "LATE"] } }, data: {
          openAmount: remainingCents / 100, status: remainingCents ? source.status : "CANCELED",
          notes: `${String(source.notes || "").trim()}${source.notes ? "\n" : ""}${note}`,
          ...(source.dailyInterestStartedAt ? { dailyInterestActive: remainingCents > 0, dailyInterestBaseAmount: remainingCents ? remainingCents / 100 : null, dailyInterestStartedAt: remainingCents ? now : null } : {}),
        } });
        if (updated.count !== 1) throw new RescheduleConflict("Um acordo mudou durante o reparcelamento. Atualize a tela e tente novamente.");
      }
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json(agreement, { status: 201 });
  } catch (error) {
    if (error instanceof RescheduleConflict) return fail(error.message, 409);
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) return fail("Os acordos mudaram durante o parcelamento. Atualize a tela e tente novamente.", 409);
    return fail("Não foi possível salvar o novo parcelamento.", 500);
  }
}
