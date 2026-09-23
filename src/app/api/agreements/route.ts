import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { asNumber, fail, requireSession } from "@/lib/api";
import { flatProgressiveTable, monthlyDueDate } from "@/lib/finance";

const agreementNote = (notes: unknown) => {
  const current = String(notes || "").trim();
  return current ? `${current}\nAcordo` : "Acordo";
};

export async function GET(req: NextRequest) {
  const auth = await requireSession(req); if (auth.error) return auth.error;
  const where = auth.session!.role === "CLIENT" ? { client: { userId: auth.session!.userId } } : {};
  if (auth.session!.role === "CLIENT") {
    return NextResponse.json(await prisma.agreement.findMany({
      where,
      select: {
        id: true, clientId: true, originalAmount: true, openAmount: true,
        installmentCount: true, interestRate: true, installmentAmount: true,
        totalAmount: true, agreementDate: true, dueDate: true, status: true,
        notes: true, dailyInterestActive: true, dailyInterestRate: true,
        dailyInterestStartedAt: true, dailyInterestBaseAmount: true,
        client: { select: { user: { select: { name: true, email: true } } } },
        installments: { select: { id: true, number: true, amount: true, interest: true, amortization: true, balance: true, dueDate: true, paid: true }, orderBy: { number: "asc" } }
      },
      orderBy: { dueDate: "asc" }
    }));
  }
  return NextResponse.json(await prisma.agreement.findMany({ where, include: { client: { include: { user: { select: { name: true, email: true } } } }, installments: { orderBy: { number: "asc" } } }, orderBy: { dueDate: "asc" } }));
}
export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "ADMIN"); if (auth.error) return auth.error;
  const d = await req.json(), amount = asNumber(d.originalAmount), count = asNumber(d.installmentCount), rate = asNumber(d.interestRate);
  const dailyRate = d.dailyInterestRate === "" || d.dailyInterestRate == null ? null : asNumber(d.dailyInterestRate);
  if (!d.clientId || !(amount > 0) || !Number.isInteger(count) || !(count >= 1) || !Number.isFinite(rate) || rate < 0 || !d.dueDate) return fail("Cliente, valor, parcelas, taxa e vencimento válidos são obrigatórios");
  if (dailyRate !== null && (!Number.isFinite(dailyRate) || dailyRate < 0)) return fail("Informe uma taxa de juros diário válida");
  const calc = flatProgressiveTable(amount, rate, count); const due = new Date(`${d.dueDate}T12:00:00.000Z`); if (isNaN(due.getTime())) return fail("Vencimento inválido");
  try {
    const agreement = await prisma.$transaction(async tx => {
      if (d.requestId) await tx.request.update({ where: { id: d.requestId }, data: { status: "APPROVED" } });
      return tx.agreement.create({ data: { clientId: d.clientId, requestId: d.requestId || null, originalAmount: amount, openAmount: calc.total, installmentCount: count, interestRate: rate, installmentAmount: calc.payment, totalAmount: calc.total, agreementDate: d.agreementDate ? new Date(d.agreementDate) : new Date(), dueDate: due, notes: agreementNote(d.notes), dailyInterestActive: false, dailyInterestRate: dailyRate, dailyInterestStartedAt: null, dailyInterestBaseAmount: null, installments: { create: calc.rows.map((row, i) => ({ ...row, dueDate: monthlyDueDate(due, i) })) } }, include: { installments: true } });
    });
    return NextResponse.json(agreement, { status: 201 });
  } catch { return fail("Não foi possível criar o acordo. Verifique se a solicitação já foi convertida."); }
}
