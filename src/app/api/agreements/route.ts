import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { asNumber, fail, requireSession } from "@/lib/api";
import { priceTable } from "@/lib/finance";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req); if (auth.error) return auth.error;
  const where = auth.session!.role === "CLIENT" ? { client: { userId: auth.session!.userId } } : {};
  return NextResponse.json(await prisma.agreement.findMany({ where, include: { client: { include: { user: { select: { name: true, email: true } } } }, installments: { orderBy: { number: "asc" } } }, orderBy: { createdAt: "desc" } }));
}
export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "ADMIN"); if (auth.error) return auth.error;
  const d = await req.json(), amount = asNumber(d.originalAmount), count = asNumber(d.installmentCount), rate = asNumber(d.interestRate);
  if (!d.clientId || !(amount > 0) || !(count >= 1) || rate < 0 || !d.dueDate) return fail("Cliente, valor, parcelas, taxa e vencimento válidos são obrigatórios");
  const calc = priceTable(amount, rate, count); const due = new Date(d.dueDate); if (isNaN(due.getTime())) return fail("Vencimento inválido");
  try {
    const agreement = await prisma.$transaction(async tx => {
      if (d.requestId) await tx.request.update({ where: { id: d.requestId }, data: { status: "APPROVED" } });
      return tx.agreement.create({ data: { clientId: d.clientId, requestId: d.requestId || null, originalAmount: amount, openAmount: amount, installmentCount: count, interestRate: rate, installmentAmount: calc.payment, totalAmount: calc.total, agreementDate: d.agreementDate ? new Date(d.agreementDate) : new Date(), dueDate: due, notes: d.notes || null, dailyInterestRate: asNumber(d.dailyInterestRate) || null, installments: { create: calc.rows.map((row, i) => ({ ...row, dueDate: new Date(due.getFullYear(), due.getMonth() + i, due.getDate()) })) } }, include: { installments: true } });
    });
    return NextResponse.json(agreement, { status: 201 });
  } catch { return fail("Não foi possível criar o acordo. Verifique se a solicitação já foi convertida."); }
}
