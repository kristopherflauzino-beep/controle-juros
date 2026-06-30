import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { clientSchema } from "@/lib/validation";
import { fail, normalizeEmail, ok, parseBodyError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "ADMIN");
  if ("error" in auth) return fail(auth.error, auth.status);

  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true, active: true } },
      _count: { select: { agreements: true, requests: true } }
    }
  });

  return ok({ clients });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "ADMIN");
  if ("error" in auth) return fail(auth.error, auth.status);

  try {
    const data = clientSchema.parse(await request.json());
    const email = normalizeEmail(data.email);

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return fail("Já existe usuário com esse e-mail/login.", 409);

    const passwordHash = await bcrypt.hash(data.password, 12);
    const client = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, role: "CLIENT", active: data.active }
      });

      return tx.client.create({
        data: {
          name: data.name,
          document: data.document || null,
          phone: data.phone || null,
          email,
          active: data.active,
          userId: user.id
        },
        include: { user: { select: { email: true, active: true } } }
      });
    });

    return ok({ client }, 201);
  } catch (error) {
    return fail("Não foi possível cadastrar cliente.", 400, parseBodyError(error));
  }
}
