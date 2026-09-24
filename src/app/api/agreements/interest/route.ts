import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { asNumber, fail, requireSession } from "@/lib/api";

class ActivationConflict extends Error {}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "ADMIN");
  if (auth.error) return auth.error;

  const body = await req.json();
  const rawIds = body.agreementIds;
  const ids = Array.isArray(rawIds) ? [...new Set(rawIds)] : [];
  const rate = asNumber(body.dailyInterestRate);
  if (!ids.length || ids.length > 100 || ids.some(id => typeof id !== "string" || !id)) return fail("Informe acordos válidos para ativar os juros.");
  if (body.dailyInterestRate === "" || body.dailyInterestRate == null || !Number.isFinite(rate) || rate < 0) return fail("Informe uma taxa de juros diário válida.");

  try {
    const activated = await prisma.$transaction(async tx => {
      const agreements = await tx.agreement.findMany({
        where: { id: { in: ids } },
        select: { id: true, clientId: true, openAmount: true, status: true, dailyInterestActive: true, dailyInterestStartedAt: true,
          installments: { where: { paid: false }, select: { id: true }, take: 1 } },
      });
      if (agreements.length !== ids.length || new Set(agreements.map(a => a.clientId)).size !== 1) throw new ActivationConflict("Os acordos do grupo não foram encontrados.");
      if (agreements.some(a => a.dailyInterestActive || a.dailyInterestStartedAt || !["OPEN", "LATE"].includes(a.status) || !a.installments.length)) throw new ActivationConflict("Um dos acordos já tem juros ativos ou não possui parcelas pendentes.");

      const startedAt = new Date();
      for (const agreement of agreements) {
        const result = await tx.agreement.updateMany({
          where: { id: agreement.id, openAmount: agreement.openAmount, dailyInterestActive: false, dailyInterestStartedAt: null, status: { in: ["OPEN", "LATE"] } },
          data: { dailyInterestActive: true, dailyInterestRate: rate, dailyInterestStartedAt: startedAt, dailyInterestBaseAmount: agreement.openAmount },
        });
        if (result.count !== 1) throw new ActivationConflict("O grupo foi alterado. Atualize o relatório e tente novamente.");
      }
      return agreements.length;
    });
    return NextResponse.json({ activated });
  } catch (error) {
    if (error instanceof ActivationConflict) return fail(error.message, 409);
    return fail("Não foi possível ativar o juros diário.", 500);
  }
}
