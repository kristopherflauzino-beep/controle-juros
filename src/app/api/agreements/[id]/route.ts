import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { asNumber, fail, requireSession } from "@/lib/api";
import { priceTable } from "@/lib/finance";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req, "ADMIN"); if (auth.error) return auth.error;
  const { id } = await params; const old = await prisma.agreement.findUnique({ where: { id } }); if (!old) return fail("Relatório não encontrado", 404);
  const d = await req.json();
  if (d.action === "start-interest") {
    if (!old.dailyInterestRate || Number(old.dailyInterestRate) <= 0) return fail("Defina uma taxa de juros diário antes de iniciar");
    if (old.dailyInterestStartedAt) return fail("O juros diário já foi iniciado");
    return NextResponse.json(await prisma.agreement.update({ where: { id }, data: { dailyInterestStartedAt: new Date() } }));
  }
  const amount = asNumber(d.originalAmount), count = asNumber(d.installmentCount), rate = asNumber(d.interestRate);
  if (!(amount > 0) || !(count >= 1) || rate < 0 || !d.dueDate) return fail("Dados financeiros inválidos");
  const calc = priceTable(amount, rate, count), due = new Date(d.dueDate);
  const result = await prisma.$transaction(async (tx: any) => {
    await tx.installment.deleteMany({ where: { agreementId: id } });
    return tx.agreement.update({ where: { id }, data: { originalAmount: amount, openAmount: asNumber(d.openAmount) > 0 ? asNumber(d.openAmount) : amount, installmentCount: count, interestRate: rate, installmentAmount: calc.payment, totalAmount: calc.total, dueDate: due, notes: d.notes || null, status: d.status, dailyInterestRate: asNumber(d.dailyInterestRate) || null, installments: { create: calc.rows.map((row, i) => ({ ...row, dueDate: new Date(due.getFullYear(), due.getMonth() + i, due.getDate()) })) } }, include: { installments: true } });
  });
  return NextResponse.json(result);
}
