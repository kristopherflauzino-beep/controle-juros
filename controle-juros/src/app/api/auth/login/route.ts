import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE, signSession } from "@/lib/auth";
import { fail, normalizeEmail, parseBodyError } from "@/lib/http";
import { loginSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const data = loginSchema.parse(await request.json());
    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(data.email) },
      include: { client: true }
    });

    if (!user || !user.active || (user.client && !user.client.active)) {
      return fail("Login ou senha inválidos.", 401);
    }

    const validPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!validPassword) return fail("Login ou senha inválidos.", 401);

    const token = signSession({
      id: user.id,
      email: user.email,
      role: user.role,
      clientId: user.client?.id ?? null
    });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, role: user.role, clientId: user.client?.id ?? null }
    });

    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8
    });

    return response;
  } catch (error) {
    return fail("Não foi possível fazer login.", 400, parseBodyError(error));
  }
}
