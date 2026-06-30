import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, requireSession } from "@/lib/api";

const schema = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(6), document: z.string().optional(), phone: z.string().optional(), active: z.boolean().default(true) });
export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "ADMIN"); if (auth.error) return auth.error;
  return NextResponse.json(await prisma.client.findMany({ include: { user: { select: { name: true, email: true, active: true } }, _count: { select: { agreements: true, requests: true } } }, orderBy: { createdAt: "desc" } }));
}
export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "ADMIN"); if (auth.error) return auth.error;
  const parsed = schema.safeParse(await req.json()); if (!parsed.success) return fail("Dados inválidos. A senha deve ter ao menos 6 caracteres.");
  const { name, email, password, document, phone, active } = parsed.data;
  try {
    const client = await prisma.client.create({ data: { document, phone, user: { create: { name, email: email.toLowerCase(), passwordHash: await hash(password, 12), role: "CLIENT", active } } }, include: { user: true } });
    return NextResponse.json(client, { status: 201 });
  } catch { return fail("Este login já está cadastrado", 409); }
}
