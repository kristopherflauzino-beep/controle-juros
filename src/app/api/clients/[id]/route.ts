import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { fail, requireSession } from "@/lib/api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req, "ADMIN"); if (auth.error) return auth.error;
  const { id } = await params; const data = await req.json();
  const login = String(data.email || "").trim().toLowerCase();
  if (!data.name || login.length < 3) return fail("Nome e login sao obrigatorios");
  if (data.password && String(data.password).length < 6) return fail("A senha deve ter ao menos 6 caracteres");
  const client = await prisma.client.findUnique({ where: { id } }); if (!client) return fail("Cliente nao encontrado", 404);
  try {
    await prisma.$transaction([
      prisma.client.update({ where: { id }, data: { document: data.document || null, phone: data.phone || null } }),
      prisma.user.update({ where: { id: client.userId }, data: { name: data.name, email: login, active: data.active !== false, ...(data.password ? { passwordHash: await hash(data.password, 12) } : {}) } })
    ]);
    return NextResponse.json({ ok: true });
  } catch { return fail("Este login ja esta cadastrado", 409); }
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req, "ADMIN"); if (auth.error) return auth.error;
  const { id } = await params; const client = await prisma.client.findUnique({ where: { id } }); if (!client) return fail("Cliente nao encontrado", 404);
  await prisma.user.delete({ where: { id: client.userId } }); return NextResponse.json({ ok: true });
}
