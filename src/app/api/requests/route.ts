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
  const data = await req.json(); const amount = asNumber(data.amount), installmentCount = asNumber(data.installmentCount), interestRate = asNumber(data.interestRate);
  const firstDueDate = new Date(data.firstDueDate);
  if (!(amount > 0) || !(installmentCount >= 1) || interestRate < 0 || isNaN(firstDueDate.getTime())) return fail("Informe valor, parcelas, juros e primeiro vencimento validos");
  const client = await prisma.client.findUnique({ where: { userId: auth.session!.userId } }); if (!client) return fail("Cadastro de cliente não encontrado", 404);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const usage = await prisma.request.aggregate({
    where: { clientId: client.id, status: { in: ["PENDING", "APPROVED"] }, createdAt: { gte: monthStart, lt: nextMonth } },
    _sum: { amount: true }
  });
  const limit = Number(client.monthlyLimit), used = Number(usage._sum.amount || 0);
  if (limit > 0 && used + amount > limit) {
    return fail(`Limite mensal atingido. Limite: R$ ${limit.toFixed(2)}; utilizado: R$ ${used.toFixed(2)}.`);
  }
  return NextResponse.json(await prisma.request.create({ data: { clientId: client.id, amount, installmentCount, interestRate, firstDueDate, note: data.note || null } }), { status: 201 });
}
