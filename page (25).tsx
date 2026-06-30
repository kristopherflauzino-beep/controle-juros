import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requestCreateSchema } from "@/lib/validation";
import { fail, ok, parseBodyError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return fail(auth.error, auth.status);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;

  const where: any = {};
  if (status) where.status = status;
  if (auth.user.role === "CLIENT") where.clientId = auth.user.clientId;

  const requests = await prisma.request.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { client: true, agreement: true }
  });

  return ok({ requests });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "CLIENT");
  if ("error" in auth) return fail(auth.error, auth.status);
  if (!auth.user.clientId) return fail("Cliente não encontrado para este usuário.", 400);

  try {
    const data = requestCreateSchema.parse(await request.json());
    const loanRequest = await prisma.request.create({
      data: {
        clientId: auth.user.clientId,
        amount: data.amount,
        observation: data.observation || null,
        status: "PENDENTE"
      },
      include: { client: true }
    });

    return ok({ request: loanRequest }, 201);
  } catch (error) {
    return fail("Não foi possível criar solicitação.", 400, parseBodyError(error));
  }
}
