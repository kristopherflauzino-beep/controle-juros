import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, requireSession } from "@/lib/api";

const schema = z.object({ name: z.string().trim().min(2), email: z.string().trim().min(3), password: z.string().min(6), document: z.string().optional(), phone: z.string().optional(), active: z.boolean().default(true), monthlyLimit: z.coerce.number().min(0).default(0) });
export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "ADMIN"); if (auth.error) return auth.error;
  const now = new Date(), monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const clients = await prisma.client.findMany({ include: { user: { select: { name: true, email: true, active: true } }, requests: { where: { status: { in: ["PENDING", "APPROVED"] }, createdAt: { gte: monthStart, lt: nextMonth } }, select: { amount: true } }, _count: { select: { agreements: true, requests: true } } }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(clients.map(({ requests, ...client }) => ({ ...client, monthlyUsed: requests.reduce((sum, request) => sum + Number(request.amount), 0) })));
}
export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "ADMIN"); if (auth.error) return auth.error;
  const parsed = schema.safeParse(await req.json()); if (!parsed.success) return fail("Dados invalidos. Informe nome, login e senha com ao menos 6 caracteres.");
  const { name, password, document, phone, active, monthlyLimit } = parsed.data;
  const login = parsed.data.email.toLowerCase();
  try {
    const client = await prisma.client.create({ data: { document: document || null, phone: phone || null, monthlyLimit, user: { create: { name, email: login, passwordHash: await hash(password, 12), role: "CLIENT", active } } }, include: { user: true } });
    return NextResponse.json(client, { status: 201 });
  } catch { return fail("Este login ja esta cadastrado", 409); }
}
