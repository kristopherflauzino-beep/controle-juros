import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, requireSession } from "@/lib/api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req, "ADMIN"); if (auth.error) return auth.error;
  const { id } = await params, data = await req.json();
  const status = data.status === "APPROVED" ? "APPROVED" : data.status === "REJECTED" ? "REJECTED" : null;
  if (!status) return fail("Decisao invalida");
  const request = await prisma.limitChangeRequest.findUnique({ where: { id } });
  if (!request) return fail("Solicitacao de limite nao encontrada", 404);
  if (request.status !== "PENDING") return fail("Esta solicitacao ja foi analisada");
  const result = await prisma.$transaction(async tx => {
    if (status === "APPROVED") {
      await tx.client.update({ where: { id: request.clientId }, data: { monthlyLimit: request.requestedLimit } });
    }
    return tx.limitChangeRequest.update({
      where: { id },
      data: { status, adminMessage: String(data.adminMessage || (status === "APPROVED" ? "Novo limite aprovado." : "Alteracao de limite recusada.")), reviewedAt: new Date() }
    });
  });
  return NextResponse.json(result);
}
