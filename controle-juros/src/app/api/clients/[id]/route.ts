import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { clientUpdateSchema } from "@/lib/validation";
import { fail, normalizeEmail, ok, parseBodyError } from "@/lib/http";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: any) {
  const auth = await requireAuth(request, "ADMIN");
  if ("error" in auth) return fail(auth.error, auth.status);

  try {
    const { id } = await context.params;
    const data = clientUpdateSchema.parse(await request.json());
    const current = await prisma.client.findUnique({ where: { id }, include: { user: true } });
    if (!current) return fail("Cliente não encontrado.", 404);

    const email = data.email ? normalizeEmail(data.email) : current.email;
    if (email !== current.email) {
      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) return fail("Já existe usuário com esse e-mail/login.", 409);
    }

    const passwordHash = data.password ? await bcrypt.hash(data.password, 12) : undefined;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: current.userId },
        data: {
          email,
          active: data.active ?? current.active,
          ...(passwordHash ? { passwordHash } : {})
        }
      });

      return tx.client.update({
        where: { id },
        data: {
          name: data.name ?? current.name,
          document: data.document === undefined ? current.document : data.document || null,
          phone: data.phone === undefined ? current.phone : data.phone || null,
          email,
          active: data.active ?? current.active
        },
        include: { user: { select: { email: true, active: true } } }
      });
    });

    return ok({ client: updated });
  } catch (error) {
    return fail("Não foi possível editar cliente.", 400, parseBodyError(error));
  }
}

export async function DELETE(request: NextRequest, context: any) {
  const auth = await requireAuth(request, "ADMIN");
  if ("error" in auth) return fail(auth.error, auth.status);

  const { id } = await context.params;
  const current = await prisma.client.findUnique({ where: { id } });
  if (!current) return fail("Cliente não encontrado.", 404);

  await prisma.client.delete({ where: { id } });
  return ok({ ok: true });
}
