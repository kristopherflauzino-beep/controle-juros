import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { adminSetupSchema } from "@/lib/validation";
import { fail, normalizeEmail, ok, parseBodyError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount > 0) return fail("O administrador inicial já foi cadastrado.", 409);

    const data = adminSetupSchema.parse(await request.json());
    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: normalizeEmail(data.email),
        passwordHash,
        role: "ADMIN",
        active: true
      },
      select: { id: true, email: true, role: true }
    });

    return ok({ user }, 201);
  } catch (error) {
    return fail("Não foi possível criar o administrador.", 400, parseBodyError(error));
  }
}
