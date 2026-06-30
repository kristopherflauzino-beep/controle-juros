import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "ADMIN");
  if ("error" in auth) return fail(auth.error, auth.status);

  return ok({
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    jwtConfigured: Boolean(process.env.JWT_SECRET),
    app: "Controle de Juros"
  });
}
