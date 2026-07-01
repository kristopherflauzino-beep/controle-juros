import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/auth";
import { fail } from "@/lib/api";

const input = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(6) });
export async function GET() { return NextResponse.json({ required: (await prisma.user.count({ where: { role: "ADMIN" } })) === 0 }); }
export async function POST(req: NextRequest) {
  if (await prisma.user.count({ where: { role: "ADMIN" } })) return fail("O administrador já foi configurado", 409);
  const parsed = input.safeParse(await req.json());
  if (!parsed.success) return fail("Preencha nome, e-mail válido e senha com ao menos 6 caracteres");
  const user = await prisma.user.create({ data: { ...parsed.data, email: parsed.data.email.toLowerCase(), passwordHash: await hash(parsed.data.password, 12), role: "ADMIN" } });
  const token = await createToken({ userId: user.id, role: "ADMIN", name: user.name });
  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set("session", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 604800 });
  return res;
}
