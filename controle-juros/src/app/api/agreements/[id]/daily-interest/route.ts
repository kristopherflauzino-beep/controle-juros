import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { calculateDailyInterest, toNumber } from "@/lib/finance";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: any) {
  const auth = await requireAuth(request, "ADMIN");
  if ("error" in auth) return fail(auth.error, auth.status);

  const { id } = await context.params;
  const agreement = await prisma.agreement.findUnique({ where: { id } });
  if (!agreement) return fail("Relatório não encontrado.", 404);
  if (!agreement.dailyInterestRate || toNumber(agreement.dailyInterestRate) <= 0) {
    return fail("Defina um juros diário maior que zero antes de iniciar.", 400);
  }

  const startedAt = agreement.dailyInterestStartedAt ?? new Date();
  const updated = await prisma.agreement.update({
    where: { id },
    data: { dailyInterestStartedAt: startedAt },
    include: { client: true, installments: { orderBy: { number: "asc" } } }
  });

  const dailyInfo = calculateDailyInterest(updated.openAmount, updated.dailyInterestRate, updated.dailyInterestStartedAt);
  await prisma.dailyInterestLog.create({
    data: {
      agreementId: id,
      baseOpenAmount: dailyInfo.baseOpenAmount,
      dailyRate: dailyInfo.dailyRate,
      daysCount: dailyInfo.daysCount,
      updatedAmount: dailyInfo.updatedAmount
    }
  });

  return ok({ agreement: { ...updated, dailyInfo } });
}
