import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/auth";
import { fail } from "@/lib/api";

const input = z.object({ name: z.string().trim().min(2), identifier: z.string().trim().min(3), password: z.string().min(6) });

export async function POST(req: NextRequest) {
  const parsed = input.safeParse(await req.json());
  if (!parsed.success) return fail("Informe nome, usuario e uma senha com pelo menos 6 caracteres");
  const { name, password } = parsed.data;
  const identifier = parsed.data.identifier.toLowerCase();
  try {
    const user = await prisma.user.create({ data: { name, email: identifier, passwordHash: await hash(password, 12), role: "CLIENT", client: { create: {} } } });
    const token = await createToken({ userId: user.id, role: "CLIENT", name: user.name });
    const res = NextResponse.json({ ok: true, role: user.role }, { status: 201 });
    res.cookies.set("session", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 604800 });
    return res;
  } catch { return fail("Este login ja esta cadastrado", 409); }
}
