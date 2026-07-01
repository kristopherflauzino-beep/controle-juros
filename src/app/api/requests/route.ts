import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { asNumber, fail, requireSession } from "@/lib/api";
export async function GET(req: NextRequest) {
  const auth = await requireSession(req); if (auth.error) return auth.error;
  const where = auth.session!.role === "CLIENT" ? { client: { userId: auth.session!.userId } } : {};
  return NextResponse.json(await prisma.request.findMany({ where, include: { client: { include: { user: { select: { name: true, email: true } } } } }, orderBy: { createdAt: "desc" } }));
}
export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "CLIENT"); if (auth.error) return auth.error;
  const data = await req.json(); const amount = asNumber(data.amount); if (!(amount > 0)) return fail("Informe um valor maior que zero");
  const client = await prisma.client.findUnique({ where: { userId: auth.session!.userId } }); if (!client) return fail("Cadastro de cliente não encontrado", 404);
  return NextResponse.json(await prisma.request.create({ data: { clientId: client.id, amount, note: data.note || null } }), { status: 201 });
}
