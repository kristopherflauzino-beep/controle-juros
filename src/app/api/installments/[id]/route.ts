import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, requireSession } from "@/lib/api";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req, "ADMIN"); if (auth.error) return auth.error;
  const { id } = await params;
  const installment = await prisma.installment.findUnique({ where: { id }, select: { id: true, agreementId: true } });
  if (!installment) return fail("Parcela nao encontrada", 404);

  const result = await prisma.$transaction(async tx => {
    await tx.installment.delete({ where: { id } });
    const remaining = await tx.installment.findMany({ where: { agreementId: installment.agreementId }, select: { amount: true, paid: true } });
    const unpaidTotal = remaining.filter(item => !item.paid).reduce((sum, item) => sum + Number(item.amount), 0);
    return tx.agreement.update({
      where: { id: installment.agreementId },
      data: {
        openAmount: unpaidTotal,
        status: remaining.length === 0 ? "CANCELED" : unpaidTotal <= 0 ? "PAID" : "OPEN",
        dailyInterestStartedAt: unpaidTotal <= 0 ? null : undefined
      }
    });
  });

  return NextResponse.json(result);
}
