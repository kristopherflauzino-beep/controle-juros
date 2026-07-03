import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, requireSession } from "@/lib/api";

export async function PATCH(req: NextRequest) {
  const auth = await requireSession(req, "ADMIN"); if (auth.error) return auth.error;
  const data = await req.json(), installmentIds = Array.isArray(data.installmentIds) ? data.installmentIds.map(String) : [];
  if (!installmentIds.length) return fail("Nenhuma parcela informada");
  const installments = await prisma.installment.findMany({ where: { id: { in: installmentIds } }, select: { id: true, agreementId: true } });
  if (installments.length !== installmentIds.length) return fail("Uma ou mais parcelas nao foram encontradas", 404);
  const agreementIds = [...new Set(installments.map(item => item.agreementId))];
  await prisma.$transaction(async tx => {
    await tx.installment.updateMany({ where: { id: { in: installmentIds } }, data: { paid: true } });
    for (const agreementId of agreementIds) {
      const remaining = await tx.installment.aggregate({ where: { agreementId, paid: false }, _sum: { amount: true }, _count: true });
      await tx.agreement.update({ where: { id: agreementId }, data: { openAmount: Number(remaining._sum.amount || 0), ...(remaining._count === 0 ? { status: "PAID", dailyInterestStartedAt: null } : {}) } });
    }
  });
  return NextResponse.json({ ok: true });
}
