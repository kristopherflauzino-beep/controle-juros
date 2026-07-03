import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { asNumber, fail, requireSession } from "@/lib/api";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req); if (auth.error) return auth.error;
  const where = auth.session!.role === "CLIENT" ? { client: { userId: auth.session!.userId } } : {};
  return NextResponse.json(await prisma.limitChangeRequest.findMany({
    where,
    include: { client: { include: { user: { select: { name: true, email: true } } } } },
    orderBy: { createdAt: "desc" }
  }));
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "CLIENT"); if (auth.error) return auth.error;
  const data = await req.json(), requestedLimit = asNumber(data.requestedLimit);
  if (!(requestedLimit >= 0)) return fail("Informe um limite mensal valido");
  const client = await prisma.client.findUnique({ where: { userId: auth.session!.userId } });
  if (!client) return fail("Cadastro de cliente nao encontrado", 404);
  return NextResponse.json(await prisma.limitChangeRequest.create({
    data: { clientId: client.id, currentLimit: client.monthlyLimit, requestedLimit }
  }), { status: 201 });
}
