import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { fail, requireSession } from "@/lib/api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req, "ADMIN"); if (auth.error) return auth.error;
  const { id } = await params; const data = await req.json();
  if (!data.name || !data.email) return fail("Nome e login são obrigatórios");
  const client = await prisma.client.findUnique({ where: { id } }); if (!client) return fail("Cliente não encontrado", 404);
  await prisma.$transaction([
    prisma.client.update({ where: { id }, data: { document: data.document || null, phone: data.phone || null } }),
    prisma.user.update({ where: { id: client.userId }, data: { name: data.name, email: String(data.email).toLowerCase(), active: data.active !== false, ...(data.password ? { passwordHash: await hash(data.password, 12) } : {}) } })
  ]);
  return NextResponse.json({ ok: true });
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req, "ADMIN"); if (auth.error) return auth.error;
  const { id } = await params; const client = await prisma.client.findUnique({ where: { id } }); if (!client) return fail("Cliente não encontrado", 404);
  await prisma.user.delete({ where: { id: client.userId } }); return NextResponse.json({ ok: true });
}
