import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, requireSession } from "@/lib/api";
import { allocatePartialPaymentCents, capitalizedInstallmentCents } from "@/lib/finance";

class PaymentConflict extends Error {}
const cents = (value: number) => Math.round(value * 100);
const monthOf = (date: Date) => date.toISOString().slice(0, 7);

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "ADMIN"); if (auth.error) return auth.error;
  const body = await req.json();
  const rawIds: unknown[] = Array.isArray(body.installmentIds) ? [...new Set(body.installmentIds)] : [];
  const amount = Number(body.amount), amountCents = cents(amount);
  const operationId = String(body.operationId || "");
  if (!rawIds.length || rawIds.length > 100 || rawIds.some(id => typeof id !== "string" || !id)) return fail("Selecione parcelas válidas do mesmo mês.");
  const ids = rawIds as string[];
  if (!Number.isFinite(amount) || !Number.isSafeInteger(amountCents) || amountCents <= 0 || Math.abs(amount * 100 - amountCents) > 0.000001) return fail("Informe um valor válido com até duas casas decimais.");
  if (!/^[0-9a-f-]{36}$/i.test(operationId)) return fail("Identificador do pagamento inválido.");

  try {
    const result = await prisma.$transaction(async tx => {
      if (await tx.partialPayment.findFirst({ where: { operationId }, select: { id: true } })) throw new PaymentConflict("Este pagamento já foi registrado. Atualize o relatório.");
      const selected = await tx.installment.findMany({ where: { id: { in: ids } }, select: { id: true, agreementId: true, dueDate: true, paid: true, agreement: { select: { clientId: true, status: true } } } });
      if (selected.length !== ids.length) throw new PaymentConflict("Uma das parcelas não foi encontrada. Atualize o relatório.");
      const clientId = selected[0].agreement.clientId, month = monthOf(selected[0].dueDate);
      if (selected.some(item => item.paid || item.agreement.clientId !== clientId || monthOf(item.dueDate) !== month || !["OPEN", "LATE"].includes(item.agreement.status))) throw new PaymentConflict("Selecione apenas parcelas pendentes do mesmo cliente e mês.");

      const agreementIds = [...new Set(selected.map(item => item.agreementId))];
      const agreements = await tx.agreement.findMany({ where: { id: { in: agreementIds } }, include: { installments: true } });
      const now = new Date();
      const effectiveCents = new Map<string, number>();
      for (const agreement of agreements) {
        for (const [id, value] of capitalizedInstallmentCents(agreement, now)) effectiveCents.set(id, value);
      }

      const ordered = selected.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.agreementId.localeCompare(b.agreementId) || a.id.localeCompare(b.id));
      const totalCents = ordered.reduce((sum, item) => sum + (effectiveCents.get(item.id) || 0), 0);
      if (amountCents >= totalCents) throw new PaymentConflict("O pagamento parcial deve ser menor que o total pendente do mês. Para quitar tudo, use Pago.");
      const allocations = allocatePartialPaymentCents(ordered.map(item => ({ id: item.id, balanceCents: effectiveCents.get(item.id) || 0 })), amountCents);

      for (const agreement of agreements) {
        if (!agreement.installments.some(item => allocations.has(item.id))) continue;
        let openCents = 0, receivedCents = 0;
        for (const item of agreement.installments.filter(item => !item.paid)) {
          const allocated = allocations.get(item.id) || 0;
          const balance = (effectiveCents.get(item.id) || 0) - allocated;
          openCents += balance;
          await tx.installment.update({ where: { id: item.id }, data: { remainingAmount: balance / 100, paid: balance === 0 } });
          if (allocated) {
            receivedCents += allocated;
            await tx.partialPayment.create({ data: { operationId, agreementId: agreement.id, installmentId: item.id, amount: allocated / 100 } });
          }
        }
        const previouslyReceived = agreement.receivedAmount == null
          ? agreement.installments.filter(item => item.paid).reduce((sum, item) => sum + cents(Number(item.amount)), 0)
          : cents(Number(agreement.receivedAmount));
        await tx.agreement.update({ where: { id: agreement.id }, data: {
          openAmount: openCents / 100,
          receivedAmount: (previouslyReceived + receivedCents) / 100,
          status: openCents === 0 ? "PAID" : agreement.status,
          ...(agreement.dailyInterestStartedAt ? { dailyInterestActive: openCents > 0, dailyInterestBaseAmount: openCents > 0 ? openCents / 100 : null, dailyInterestStartedAt: openCents > 0 ? now : null } : {}),
        } });
      }
      return { ok: true, month, paid: amountCents / 100 };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PaymentConflict) return fail(error.message, 409);
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) return fail("O relatório mudou durante o pagamento. Atualize e tente novamente.", 409);
    return fail("Não foi possível registrar o pagamento parcial.", 500);
  }
}
