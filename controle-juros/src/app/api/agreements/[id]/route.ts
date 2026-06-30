import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { updateAgreementFinancials } from "@/lib/agreement-service";
import { agreementUpdateSchema } from "@/lib/validation";
import { calculateDailyInterest } from "@/lib/finance";
import { fail, ok, parseBodyError } from "@/lib/http";

export const runtime = "nodejs";

function withDailyInfo(agreement: any) {
  return {
    ...agreement,
    dailyInfo: calculateDailyInterest(
      agreement.openAmount,
      agreement.dailyInterestRate,
      agreement.dailyInterestStartedAt
    )
  };
}

export async function GET(request: NextRequest, context: any) {
  const auth = await requireAuth(request);
  if ("error" in auth) return fail(auth.error, auth.status);

  const { id } = await context.params;
  const agreement = await prisma.agreement.findUnique({
    where: { id },
    include: { client: true, installments: { orderBy: { number: "asc" } }, request: true }
  });

  if (!agreement) return fail("Relatório não encontrado.", 404);
  if (auth.user.role === "CLIENT" && agreement.clientId !== auth.user.clientId) return fail("Acesso negado.", 403);

  return ok({ agreement: withDailyInfo(agreement) });
}

export async function PATCH(request: NextRequest, context: any) {
  const auth = await requireAuth(request, "ADMIN");
  if ("error" in auth) return fail(auth.error, auth.status);

  try {
    const { id } = await context.params;
    const data = agreementUpdateSchema.parse(await request.json());
    const updated = await updateAgreementFinancials(id, data as any);
    return ok({ agreement: withDailyInfo(updated) });
  } catch (error) {
    return fail("Não foi possível editar relatório.", 400, parseBodyError(error));
  }
}

export async function DELETE(request: NextRequest, context: any) {
  const auth = await requireAuth(request, "ADMIN");
  if ("error" in auth) return fail(auth.error, auth.status);

  const { id } = await context.params;
  await prisma.agreement.delete({ where: { id } });
  return ok({ ok: true });
}
