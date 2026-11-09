import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, requireSession } from "@/lib/api";

class ActivationConflict extends Error {}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "ADMIN");
  if (auth.error) return auth.error;

  const body = await req.json();
  const clientId = body.clientId;
  const month = body.month;
  const rate = Number(body.dailyInterestRate);
  const expectedTotalCents = Number(body.expectedTotalCents);
  if (typeof clientId !== "string" || !clientId || typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return fail("Selecione um cliente e mês válidos.");
  if (body.dailyInterestRate === "" || body.dailyInterestRate == null || !Number.isFinite(rate) || rate < 0 || rate > 9999.9999 || Math.abs(rate * 10000 - Math.round(rate * 10000)) > 0.000001) return fail("Informe uma taxa diária válida com até quatro casas decimais.");
  if (!Number.isSafeInteger(expectedTotalCents) || expectedTotalCents <= 0) return fail("Atualize o saldo do mês e tente novamente.");
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

  try {
    const activated = await prisma.$transaction(async tx => {
      const installments = await tx.installment.findMany({
        where: { agreement: { clientId, status: { in: ["OPEN", "LATE"] } }, dueDate: { gte: start, lt: end }, paid: false, rescheduledIntoId: null, dailyInterestActive: false },
        select: { id: true, amount: true, remainingAmount: true },
      });
      const totalCents = installments.reduce((sum, item) => sum + Math.round(Number(item.remainingAmount ?? item.amount) * 100), 0);
      if (!installments.length || !Number.isSafeInteger(totalCents) || totalCents <= 0) throw new ActivationConflict("Não há parcelas pendentes sem juros neste mês.");
      if (totalCents !== expectedTotalCents) throw new ActivationConflict("O valor deste mês mudou. Atualize o relatório antes de ativar os juros.");
      const startedAt = new Date();
      for (const item of installments) {
        const result = await tx.installment.updateMany({
          where: { id: item.id, paid: false, rescheduledIntoId: null, dailyInterestActive: false, remainingAmount: item.remainingAmount },
          data: { dailyInterestActive: true, dailyInterestRate: rate, dailyInterestStartedAt: startedAt, dailyInterestBaseAmount: item.remainingAmount ?? item.amount },
        });
        if (result.count !== 1) throw new ActivationConflict("Uma parcela mudou. Atualize o relatório e tente novamente.");
      }
      return installments.length;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ activated, month });
  } catch (error) {
    if (error instanceof ActivationConflict) return fail(error.message, 409);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return fail("O relatório mudou durante a ativação. Atualize e tente novamente.", 409);
    return fail("Não foi possível ativar o juros diário deste mês.", 500);
  }
}
