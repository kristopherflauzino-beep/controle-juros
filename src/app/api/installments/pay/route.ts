import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, requireSession } from "@/lib/api";
import { capitalizedInstallmentCents } from "@/lib/finance";
import { Prisma } from "@prisma/client";

export async function PATCH(req: NextRequest) {
  const auth = await requireSession(req, "ADMIN"); if (auth.error) return auth.error;
  const data = await req.json(), installmentIds = Array.isArray(data.installmentIds) ? data.installmentIds.map(String) : [];
  if (!installmentIds.length) return fail("Nenhuma parcela informada");
  try {
    await prisma.$transaction(async tx => {
      const selected = await tx.installment.findMany({ where: { id: { in: installmentIds } }, select: { id: true, agreementId: true, paid: true } });
      if (selected.length !== installmentIds.length || selected.some(item => item.paid)) throw new Error("Uma ou mais parcelas já foram pagas. Atualize o relatório.");
      const selectedIds = new Set(selected.map(item => item.id));
      for (const agreementId of [...new Set(selected.map(item => item.agreementId))]) {
        const agreement = await tx.agreement.findUniqueOrThrow({ where: { id: agreementId }, include: { installments: true } });
        if (agreement.status === "CANCELED" || agreement.status === "PAID") throw new Error("Não é possível receber parcelas de um acordo pago ou cancelado.");
        if (agreement.receivedAmount == null) {
          await tx.installment.updateMany({ where: { agreementId, id: { in: installmentIds } }, data: { paid: true } });
          const remaining = await tx.installment.aggregate({ where: { agreementId, paid: false }, _sum: { amount: true }, _count: true });
          const openAmount = Number(remaining._sum.amount || 0);
          await tx.agreement.update({ where: { id: agreementId }, data: { openAmount, ...(remaining._count === 0 ? { status: "PAID", dailyInterestActive: false, dailyInterestStartedAt: null } : agreement.dailyInterestStartedAt ? { dailyInterestBaseAmount: openAmount, dailyInterestStartedAt: new Date() } : {}) } });
          continue;
        }

        const unpaid = agreement.installments.filter(item => !item.paid);
        const now = new Date();
        const effectiveCents = capitalizedInstallmentCents(agreement, now);
        let openCents = 0, paidCents = 0;
        for (const item of unpaid) {
          const value = effectiveCents.get(item.id) || 0;
          const pay = selectedIds.has(item.id);
          if (pay) paidCents += value; else openCents += value;
          await tx.installment.update({ where: { id: item.id }, data: { paid: pay, remainingAmount: pay ? 0 : value / 100 } });
        }
        await tx.agreement.update({ where: { id: agreementId }, data: {
          openAmount: openCents / 100,
          receivedAmount: Number(agreement.receivedAmount) + paidCents / 100,
          status: openCents === 0 ? "PAID" : agreement.status,
          ...(agreement.dailyInterestStartedAt ? { dailyInterestActive: openCents > 0, dailyInterestBaseAmount: openCents > 0 ? openCents / 100 : null, dailyInterestStartedAt: openCents > 0 ? now : null } : {}),
        } });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return fail("O relatório mudou durante o pagamento. Atualize e tente novamente.", 409);
    return fail(error instanceof Error ? error.message : "Não foi possível registrar o pagamento.", 409);
  }
}
