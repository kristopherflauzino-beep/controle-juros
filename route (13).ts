import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    return ok({ hasAdmin: adminCount > 0 });
  } catch {
    return fail("Banco de dados indisponível. Verifique DATABASE_URL e migrations.", 500);
  }
}
