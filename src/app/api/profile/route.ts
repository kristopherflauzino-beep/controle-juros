import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/auth";
import { fail, requireSession } from "@/lib/api";
export async function GET(req: NextRequest) {
  const auth = await requireSession(req); if (auth.error) return auth.error;
  const user = await prisma.user.findUnique({ where: { id: auth.session!.userId }, include: { client: true }, omit: { passwordHash: true } });
  return NextResponse.json(user);
}
export async function PATCH(req: NextRequest) {
  const auth = await requireSession(req); if (auth.error) return auth.error;
  const data = await req.json();
  const name = String(data.name || "").trim();
  const login = String(data.email || "").trim().toLowerCase();
  const password = String(data.password || "");
  if (name.length < 2 || login.length < 3) return fail("Informe nome e login validos");
  if (password && password.length < 6) return fail("A senha deve ter ao menos 6 caracteres");
  try {
    const user = await prisma.user.update({ where: { id: auth.session!.userId }, data: { name, email: login, ...(password ? { passwordHash: await hash(password, 12) } : {}) } });
    const token = await createToken({ userId: user.id, role: user.role, name: user.name });
    const res = NextResponse.json({ ok: true });
    res.cookies.set("session", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 604800 });
    return res;
  } catch { return fail("Este login ja esta cadastrado", 409); }
}
