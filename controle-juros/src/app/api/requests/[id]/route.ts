import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createAgreementWithInstallments } from "@/lib/agreement-service";
import { agreementSchema } from "@/lib/validation";
import { fail, ok, parseBodyError } from "@/lib/http";
import { toNumber } from "@/lib/finance";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: any) {
  const auth = await requireAuth(request, "ADMIN");
  if ("error" in auth) return fail(auth.error, auth.status);

  try {
    const { id } = await context.params;
    const body = await request.json();
    const status = body.status as "PENDENTE" | "APROVADO" | "RECUSADO";
    if (!["PENDENTE", "APROVADO", "RECUSADO"].includes(status)) return fail("Status inválido.", 400);

    const loanRequest = await prisma.request.findUnique({
      where: { id },
      include: { agreement: true, client: true }
    });
    if (!loanRequest) return fail("Solicitação não encontrada.", 404);

    if (status === "RECUSADO") {
      const updated = await prisma.request.update({
        where: { id },
        data: { status: "RECUSADO", refusedAt: new Date() },
        include: { client: true, agreement: true }
      });
      return ok({ request: updated });
    }

    if (status === "PENDENTE") {
      const updated = await prisma.request.update({
        where: { id },
        data: { status: "PENDENTE", refusedAt: null, approvedAt: null },
        include: { client: true, agreement: true }
      });
      return ok({ request: updated });
    }

    if (loanRequest.agreement) {
      const updated = await prisma.request.update({
        where: { id },
        data: { status: "APROVADO", approvedAt: new Date() },
        include: { client: true, agreement: true }
      });
      return ok({ request: updated, agreement: loanRequest.agreement });
    }

    const dueDate = body.dueDate || new Date(Date.now() + 30 * 86400000).toISOString();
    const agreementData = agreementSchema.parse({
      clientId: loanRequest.clientId,
      requestId: loanRequest.id,
      originalValue: body.originalValue ?? toNumber(loanRequest.amount),
      installmentsCount: body.installmentsCount ?? 1,
      interestRate: body.interestRate ?? 0,
      dueDate,
      status: "ABERTO",
      observations: body.observations ?? loanRequest.observation ?? "Acordo gerado a partir de solicitação aprovada.",
      dailyInterestRate: body.dailyInterestRate ?? null
    });

    const agreement = await createAgreementWithInstallments(agreementData);
    const updated = await prisma.request.update({
      where: { id },
      data: { status: "APROVADO", approvedAt: new Date() },
      include: { client: true, agreement: true }
    });

    return ok({ request: updated, agreement });
  } catch (error) {
    return fail("Não foi possível atualizar solicitação.", 400, parseBodyError(error));
  }
}
