import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const AUTH_COOKIE = "controle_juros_token";

export type SessionUser = {
  id: string;
  email: string;
  role: "ADMIN" | "CLIENT";
  clientId?: string | null;
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET não configurado.");
  }
  return "desenvolvimento-controle-juros-trocar-em-producao";
}

export function signSession(user: SessionUser): string {
  return jwt.sign(user, getJwtSecret(), { expiresIn: "8h" });
}

export function verifySession(token?: string): SessionUser | null {
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret()) as SessionUser;
  } catch {
    return null;
  }
}

export async function requireAuth(request: NextRequest, role?: "ADMIN" | "CLIENT") {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const decoded = verifySession(token);
  if (!decoded) {
    return { error: "Não autenticado.", status: 401 as const };
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    include: { client: true }
  });

  if (!user || !user.active || (user.client && !user.client.active)) {
    return { error: "Usuário inativo ou inexistente.", status: 401 as const };
  }

  if (role && user.role !== role) {
    return { error: "Acesso negado.", status: 403 as const };
  }

  const session: SessionUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    clientId: user.client?.id ?? null
  };

  return { user: session, dbUser: user };
}
