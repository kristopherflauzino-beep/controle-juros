import { NextRequest, NextResponse } from "next/server";
import { getRequestSession } from "./auth";

export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
export async function requireSession(req: NextRequest, role?: "ADMIN" | "CLIENT") {
  const session = await getRequestSession(req);
  if (!session) return { error: fail("Não autenticado", 401) };
  if (role && session.role !== role) return { error: fail("Acesso negado", 403) };
  return { session };
}
export const asNumber = (value: unknown) => typeof value === "number" ? value : Number(value);
