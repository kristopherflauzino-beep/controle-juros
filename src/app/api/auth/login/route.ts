import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/auth";
import { fail } from "@/lib/api";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) return fail("Informe login e senha");
  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!user || !user.active || !(await compare(String(password), user.passwordHash))) return fail("Login ou senha inválidos", 401);
  const token = await createToken({ userId: user.id, role: user.role, name: user.name });
  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set("session", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 604800 });
  return res;
}
